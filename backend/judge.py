"""Themis judge.

Themis is not a council persona. It frames the question, finds the fault line,
rules on objections, and produces the final diagnostic verdict.
"""

from __future__ import annotations

import os

from adapters.base import SENTINEL_END, SENTINEL_START, MemberAdapter, load_persona
from adapters.codex import CodexAdapter
from schemas import Frame, MemberResponse, Verdict


def _project_block(project_context: str | None) -> str:
    if not project_context or not project_context.strip():
        return ""
    return f"## Proje baglami\n{project_context.strip()[:12000]}\n\n"


def _wrap(persona: str, task: str, body: str, schema_hint: str, project_context: str | None = None) -> str:
    return "\n".join(
        [
            persona.strip(),
            "",
            f"## Gorev: {task}",
            _project_block(project_context) + body.strip(),
            "",
            "## Cikti - KESIN",
            "Cevabini SADECE su sinirlayicilar arasinda, tek satir gecerli JSON olarak ver:",
            SENTINEL_START,
            schema_hint,
            SENTINEL_END,
            "Sinirlayicilar disina HICBIR sey yazma. Markdown, aciklama YOK.",
        ]
    )


def _openings_digest(openings: list[MemberResponse]) -> str:
    lines = []
    for opening in openings:
        reasons = " ".join(f"({i + 1}) {reason}" for i, reason in enumerate(opening.reasons))
        lines.append(
            f"- [{opening.role}] DURUS: {opening.stance} | GUVEN: {opening.confidence} | "
            f"GEREKCELER: {reasons} | FLIP: {opening.flip_condition}"
        )
    return "\n".join(lines)


class ThemisJudge:
    """Yargıç. Backend, ayarlardan seçilen provider'dan gelir (providers.
    build_judge_backend); ask_raw'ı olan herhangi bir adapter olabilir. Verilmezse
    Codex'e düşer (geriye uyumluluk)."""

    def __init__(self, backend: MemberAdapter | None = None):
        self.persona = load_persona("themis")
        self._backend = backend or CodexAdapter(
            role="stratejist", persona_name="themis",
            model=os.environ.get("MODEL_THEMIS_CODEX"),
        )

    async def frame(self, raw_question: str, project_context: str | None = None) -> Frame:
        prompt = _wrap(
            self.persona,
            "CERCEVELEME (Faz 0)",
            f"Kullanicinin ham sorusu:\n\"{raw_question}\"\n\n"
            "Bunu net, karar verilebilir tek bir onermeye cevir. "
            "Proje baglami varsa onermeyi o baglamdan koparma. answer_format cogunlukla yes_no.",
            '{"raw_question":"...","proposition":"...","answer_format":"yes_no","options":["Evet","Hayir"]}',
            project_context=project_context,
        )
        data = await self._backend.ask_raw(prompt)
        data.setdefault("raw_question", raw_question)
        return Frame.model_validate(data)

    async def fault_line(
        self,
        proposition: str,
        openings: list[MemberResponse],
        project_context: str | None = None,
    ) -> dict:
        roles = [opening.role for opening in openings]
        prompt = _wrap(
            self.persona,
            "FAY HATTI (Faz 2)",
            f"Onerme: {proposition}\n\nUyelerin bagimsiz acilislari:\n{_openings_digest(openings)}\n\n"
            "Bu kararin asil bagli oldugu TEK fay hattini bul. "
            f"Sonra bu eksende en sert karsi karsiya gelen iki uyeyi sec (roller: {roles}).",
            '{"fault_line":"...","a":"<rol>","b":"<rol>"}',
            project_context=project_context,
        )
        return await self._backend.ask_raw(prompt)

    async def rule(
        self,
        fault_line: str,
        objector: str,
        target: str,
        claim: str,
        argument: str,
        project_context: str | None = None,
    ) -> str:
        prompt = _wrap(
            self.persona,
            "HUKUM (Faz 2 itirazi)",
            f"Fay hatti: {fault_line}\n"
            f"{objector}, {target}'in su iddiasina itiraz etti: \"{claim}\"\n"
            f"Itiraz gerekcesi: \"{argument}\"\n\n"
            "Itiraz hakli mi? Sadece bu noktada hukmet.",
            '{"ruling":"upheld"}',
            project_context=project_context,
        )
        data = await self._backend.ask_raw(prompt)
        ruling = str(data.get("ruling", "overruled")).lower()
        return "upheld" if ruling == "upheld" else "overruled"

    async def verdict(
        self,
        proposition: str,
        openings: list[MemberResponse],
        clash_digest: str,
        project_context: str | None = None,
    ) -> Verdict:
        support = sum(1 for opening in openings if _is_support(opening))
        oppose = len(openings) - support
        prompt = _wrap(
            self.persona,
            "SENTEZ / HUKUM (Faz 3)",
            f"Onerme: {proposition}\n\nAcilislar:\n{_openings_digest(openings)}\n\n"
            f"Catisma ozeti:\n{clash_digest}\n\n"
            f"Ham oy sinyali: {support} destek / {oppose} karsi (SADECE sinyal, confidence yapma).\n"
            "Nihai hukmu ver. Kurallar: confidence oy sayimindan hesaplanmaz; korelasyonu, "
            "muhalifin kim oldugunu ve muhalefetin kritik olup olmadigini yorumla. minority_report'u silme.",
            '{"decision":"...","confidence":0,"vote_signal":{"support":%d,"oppose":%d},'
            '"confidence_weighted":"...","dissenter":"<rol|null>","dissent_is_load_bearing":false,'
            '"consensus":"...","fault_line":"...","kill_condition":"...","minority_report":"...",'
            '"open_questions":["..."]}' % (support, oppose),
            project_context=project_context,
        )
        data = await self._backend.ask_raw(prompt)
        data.setdefault("vote_signal", {"support": support, "oppose": oppose})
        return Verdict.model_validate(data)

    def close(self) -> None:
        closer = getattr(self._backend, "close", None)
        if callable(closer):
            closer()


def _is_support(opening: MemberResponse) -> bool:
    stance = opening.stance.lower()
    return stance.startswith("evet") or "yapılmalı" in stance or "yapilmali" in stance or "doğru" in stance or "dogru" in stance
