"""Local Ollama adapter for Atlas.

Atlas is the realist voice. For the local setup we run it through Ollama and
unload the model after the full Divan run by calling ``ollama stop <model>`` in
``close()``. That keeps Gemma from squatting in RAM after the case is done.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import subprocess
import time
import urllib.error
import urllib.request

from schemas import MemberResponse

from .base import Context, MemberAdapter, build_schema_member_prompt, extract_json_between_sentinels

logger = logging.getLogger("divan.backend")


class OllamaAdapter(MemberAdapter):
    """Yerel Ollama runtime — herhangi bir role için. Akış bitince modeli
    RAM'den boşaltmak üzere close()'da `ollama stop <model>` çağırır."""

    def __init__(
        self,
        role: str = "realist",
        persona_name: str = "atlas",
        model: str | None = None,
        base_url: str | None = None,
        temperature: float | None = None,
        timeout: float | None = None,
        ollama_bin: str | None = None,
        unload_after_run: bool | None = None,
    ):
        super().__init__(role=role, persona_name=persona_name)
        self.model = model or os.environ.get("MODEL_ATLAS", "gemma4:12b")
        self.base_url = (base_url or os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")).rstrip("/")
        self.temperature = temperature if temperature is not None else float(os.environ.get("OLLAMA_TEMPERATURE_ATLAS", "0.4"))
        self.timeout = timeout or float(os.environ.get("OLLAMA_TIMEOUT", "240"))
        self.ollama_bin = ollama_bin or os.environ.get("OLLAMA_BIN", "ollama")
        self.unload_after_run = (
            unload_after_run
            if unload_after_run is not None
            else os.environ.get("OLLAMA_STOP_AFTER_RUN", "1").strip().lower() in {"1", "true", "yes", "on"}
        )

    async def ask(self, proposition: str, context: Context = None) -> MemberResponse:
        prompt = build_schema_member_prompt(self.persona, proposition, context)
        started_at = time.perf_counter()
        logger.info("adapter.call.start adapter=OllamaAtlasAdapter role=%s model=%s", self.role, self.model)
        try:
            data = await asyncio.to_thread(self._post_chat, prompt)
        except Exception:
            logger.exception("adapter.call.error adapter=OllamaAtlasAdapter role=%s elapsed=%.1fs", self.role, time.perf_counter() - started_at)
            raise
        logger.info("adapter.call.done adapter=OllamaAtlasAdapter role=%s elapsed=%.1fs", self.role, time.perf_counter() - started_at)
        return self._validate(data)

    async def ask_raw(self, prompt: str) -> dict:
        """Yargıç fazları için serbest JSON (şema/role dayatmadan)."""
        return await asyncio.to_thread(self._post_chat, prompt)

    def close(self) -> None:
        if not self.unload_after_run:
            return
        cmd = shutil.which(self.ollama_bin) or self.ollama_bin
        try:
            result = subprocess.run(
                [cmd, "stop", self.model],
                capture_output=True,
                text=True,
                timeout=20,
                check=False,
            )
            logger.info("adapter.cleanup adapter=OllamaAtlasAdapter action=ollama_stop model=%s exit=%s", self.model, result.returncode)
        except Exception:
            logger.exception("adapter.cleanup.error adapter=OllamaAtlasAdapter action=ollama_stop model=%s", self.model)
            # Cleanup is best-effort; the trial result is already produced.
            return

    def _post_chat(self, prompt: str) -> dict:
        payload = {
            "model": self.model,
            "stream": False,
            "format": "json",
            "options": {"temperature": self.temperature},
            "messages": [
                {"role": "user", "content": prompt},
            ],
        }
        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{self.base_url}/api/chat",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read().decode("utf-8")
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Ollama Atlas baglantisi kurulamadi: {exc}") from exc

        parsed = json.loads(raw)
        content = parsed.get("message", {}).get("content", "").strip()
        if not content:
            raise RuntimeError(f"Ollama Atlas bos cevap verdi: {raw[:400]}")
        if "===DIVAN_JSON_START===" in content:
            return extract_json_between_sentinels(content)
        return json.loads(content)


class OllamaAtlasAdapter(OllamaAdapter):
    """Geriye uyumluluk: Atlas için varsayılan Ollama adapter'ı."""

    def __init__(self, **kwargs):
        kwargs.setdefault("role", "realist")
        kwargs.setdefault("persona_name", "atlas")
        super().__init__(**kwargs)
