"""MemberAdapter kontratı + ortak parse yardımcıları (CLAUDE.md §2.1).

Orchestrator hangi backend'in (CLI/API) çağrıldığını BİLMEZ — sadece
MemberResponse alır. Bütün adapter'lar bu tek `ask()` kontratını uygular.
Böylece kişisel v1'de CLI, ürünleşmede API'ye config flip'le geçilir.
"""

from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

from pydantic import ValidationError

from schemas import MemberResponse, Role

# Faz 1'de modeller birbirini GÖRMEZ. context yalnızca Faz 2 (çatışma) için
# kullanılır — rakibin enjekte edilmiş argümanı. Faz 1'de daima None.
Context = Optional[str]

# CLI TUI çıktısı gürültülü. Modele bu sınırlayıcıları dayatıyoruz; JSON'ı
# sadece bunların arasından çekiyoruz (§2.1).
SENTINEL_START = "===DIVAN_JSON_START==="
SENTINEL_END = "===DIVAN_JSON_END==="

# KRİTİK (probe ile kanıtlandı): Claude Code TUI, asistan cevabındaki
# kelime aralarını LİTERAL boşluk yerine yatay imleç hareketiyle render eder
# (örn. "Evet\x1b[39Gyapilmali" → 39. sütuna git). Bunları önce BOŞLUĞA
# çevirmezsek strip sonrası kelimeler birleşir ("Evetyapilmali"). JSON için
# fazladan boşluk zararsız; kelime sınırı korunur.
#   CHA = \x1b[<n>G (cursor horizontal absolute), CUF = \x1b[<n>C (cursor forward)
_HMOVE_RE = re.compile(r"\x1b\[[0-9]*[GC]")
# Kalan tüm ANSI/OSC/escape dizileri (renk, OSC başlık, tek-harf escape).
_ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]")


def strip_ansi(text: str) -> str:
    """TUI çıktısından ANSI escape dizilerini temizle.

    Yatay imleç hareketleri önce boşluğa çevrilir (yukarıdaki nota bkz.),
    sonra geri kalan tüm escape dizileri silinir.
    """
    text = _HMOVE_RE.sub(" ", text)
    return _ANSI_RE.sub("", text)


def extract_json_between_sentinels(raw: str) -> dict:
    """Sentinel'ler arasındaki JSON'ı çıkar ve parse et.

    TUI çıktısı sentinel'in kendisini birden çok kez yankılayabilir
    (prompt echo + cevap). Bu yüzden SON START..END çiftini alırız.
    """
    cleaned = strip_ansi(raw)
    start_positions = [m.end() for m in re.finditer(re.escape(SENTINEL_START), cleaned)]
    end_positions = [m.start() for m in re.finditer(re.escape(SENTINEL_END), cleaned)]
    if not start_positions or not end_positions:
        raise ValueError(
            f"Sentinel bulunamadı. START={len(start_positions)} END={len(end_positions)}\n"
            f"Ham (son 800 char): ...{cleaned[-800:]!r}"
        )
    # Son geçerli (start < end) çifti
    start = start_positions[-1]
    end = next((e for e in reversed(end_positions) if e > start), None)
    if end is None:
        raise ValueError("START sonrası END yok (kapanmamış sentinel).")
    blob = cleaned[start:end].strip()
    # Bazı CLI'lar JSON'ı ``` ile sarabilir; temizle.
    blob = blob.strip("`").strip()
    if blob.startswith("json"):
        blob = blob[4:].strip()
    # KRİTİK: model tek-satır JSON üretir (prompt böyle dayatır), ama TUI uzun
    # satırı kelime sınırında kaydırır → blob içine \r\n + girinti girer ve bu
    # kontrol karakterleri JSON string'i içinde GEÇERSİZ. Kaydırma kelime
    # sınırında olduğu için her newline+girinti dizisini tek boşluğa çökertiriz.
    blob = re.sub(r"[\r\n]+[ \t]*", " ", blob)
    return json.loads(blob)


def build_member_prompt(persona: str, proposition: str, context: Context = None) -> str:
    """Persona + önerme (+ Faz 2 context) → tek prompt string'i.

    Sentinel talimatı her zaman eklenir; persona dosyasında olsa bile garanti.
    """
    parts = [persona.strip(), "", f"## Önerme\n{proposition.strip()}"]
    if context:
        parts += ["", f"## Sana iletilen rakip argüman (yalnız bu eksende cevapla)\n{context.strip()}"]
    parts += [
        "",
        "## Nasıl konuş",
        "Günlük, samimi, eğlenceli bir dille — arkadaşına anlatır gibi. Rapor/danışman dili ve jargon YOK.",
        "Soru günlük bir mesele ya da zevk meselesiyse (rock mı rap mi gibi) KASMA: "
        "kendi teknik çerçeveni zorla dayatma, kişiliğinle rahat ve net konuş.",
        "stance: net tarafını söyle. reasons: neden o tarafta olduğunu sade sade anlat.",
        "flip_condition: seni fikrinden ne döndürür, doğal tek cümleyle — zorlama 'test koşulu' değil; "
        "günlük soruda hafif olabilir.",
        "",
        "## Çıktı — KESİN",
        "Cevabını SADECE şu sınırlayıcılar arasında, tek satır geçerli JSON ver:",
        f"{SENTINEL_START}",
        "Zorunlu anahtarlar: role, stance, reasons, confidence, flip_condition.",
        f"{SENTINEL_END}",
        "Sınırlayıcı dışına HİÇBİR şey yazma. Markdown/ön söz/kod bloğu YOK.",
        'Placeholder ("...") kullanma; alanları gerçek içerikle doldur. flip_condition boş olamaz (kısa ve doğal yaz).',
    ]
    return "\n".join(parts)


def build_schema_member_prompt(persona: str, proposition: str, context: Context = None) -> str:
    """Persona + önerme (+ Faz 2 context) -> schema-zorlamalı CLI/API prompt'u.

    Codex `--output-schema` zaten son cevabı JSON şemasına bağlar; bu yüzden
    sentinel istemeyiz. API adapter'ları da `response_format=json_object`
    kullandığında aynı sade talimattan yararlanır.
    """
    parts = [persona.strip(), "", f"## Önerme\n{proposition.strip()}"]
    if context:
        parts += ["", f"## Sana iletilen rakip argüman (yalnız bu eksende cevapla)\n{context.strip()}"]
    parts += [
        "",
        "## Nasıl konuş",
        "Günlük, samimi, eğlenceli bir dille — arkadaşına anlatır gibi. Rapor/danışman dili ve jargon YOK.",
        "Soru günlük/zevk meselesiyse KASMA: teknik çerçeveni zorla dayatma, kişiliğinle rahat konuş.",
        "flip_condition: seni ne döndürür, doğal tek cümleyle (zorlama test koşulu değil; günlük soruda hafif olabilir).",
        "",
        "## Çıktı - KESİN JSON",
        "Sadece role, stance, reasons, confidence, flip_condition alanlı geçerli JSON döndür.",
        "Markdown, ön söz, kod bloğu YOK.",
        'Placeholder ("...") kullanma; flip_condition boş olamaz (kısa ve doğal).',
    ]
    return "\n".join(parts)


def load_persona(name: str) -> str:
    """personas/<name>.md içeriğini oku."""
    path = Path(__file__).resolve().parent.parent / "personas" / f"{name}.md"
    return path.read_text(encoding="utf-8")


class MemberAdapter(ABC):
    """Tüm üye adapter'larının uyguladığı tek kontrat.

    role: bu adapter'ın temsil ettiği meclis üyesi (validasyon için).
    """

    def __init__(self, role: Role, persona_name: str):
        self.role = role
        self.persona_name = persona_name
        self.persona = load_persona(persona_name)

    @abstractmethod
    async def ask(
        self, proposition: str, context: Context = None
    ) -> MemberResponse:
        """Önerme (+ opsiyonel Faz 2 context) → doğrulanmış MemberResponse."""
        raise NotImplementedError

    def _validate(self, data: dict) -> MemberResponse:
        """Ham JSON'ı şemaya oturt. Adapter role'u otoritedir."""
        data["role"] = self.role
        response = MemberResponse.model_validate(data)
        placeholder_values = {"...", "…", "TODO", "todo"}
        fields = [response.stance, response.flip_condition, *response.reasons]
        if any(value.strip() in placeholder_values for value in fields):
            raise ValidationError.from_exception_data(
                "MemberResponse",
                [
                    {
                        "type": "value_error",
                        "loc": ("content",),
                        "input": data,
                        "ctx": {
                            "error": ValueError(
                                "Model placeholder content returned; real stance/reasons/flip_condition required."
                            )
                        },
                    }
                ],
            )
        return response
