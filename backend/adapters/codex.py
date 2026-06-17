"""CodexAdapter - Socrates (CLAUDE.md §2.1 / §12).

Socrates, `codex exec` ile non-interactive çalışır. Prompt stdin'den verilir;
böylece tırnaklama/escape sorunları olmaz. `--output-schema` MemberResponse
şemasını zorlar, sentinel gerekmez.
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import tempfile
import uuid
from pathlib import Path

from schemas import MemberResponse, Role

from .base import (
    Context,
    MemberAdapter,
    build_schema_member_prompt,
    extract_json_between_sentinels,
)


class CodexAdapter(MemberAdapter):
    def __init__(
        self,
        role: Role = "supheci",
        persona_name: str = "socrates",
        model: str | None = None,
        bin_name: str | None = None,
        timeout: float | None = None,
        schema_path: str | Path | None = None,
    ):
        super().__init__(role, persona_name)
        self.bin_name = bin_name or os.environ.get("CODEX_BIN", "codex")
        self.model = model or os.environ.get("MODEL_SOCRATES")
        self.timeout = timeout or float(os.environ.get("DIVAN_CLI_TIMEOUT", "300"))
        self.schema_path = Path(schema_path) if schema_path else Path(__file__).resolve().parent.parent / "member_schema.json"

    def _resolve_cmd(self) -> str:
        exe = (
            shutil.which(self.bin_name + ".cmd")
            or shutil.which(self.bin_name + ".exe")
            or shutil.which(self.bin_name)
        )
        if not exe:
            raise FileNotFoundError(f"'{self.bin_name}' PATH'te bulunamadı.")
        return exe

    async def ask(self, proposition: str, context: Context = None) -> MemberResponse:
        prompt = build_schema_member_prompt(self.persona, proposition, context)
        output_path = Path(tempfile.gettempdir()) / f"divan_codex_{os.getpid()}_{uuid.uuid4().hex}.json"
        if output_path.exists():
            output_path.unlink()

        cmd = [
            self._resolve_cmd(),
            "exec",
            "--skip-git-repo-check",
            "--sandbox",
            "read-only",
            "--ephemeral",
            "--output-schema",
            str(self.schema_path),
            "--output-last-message",
            str(output_path),
        ]
        if self.model:
            cmd += ["--model", self.model]
        cmd.append("-")

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(prompt.encode("utf-8")), timeout=self.timeout
            )
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            raise TimeoutError(f"CodexAdapter {self.timeout}s içinde cevap vermedi.")

        self.last_stdout = stdout.decode("utf-8", errors="replace")
        self.last_stderr = stderr.decode("utf-8", errors="replace")
        if proc.returncode != 0:
            raise RuntimeError(
                "codex exec başarısız oldu "
                f"(exit={proc.returncode}). stderr:\n{self.last_stderr[-2000:]}"
            )
        if not output_path.exists():
            raise FileNotFoundError(
                f"Codex output dosyası oluşmadı: {output_path}\nstdout:\n{self.last_stdout[-2000:]}"
            )

        raw = output_path.read_text(encoding="utf-8")
        try:
            output_path.unlink()
        except OSError:
            pass
        # base._validate kullan: role-otoritesi + placeholder kontrolü uygulansın.
        return self._validate(json.loads(raw))

    async def ask_raw(self, prompt: str) -> dict:
        """Şema dayatmadan serbest JSON döndürür (Themis fazları için). Prompt
        sentinel talimatını içermeli; çıktı sentinel arasından çekilir."""
        output_path = Path(tempfile.gettempdir()) / f"divan_judge_{os.getpid()}_{uuid.uuid4().hex}.json"
        cmd = [
            self._resolve_cmd(), "exec",
            "--skip-git-repo-check", "--sandbox", "read-only", "--ephemeral",
            "--output-last-message", str(output_path),
        ]
        if self.model:
            cmd += ["--model", self.model]
        cmd.append("-")

        proc = await asyncio.create_subprocess_exec(
            *cmd, stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(prompt.encode("utf-8")), timeout=self.timeout
            )
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            raise TimeoutError(f"CodexAdapter(judge) {self.timeout}s içinde cevap vermedi.")

        self.last_stderr = stderr.decode("utf-8", errors="replace")
        if proc.returncode != 0 or not output_path.exists():
            raise RuntimeError(
                f"codex exec(judge) başarısız (exit={proc.returncode}). stderr:\n{self.last_stderr[-1500:]}"
            )
        text = output_path.read_text(encoding="utf-8")
        try:
            output_path.unlink()
        except OSError:
            pass
        try:
            return extract_json_between_sentinels(text)
        except Exception:
            t = text.strip().strip("`").strip()
            if t.startswith("json"):
                t = t[4:].strip()
            return json.loads(t)
