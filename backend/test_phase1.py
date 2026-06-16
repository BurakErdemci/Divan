"""Faz 1 izolasyon/paralellik duman testi."""

from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from adapters.base import Context, MemberAdapter  # noqa: E402
from phases.phase1_open import run_phase1_opening  # noqa: E402
from schemas import MemberResponse, Role  # noqa: E402


class FakeAdapter(MemberAdapter):
    def __init__(self, role: Role):
        self.seen_context: Context | str = "not-called"
        super().__init__(role=role, persona_name="athena")

    async def ask(self, proposition: str, context: Context = None) -> MemberResponse:
        self.seen_context = context
        await asyncio.sleep(0.01)
        return MemberResponse(
            role=self.role,
            stance=f"{self.role} pozisyonu",
            reasons=["gerekçe"],
            confidence=50,
            flip_condition="Şu doğruysa fikrimi değiştiririm: test koşulu.",
        )


async def main() -> int:
    adapters = [FakeAdapter(role) for role in ["stratejist", "supheci", "yaratici", "muhendis", "realist"]]
    responses = await run_phase1_opening("Net önerme", adapters)
    assert len(responses) == 5
    assert {response.role for response in responses} == {
        "stratejist",
        "supheci",
        "yaratici",
        "muhendis",
        "realist",
    }
    assert all(adapter.seen_context is None for adapter in adapters)
    print("OK - Phase 1 called five members in isolation.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
