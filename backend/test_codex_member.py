"""Milestone 1 - Socrates/CodexAdapter kabul testi.

Gercek `codex exec` cagrisi yapar ve MemberResponse semasina uygun JSON alir.
"""

from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from adapters.codex import CodexAdapter  # noqa: E402

PROPOSITION = (
    "Onumuzdeki 2 hafta icinde frontend overhaul'u durdurup mevcut urune "
    "sesli mod eklemek dogru oncelik mi? Evet/Hayir."
)


async def main() -> int:
    adapter = CodexAdapter(model=os.environ.get("MODEL_SOCRATES"))
    resp = await adapter.ask(PROPOSITION)
    print("=== MemberResponse ===")
    print("role       :", resp.role)
    print("stance     :", resp.stance)
    print("confidence :", resp.confidence)
    print("reasons    :")
    for reason in resp.reasons:
        print("   -", reason)
    print("flip_cond  :", resp.flip_condition)

    assert resp.role == "supheci"
    assert resp.stance and resp.reasons and resp.flip_condition
    assert 0 <= resp.confidence <= 100
    print("\nOK - CodexAdapter returned schema-valid Socrates JSON.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
