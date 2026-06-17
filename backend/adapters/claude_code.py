"""ClaudeCodeAdapter — Athena & Themis (CLAUDE.md §2.1).

Claude tarafı `-p` headless DEĞİL (token havuzunu patlatıyor); interaktif
Claude Code oturumu ConPTY ile sürülür. Windows'ta pexpect pty yok, bu yüzden
pywinpty (ConPTY). Faz 2'de aynı oturum açık kalır → bağlamı taşır, --resume
gerekmez.

Probe ile doğrulanmış mekanik:
  - Cevap, kelime aralarını yatay imleç hareketiyle render eder → strip_ansi
    bunları boşluğa çevirir (base.py).
  - Prompt echo'su da sentinel'leri içerir; cevap geldiğini END sayısının
    taban+2'ye (echo + cevap) ulaşmasından anlarız, sonra SON çifti çekeriz.
"""

from __future__ import annotations

import asyncio
import os
import shutil
import threading
import time

from winpty import PtyProcess

from .base import (
    SENTINEL_END,
    Context,
    MemberAdapter,
    build_member_prompt,
    extract_json_between_sentinels,
    strip_ansi,
)
from schemas import MemberResponse, Role


class ClaudeCodeAdapter(MemberAdapter):
    def __init__(
        self,
        role: Role,
        persona_name: str,
        model: str | None = None,
        bin_name: str | None = None,
        timeout: float | None = None,
    ):
        super().__init__(role, persona_name)
        self.bin_name = bin_name or os.environ.get("CLAUDE_CODE_BIN", "claude")
        self.model = model
        self.timeout = timeout or float(os.environ.get("DIVAN_PTY_TIMEOUT", "120"))
        self._proc: PtyProcess | None = None
        self._chunks: list[str] = []
        self._lock = threading.Lock()
        self._reader: threading.Thread | None = None
        self._stop = threading.Event()

    # --- ConPTY oturum yönetimi -------------------------------------------
    def _resolve_cmd(self) -> list[str]:
        """bin_name'i Windows'ta çalıştırılabilir .cmd shim'e çöz."""
        exe = shutil.which(self.bin_name + ".cmd") or shutil.which(self.bin_name)
        if not exe:
            raise FileNotFoundError(f"'{self.bin_name}' PATH'te bulunamadı.")
        cmd = [exe]
        if self.model:
            cmd += ["--model", self.model]
        return cmd

    def _read_loop(self) -> None:
        while not self._stop.is_set():
            try:
                data = self._proc.read(4096)  # bloklar; thread'de güvenli
            except (EOFError, OSError):
                return
            except Exception:
                return
            if data:
                with self._lock:
                    self._chunks.append(data)

    def _buffer(self) -> str:
        with self._lock:
            return "".join(self._chunks)

    def start(self) -> None:
        cmd = self._resolve_cmd()
        # Geniş terminal: uzun JSON satırının kaydırma sıklığını azaltır
        # (kalan kaydırmaları base.py zaten boşluğa çökertir).
        self._proc = PtyProcess.spawn(cmd, dimensions=(50, 400))
        self._stop.clear()
        self._reader = threading.Thread(target=self._read_loop, daemon=True)
        self._reader.start()
        self._wait_ready()

    def _wait_ready(self, timeout: float = 25) -> None:
        """Hazır input kutusu (`>`) görünene kadar bekle."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            if ">" in strip_ansi(self._buffer()):
                time.sleep(0.5)  # tam yerleşsin
                return
            time.sleep(0.3)
        raise TimeoutError("Claude Code hazır prompt'u görünmedi (startup).")

    def _send_and_collect(self, prompt: str) -> dict:
        base_end = strip_ansi(self._buffer()).count(SENTINEL_END)
        target = base_end + 2  # prompt echo'su + asıl cevap
        # bracketed-paste: çok satırlı prompt tek parça gönderilir, sonra submit
        self._proc.write("\x1b[200~" + prompt + "\x1b[201~")
        time.sleep(0.6)
        self._proc.write("\r")

        deadline = time.time() + self.timeout
        while time.time() < deadline:
            cleaned = strip_ansi(self._buffer())
            rate_limit_message = self._rate_limit_message(cleaned)
            if rate_limit_message:
                self.last_raw = self._buffer()
                raise RuntimeError(rate_limit_message)
            if cleaned.count(SENTINEL_END) >= target:
                time.sleep(0.4)  # son chunk'lar da insin
                break
            time.sleep(0.4)
        self.last_raw = self._buffer()
        rate_limit_message = self._rate_limit_message(strip_ansi(self.last_raw))
        if rate_limit_message:
            raise RuntimeError(rate_limit_message)
        return extract_json_between_sentinels(self.last_raw)

    @staticmethod
    def _rate_limit_message(cleaned: str) -> str | None:
        lower = cleaned.lower()
        signals = (
            "hit your session limit",
            "/rate-limit-options",
            "weekly limit",          # "You've used 81% of your weekly limit"
            "usage limit",
            "approaching your",
        )
        if not any(sig in lower for sig in signals):
            return None
        reset = None
        marker = "resets "
        idx = lower.find(marker)
        if idx != -1:
            reset = cleaned[idx + len(marker):].splitlines()[0].strip()
        suffix = f" Reset: {reset}" if reset else ""
        return f"Claude Code limitine ulaşıldı (Athena yanıt veremiyor).{suffix}"

    def close(self) -> None:
        self._stop.set()
        if self._proc is not None:
            try:
                self._proc.terminate(force=True)
            except Exception:
                pass
            self._proc = None

    # --- Kontrat ----------------------------------------------------------
    async def ask(
        self, proposition: str, context: Context = None
    ) -> MemberResponse:
        prompt = build_member_prompt(self.persona, proposition, context)
        if self._proc is None:
            await asyncio.to_thread(self.start)
        data = await asyncio.to_thread(self._send_and_collect, prompt)
        return self._validate(data)

    async def ask_raw(self, prompt: str) -> dict:
        """Üye kontratını baypas eder: verilen prompt'u aynen gönderir, sentinel
        arası JSON'ı dict olarak döndürür. Themis (yargıç) fazları için —
        prompt sentinel talimatını kendisi içermeli."""
        if self._proc is None:
            await asyncio.to_thread(self.start)
        return await asyncio.to_thread(self._send_and_collect, prompt)
