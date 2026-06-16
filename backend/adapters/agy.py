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
import os
import shutil
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

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(self.cwd),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=self.timeout)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            raise TimeoutError(f"AgyAdapter {self.timeout}s içinde cevap vermedi.")

        self.last_stdout = stdout.decode("utf-8", errors="replace")
        self.last_stderr = stderr.decode("utf-8", errors="replace")
        combined = self.last_stdout + "\n" + self.last_stderr
        transcript_text = await asyncio.to_thread(self._read_transcript_response)
        response_text = combined if SENTINEL_START in combined else transcript_text
        if proc.returncode != 0:
            if response_text and SENTINEL_START in response_text:
                data = extract_json_between_sentinels(response_text)
                return self._validate(data)
            raise RuntimeError(
                f"agy print başarısız oldu (exit={proc.returncode}). Çıktı:\n{combined[-2500:]}"
            )
        if not response_text:
            raise RuntimeError(
                "agy cevap metni bulunamadı: stdout boş/sentinel'siz ve transcript fallback "
                f"sonuç vermedi. cwd={self.cwd} app_data_dir={self.app_data_dir}"
            )
        data = extract_json_between_sentinels(response_text)
        return self._validate(data)

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
