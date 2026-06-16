"""HTTP chat-completions adapter - Hephaestus & Atlas.

API key'ler henüz yok; bu iskelet DeepSeek ve xAI'nin OpenAI-compatible chat
completions akışına göre tek MemberAdapter kontratını uygular.
"""

from __future__ import annotations

import asyncio
import json
import os
import urllib.error
import urllib.request

from schemas import MemberResponse, Role

from .base import Context, MemberAdapter, build_schema_member_prompt, extract_json_between_sentinels


class ApiAdapter(MemberAdapter):
    def __init__(
        self,
        role: Role,
        persona_name: str,
        provider: str,
        model: str | None = None,
        api_key: str | None = None,
        base_url: str | None = None,
        temperature: float | None = None,
        timeout: float | None = None,
    ):
        super().__init__(role, persona_name)
        self.provider = provider
        self.model = model or self._env_model(provider)
        self.api_key = api_key or self._env_key(provider)
        self.base_url = (base_url or self._env_base(provider)).rstrip("/")
        self.temperature = temperature if temperature is not None else self._default_temperature(role)
        self.timeout = timeout or float(os.environ.get("DIVAN_API_TIMEOUT", "120"))

    @staticmethod
    def _env_model(provider: str) -> str:
        if provider == "deepseek":
            return os.environ.get("MODEL_HEPHAESTUS", "deepseek-v4-flash")
        if provider == "xai":
            return os.environ.get("MODEL_ATLAS", "grok-4.1-fast")
        raise ValueError(f"Bilinmeyen provider: {provider}")

    @staticmethod
    def _env_key(provider: str) -> str | None:
        if provider == "deepseek":
            return os.environ.get("DEEPSEEK_API_KEY")
        if provider == "xai":
            return os.environ.get("XAI_API_KEY")
        raise ValueError(f"Bilinmeyen provider: {provider}")

    @staticmethod
    def _env_base(provider: str) -> str:
        if provider == "deepseek":
            return os.environ.get("DEEPSEEK_API_BASE", "https://api.deepseek.com/chat/completions")
        if provider == "xai":
            return os.environ.get("XAI_API_BASE", "https://api.x.ai/v1/chat/completions")
        raise ValueError(f"Bilinmeyen provider: {provider}")

    @staticmethod
    def _default_temperature(role: Role) -> float:
        return {"muhendis": 0.3, "realist": 0.4}.get(role, 0.3)

    async def ask(self, proposition: str, context: Context = None) -> MemberResponse:
        if not self.api_key:
            raise RuntimeError(f"{self.provider} API key eksik; .env içinde ayarla.")
        prompt = build_schema_member_prompt(self.persona, proposition, context)
        data = await asyncio.to_thread(self._post_chat_completion, prompt)
        return self._validate(data)

    def _post_chat_completion(self, prompt: str) -> dict:
        payload = {
            "model": self.model,
            "temperature": self.temperature,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": self.persona},
                {"role": "user", "content": prompt},
            ],
        }
        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            self.base_url,
            data=body,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"{self.provider} API HTTP {exc.code}: {detail}") from exc

        parsed = json.loads(raw)
        content = parsed["choices"][0]["message"]["content"].strip()
        if "===DIVAN_JSON_START===" in content:
            return extract_json_between_sentinels(content)
        return json.loads(content)


class DeepSeekAdapter(ApiAdapter):
    def __init__(self, **kwargs):
        super().__init__(role="muhendis", persona_name="hephaestus", provider="deepseek", **kwargs)


class XaiAdapter(ApiAdapter):
    def __init__(self, **kwargs):
        super().__init__(role="realist", persona_name="atlas", provider="xai", **kwargs)
