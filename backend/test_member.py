"""Milestone 1 — tek uye testi (CLAUDE.md §8.1).

Gercek bir Claude Code interaktif oturumuna Athena persona'siyla bir onerme
gonderir, temiz MemberResponse alabiliyor muyuz dogrular.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from adapters.claude_code import ClaudeCodeAdapter  # noqa: E402

PROPOSITION = (
    "Onumuzdeki 2 hafta icinde frontend overhaul'u durdurup mevcut urune "
    "sesli mod eklemek dogru oncelik mi? Evet/Hayir."
)


async def main() -> int:
    adapter = ClaudeCodeAdapter(
        role="stratejist",
        persona_name="athena",
        model=os.environ.get("MODEL_ATHENA"),  # None -> login default (Opus 4.8)
    )
    try:
        resp = await adapter.ask(PROPOSITION)
    except Exception:
        raw = getattr(adapter, "last_raw", "")
        with open("backend/last_session_raw.txt", "w", encoding="utf-8") as f:
            f.write(repr(raw))
        print("PARSE HATASI — ham buffer backend/last_session_raw.txt'e yazildi")
        raise
    finally:
        adapter.close()

    print("=== MemberResponse ===")
    print("role       :", resp.role)
    print("stance      :", resp.stance)
    print("confidence  :", resp.confidence)
    print("reasons     :")
    for r in resp.reasons:
        print("   -", r)
    print("flip_cond   :", resp.flip_condition)

    assert resp.role == "stratejist"
    assert resp.stance and resp.reasons and resp.flip_condition
    assert 0 <= resp.confidence <= 100
    print("\nOK — tek uye temiz JSON dondurdu, sema gecerli.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
