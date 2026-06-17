"""HTTP chat-completions adapter for Hephaestus via DeepSeek."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import urllib.error
import urllib.request

from schemas import MemberResponse, Role

from .base import Context, MemberAdapter, build_schema_member_prompt, extract_json_between_sentinels

logger = logging.getLogger("divan.backend")


def _raise_provider(provider: str):
    raise ValueError(f"Bilinmeyen provider: {provider}")


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
        return {
            "deepseek": os.environ.get("MODEL_HEPHAESTUS", "deepseek-v4"),
            "xai": os.environ.get("MODEL_ATLAS", "grok-4.1-fast"),
            "openai": os.environ.get("MODEL_SOCRATES_API", "gpt-5.5"),
        }.get(provider) or _raise_provider(provider)

    @staticmethod
    def _env_key(provider: str) -> str | None:
        keys = {"deepseek": "DEEPSEEK_API_KEY", "xai": "XAI_API_KEY", "openai": "OPENAI_API_KEY"}
        if provider not in keys:
            _raise_provider(provider)
        return os.environ.get(keys[provider])

    @staticmethod
    def _env_base(provider: str) -> str:
        bases = {
            "deepseek": ("DEEPSEEK_API_BASE", "https://api.deepseek.com/chat/completions"),
            "xai": ("XAI_API_BASE", "https://api.x.ai/v1/chat/completions"),
            "openai": ("OPENAI_API_BASE", "https://api.openai.com/v1/chat/completions"),
        }
        if provider not in bases:
            _raise_provider(provider)
        env, default = bases[provider]
        return os.environ.get(env, default)

    @staticmethod
    def _default_temperature(role: Role) -> float:
        return {"muhendis": 0.3, "realist": 0.4, "supheci": 0.3}.get(role, 0.4)

    async def ask(self, proposition: str, context: Context = None) -> MemberResponse:
        if not self.api_key:
            raise RuntimeError(f"{self.provider} API key eksik; .env icinde ayarla.")
        prompt = build_schema_member_prompt(self.persona, proposition, context)
        started_at = time.perf_counter()
        logger.info("adapter.call.start adapter=%s role=%s provider=%s model=%s", type(self).__name__, self.role, self.provider, self.model)
        try:
            data = await asyncio.to_thread(self._post_chat_completion, prompt)
        except Exception:
            logger.exception("adapter.call.error adapter=%s role=%s elapsed=%.1fs", type(self).__name__, self.role, time.perf_counter() - started_at)
            raise
        logger.info("adapter.call.done adapter=%s role=%s elapsed=%.1fs", type(self).__name__, self.role, time.perf_counter() - started_at)
        return self._validate(data)

    async def ask_raw(self, prompt: str) -> dict:
        """Yargıç fazları için serbest JSON (şema/role dayatmadan)."""
        if not self.api_key:
            raise RuntimeError(f"{self.provider} API key eksik; ayarlardan gir.")
        return await asyncio.to_thread(self._post_chat_completion, prompt)

    def _post_chat_completion(self, prompt: str) -> dict:
        payload = {
            "model": self.model,
            "temperature": self.temperature,
            "response_format": {"type": "json_object"},
            "messages": [
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


class OpenAiAdapter(ApiAdapter):
    """OpenAI Chat Completions (Socrates'in API yolu — Codex CLI yerine)."""

    def __init__(self, **kwargs):
        super().__init__(role="supheci", persona_name="socrates", provider="openai", **kwargs)
