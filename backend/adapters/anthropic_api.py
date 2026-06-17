"""Anthropic Messages API adapter (Athena/Themis için API yolu).

Claude Code CLI yerine API key ile çalışmak isteyenler için. Messages API
formatı OpenAI'dan farklı: system ayrı alan, max_tokens zorunlu.
"""

from __future__ import annotations

import asyncio
import json
import os
import urllib.error
import urllib.request

from schemas import MemberResponse, Role

from .base import Context, MemberAdapter, build_schema_member_prompt, extract_json_between_sentinels

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"


class AnthropicApiAdapter(MemberAdapter):
    def __init__(
        self,
        role: Role,
        persona_name: str,
        model: str | None = None,
        api_key: str | None = None,
        temperature: float = 0.5,
        timeout: float | None = None,
    ):
        super().__init__(role, persona_name)
        self.model = model or os.environ.get("MODEL_ATHENA", "claude-opus-4-8")
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        self.temperature = temperature
        self.timeout = timeout or float(os.environ.get("DIVAN_API_TIMEOUT", "120"))

    async def ask(self, proposition: str, context: Context = None) -> MemberResponse:
        if not self.api_key:
            raise RuntimeError("Anthropic API key eksik; ayarlardan gir.")
        prompt = build_schema_member_prompt(self.persona, proposition, context)
        data = await asyncio.to_thread(self._post, prompt)
        return self._validate(data)

    async def ask_raw(self, prompt: str) -> dict:
        """Yargıç fazları için serbest JSON (şema/role dayatmadan)."""
        if not self.api_key:
            raise RuntimeError("Anthropic API key eksik; ayarlardan gir.")
        return await asyncio.to_thread(self._post, prompt)

    def _post(self, prompt: str) -> dict:
        payload = {
            "model": self.model,
            "max_tokens": 1500,
            "temperature": self.temperature,
            "messages": [{"role": "user", "content": prompt}],
        }
        req = urllib.request.Request(
            ANTHROPIC_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Anthropic API HTTP {exc.code}: {detail}") from exc

        parsed = json.loads(raw)
        content = "".join(
            block.get("text", "") for block in parsed.get("content", []) if block.get("type") == "text"
        ).strip()
        if "===DIVAN_JSON_START===" in content:
            return extract_json_between_sentinels(content)
        return json.loads(content.strip().strip("`").lstrip("json").strip())
