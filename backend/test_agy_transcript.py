"""Agy transcript fallback duman testi."""

from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))

from adapters.agy import AgyAdapter  # noqa: E402
from adapters.base import SENTINEL_END, SENTINEL_START  # noqa: E402


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        cwd = root / "workspace"
        app_data = root / "agy-data"
        conversation_id = "11111111-1111-1111-1111-111111111111"
        transcript = app_data / "brain" / conversation_id / ".system_generated" / "logs" / "transcript.jsonl"
        cache = app_data / "cache" / "last_conversations.json"
        transcript.parent.mkdir(parents=True)
        cache.parent.mkdir(parents=True)
        cwd.mkdir()
        cache.write_text(json.dumps({str(cwd): conversation_id}), encoding="utf-8")
        transcript.write_text(
            json.dumps(
                {
                    "type": "PLANNER_RESPONSE",
                    "status": "DONE",
                    "content": (
                        f"{SENTINEL_START}"
                        '{"role":"yaratici","stance":"Evet, ama kapsamı tersine çevir.",'
                        '"reasons":["Sesli modu özellik değil öğrenme deneyi yap."],'
                        '"confidence":70,'
                        '"flip_condition":"Şu doğruysa fikrimi değiştiririm: Kullanıcılar sesli akışı istemiyorsa."}'
                        f"{SENTINEL_END}"
                    ),
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

        adapter = AgyAdapter(cwd=cwd, app_data_dir=app_data)
        text = adapter._read_transcript_response()
        assert text and SENTINEL_START in text
        print("OK - Agy transcript fallback found sentinel response.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
