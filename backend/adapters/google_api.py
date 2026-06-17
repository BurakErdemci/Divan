"""Google Gemini API adapter (Apollo için API yolu).

agy (Antigravity CLI) yerine API key ile çalışmak isteyenler için. Gemini
generateContent formatı: contents + generationConfig.
"""

from __future__ import annotations

import asyncio
import json
import os
import urllib.error
import urllib.request

from schemas import MemberResponse, Role

from .base import Context, MemberAdapter, build_schema_member_prompt, extract_json_between_sentinels

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


class GoogleApiAdapter(MemberAdapter):
    def __init__(
        self,
        role: Role,
        persona_name: str,
        model: str | None = None,
        api_key: str | None = None,
        temperature: float = 0.9,
        timeout: float | None = None,
    ):
        super().__init__(role, persona_name)
        self.model = model or os.environ.get("MODEL_APOLLO", "gemini-3.5-flash")
        self.api_key = api_key or os.environ.get("GOOGLE_API_KEY")
        self.temperature = temperature
        self.timeout = timeout or float(os.environ.get("DIVAN_API_TIMEOUT", "120"))

    async def ask(self, proposition: str, context: Context = None) -> MemberResponse:
        if not self.api_key:
            raise RuntimeError("Google API key eksik; ayarlardan gir.")
        prompt = build_schema_member_prompt(self.persona, proposition, context)
        data = await asyncio.to_thread(self._post, prompt)
        return self._validate(data)

    async def ask_raw(self, prompt: str) -> dict:
        """Yargıç fazları için serbest JSON (şema/role dayatmadan)."""
        if not self.api_key:
            raise RuntimeError("Google API key eksik; ayarlardan gir.")
        return await asyncio.to_thread(self._post, prompt)

    def _post(self, prompt: str) -> dict:
        url = f"{GEMINI_BASE}/{self.model}:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": self.temperature,
                "responseMimeType": "application/json",
            },
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Google API HTTP {exc.code}: {detail}") from exc

        parsed = json.loads(raw)
        content = "".join(
            part.get("text", "")
            for part in parsed.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        ).strip()
        if "===DIVAN_JSON_START===" in content:
            return extract_json_between_sentinels(content)
        return json.loads(content.strip().strip("`").lstrip("json").strip())
