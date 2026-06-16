"""Milestone 1 - Apollo/AgyAdapter kabul testi.

Gercek `agy --print` cagrisi yapar. agy stdout bug'ina takilirsa adapter
transcript fallback ile son sentinel'li PLANNER_RESPONSE'u okur.
"""

from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from adapters.agy import AgyAdapter  # noqa: E402

PROPOSITION = (
    "Onumuzdeki 2 hafta icinde frontend overhaul'u durdurup mevcut urune "
    "sesli mod eklemek dogru oncelik mi? Evet/Hayir."
)


async def main() -> int:
    adapter = AgyAdapter(model=os.environ.get("MODEL_APOLLO"), timeout=90)
    resp = await adapter.ask(PROPOSITION)
    print("=== MemberResponse ===")
    print("role       :", resp.role)
    print("stance     :", resp.stance)
    print("confidence :", resp.confidence)
    print("reasons    :")
    for reason in resp.reasons:
        print("   -", reason)
    print("flip_cond  :", resp.flip_condition)

    assert resp.role == "yaratici"
    assert resp.stance and resp.reasons and resp.flip_condition
    assert 0 <= resp.confidence <= 100
    print("\nOK - AgyAdapter returned schema-valid Apollo JSON.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
