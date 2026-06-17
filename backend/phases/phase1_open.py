"""Phase 1 independent openings.

Every member sees the proposition and shared project context only. They do not
see each other's answers in this phase.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from collections.abc import Iterable

from adapters.base import MemberAdapter
from logging_utils import step_log
from schemas import MemberResponse

logger = logging.getLogger("divan.backend")


async def _ask_member(adapter: MemberAdapter, proposition: str, trial_id: str | None = None) -> MemberResponse:
    started_at = time.perf_counter()
    timeout = float(os.environ.get("DIVAN_MEMBER_TIMEOUT", "300"))
    logger.info("phase1.member.start role=%s adapter=%s", adapter.role, type(adapter).__name__)
    step_log(trial_id, "phase1", adapter.persona_name, "member.start", role=adapter.role, adapter=type(adapter).__name__, timeout=timeout)
    try:
        response = await asyncio.wait_for(adapter.ask(proposition, context=None), timeout=timeout)
    except asyncio.TimeoutError:
        elapsed = time.perf_counter() - started_at
        logger.error(
            "phase1.member.timeout role=%s adapter=%s elapsed=%.1fs timeout=%.1fs",
            adapter.role,
            type(adapter).__name__,
            elapsed,
            timeout,
        )
        step_log(trial_id, "phase1", adapter.persona_name, "member.timeout", role=adapter.role, adapter=type(adapter).__name__, elapsed=f"{elapsed:.1f}s")
        raise RuntimeError(f"{type(adapter).__name__} {timeout:.0f} saniye icinde cevap vermedi.") from None
    except Exception as exc:  # noqa: BLE001
        elapsed = time.perf_counter() - started_at
        logger.error(
            "phase1.member.error role=%s adapter=%s elapsed=%.1fs error=%r",
            adapter.role,
            type(adapter).__name__,
            elapsed,
            exc,
        )
        step_log(trial_id, "phase1", adapter.persona_name, "member.error", role=adapter.role, adapter=type(adapter).__name__, elapsed=f"{elapsed:.1f}s", error=repr(exc))
        raise

    elapsed = time.perf_counter() - started_at
    logger.info(
        "phase1.member.done role=%s adapter=%s elapsed=%.1fs confidence=%s",
        response.role,
        type(adapter).__name__,
        elapsed,
        response.confidence,
    )
    step_log(trial_id, "phase1", adapter.persona_name, "member.done", role=response.role, adapter=type(adapter).__name__, elapsed=f"{elapsed:.1f}s", confidence=response.confidence)
    return response


async def run_phase1_opening(
    proposition: str, adapters: Iterable[MemberAdapter], trial_id: str | None = None
) -> list[MemberResponse]:
    members = list(adapters)
    logger.info("phase1.start members=%s", [type(member).__name__ for member in members])
    step_log(trial_id, "phase1", "council", "members.start", members=[member.persona_name for member in members])
    results = await asyncio.gather(
        *(_ask_member(adapter, proposition, trial_id=trial_id) for adapter in members),
        return_exceptions=True,
    )
    responses: list[MemberResponse] = []
    for adapter, result in zip(members, results):
        if isinstance(result, Exception):
            logger.warning(
                "phase1.member.skipped role=%s adapter=%s error=%r",
                adapter.role,
                type(adapter).__name__,
                result,
            )
            step_log(trial_id, "phase1", adapter.persona_name, "member.skipped", role=adapter.role, adapter=type(adapter).__name__, error=repr(result))
            continue
        responses.append(result)

    if len(responses) < 2:
        raise RuntimeError(
            "Faz 1 icin yeterli uye cevabi yok. "
            f"Basarili={len(responses)} toplam={len(members)}"
        )

    roles = [response.role for response in responses]
    if len(roles) != len(set(roles)):
        raise ValueError(f"Faz 1 rolleri benzersiz olmali: {roles}")
    logger.info("phase1.done roles=%s", roles)
    step_log(trial_id, "phase1", "council", "members.done", roles=roles)
    return list(responses)
