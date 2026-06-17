"""Provider/model registry + dinamik üye fabrikası + settings.json deposu.

Ayarlar sekmesi (CLAUDE.md §16) buraya dayanır. Kullanıcı her karakter için
provider+model+backend (cli/api/local) seçer; bu modül seçimi doğru adapter'a
çevirir. Tek/çoklu provider modu da burada çözülür.
"""

from __future__ import annotations

import json
from pathlib import Path

from adapters.agy import AgyAdapter
from adapters.anthropic_api import AnthropicApiAdapter
from adapters.api import ApiAdapter
from adapters.base import MemberAdapter
from adapters.claude_code import ClaudeCodeAdapter
from adapters.codex import CodexAdapter
from adapters.google_api import GoogleApiAdapter
from adapters.ollama import OllamaAdapter

# --- Kayıt defteri (frontend dropdown'ları bununla beslenir) ----------------
PROVIDERS: dict[str, dict] = {
    "anthropic": {"label": "Anthropic (Claude)", "backends": ["cli", "api"], "key": "anthropic",
                  "models": ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"]},
    "openai":    {"label": "OpenAI (GPT)", "backends": ["cli", "api"], "key": "openai",
                  "models": ["gpt-5.5", "gpt-5", "o4"]},
    "google":    {"label": "Google (Gemini)", "backends": ["cli", "api"], "key": "google",
                  # CLI (agy): 3.5-flash / 3.1-pro. API'de daha fazlası var;
                  # 3.1-flash-lite en yüksek RPD'li (ücretsiz kota) → API testleri için ideal.
                  "models": ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3.1-pro",
                             "gemini-3-flash", "gemini-2.5-flash"]},
    "deepseek":  {"label": "DeepSeek", "backends": ["api"], "key": "deepseek",
                  "models": ["deepseek-v4", "deepseek-r1"]},
    "xai":       {"label": "xAI (Grok)", "backends": ["api"], "key": "xai",
                  "models": ["grok-4.1", "grok-4.1-fast"]},
    "ollama":    {"label": "Ollama (yerel)", "backends": ["local"], "key": None,
                  "models": ["gemma4:12b", "qwen3", "llama4", "deepseek-r1"]},
}

# Üye id -> meclis rolü (themis hariç; o yargıç).
MEMBER_ROLE: dict[str, str] = {
    "athena": "stratejist", "socrates": "supheci", "apollo": "yaratici",
    "hephaestus": "muhendis", "atlas": "realist",
}
MEMBER_IDS = list(MEMBER_ROLE.keys())
ROLE_TEMP = {"stratejist": 0.5, "supheci": 0.3, "yaratici": 0.9, "muhendis": 0.3, "realist": 0.4}

# CLI backend'i olan provider'ın CLI adapter sınıfı.
_CLI = {"anthropic": ClaudeCodeAdapter, "openai": CodexAdapter, "google": AgyAdapter}

# --- Varsayılan ayarlar -----------------------------------------------------
def default_settings() -> dict:
    return {
        "mode": "multi",
        "language": "tr",
        "single_provider": "google",
        "single_model": "gemini-3.5-flash",
        "single_backend": "cli",
        "members": {
            "athena":     {"provider": "anthropic", "model": "claude-opus-4-8",   "backend": "cli",   "enabled": True},
            "socrates":   {"provider": "openai",    "model": "gpt-5.5",            "backend": "cli",   "enabled": True},
            "apollo":     {"provider": "google",    "model": "gemini-3.5-flash",   "backend": "cli",   "enabled": True},
            "hephaestus": {"provider": "deepseek",  "model": "deepseek-v4",        "backend": "api",   "enabled": True},
            "atlas":      {"provider": "ollama",    "model": "gemma4:12b",         "backend": "local", "enabled": True},
            # themis = yargıç, her zaman aktif (enabled toggle'ı yok).
            "themis":     {"provider": "openai",    "model": "gpt-5.5",            "backend": "cli",   "enabled": True},
        },
        "api_keys": {"anthropic": "", "openai": "", "google": "", "deepseek": "", "xai": ""},
    }


# --- settings.json deposu ---------------------------------------------------
_SETTINGS_PATH = Path(__file__).resolve().parent / ".divan" / "settings.json"


def load_settings() -> dict:
    if _SETTINGS_PATH.exists():
        try:
            data = json.loads(_SETTINGS_PATH.read_text(encoding="utf-8"))
            return _merge_defaults(data)
        except (json.JSONDecodeError, OSError):
            pass
    return default_settings()


def save_settings(data: dict) -> dict:
    merged = _merge_defaults(data)
    _SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    _SETTINGS_PATH.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    return merged


def _merge_defaults(data: dict) -> dict:
    base = default_settings()
    base["mode"] = data.get("mode", base["mode"])
    base["language"] = data.get("language", base["language"])
    base["single_provider"] = data.get("single_provider", base["single_provider"])
    base["single_model"] = data.get("single_model", base["single_model"])
    base["single_backend"] = data.get("single_backend", base["single_backend"])
    for mid, cfg in (data.get("members") or {}).items():
        if mid in base["members"] and isinstance(cfg, dict):
            base["members"][mid].update({k: cfg[k] for k in ("provider", "model", "backend") if k in cfg})
            if "enabled" in cfg:
                base["members"][mid]["enabled"] = bool(cfg["enabled"])
    base["members"]["themis"]["enabled"] = True  # yargıç hep açık
    for k, v in (data.get("api_keys") or {}).items():
        if k in base["api_keys"]:
            base["api_keys"][k] = v or ""
    return base


# --- Üye/yargıç inşası ------------------------------------------------------
def _effective_cfg(member_id: str, settings: dict) -> dict:
    """single modda tüm üyeler tek provider'dan; aksi halde member config."""
    if settings.get("mode") == "single":
        prov = settings.get("single_provider", "google")
        spec = PROVIDERS[prov]
        backend = settings.get("single_backend") or spec["backends"][0]
        if backend not in spec["backends"]:
            backend = spec["backends"][0]
        model = settings.get("single_model") or spec["models"][0]
        if model not in spec["models"]:
            model = spec["models"][0]
        return {"provider": prov, "model": model, "backend": backend}
    return settings["members"][member_id]


def _build_adapter(provider: str, persona_name: str, role: str, model: str | None,
                   backend: str | None, keys: dict, temp: float) -> MemberAdapter:
    """provider+backend+model → doğru adapter (üye veya yargıç fark etmez)."""
    if backend == "cli" and provider in _CLI:
        if provider == "google":
            # agy transcript fallback'i cwd→conversation_id eşlemesine (last_conversations.json)
            # dayanır; bu eşleme SADECE agy'nin tanıdığı/kayıtlı dizinler için var. Her üyeye
            # taze boş cwd verince agy o dizini kaydetmiyor → transcript bulunamıyor → 300s
            # takılma. O yüzden TÜM agy'ler kayıtlı, stabil backend dizininde koşar; eşzamanlı
            # cwd→id çakışması ise AgyAdapter içindeki global kilitle (serialize) önlenir.
            agy_cwd = Path(__file__).resolve().parent
            return AgyAdapter(role=role, persona_name=persona_name, model=model, cwd=str(agy_cwd))
        return _CLI[provider](role=role, persona_name=persona_name, model=model)
    if backend == "local" and provider == "ollama":
        return OllamaAdapter(role=role, persona_name=persona_name, model=model)
    if backend == "api":
        if provider == "anthropic":
            return AnthropicApiAdapter(role, persona_name, model=model, api_key=keys.get("anthropic"), temperature=temp)
        if provider == "google":
            return GoogleApiAdapter(role, persona_name, model=model, api_key=keys.get("google"), temperature=temp)
        if provider in ("openai", "deepseek", "xai"):
            return ApiAdapter(role, persona_name, provider=provider, model=model, api_key=keys.get(provider), temperature=temp)
    raise ValueError(f"{persona_name}: geçersiz provider/backend ({provider}/{backend})")


def build_member_from_config(member_id: str, settings: dict) -> MemberAdapter:
    role = MEMBER_ROLE[member_id]
    cfg = _effective_cfg(member_id, settings)
    return _build_adapter(
        cfg["provider"], member_id, role, cfg.get("model"), cfg.get("backend"),
        settings.get("api_keys", {}), ROLE_TEMP.get(role, 0.4),
    )


def enabled_member_ids(settings: dict) -> list[str]:
    """Aktif (enabled) meclis üyeleri. Kapatılan üyeler duruşmaya katılmaz."""
    members = settings.get("members", {})
    return [mid for mid in MEMBER_IDS if members.get(mid, {}).get("enabled", True)]


def build_members_from_settings(settings: dict) -> list[MemberAdapter]:
    return [build_member_from_config(mid, settings) for mid in enabled_member_ids(settings)]


def build_judge_backend(settings: dict) -> MemberAdapter:
    """Yargıç (Themis) backend'i SEÇİLEN provider'dan kurulur — "Gemini seçtiysem
    yargıç da Gemini" mantığı. Adapter'ın ask_raw'ı kullanılır (hepsinde var)."""
    keys = settings.get("api_keys", {})
    if settings.get("mode") == "single":
        prov = settings.get("single_provider", "google")
        spec = PROVIDERS[prov]
        backend = settings.get("single_backend") or spec["backends"][0]
        if backend not in spec["backends"]:
            backend = spec["backends"][0]
        model = settings.get("single_model") or spec["models"][0]
    else:
        cfg = settings["members"].get("themis", {})
        prov = cfg.get("provider", "openai")
        spec = PROVIDERS.get(prov, PROVIDERS["openai"])
        backend = cfg.get("backend") or spec["backends"][0]
        model = cfg.get("model") or spec["models"][0]
    # Yargıç deterministik olmalı → düşük temp.
    return _build_adapter(prov, "themis", "stratejist", model, backend, keys, 0.2)
