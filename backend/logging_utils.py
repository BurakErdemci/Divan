"""Small structured logging helpers for Divan runtime traces."""

from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from typing import Iterator

logger = logging.getLogger("divan.backend")


def step_log(
    trial_id: str | None,
    phase: str,
    actor: str,
    event: str,
    **fields: object,
) -> None:
    prefix = f"step trial={trial_id or '-'} phase={phase} actor={actor} event={event}"
    suffix = " ".join(f"{key}={value!r}" for key, value in fields.items() if value is not None)
    logger.info("%s%s", prefix, f" {suffix}" if suffix else "")


@contextmanager
def timed_step(
    trial_id: str | None,
    phase: str,
    actor: str,
    event: str,
    **fields: object,
) -> Iterator[None]:
    started_at = time.perf_counter()
    step_log(trial_id, phase, actor, f"{event}.start", **fields)
    try:
        yield
    except Exception as exc:
        elapsed = time.perf_counter() - started_at
        step_log(trial_id, phase, actor, f"{event}.error", elapsed=f"{elapsed:.1f}s", error=repr(exc))
        raise
    elapsed = time.perf_counter() - started_at
    step_log(trial_id, phase, actor, f"{event}.done", elapsed=f"{elapsed:.1f}s")
