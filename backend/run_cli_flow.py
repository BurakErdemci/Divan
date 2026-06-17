"""Divan headless akış testi — SADECE CLI üyeleri (Claude/Codex/agy).
Hephaestus + Atlas (API) atlanır. Akışı backend/last_flow.txt'e döker.

Çalıştır:  backend/.venv/Scripts/python.exe backend/run_cli_flow.py "soru"
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from adapters.agy import AgyAdapter  # noqa: E402
from adapters.api import DeepSeekAdapter  # noqa: E402
from adapters.claude_code import ClaudeCodeAdapter  # noqa: E402
from adapters.codex import CodexAdapter  # noqa: E402
from adapters.factory import load_divan_env  # noqa: E402
from adapters.ollama import OllamaAtlasAdapter  # noqa: E402
from judge import ThemisJudge  # noqa: E402
from orchestrator import run_trial  # noqa: E402

QUESTION = sys.argv[1] if len(sys.argv) > 1 else (
    "Jarvan'a önümüzdeki 2 hafta içinde sesli mod eklemeli miyim?"
)

OUT = os.path.join(os.path.dirname(__file__), "last_flow.txt")
_lines: list[str] = []


def env_enabled(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


def has_env_value(name: str) -> bool:
    value = os.environ.get(name, "").strip()
    return bool(value and value not in {"...", "<...>", "changeme", "CHANGE_ME"})


def log(s: str = "") -> None:
    _lines.append(s)
    print(s.encode("ascii", "replace").decode("ascii"))  # konsol cp1252 güvenli


def render(ev: dict) -> None:
    t = ev["type"]
    if t == "phase_started":
        log(f"\n{'='*70}\n### FAZ: {ev['phase'].upper()}\n{'='*70}")
    elif t == "frame":
        d = ev["data"]
        log(f"[ÇERÇEVE] Ham: {d['raw_question']}")
        log(f"[ÇERÇEVE] Önerme: {d['proposition']}  ({d['answer_format']})")
    elif t == "member_started":
        log(f"\n-- {ev['member'].upper()} kürsüye çıkıyor --")
    elif t == "member_response":
        d = ev["data"]
        log(f"[{ev['member'].upper()} / {d['role']}]  GÜVEN: {d['confidence']}")
        log(f"  DURUŞ: {d['stance']}")
        for i, r in enumerate(d["reasons"], 1):
            log(f"   {i}. {r}")
        log(f"  FLIP: {d['flip_condition']}")
    elif t == "objection":
        log(f"\n  ⚔ İTİRAZ! {ev['from']} → {ev['target']}  | HÜKÜM: {ev['ruling'].upper()}")
        log(f"    İtiraz edilen iddia: {ev['claim']}")
    elif t == "clash":
        ex = ev["data"]["exchanges"][-1]
        log(f"    [{ex['from']}] argüman: {ex['argument']}")
    elif t == "verdict":
        d = ev["data"]
        log(f"\n{'#'*70}\nKARAR: {d['decision']}")
        log(f"GÜVEN: {d['confidence']}  | OY SİNYALİ: {d['vote_signal']}")
        log(f"AĞIRLIKLI: {d['confidence_weighted']}")
        log(f"FAY HATTI: {d['fault_line']}")
        log(f"UZLAŞI: {d['consensus']}")
        log(f"KILL-CONDITION: {d['kill_condition']}")
        log(f"MUHALİF: {d.get('dissenter')}  (kritik mi: {d.get('dissent_is_load_bearing')})")
        log(f"AZINLIK RAPORU: {d['minority_report']}")
        log(f"AÇIK SORULAR: {d.get('open_questions')}")


async def main() -> int:
    load_divan_env()
    members = []
    if not env_enabled("DIVAN_SKIP_CLAUDE"):
        members.append(ClaudeCodeAdapter(role="stratejist", persona_name="athena", model=os.environ.get("MODEL_ATHENA")))
    members.append(CodexAdapter(role="supheci", persona_name="socrates", model=os.environ.get("MODEL_SOCRATES")))
    members.append(AgyAdapter(role="yaratici", persona_name="apollo", model=os.environ.get("MODEL_APOLLO")))
    if has_env_value("DEEPSEEK_API_KEY"):
        members.append(DeepSeekAdapter())
    if env_enabled("DIVAN_ENABLE_OLLAMA_ATLAS"):
        members.append(OllamaAtlasAdapter())
    judge = ThemisJudge()
    log(f"SORU: {QUESTION}\n(Uyeler: {', '.join(type(m).__name__ for m in members)}, Themis=Codex)")
    try:
        async for ev in run_trial(QUESTION, members, judge):
            render(ev)
    except Exception as e:
        import traceback
        log(f"\n!!! HATA: {e!r}\n{traceback.format_exc()}")
        return 1
    finally:
        for m in members:
            if hasattr(m, "close"):
                m.close()
        judge.close()
        with open(OUT, "w", encoding="utf-8") as f:
            f.write("\n".join(_lines))
        print(f"\n--> transcript: {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
