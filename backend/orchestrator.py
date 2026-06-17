"""Divan 4-phase orchestrator.

The frontend wants a complete list of TrialEvent dicts. The orchestrator does
not know which backend each member uses; it only receives MemberResponse data
through the adapter contract.
"""

from __future__ import annotations

from typing import AsyncIterator

from adapters.base import MemberAdapter
from judge import ThemisJudge
from logging_utils import step_log, timed_step
from phases.phase1_open import run_phase1_opening
from schemas import Clash, Exchange, MemberResponse

ROLE_TO_ID = {
    "stratejist": "athena",
    "supheci": "socrates",
    "yaratici": "apollo",
    "muhendis": "hephaestus",
    "realist": "atlas",
}


LANG_DIRECTIVE = {
    "tr": "Tüm cevaplarını TÜRKÇE ver.",
    "en": ("Respond ENTIRELY IN ENGLISH. Every field (stance, reasons, flip_condition, "
           "decision, minority_report, everything) must be natural English, regardless of "
           "the language these instructions are written in."),
}


def _lang_block(language: str | None, project_context: str | None) -> str:
    """Dil direktifini proje bağlamının başına koy — böylece üye ve yargıç
    promptlarının HEPSİNE akar (ayrı imza gerekmez)."""
    directive = LANG_DIRECTIVE.get((language or "tr").lower(), LANG_DIRECTIVE["tr"])
    parts = [f"## Dil / Language\n{directive}"]
    if project_context and project_context.strip():
        parts.append(project_context.strip())
    return "\n\n".join(parts)


def _arg_text(resp: MemberResponse) -> str:
    top = resp.reasons[0] if resp.reasons else ""
    return f"{resp.stance} {top}".strip()


def _with_project_context(proposition: str, project_context: str | None, raw_question: str | None = None) -> str:
    parts: list[str] = []
    if project_context and project_context.strip():
        parts.extend(["## Proje baglami", project_context.strip()[:12000], ""])
    if raw_question:
        parts.extend(["## Kullanici sorusu", raw_question.strip(), ""])
    if proposition:
        parts.extend(["## Karara baglanacak onerme", proposition.strip()])
    return "\n".join(parts).strip()


async def run_trial(
    question: str,
    members: list[MemberAdapter],
    judge: ThemisJudge,
    project_context: str | None = None,
    trial_id: str | None = None,
    language: str = "tr",
) -> AsyncIterator[dict]:
    by_role = {m.role: m for m in members}
    # Dil direktifini bağlama göm → bütün fazlardaki prompt'lara akar.
    project_context = _lang_block(language, project_context)

    step_log(trial_id, "phase0", "themis", "phase.start")
    yield {"type": "phase_started", "phase": "frame"}
    with timed_step(trial_id, "phase0", "themis", "frame"):
        frame = await judge.frame(question, project_context=project_context)
    yield {"type": "frame", "data": frame.model_dump()}
    step_log(trial_id, "phase0", "themis", "phase.done", proposition=frame.proposition[:160])

    member_proposition = _with_project_context(frame.proposition, project_context)

    step_log(trial_id, "phase1", "council", "phase.start", members=[type(member).__name__ for member in members])
    yield {"type": "phase_started", "phase": "opening"}
    openings = await run_phase1_opening(member_proposition, members, trial_id=trial_id)
    by_role_open = {o.role: o for o in openings}
    for opening in openings:
        member_id = ROLE_TO_ID.get(opening.role, "themis")
        step_log(trial_id, "phase1", member_id, "reveal", confidence=opening.confidence)
        yield {"type": "member_started", "member": member_id}
        yield {"type": "member_response", "member": member_id, "data": opening.model_dump()}
    step_log(trial_id, "phase1", "council", "phase.done", roles=[opening.role for opening in openings])

    step_log(trial_id, "phase2", "themis", "phase.start")
    yield {"type": "phase_started", "phase": "clash"}
    with timed_step(trial_id, "phase2", "themis", "fault_line"):
        fault_data = await judge.fault_line(frame.proposition, openings, project_context=project_context)
    fault_line = str(fault_data.get("fault_line", "")).strip() or "Anlasmazligin ekseni"
    a_role, b_role = _pick_pair(fault_data, openings)
    step_log(trial_id, "phase2", "themis", "pair_selected", fault_line=fault_line[:180], a=a_role, b=b_role)

    exchanges: list[Exchange] = []
    upheld_count = 0
    for objector_role, target_role in [(a_role, b_role), (b_role, a_role)]:
        if objector_role not in by_role or target_role not in by_role_open:
            continue
        target_open = by_role_open[target_role]
        context = (
            f"Rakibin {target_role} sunu savunuyor: \"{target_open.stance}\". "
            f"En guclu gerekcesi: \"{target_open.reasons[0] if target_open.reasons else ''}\". "
            f"Bu eksende ({fault_line}) ona DOGRUDAN karsi cik, kendi rolunle curut."
        )
        actor_id = ROLE_TO_ID.get(objector_role, objector_role)
        target_id = ROLE_TO_ID.get(target_role, target_role)
        with timed_step(trial_id, "phase2", actor_id, "objection_argument", target=target_id):
            response = await by_role[objector_role].ask(member_proposition, context=context)
        argument = _arg_text(response)
        claim = target_open.stance
        with timed_step(trial_id, "phase2", "themis", "rule", objector=actor_id, target=target_id):
            ruling = await judge.rule(fault_line, objector_role, target_role, claim, argument, project_context=project_context)
        if ruling == "upheld":
            upheld_count += 1
        step_log(trial_id, "phase2", "themis", "ruling", objector=actor_id, target=target_id, ruling=ruling)

        exchanges.append(
            Exchange.model_validate(
                {
                    "from": objector_role,
                    "targets": target_role,
                    "claim_challenged": claim,
                    "argument": argument,
                    "objection": True,
                    "ruling": ruling,
                    "sub_round": None,
                }
            )
        )

        yield {
            "type": "objection",
            "from": ROLE_TO_ID.get(objector_role, "themis"),
            "target": ROLE_TO_ID.get(target_role, "themis"),
            "claim": claim,
            "ruling": ruling,
        }
        clash = Clash(fault_line=fault_line, exchanges=list(exchanges), upheld_count=min(upheld_count, 2))
        yield {"type": "clash", "data": clash.model_dump(by_alias=True)}

    clash_digest = "\n".join(
        f"- {exchange.from_member} -> {exchange.targets}: \"{exchange.argument}\" [HUKUM: {exchange.ruling}]"
        for exchange in exchanges
    ) or "(catisma yok)"

    yield {"type": "phase_started", "phase": "verdict"}
    step_log(trial_id, "phase3", "themis", "phase.start")
    with timed_step(trial_id, "phase3", "themis", "verdict"):
        verdict = await judge.verdict(frame.proposition, openings, clash_digest, project_context=project_context)
    yield {"type": "verdict", "data": verdict.model_dump()}
    step_log(trial_id, "phase3", "themis", "phase.done", confidence=verdict.confidence)


def _pick_pair(fault_data: dict, openings: list[MemberResponse]) -> tuple[str, str]:
    roles = [opening.role for opening in openings]
    a = str(fault_data.get("a", "")).strip()
    b = str(fault_data.get("b", "")).strip()
    if a in roles and b in roles and a != b:
        return a, b

    ordered = sorted(openings, key=lambda opening: opening.confidence)
    if len(ordered) >= 2:
        return ordered[-1].role, ordered[0].role
    return roles[0], roles[0]
