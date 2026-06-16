"""Divan — fazlar arası veri kontratı (CLAUDE.md §4).

Bu şemalar pipeline'ın omurgasıdır. Adapter backend'i ne olursa olsun
(CLI veya API) her üye MemberResponse döndürmek ZORUNDA — kontrat budur.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

# Beş üyenin rolleri. Yargıç (Themis) bir üye DEĞİL, ayrı instance.
Role = Literal["stratejist", "supheci", "yaratici", "muhendis", "realist"]


# ---------------------------------------------------------------------------
# Faz 0 — Çerçeveleme (Yargıç)
# ---------------------------------------------------------------------------
class Frame(BaseModel):
    raw_question: str
    proposition: str = Field(..., description="Net, karar verilebilir önerme")
    answer_format: Literal["yes_no", "choice", "scalar"]
    options: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Faz 1 — her modelin bağımsız açılışı (izole)
# ---------------------------------------------------------------------------
class MemberResponse(BaseModel):
    """Her adapter'ın ask() çıktısı. Tüm sistemin tek ortak para birimi."""

    role: Role
    stance: str = Field(..., description="Tek cümle net pozisyon")
    reasons: list[str] = Field(..., min_length=1)
    confidence: int = Field(..., ge=0, le=100)
    flip_condition: str = Field(
        ..., min_length=1, description="Şu doğruysa fikrimi değiştiririm: ..."
    )


# ---------------------------------------------------------------------------
# Faz 2 — çatışma turu (tek eksen)
# ---------------------------------------------------------------------------
class Exchange(BaseModel):
    from_member: Role = Field(..., alias="from")
    targets: Role
    claim_challenged: str
    argument: str
    objection: bool = False
    ruling: Optional[Literal["upheld", "overruled"]] = None
    # upheld ise o noktada açılan hedefli alt-tur çıktısı; yoksa None.
    sub_round: Optional[str] = None

    model_config = {"populate_by_name": True}


class Clash(BaseModel):
    fault_line: str = Field(..., description="Anlaşmazlığın tek ekseni")
    exchanges: list[Exchange] = Field(default_factory=list)
    # CLAUDE.md §3/§4: 2'yi geçemez. Themis tavanı zorlarsa senteze taşır.
    upheld_count: int = Field(0, ge=0, le=2)


# ---------------------------------------------------------------------------
# Faz 3 — VERDICT (nihai çıktı)
# ---------------------------------------------------------------------------
class VoteSignal(BaseModel):
    support: int = Field(..., ge=0)
    oppose: int = Field(..., ge=0)


class Verdict(BaseModel):
    decision: str = Field(..., description="Net tavır — şunu yap")
    # KRİTİK: confidence ASLA support/total ile hesaplanmaz; Yargıç'ın yorumudur.
    confidence: int = Field(..., ge=0, le=100)
    vote_signal: VoteSignal
    confidence_weighted: str
    dissenter: Optional[Role] = None
    dissent_is_load_bearing: bool = False
    consensus: str
    fault_line: str
    kill_condition: str
    minority_report: str = Field(
        ..., description="Muhalif görüş — silinmez, görünür kalır"
    )
    open_questions: list[str] = Field(default_factory=list)
