"""Default Divan member adapter wiring."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

from .agy import AgyAdapter
from .api import DeepSeekAdapter
from .base import MemberAdapter
from .claude_code import ClaudeCodeAdapter
from .codex import CodexAdapter
from .ollama import OllamaAtlasAdapter


def load_divan_env() -> None:
    root = Path(__file__).resolve().parents[2]
    load_dotenv(root / ".env")


def build_default_member_adapters() -> list[MemberAdapter]:
    """Beş üyeyi CLAUDE.md §2'deki backend kararlarıyla kur."""
    load_divan_env()
    return [
        ClaudeCodeAdapter(
            role="stratejist",
            persona_name="athena",
            model=os.environ.get("MODEL_ATHENA"),
        ),
        CodexAdapter(
            role="supheci",
            persona_name="socrates",
            model=os.environ.get("MODEL_SOCRATES"),
        ),
        AgyAdapter(
            role="yaratici",
            persona_name="apollo",
            model=os.environ.get("MODEL_APOLLO"),
        ),
        DeepSeekAdapter(),
        OllamaAtlasAdapter(),
    ]
