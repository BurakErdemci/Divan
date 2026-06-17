"""Divan FastAPI + SSE server.

Frontend contract:
  POST /api/trials {question}        -> {trial_id}
  GET  /api/trials/{trial_id}/events -> SSE TrialEvent stream

Important UX rule: the SSE endpoint waits until the whole backend precompute is
done, then sends the complete event list. The desktop app should not start the
courtroom playback while the AI members are still answering.
"""

from __future__ import annotations

import asyncio
import json
import logging
import logging.handlers
import os
import sys
import traceback
import uuid
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from adapters.base import MemberAdapter
from adapters.factory import load_divan_env
from judge import ThemisJudge
from logging_utils import step_log
from orchestrator import run_trial
from providers import (
    PROVIDERS,
    build_judge_backend,
    build_members_from_settings,
    load_settings,
    save_settings,
)

load_divan_env()

LOG_DIR = Path(__file__).resolve().parent / ".divan"
LOG_DIR.mkdir(exist_ok=True)
LOG_PATH = LOG_DIR / "server.log"

logger = logging.getLogger("divan.backend")
logger.setLevel(logging.INFO)
if not logger.handlers:
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    handler = logging.handlers.RotatingFileHandler(
        LOG_PATH,
        maxBytes=1_000_000,
        backupCount=3,
        encoding="utf-8",
    )
    handler.setFormatter(fmt)
    logger.addHandler(handler)
    # Ayrıca konsola (npm `[backend]` terminali) bas → faz/üye ilerlemesi canlı görünür.
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(fmt)
    logger.addHandler(console)

app = FastAPI(title="Divan")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_trials: dict[str, dict] = {}


async def _run(trial_id: str, question: str, project_context: str | None = None) -> None:
    settings = load_settings()
    language = settings.get("language", "tr")
    members = build_members_from_settings(settings)
    judge = ThemisJudge(build_judge_backend(settings))
    store = _trials[trial_id]
    logger.info(
        "trial.start id=%s members=%s question=%r",
        trial_id,
        [type(member).__name__ for member in members],
        question,
    )
    step_log(trial_id, "trial", "backend", "start", members=[type(member).__name__ for member in members])
    if project_context:
        logger.info("trial.project_context id=%s chars=%s", trial_id, len(project_context))
        step_log(trial_id, "trial", "backend", "project_context", chars=len(project_context))
    try:
        async for event in run_trial(question, members, judge, project_context=project_context, trial_id=trial_id, language=language):
            store["events"].append(event)
            logger.info("trial.event id=%s type=%s count=%s", trial_id, event.get("type"), len(store["events"]))
            step_log(trial_id, str(event.get("phase") or event.get("type")), "backend", "event", count=len(store["events"]))
    except Exception as exc:  # noqa: BLE001
        logger.error("trial.error id=%s error=%r\n%s", trial_id, exc, traceback.format_exc())
        store["events"].append({"type": "error", "message": str(exc)})
    finally:
        for member in members:
            closer = getattr(member, "close", None)
            if closer:
                try:
                    closer()
                except Exception as exc:  # noqa: BLE001
                    logger.warning("trial.member_close_error id=%s member=%s error=%r", trial_id, type(member).__name__, exc)
        try:
            judge.close()
        except Exception as exc:  # noqa: BLE001
            logger.warning("trial.judge_close_error id=%s error=%r", trial_id, exc)
        store["done"] = True
        logger.info("trial.done id=%s event_count=%s log=%s", trial_id, len(store["events"]), LOG_PATH)
        step_log(trial_id, "trial", "backend", "done", event_count=len(store["events"]))


class TrialReq(BaseModel):
    question: str
    project_context: str | None = None


@app.post("/api/trials")
async def create_trial(req: TrialReq) -> dict:
    trial_id = uuid.uuid4().hex
    _trials[trial_id] = {"events": [], "done": False}
    logger.info("trial.create id=%s", trial_id)
    asyncio.create_task(_run(trial_id, req.question, req.project_context))
    return {"trial_id": trial_id}


@app.get("/api/trials/{trial_id}/events")
async def trial_events(trial_id: str) -> StreamingResponse:
    async def gen():
        if trial_id not in _trials:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Geçersiz trial_id'}, ensure_ascii=False)}\n\n"
            return

        logger.info("sse.open id=%s", trial_id)
        while not _trials[trial_id]["done"]:
            yield ": waiting\n\n"
            await asyncio.sleep(0.2)

        for event in _trials[trial_id]["events"]:
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

        yield f"data: {json.dumps({'type': 'complete'}, ensure_ascii=False)}\n\n"
        logger.info("sse.complete id=%s count=%s", trial_id, len(_trials[trial_id]["events"]))

    return StreamingResponse(gen(), media_type="text/event-stream")


@app.get("/api/providers")
async def get_providers() -> dict:
    """Frontend dropdown'ları için provider/model/backend kayıt defteri."""
    return {"providers": PROVIDERS}


@app.get("/api/settings")
async def get_settings() -> dict:
    return load_settings()


@app.post("/api/settings")
async def post_settings(payload: dict) -> dict:
    saved = save_settings(payload)
    logger.info("settings.saved mode=%s", saved.get("mode"))
    return saved


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "log": str(LOG_PATH)}
