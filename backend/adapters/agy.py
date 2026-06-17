"""AgyAdapter - Apollo (CLAUDE.md §2.1 / §12).

`agy --help` içinde JSON output flag'i yok; bu yüzden print modda sentinel'li
prompt kullanıp stdout/stderr karışımından JSON'ı sentinel ile çekeriz.

Not: agy `--print` gerçek TTY yokken bazen cevabı stdout'a yazmıyor (issue
#76/#115 davranışı). Exit 0 dönebilir ama stdout boş kalır. Bu durumda agy'nin
kendi transcript dosyasından son sentinel'li PLANNER_RESPONSE içeriğini okuruz.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import subprocess
import time
from pathlib import Path

from schemas import MemberResponse, Role

from .base import (
    SENTINEL_START,
    Context,
    MemberAdapter,
    build_member_prompt,
    extract_json_between_sentinels,
)

logger = logging.getLogger("divan.backend")

# Tüm agy çağrıları aynı stabil cwd'de koşar (transcript fallback kayıtlı dizin ister).
# Eşzamanlı çalışırlarsa agy'nin cwd→conversation_id eşlemesi (last_conversations.json)
# yarışır → yanlış/boş transcript. Bu global kilit agy çağrılarını seri yapar.
_AGY_LOCK = asyncio.Lock()


class AgyAdapter(MemberAdapter):
    def __init__(
        self,
        role: Role = "yaratici",
        persona_name: str = "apollo",
        model: str | None = None,
        bin_name: str | None = None,
        timeout: float | None = None,
        cwd: str | Path | None = None,
        app_data_dir: str | Path | None = None,
    ):
        super().__init__(role, persona_name)
        self.bin_name = bin_name or os.environ.get("AGY_BIN", "agy")
        self.model = model or os.environ.get("MODEL_APOLLO")
        self.timeout = timeout or float(os.environ.get("DIVAN_CLI_TIMEOUT", "300"))
        self.cwd = Path(cwd or os.environ.get("DIVAN_AGY_CWD") or Path.cwd()).resolve()
        self.app_data_dir = Path(
            app_data_dir
            or os.environ.get("DIVAN_AGY_APP_DATA_DIR")
            or Path.home() / ".gemini" / "antigravity-cli"
        )
        self.transcript_poll_seconds = float(os.environ.get("DIVAN_AGY_TRANSCRIPT_POLL", "5"))
        # Süreç çalışırken transcript'i bu aralıkla yokla (bilinen no-exit bug'ı için).
        self.poll_interval = float(os.environ.get("DIVAN_AGY_POLL", "2"))

    def _resolve_cmd(self) -> str:
        exe = (
            shutil.which(self.bin_name + ".exe")
            or shutil.which(self.bin_name + ".cmd")
            or shutil.which(self.bin_name)
        )
        if not exe:
            raise FileNotFoundError(f"'{self.bin_name}' PATH'te bulunamadı.")
        return exe

    async def ask(self, proposition: str, context: Context = None) -> MemberResponse:
        prompt = build_member_prompt(self.persona, proposition, context)
        prompt += (
            "\n\n## AGY ICIN EK KISIT\n"
            "Cok kisa cevap ver. stance tek kisa cumle olsun. "
            "reasons tam 3 madde olsun ve her madde en fazla 14 kelime olsun. "
            "flip_condition tek kisa cumle olsun. JSON disina hicbir sey yazma."
        )
        text = await self._run_agy(prompt)
        return self._validate(extract_json_between_sentinels(text))

    async def ask_raw(self, prompt: str) -> dict:
        """Yargıç fazları için: verilen prompt'u aynen koştur, sentinel JSON döndür."""
        text = await self._run_agy(prompt)
        return extract_json_between_sentinels(text)

    async def _run_agy(self, prompt: str) -> str:
        # Seri çalış: aynı anda iki agy → cwd→id eşlemesi yarışır (single-gemini fix).
        async with _AGY_LOCK:
            return await self._run_agy_locked(prompt)

    async def _run_agy_locked(self, prompt: str) -> str:
        log_path = self.cwd / ".divan" / "agy.log"
        log_path.parent.mkdir(parents=True, exist_ok=True)
        cmd = [
            self._resolve_cmd(),
            "--log-file",
            str(log_path),
            "--print",
            prompt,
            "--print-timeout",
            f"{int(self.timeout)}s",
        ]
        if self.model:
            cmd += ["--model", self.model]

        started_at = time.perf_counter()
        logger.info(
            "adapter.call.start adapter=AgyAdapter role=%s model=%r cwd=%s timeout=%s",
            self.role,
            self.model,
            self.cwd,
            self.timeout,
        )
        # ÖNEMLİ: agy'yi asyncio.create_subprocess_exec ile DEĞİL, thread içinde senkron
        # subprocess.run ile koştur. Windows ProactorEventLoop'un overlapped pipe'ları agy
        # ile takılıyor: süreç bitse bile stdout EOF gelmiyor → "no-exit" gibi 300s asılma.
        # Senkron subprocess.run aynı promptta ~8s'de temiz çıkıyor (kanıtlandı). Kilit
        # zaten seri çalıştırdığı için thread güvenli.
        try:
            result = await asyncio.to_thread(self._spawn_blocking, cmd)
        except subprocess.TimeoutExpired:
            logger.error(
                "adapter.call.timeout adapter=AgyAdapter role=%s elapsed=%.1fs",
                self.role,
                time.perf_counter() - started_at,
            )
            raise TimeoutError(f"AgyAdapter {self.timeout}s içinde cevap vermedi.")

        self.last_stdout = (result.stdout or b"").decode("utf-8", errors="replace")
        self.last_stderr = (result.stderr or b"").decode("utf-8", errors="replace")
        returncode = result.returncode
        logger.info(
            "adapter.call.return adapter=AgyAdapter role=%s exit=%s elapsed=%.1fs stdout_chars=%s stderr_chars=%s",
            self.role,
            returncode,
            time.perf_counter() - started_at,
            len(self.last_stdout),
            len(self.last_stderr),
        )

        # Öncelik: stdout/stderr'deki sentinel → transcript fallback (agy stdout bug'ı).
        combined = self.last_stdout + "\n" + self.last_stderr
        if SENTINEL_START in combined:
            return combined
        transcript_text = await asyncio.to_thread(self._read_transcript_response)
        logger.info(
            "adapter.transcript adapter=AgyAdapter role=%s found=%s",
            self.role,
            bool(transcript_text and SENTINEL_START in transcript_text),
        )
        if transcript_text and SENTINEL_START in transcript_text:
            return transcript_text
        if returncode not in (0, None):
            raise RuntimeError(
                f"agy print başarısız oldu (exit={returncode}). Çıktı:\n{combined[-2500:]}"
            )
        raise RuntimeError(
            "agy cevap metni bulunamadı: stdout boş/sentinel'siz ve transcript fallback "
            f"sonuç vermedi. cwd={self.cwd} app_data_dir={self.app_data_dir}"
        )

    def _spawn_blocking(self, cmd: list[str]) -> "subprocess.CompletedProcess[bytes]":
        """Senkron Popen (thread içinde çağrılır). Timeout olursa TÜM süreç ağacını öldür:
        agy node tabanlı, `proc.kill()` sadece parent'ı öldürür, node çocukları zombi kalıp
        agy'nin global durumunu (`~/.gemini`) kilitler → sonraki agy'ler de takılır."""
        creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        # stdin=DEVNULL KRİTİK: agy interaktif bir CLI. stdin verilmezse parent'ın
        # stdin'ini miras alır. Electron backend'i `shell: true` ile başlattığı için
        # uvicorn'un stdin'i tuhaf/açık bir handle → agy onu okumaya çalışıp 300s asılır.
        # (Aynı kod terminalden çalışırken stdin normal olduğu için sorunsuzdu.)
        # DEVNULL → agy anında EOF görür, beklemez.
        proc = subprocess.Popen(
            cmd,
            cwd=str(self.cwd),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=creationflags,
        )
        try:
            stdout, stderr = proc.communicate(timeout=self.timeout)
            return subprocess.CompletedProcess(cmd, proc.returncode, stdout, stderr)
        except subprocess.TimeoutExpired:
            self._kill_tree(proc.pid)
            try:
                proc.communicate(timeout=5)
            except Exception:  # noqa: BLE001
                pass
            raise

    @staticmethod
    def _kill_tree(pid: int) -> None:
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        try:
            if os.name == "nt":
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(pid)],
                    capture_output=True,
                    creationflags=flags,
                )
            else:
                os.killpg(os.getpgid(pid), 9)
        except Exception:  # noqa: BLE001
            pass

    def _read_transcript_response(self) -> str | None:
        deadline = time.time() + self.transcript_poll_seconds
        while time.time() <= deadline:
            text = self._read_transcript_response_once()
            if text and SENTINEL_START in text:
                return text
            time.sleep(0.25)
        return None

    def _read_transcript_response_once(self) -> str | None:
        conversation_id = self._conversation_id_for_cwd()
        if not conversation_id:
            return None

        brain_dir = self.app_data_dir / "brain" / conversation_id
        transcript = brain_dir / ".system_generated" / "logs" / "transcript.jsonl"
        if not transcript.exists():
            matches = list(brain_dir.rglob("transcript.jsonl"))
            if not matches:
                return None
            transcript = max(matches, key=lambda path: path.stat().st_mtime)

        try:
            lines = transcript.read_text(encoding="utf-8").splitlines()
        except OSError:
            return None

        for line in reversed(lines):
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if event.get("type") != "PLANNER_RESPONSE":
                continue
            content = self._content_to_text(event.get("content"))
            if content and SENTINEL_START in content:
                return content
        return None

    def _conversation_id_for_cwd(self) -> str | None:
        path = self.app_data_dir / "cache" / "last_conversations.json"
        try:
            conversations = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None

        cwd_key = self._normalize_path(self.cwd)
        for raw_path, conversation_id in conversations.items():
            if self._normalize_path(Path(raw_path)) == cwd_key:
                return str(conversation_id)
        return None

    @staticmethod
    def _normalize_path(path: Path) -> str:
        return os.path.normcase(os.path.abspath(str(path)))

    @staticmethod
    def _content_to_text(content: object) -> str:
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, str):
                    parts.append(item)
                elif isinstance(item, dict):
                    text = item.get("text") or item.get("content")
                    if isinstance(text, str):
                        parts.append(text)
            return "\n".join(parts)
        if isinstance(content, dict):
            text = content.get("text") or content.get("content")
            if isinstance(text, str):
                return text
        return ""
