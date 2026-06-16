"""Faz 1 - bağımsız açılış.

Beş üye paralel çağrılır ve birbirini görmez. Her adapter'a yalnızca önerme
gider; `context=None` izolasyonun kod seviyesindeki sınırıdır.
"""

from __future__ import annotations

import asyncio
from collections.abc import Iterable

from adapters.base import MemberAdapter
from schemas import MemberResponse


async def run_phase1_opening(
    proposition: str, adapters: Iterable[MemberAdapter]
) -> list[MemberResponse]:
    members = list(adapters)
    responses = await asyncio.gather(
        *(adapter.ask(proposition, context=None) for adapter in members)
    )
    roles = [response.role for response in responses]
    if len(roles) != len(set(roles)):
        raise ValueError(f"Faz 1 rolleri benzersiz olmalı: {roles}")
    return list(responses)
