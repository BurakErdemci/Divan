# CLAUDE.md — Divan

> **Codename:** Divan (konsey + mahkeme + Divan-ı Hümayun göndermesi). İstersen değiştir.
> **Tek cümle:** 5 farklı LLM'in 5 farklı persona ile bir öneriyi tartıştığı, çıktısı **karar değil teşhis** olan, Ace Attorney estetiğinde bir karar-destek aracı.

Bu dosya bu projenin anayasasıdır. Buradaki tasarım kararları "iyileştirilmek" için değil, **uygulanmak** için yazıldı. Bir kuralın neden böyle olduğu açıklanmışsa, o gerekçe o kuralın parçasıdır — gerekçeyi atlayıp kuralı değiştirme.

---

## 0. Felsefe (önce bunu oku, kod yazmadan önce)

Bu araç bir **tartışma odası değil**, bir **teşhis + zorlanmış karar makinesidir**.

Kullanıcı (Burak) genelde kararsız gelir. Kararsızlığın sebebi *az görüş* değil, *çok görüş*. O yüzden bu sistemin amacı daha fazla görüş üretmek değil — **anlaşmazlığın tam olarak nereden kaynaklandığını görünür kılmak**. Kullanıcı "demek ben aslında hız mı kalite mi diye ayrışmışım" dediği an iş biter.

Bu yüzden çıktı her zaman: **net bir tavır + güven skoru + anlaşmazlığın hangi eksende olduğu + fikrini değiştirecek koşul.** Tartışma sadece girdidir; çıktı asla "öte yandan şöyle de bakılabilir" bulamacı olamaz.

**Üç kutsal kural (bunları bozarsan proje amacını kaybeder):**

1. **Faz 1'de modeller birbirini GÖRMEZ.** İzolasyon korelasyonu kırar. Bu modeller aynı veriyle eğitildi, aynı RLHF ile "uzlaşmacı ol" diye ayarlandı — birbirini görürlerse anında yamanır, sahte konsensüs çıkar. En değerli sinyal Faz 1'in *dağılımındadır*, sonraki fazların *birliğinde* değil.
2. **Oylama KARAR VERMEZ, sinyal üretir.** Kararı moderatör verir. Sayım sadece güven sinyalidir ve **ağırlıklıdır** — ham kafa sayısı değil. `confidence` alanı asla `support / total` formülüyle hesaplanmaz.
3. **Sentez anlaşmazlığı silmez.** Azınlık raporu her zaman hayatta kalır ve görünür olur. Çoğu zaman doğru görüş azınlık görüşüdür; oylama mantığı onu çöpe atar, biz atmayız.

---

## 1. Teknik Stack

Burak'ın mevcut stack'iyle hizalı (Unity Architect AI / Jarvan pattern'leri):

| Katman | Teknoloji |
|---|---|
| Desktop shell | Electron |
| Frontend | React 18 + TypeScript + Vite |
| State machine | XState (faz akışı birebir bir state machine — manuel reducer da olur ama XState daha temiz) |
| Animasyon | Framer Motion (pop/slam/banner geçişleri) + CSS `steps()` (sprite animasyonu) |
| Backend / orchestrator | FastAPI (Python) |
| Streaming | SSE (Server-Sent Events) — her faz/karakter için ayrı event |
| Provider katmanı | **Hibrit adapter** — bazı üyeler abonelik CLI'ı (Claude Code, Codex, agy), bazıları API (DeepSeek, Grok). Her üye aynı girdi/çıktı kontratını uygular, backend değişebilir. (bkz. §2.1) |
| Eşzamanlılık | `asyncio.gather` (Faz 1 paralel çağrılar) |

Auth yok — Unity Architect'teki gibi local/IDE pozisyonlama.

---

## 2. Meclis Üyeleri

5 model + 1 moderatör. Moderatör **ayrı bir instance** — persona prompt'u yok, görüşü yok, sadece haritalar ve zorlar.

| Karakter | Rol | Model | Backend (nasıl çağrılır) | Tek işi | Dengelediği tuzak | İmza rengi |
|---|---|---|---|---|---|---|
| **Athena** | Stratejist | Claude Opus 4.8 | **Claude Code** (interaktif, `-p` YOK) | 2. ve 3. dereceden sonuçlar — "6 ay sonra bu bizi nereye götürür" | kısa vadeci heyecan | Mor (royal) |
| **Socrates** | Şüpheci | GPT 5.5 | **Codex** (`codex exec`) | Mantığın **içindeki** çürüğü bul, varsayıma saldır (epistemik) | "kulağa mantıklı geliyor" | Kırmızı |
| **Apollo** | Yaratıcı | Gemini 3.5 Flash (varsayılan) / 3.1 Pro (opsiyon) | **agy** (Antigravity CLI) | Problemi yeniden çerçevele — "ya hiç yapmasak" | aynı çözüm uzayında sıkışmak | Teal/yeşil |
| **Hephaestus** | Mühendis | DeepSeek V4 Flash | **API** | Fizibilite, maliyet, gerçek emek + teknik borç | "kağıt üzerinde kolay" | Çelik mavisi |
| **Atlas** | Realist | Grok 4.1 Fast | **API** | Veri, sayı, "bunu kim neden parayla kullanır" (ampirik) | kendi fikrine âşık olma | Amber/altın |
| **Themis** | Yargıç | Claude Opus 4.8 | **Claude Code** (ayrı interaktif oturum) | Çerçeveler, fay hattını seçer, itirazları hükme bağlar, sentezler | — | Nötr/altın |

> **Backend kararları (neden böyle):**
> - **Claude → Claude Code interaktif, `-p` DEĞİL.** Pratikte `-p` headless ayrı/sınırlı token havuzu yiyor ve bütçeyi patlatıyor; interaktif oturum ise düzgün çalışıyor. O yüzden Claude tarafı pty ile sürülen interaktif oturum (§2.1).
> - **Gemini → agy, Opus 4.6'sı DEĞİL.** agy içinde Claude Opus 4.6 da var ama o eski sürüm; Claude'u Claude Code'dan (Opus 4.8) sürmek daha güncel. agy sadece Gemini için. **3.5 Flash varsayılan** (hızlı + bu rol için fazlasıyla iyi), karmaşık davalarda 3.1 Pro'ya `--model` ile geçilebilir.
> - **DeepSeek + Grok → API.** CLI eşdeğerleri yok; zaten kuruşluk maliyet (§ pricing notu).
> - ⚠️ **agy/Gemini CLI geçişi:** Gemini CLI 18 Haziran 2026'da consumer'lar için kapanıyor, agy resmi halefi. Apollo'yu baştan agy üzerine kur, Gemini CLI'a bağlanma.

> **İsim mantığı (eşleştirme kasıtlı):** Athena = bilgelik/strateji. Socrates = elenchus, mantığı sorgulama. Apollo = sanat/farklı açı. Hephaestus = demirci/yapıcı (fizibilite). Atlas = dünyanın yükünü taşır (veri/pazar). Themis = adaletin terazisi (tarafsız).
> **Socrates ≠ Atlas ayrımını isimler korumalı:** Socrates *mantığa* itiraz eder, Atlas *gerçeğe* dayanır.

> **DİKKAT — Şüpheci ≠ Realist.** İkisi sürekli üst üste binmeye meyillidir, bunu engelle:
> - **Şüpheci** senin *akıl yürütmene* saldırır: "X varsayımın temelsiz, çünkü..." (epistemik, içsel mantık)
> - **Realist** *dış dünyaya/sayılara* dayanır: "Pazar hayır diyor, çünkü veri..." (ampirik, dışsal kanıt)
> Prompt'larında bu ayrımı sertçe vurgula. Aynı sesi iki kez duyarsak rol tasarımı çökmüştür.

### Model çağrı parametreleri

| Rol | temperature | Not |
|---|---|---|
| Stratejist | 0.5 | dengeli |
| Şüpheci | 0.3 | keskin, tutarlı |
| Yaratıcı | 0.9 | ışınsın |
| Mühendis | 0.3 | sayılarda tutarlı |
| Realist | 0.4 | veri odaklı |
| Yargıç | 0.2 | tarafsız, deterministik sentez |

Config (`.env`) — string'leri hardcode etme, değişiyorlar:
```
# Claude (Claude Code interaktif — API key değil, login auth)
CLAUDE_CODE_BIN=claude
MODEL_ATHENA=claude-opus-4-8
MODEL_THEMIS=claude-opus-4-8

# GPT (Codex exec — login auth)
CODEX_BIN=codex
MODEL_SOCRATES=<gpt-5.5 / codex model string>

# Gemini (agy — login auth)
AGY_BIN=agy
MODEL_APOLLO=gemini-3.5-flash   # opsiyon: gemini-3.1-pro

# API tarafı (key gerekli)
DEEPSEEK_API_KEY=...
MODEL_HEPHAESTUS=deepseek-v4-flash
XAI_API_KEY=...
MODEL_ATLAS=grok-4.1-fast
```

---

## 2.1 Adapter Katmanı (en kritik mimari karar)

Her üye **aynı kontratı** uygular: `ask(proposition, persona, context) -> MemberResponse (JSON)`. Backend (CLI mi API mi) adapter'ın içinde gizlenir. Orchestrator hangi backend'in çağrıldığını bilmez — sadece JSON alır. Böylece kişisel v1'de CLI, ileride ürünleştirmede API'ye config flip'le geçilir.

```
interface MemberAdapter {
  ask(proposition, persona, context?) -> MemberResponse
}
```

Dört tip adapter:

### 1. ClaudeCodeAdapter (Athena, Themis) — interaktif, `-p` YOK
`-p` headless token havuzunu patlatıyordu; bunun yerine **pty/pexpect ile interaktif bir Claude Code oturumu sürülür.** Mantık:
- Orchestrator başında her Claude üyesi için bir kalıcı interaktif oturum spawn edilir (`pexpect.spawn("claude")`).
- Prompt gönderilir; cevap TUI çıktısı olarak gelir.
- **Parse problemi (TUI gürültülü):** Persona prompt'una sentinel sınırlayıcı dayat — model cevabı `===DIVAN_JSON_START=== {...} ===DIVAN_JSON_END===` arasında versin. Orchestrator ANSI escape kodlarını strip'ler, sentinel arası JSON'ı çeker.
- Faz 2'de aynı üye kendi oturumunda devam eder (bağlamı zaten taşıyor — `--resume`'a bile gerek yok, oturum açık).
- Pseudocode:
```python
session = pexpect.spawn(f"{CLAUDE_CODE_BIN}", encoding="utf-8")
session.sendline(persona_prompt + "\n" + proposition + "\nCevabı sentinel arasında JSON ver.")
session.expect("===DIVAN_JSON_END===", timeout=120)
raw = strip_ansi(session.before)
response = extract_json_between_sentinels(raw)
```

### 2. CodexAdapter (Socrates) — `codex exec`
- `codex exec --json --output-schema member_schema.json --skip-git-repo-check --sandbox read-only --ephemeral "<persona + proposition>"`
- `--output-schema` çıktıyı şemaya zorlar → parse garantili.
- `--sandbox read-only --ephemeral` → kodlama davranışı kapalı, diske yazmaz, saf görüş.
- ⚠️ Eğer Codex de `claude -p` gibi token/limit sorunu çıkarırsa, ClaudeCodeAdapter'daki pty-interaktif desene düş (`codex` interaktif + sentinel).

### 3. AgyAdapter (Apollo) — `agy -p`
- `agy -p "<persona + proposition>" --output-format json --model gemini-3.5-flash`
- Google planından faturalanır, ayrı API key yok.
- Yüksek temp isteyen tek rol burası (yaratıcı); agy temp'i net açmıyorsa prompt'la "ışınla, sıra dışı açılar üret" diye telafi et.

### 4. ApiAdapter (Hephaestus, Atlas) — düz HTTP
- DeepSeek + Grok standart chat completions endpoint'i. `temperature` burada net kontrol edilebilir.
- `response_format: json_object` (destekliyorsa) ile parse garantile.

> **Neden bu kadar uğraş:** Çünkü §0'daki kutsal kuralları (izolasyon, JSON kontratı) backend ne olursa olsun korumak için tek bir kontrat şart. Adapter sınırı olmadan, 4 farklı invocation yöntemi orchestrator'a sızar ve pipeline kırılgan olur.

> **Temperature uyarısı:** CLI'lar temp'i net açmıyor. Şans eseri CLI'daki üçü (Athena 0.5, Socrates 0.3, Themis 0.2) düşük/orta istiyor — varsayılana yakın, sorun değil. Yüksek temp isteyen Apollo agy'de, orada prompt'la telafi. API'deki ikisinde (Hephaestus, Atlas) temp tam kontrol var.

---

## 3. Akış (4 Faz)

```
Ham soru
  │
  ▼
[Faz 0] ÇERÇEVELEME (Yargıç)         → bulanık soruyu karar verilebilir önermeye çevirir
  │
  ▼
[Faz 1] BAĞIMSIZ AÇILIŞ (5 model)    → PARALEL, İZOLE. Birbirini görmez. (en kritik faz)
  │
  ▼
[Faz 2] ÇATIŞMA (tek eksen, 1 tur)   → Yargıç fay hattını seçer, modeller SADECE o eksende çarpışır
  │
  ▼
[Faz 3] SENTEZ (Yargıç, oylama=sinyal) → karar + güven + ağırlıklı oy + kill-condition + azınlık raporu
```

### Faz 0 — Çerçeveleme
**En sık atlanacak ama en önemli adım.** Yargıç, kullanıcının bulanık sorusunu *karar verilebilir bir önermeye* çevirir.
- Girdi: ham soru ("Jarvan'a sesli mod ekleyeyim mi?")
- Çıktı: keskin önerme + cevap formatı ("Önümüzdeki 2 hafta içinde frontend overhaul'u durdurup Jarvan'a sesli modu eklemek doğru öncelik mi? **Evet/Hayır.**")
- Kötü girdi = kötü çıktı. Bulanık soru girerse 5 model 5 yöne dağılır, sentez çöp olur.
- UI: Yargıç davayı okur, sahne kurulur.

### Faz 1 — Bağımsız Açılış
**Sistemin kalbi.** 5 model paralel, izole, birbirini görmeden cevap verir.
- Her modele giden context: **SADECE** önerme + kendi persona system prompt'u. Başka modelin cevabı ASLA enjekte edilmez.
- `asyncio.gather` ile paralel.
- Her model bu şemada döner (bkz. §4 schema).
- UI: karakterler sırayla "ifade verir" (sequential reveal — mahkeme hissi). Arka planda paralel gelir ama önümüze tek tek dökülür.

### Faz 2 — Çatışma (mekanik itiraz)
Serbest tartışma DEĞİL. Hedefli, tek eksen. İtiraz burada **görsel efekt değil, sistemin mekanik parçasıdır.**
- Themis, Faz 1 çıktılarına bakar ve **tek bir fay hattı** bulur (karar aslında neye bağlı).
- Sonra modelleri *sadece o eksende* karşı karşıya getirir: her modele rakibin en güçlü argümanı enjekte edilir.
- Bir karakter, başka birinin iddiasına **resmi itiraz** edebilir (`objection`). İtiraz sadece "katılmıyorum" değil; *hangi iddiaya, neden* itiraz ettiğini belirtir.
- **Themis itirazı hükme bağlar:** `upheld` (haklı) veya `overruled` (haksız).
  - `overruled` → itiraz kaydedilir ama akış devam eder.
  - `upheld` → **sadece o tek noktada bir hedefli alt-tur** açılır. İlgili taraflar o iddiayı yeniden ele alır.
- **SINIR (kritik):** İtiraz başına **maksimum 1 alt-tur.** Açık uçlu yeni round YOK. Alt-tur da tek eksen, tek nokta. Zorlama fonksiyonu kalsın, döngü olmasın — yoksa konsensüse yapay yakınsama ve gerçek anlaşmazlığın kaybı geri gelir.
- Toplam itiraz/alt-tur tavanı: bütün Faz 2 için **en fazla 2 upheld alt-tur.** Themis bunu aşamaz; aşması gerekiyorsa "bu eksende anlaşmazlık çözülemez, senteze taşınıyor" der.
- UI: **OBJECTION! / İTİRAZ! anı** — itiraz eden karakter desk slam + banner + SFX. `upheld`/`overruled` Themis'in tokmağıyla görselleşir. Bu efektler itiraz *mekaniğini* görünür kılar, mekaniğin yerine geçmez.

### Faz 3 — Sentez
Yargıç tüm transkripti alır, yapılandırılmış karar üretir (bkz. §4 verdict schema).
- Oylama burada devreye girer ama **karar üretmez** — moderatörün kararına eşlik eden bir sinyaldir.
- UI: gavel slam + verdict kartı + ağırlıklı güven göstergesi + iki tarafa dizilmiş portreler + ayakta kalan azınlık.

---

## 4. Veri Şemaları (fazlar arası kontrat)

### Faz 0 çıktısı
```json
{
  "raw_question": "...",
  "proposition": "Net, karar verilebilir önerme",
  "answer_format": "yes_no | choice | scalar",
  "options": ["...", "..."]
}
```

### Faz 1 — her modelin açılışı
```json
{
  "role": "stratejist | supheci | yaratici | muhendis | realist",
  "stance": "Tek cümle net pozisyon",
  "reasons": ["gerekçe 1", "gerekçe 2", "gerekçe 3"],
  "confidence": 0,
  "flip_condition": "Şu doğruysa fikrimi değiştiririm: ..."
}
```
> `flip_condition` altın değerinde. 5 modelin flip koşulları üst üste binince, kullanıcının gidip **araştırması/test etmesi gereken somut soru listesi** çıkar. Sistem "şunu yap" demekle kalmaz, "şu 2 şeyi öğrenirsen kararın kesinleşir" der. Kararsızlığı çözen tam olarak budur.

### Faz 2 — çatışma turu
```json
{
  "fault_line": "Anlaşmazlığın tek ekseni",
  "exchanges": [
    {
      "from": "athena",
      "targets": "atlas",
      "claim_challenged": "Hangi iddiaya itiraz ediliyor",
      "argument": "İtiraz gerekçesi",
      "objection": true,
      "ruling": "upheld | overruled",
      "sub_round": "upheld ise: o noktada açılan hedefli alt-tur çıktısı, yoksa null"
    }
  ],
  "upheld_count": 0
}
```
> `upheld_count` 2'yi geçemez. Themis bu tavanı zorlarsa anlaşmazlığı senteze taşır, yeni tur açmaz.

### Faz 3 — VERDICT (nihai çıktı)
```json
{
  "decision": "Net tavır — şunu yap",
  "confidence": 72,
  "vote_signal": { "support": 4, "oppose": 1 },
  "confidence_weighted": "4 destek (ort. güven 68) / 1 karşı (güven 88)",
  "dissenter": "realist",
  "dissent_is_load_bearing": true,
  "consensus": "Herkesin hemfikir olduğu, tartışmaya gerek olmayan kısım",
  "fault_line": "Karar aslında neye bağlı",
  "kill_condition": "Şu olursa bu karar yanlıştı, geri dön",
  "minority_report": "Muhalif görüş — silinmez, görünür kalır",
  "open_questions": ["flip koşullarından türeyen, araştırılacak somut sorular"]
}
```

> **`confidence` nasıl hesaplanır (KRİTİK):**
> `confidence`, Yargıç'ın *yorumudur* — şunları hesaba katar: ağırlıklı oy, korelasyon (modeller birbirine benzer, 4-1 göründüğü kadar güçlü mutabakat DEĞİL), muhalifin kim olduğu, ve `dissent_is_load_bearing`.
> **ASLA `support / total` ile hesaplanmaz.** `vote_signal` ham veridir, yanında durur; confidence'ı o yapmaz.
> Eğer tek muhalifin flip koşulu gerçekleşmesi muhtemel bir şeyse → 4-1 güveni **artırmaz, düşürür.** O zaman `dissent_is_load_bearing: true` ve confidence aşağı çekilir.

---

## 5. Frontend — Oyunlaştırma (Ace Attorney estetiği)

### Mahkeme eşlemesi
| Oyun öğesi | Divan karşılığı |
|---|---|
| Dava | Önerme (Faz 0 çıktısı) |
| Avukatlar / karakterler | 5 model, her biri pixel portre + isimlik |
| Açılış ifadeleri | Faz 1 — karakterler sırayla konuşur |
| "OBJECTION!" / "İTİRAZ!" | Faz 2 — model rakibe karşı çıkınca |
| Yargıç + tokmak | Faz 3 — sentez/karar |
| Health bar | Güven göstergesi (confidence meter) |
| Court record / kanıt | Birikmiş argümanlar + önerme paneli |

### Ekran düzeni
```
┌─────────────────────────────────────────────┐
│  [Faz göstergesi: ● Çerçeveleme ○ Açılış ...]  │  ← üst şerit
├─────────────────────────────────────────────┤
│                                               │
│        [ Pixel sahne + karakter sprite ]      │  ← üst 2/3
│                                               │
├─────────────────────────────────────────────┤
│ ▌İSİMLİK▐  Karakterin tam argümanı burada     │  ← alt 1/3
│  streaming ile, RAHAT OKUNUR fontta dökülür   │     dialog box
└─────────────────────────────────────────────┘
   [Yan panel: önerme + court record + güven]
```

### Sprite state machine (her karakter için)
Confidence skoru → poz eşlemesi:
| State | Tetikleyici | Animasyon |
|---|---|---|
| `idle` | sıra beklerken | hafif idle döngüsü |
| `speaking` | konuşurken | ağız/text-blip animasyonu |
| `confident` | confidence ≥ 80 | işaret etme / kollar kavuşmuş poz |
| `nervous` | confidence ≤ 49 veya köşeye sıkışınca | terleme damlası, gergin poz |
| `objection` | Faz 2'de karşı çıkınca | masaya vurma (desk slam) + "İTİRAZ!" banner |
| `conceding` | flip koşulu tetiklenince / kabul edince | başını eğme |

### Animasyon & efekt kuralları (ÖNEMLİ — şirinlik işlevi gömmesin)
- **Argüman metni HER ZAMAN tam ve rahat okunur.** Bu araç bir teşhis aleti; kullanıcı sunumu izleyip içeriği kaçırırsa amaç ölür.
- Pixel/retro font (Press Start 2P, Silkscreen) **sadece isimlik + banner + başlıklarda.** Uzun teknik argümanlar temiz, okunaklı bir fontta (örn. system-ui veya hafif monospace).
- Efektler (slam, banner, gavel) sadece **geçiş anlarında** — argüman okunurken sahne sakin.
- Text streaming: SSE token'larını text-blip SFX ile dök (Ace Attorney dialog hissi), ama "skip/instant" butonu olsun — okumak isteyene engel olma.
- `prefers-reduced-motion` desteği zorunlu.

### Görsel kimlik
- Her karaktere imza rengi (§2 tablosu). Verdict ekranında destek/karşı tarafları bu renklerle diz.
- Pixel portreler: başlangıçta her karaktere distinct renkli basit pixel avatar yeterli; gerçek sprite'ları sonra swap'le (placeholder-first).
- SFX: itiraz sesi, masa vuruşu, text blip, tokmak, verdict fanfarı.

> **⚠️ HUKUKİ NOT:** Ace Attorney'in ses/görsel asset'lerini (sprite, SFX, müzik) KOPYALAMA. Capcom IP'si. Estetiği taklit et, asset'leri kendi üret veya royalty-free kaynak kullan. "Objection.lol" tarzı ripped asset'ler kullanma.

---

## 6. Proje Yapısı

```
divan/
├── CLAUDE.md
├── .env.example
├── backend/
│   ├── main.py                  # FastAPI app + SSE endpoints
│   ├── orchestrator.py          # 4-faz pipeline
│   ├── adapters/
│   │   ├── base.py              # MemberAdapter interface (ask -> JSON kontratı)
│   │   ├── claude_code.py       # pty/pexpect interaktif, -p YOK (Athena, Themis)
│   │   ├── codex.py             # codex exec --output-schema (Socrates)
│   │   ├── agy.py               # agy -p --output-format json (Apollo)
│   │   └── api.py               # DeepSeek + Grok HTTP (Hephaestus, Atlas)
│   ├── personas/
│   │   ├── athena.md            # Stratejist
│   │   ├── socrates.md          # Şüpheci
│   │   ├── apollo.md            # Yaratıcı
│   │   ├── hephaestus.md        # Mühendis
│   │   ├── atlas.md             # Realist
│   │   └── themis.md            # moderatör — persona DEĞİL, sentez talimatı
│   ├── phases/
│   │   ├── phase0_frame.py
│   │   ├── phase1_open.py       # asyncio.gather, izole
│   │   ├── phase2_clash.py
│   │   └── phase3_verdict.py
│   └── schemas.py               # pydantic modeller (§4)
├── electron/
│   └── main.ts
└── src/                          # React frontend
    ├── App.tsx
    ├── trial-machine.ts          # XState: faz akışı
    ├── components/
    │   ├── Courtroom.tsx         # sahne + sprite
    │   ├── DialogueBox.tsx       # streaming argüman + isimlik
    │   ├── CharacterSprite.tsx   # state machine'li sprite
    │   ├── ObjectionBanner.tsx   # İTİRAZ! efekti
    │   ├── PhaseIndicator.tsx
    │   ├── CourtRecord.tsx       # önerme + birikmiş argümanlar
    │   └── VerdictCard.tsx       # §4 verdict render
    ├── hooks/
    │   └── useSSE.ts
    └── assets/                   # placeholder pixel portreler, SFX
```

---

## 7. Persona Prompt Şablonu

Her persona MD dosyası şu iskeleti izler:
```
# Rol: <isim>
Sen bir mecliste <rol> rolündesin. Tek işin: <tek iş cümlesi>.

## Bakış açın
<karakterin nasıl düşündüğü — §2'deki "tek işi" ve "dengelediği tuzak">

## Kurallar
- Diğer üyeleri görmüyorsun (Faz 1). Sadece önermeye cevap ver.
- Kısa, net, karakterinde konuş. <konuşma tarzı>
- ASLA uzlaşmacı olma, rolünü oyna.

## Çıktı formatı (KESİN JSON)
{ "role": "...", "stance": "...", "reasons": [...], "confidence": <0-100>, "flip_condition": "..." }
Sadece JSON döndür. Markdown, ön söz, ``` YOK.
```

**Yargıç farklı** — persona yok, şu talimatı alır: "Sen tarafsız bir yargıçsın. Görüşün yok. Görevin: önermeyi netleştir (Faz 0), fay hattını bul (Faz 2), §4 verdict şemasını üret (Faz 3). confidence'ı ASLA oy sayımından hesaplama — yorumla, korelasyonu ve load-bearing dissent'i hesaba kat."

---

## 8. Yapım Sırası (milestone'lar)

1. **Adapter katmanı + tek üye testi.** Önce en riskli backend: ClaudeCodeAdapter (pty interaktif, sentinel JSON parse). Bir Claude üyesine prompt atıp temiz JSON alabiliyor musun? Bu çalışıyorsa gerisi kolay. Sonra Codex, agy, API adapter'larını aynı kontrata oturt. (En riskli kısım önce — 4 farklı backend tek `ask()` kontratını veriyor mu?)
2. **Faz 1 izole + paralel.** `asyncio.gather`, her model SADECE önerme görüyor. JSON şema validasyonu (pydantic).
3. **Faz 0 + Faz 3 (Yargıç).** Çerçeveleme ve sentez. Verdict şeması üretiliyor. — Bu noktada **headless çalışan tam bir karar makinen var.** UI olmadan terminal'den test et.
4. **Faz 2 çatışma.** Fault line seçimi + hedefli tur.
5. **SSE streaming.** Backend → frontend event akışı.
6. **Frontend temel.** XState faz akışı, dialogue box, streaming argüman, court record. — **Önce okunabilirlik, oyunlaştırma yok.** Sistem çıplak haliyle işe yarıyor mu?
7. **Oyunlaştırma katmanı.** Sprite'lar, state machine pozları, İTİRAZ! banner, SFX, verdict ekranı, pixel estetik. — En son, çünkü çekirdek değer buna bağlı değil.

> Sıralama bilinçli: **çekirdek karar mantığı oyunlaştırmadan tamamen bağımsız çalışmalı.** Oyunlaştırma çökse bile araç işlevini korur. Tersi olamaz.

---

## 9. Vakanüvis — Dava Arşivi & Örüntü (otomatik ağırlıklandırma YOK)

Sistem geçmişi hatırlamalı ama **kendini ayarlamamalı.** Burada keskin bir çizgi var, dikkatle uygula.

### Yapılacak: Vakanüvis (the Chronicle)
- Her dava arşivlenir: önerme, 5 açılış, fay hattı, itirazlar+hükümler, verdict, ve (varsa) **sonradan girilen gerçek sonuç.**
- Depolama: local SQLite (Jarvan'daki log pattern'i).
- Kullanıcı bir kararı kapatırken sonucu işaretleyebilir: `tuttu / tutmadı / belirsiz / çözülmedi`.
- Sistem bundan **tarif edici (descriptive) örüntü** çıkarır ve **kullanıcıya gösterir:**
  > "Scope/timeline davalarında Atlas'ın karamsarlığı, sonucu işaretlenmiş 9 davanın 7'sinde gerçekle örtüşmüş. Bu sefer Atlas'ın timeline itirazına ekstra ağırlık vermek isteyebilirsin."
- Örüntü **alana özeldir** (Atlas pazarda isabetliyken mimaride olmayabilir) ve her zaman override edilebilir bir öneridir.

### Yapılmayacak: Otomatik güvenilirlik ağırlıklandırması
GPT'nin "Atlas %81 doğruysa itirazları otomatik daha ağır sayılsın" önerisi **reddedildi.** Sebepler:
1. **Ground truth yok.** Kararların çoğunun temiz/ölçülebilir sonucu yok. Doğrulanmamış sonuç üzerinden puan, "Burak'ın sonunda yaptığıyla aynı fikirde miydi"yi ölçer → sana duymak istediğini söyleyeni ödüllendirir.
2. **Aracın amacını ters çevirir.** Felsefe (§0): *azınlık görüşü genelde haklı olandır, anlaşmazlığı koru.* Otomatik ağırlık tam tersini yapar — muhalifi sistematik kısar, konsey yankı odasına döner. Kaçtığımız tuzak "feature" kılığında geri gelir.
3. **Rolleri yanlış ölçer.** Şüphecinin işi haklı çıkmak değil, çürük yakalamak. 10 risk işaret edip 2'si gerçekleşen ama o 2'si felaket olan bir Socrates işini kusursuz yapmıştır. Hit-rate bunu cezalandırır.

**Çizgi net:** Veri topla + örüntüyü kullanıcıya göster = EVET. Skoru sistemin kararına/confidence'ına otomatik girdi yap = HAYIR. Human-in-the-loop, mekanik susturma değil.

---

## 10. YAPMA Listesi (tasarım bütünlüğü koruması)

Claude Code "yardımcı olmak" için bunları bozmaya meyilli olacak. Bozma:

1. ❌ Faz 1'de bir modele başka modelin cevabını "context olsun diye" verme. İzolasyon kasıtlı.
2. ❌ Kararı `majority` ile belirleme. Themis karar verir, oy sadece ağırlıklı sinyal.
3. ❌ `confidence = support / total` yapma. confidence Themis'in yorumudur.
4. ❌ Faz 2'yi "konsensüse ulaşana kadar" döngüye sokma. İtiraz başına max 1 alt-tur, toplam max 2 upheld.
5. ❌ Socrates (Şüpheci) ile Atlas (Realist) aynı işe sokma. Biri epistemik (mantık), biri ampirik (veri).
6. ❌ Themis'e (Yargıç) persona/görüş verme. Ayrı instance, tarafsız.
7. ❌ Sentezde anlaşmazlığı törpüleme. `minority_report` her zaman hayatta kalır.
8. ❌ Oyunlaştırmayı argümanların önüne geçirme. Metin her zaman tam ve okunur.
9. ❌ Ace Attorney asset'lerini ripleme. IP ihlali.
10. ❌ Model string'lerini koda hardcode etme. `.env`'de tut.
11. ❌ **Vakanüvis güvenilirlik örüntüsünü confidence'a veya oy ağırlığına otomatik girdi yapma.** Sadece kullanıcıya gösterilir; kararı insan verir. (bkz. §9)
12. ❌ **Claude tarafında `-p` headless kullanma.** Token havuzunu patlatıyor; interaktif oturum + pty (§2.1). Bu kişisel kullanım içindir — Divan ürünleşirse abonelik CLI'ı backend yapmak ToS ihlali, o noktada API adapter'a geç.

---

## 11. Açık Sorular (Burak karar verecek)

- ~~Faz 1 JSON şeması mı serbest metin mi?~~ → **Karar: JSON şema.**
- ~~Davalar kaydedilsin mi?~~ → **Karar: evet, Vakanüvis (§9), local SQLite.**
- Sonuç işaretleme zorunlu mu opsiyonel mi? → öneri: opsiyonel, hatırlatma ile (kapanmamış davalar "çözülmedi" kalır).
- Kullanıcı runtime'da bir karaktere "daha sert ol" diyebilsin mi? → v2.
- Vakanüvis örüntüsü ne zaman gösterilsin — Faz 0'da mı (önyargı yaratır mı?) yoksa verdict'ten sonra mı? → öneri: **verdict'ten sonra**, kararı kirletmesin.

---

## 12. Yapım Durumu — HANDOFF (Codex devam edecek)

> **Bağlam:** Milestone 1'in en riskli parçası (ClaudeCodeAdapter, §8.1) **bitti ve canlı kanıtlandı.** Bu bölüm Codex'in sıfırdan keşfetmemesi için acıyla öğrenilen mekanikleri kayda geçirir. Aşağıdaki "öğrenilen kurallar" **uygulanmış gerçeklerdir**, yeniden tartışma.

### ✅ Tamamlanan (çalışıyor)
- `backend/schemas.py` — §4 pydantic modelleri (Frame, MemberResponse, Exchange/Clash, Verdict). `flip_condition` artık `min_length=1` (boş gelirse validasyon patlar — kasıtlı kalite kapısı).
- `backend/adapters/base.py` — `MemberAdapter` ABC (`async ask(proposition, context=None) -> MemberResponse`), `strip_ansi`, `extract_json_between_sentinels`, `build_member_prompt`, `load_persona`.
- `backend/adapters/claude_code.py` — **ClaudeCodeAdapter, KANITLANDI.** Athena persona'sıyla gerçek interaktif Claude Code oturumu ConPTY üzerinden sürülüyor, şema-geçerli MemberResponse dönüyor (Türkçe kusursuz, flip_condition dolu).
- `backend/adapters/codex.py` — **CodexAdapter, KANITLANDI.** `codex.cmd exec`, stdin prompt, `--output-schema backend/member_schema.json`, `--output-last-message <tmp>.json`; Socrates canlı şema-geçerli MemberResponse döndürdü.
- `backend/adapters/agy.py` — **AgyAdapter, KANITLANDI.** `agy --print` sentinel prompt ile çalışıyor; stdout bug'ı için transcript fallback var (`last_conversations.json` → `brain/<id>/.system_generated/logs/transcript.jsonl` → son sentinel'li `PLANNER_RESPONSE.content`). Apollo canlı şema-geçerli MemberResponse döndürdü.
- `backend/member_schema.json`, `backend/adapters/api.py`, `backend/adapters/factory.py`, `backend/phases/phase1_open.py` — schema, API placeholder, default adapter wiring ve Faz 1 izole/paralel runner eklendi.
- `backend/personas/athena.md`, `backend/.env.example` (kök `.env.example`).
- venv: `backend/.venv` — kurulu paketler: `pydantic`, `python-dotenv`, `pywinpty`, `pexpect`.
- Çalışan kabul testleri: `backend/test_member.py`, `backend/test_codex_member.py`, `backend/test_agy_member.py` (canlı), `backend/test_phase1.py`, `backend/test_agy_transcript.py`.

### 🔑 Öğrenilen kurallar (Windows + Claude Code TUI — TEKRAR KEŞFETME)
1. **pexpect pty Windows'ta YOK.** Claude interaktif oturumu `pywinpty` (ConPTY) ile sürülür: `from winpty import PtyProcess; PtyProcess.spawn([cmd], dimensions=(50, 400))`.
2. **`.cmd` shim'i çöz.** `shutil.which("claude.cmd")` — npm shim'i. Doğrudan `claude` (bash script) ConPTY'de çalışmaz.
3. **`read()` BLOKLAR.** Okuma daemon thread'inde sürekli yapılır, buffer lock'la paylaşılır. Ana akış buffer'ı poll'lar.
4. **Prompt gönderimi:** bracketed-paste ile tek parça → `proc.write("\x1b[200~" + prompt + "\x1b[201~")`, kısa bekleme, sonra `proc.write("\r")` (submit). Çok satırlı prompt'un erken submit olmasını engeller.
5. **strip_ansi kelime aralarını korumalı.** TUI, asistan cevabındaki boşlukları LİTERAL boşluk yerine yatay imleç hareketiyle (`\x1b[NG` CHA / `\x1b[NC` CUF) çizer. Bunlar önce BOŞLUĞA çevrilir, sonra kalan ANSI silinir — yoksa kelimeler birleşir ("Evet yapilmali" → "Evetyapilmali").
6. **Satır kaydırması = JSON-içi kontrol karakteri.** Uzun tek-satır JSON terminal genişliğinde kelime sınırında kaydırılır → blob'a `\r\n` + girinti girer (JSON string'inde GEÇERSİZ). `extract` blob'da `[\r\n]+[ \t]*` → tek boşluk çökertir. Genişlik 400 kaydırmayı azaltır ama bu çökertme asıl güvencedir.
7. **Tamamlanma tespiti:** prompt echo'su da sentinel'leri içerir (prompt'ta var). Cevabın geldiği, temizlenmiş buffer'da `SENTINEL_END` sayısının **taban + 2** (echo + cevap) olmasından anlaşılır. Sonra SON START..END çifti çekilir.
8. **Encoding tuzağı YANILTICI.** `read()` zaten UTF-8 decode eder; veri doğrudur. cp1252 mojibake (ı→Ä±, —→â€") yalnızca **PowerShell `Get-Content` ve Python stdout→pipe** ekran artefaktıdır. Doğrulama için dosyaları `encoding="utf-8"` yazıp **Read tool** ile oku; konsol çıktısı için `PYTHONUTF8=1` set et.
9. **Rate limit parse hatası değildir.** Claude Code TUI `You've hit your session limit · resets ...` ekranını gösterebilir ve prompt echo'sundaki sentinel yüzünden parser yanlış bloğu çekebilir. `ClaudeCodeAdapter` önce rate-limit metnini yakalar ve temiz `RuntimeError` verir; JSON parse'a sokma.

### 🔑 Öğrenilen kurallar (agy / Antigravity CLI — TEKRAR KEŞFETME)
1. **`agy --print` stdout'a güvenilmez.** Gerçek TTY yokken exit 0 döndürüp model cevabını stdout'a yazmayabiliyor (issue #76/#115 davranışı). Subprocess otomasyonunda stdout boş/sentinel'siz kalırsa hata sanma.
2. **Transcript fallback kullan.** `~/.gemini/antigravity-cli/cache/last_conversations.json` içinden `cwd -> conversation_id` bulunur; sonra `~/.gemini/antigravity-cli/brain/<id>/.system_generated/logs/transcript.jsonl` içinde sondan geriye ilk sentinel'li `type=="PLANNER_RESPONSE"` + `content` okunur.
3. **`--log-file` workspace içine yönlendir.** Agy home altına log/config yazmaya çalışıp stderr'i kirletiyor; `--log-file <cwd>/.divan/agy.log` gürültüyü azaltır.
4. **`--output-format json` yok.** `agy help` 1.0.0'da böyle bir flag göstermiyor; JSON kontratı sentinel prompt + `extract_json_between_sentinels` ile korunur.
5. **Role alanı modelden değil adapter'dan gelir.** Apollo canlı testte `"role":"Apollo"` yazdı; `MemberAdapter._validate()` adapter role'unu otorite kabul eder ve `data["role"] = self.role` yapar.

### ▶️ Codex'in yapacağı (sıradaki)
1. **ApiAdapter (Hephaestus, Atlas) — placeholder canlı test bekliyor.** API key henüz yok (`.env`'de boş). HTTP iskeleti yazıldı; key gelince DeepSeek + Grok chat completions, `response_format: json_object`, temp tam kontrol ile test et.
2. **Milestone 2:** Faz 1 izole + paralel artık iskelet olarak hazır (`backend/phases/phase1_open.py`). Tüm canlı adapter'lar ve API key'ler hazır olunca beş üyeyi `build_default_member_adapters()` ile koştur; her model SADECE önermeyi görmeli.

### 🧹 Temizlenecek scratch dosyaları (silinebilir)
`backend/probe_claude.py`, `probe_send.py`, `probe_*_out.txt`, `region.txt`, `inspect_raw.py`, `test_parse_offline.py`, `test_parse_real.py`, `parse_real_out.txt`, `last_session_raw.txt`, `member_live.txt`. Bunlar keşif/debug iskeleleydi. `test_member.py` kalsın (kabul testi).

---

## 13. Frontend + Ses/Görsel Durumu — HANDOFF 2 (Codex devam edecek)

> **Bağlam:** Gemini'nin ilk frontend'i "web dashboard" gibiydi; tam ekran Ace Attorney tarzı VN masaüstü uygulamasına dönüştürüldü. Görseller ve sesler entegre edildi. Bu bölüm o işin **bitmiş gerçeklerini** ve Codex'in sıradaki işini kayda geçirir.

### ✅ Tamamlanan (frontend, çalışıyor + ekran görüntüsüyle doğrulandı)
- **Tam ekran VN sahnesi:** `frontend/src/components/Courtroom.tsx` — tek büyük aktif büst (her konuşmacı değişiminde giriş animasyonu), üstte roster şeridi (5 üye + yargıç), imza-renginde spot. `App.tsx` artık `fixed inset-0` tam ekran oyun kabuğu (eski `max-w-5xl` kart düzeni kaldırıldı). Başlangıç "Dava Dosyası" ekranı + karar ekranı.
- **KRİTİK CSS dersi:** `.vn-stage-bg`'ye `position:relative` KOYMA — `@tailwind utilities`'ten sonra geldiği için tailwind `absolute inset-0`'ı ezer, konteyner içerik-yüksekliğine çöker (sahne siyah kalır). Bu sınıf hep `absolute inset-0` ile kullanılır.
- **Manuel ilerleme (otomatik geçiş YOK):** `trial-machine.ts` artık her segmentte "DEVAM ▼" ile bekler. İlerleme: sahne/diyaloğa tıkla veya **Boşluk/Enter/→**. Metin akarken bir basış metni tamamlar, ikinci basış sıradakine geçer. (`advance()` fonksiyonu; `streamingRef`/`waitingRef` ile stale-closure'dan kaçınıldı.)
- **Mock hızlandırıldı:** `mockTrialStream.ts` gecikmeleri 120 ms'e kapatıldı (eski 6 sn'lik beklemeler "sırada… takılıyor" hissi veriyordu; manuel ilerleme olduğu için olaylar hızlı kuyruğa düşmeli).
- **Üye raporu:** `components/CouncilReport.tsx` — karar ekranında VerdictCard altında her üyenin duruşu/güveni/gerekçeleri/flip koşulu. (Kullanıcı isteği.)
- **Masaüstü:** `vite.config.ts` `base:'./'` (Electron file:// asset yolu). `electron/main.ts` DevTools artık otomatik açılmıyor (`DIVAN_DEVTOOLS=1` veya F12 ile açılır).
- **Ses (`utils/audio.ts`):** yazı sesi yumuşak tonsuz "tık" yapıldı. **Dosya-tabanlı SFX:** `src/assets/sfx/` içine konan dosyalar sentez yerine otomatik çalınır (glob ile). Tanınan adlar: `objection`, `gavel`, `desk-slam`, `verdict`, `blip` + **karaktere özel** `objection-<id>` (athena/socrates/apollo/hephaestus/atlas/themis).
- **Objection sesleri:** kullanıcının verdiği "Every Ace Attorney Objection.mp3" montajından (kökte, müzikli, kesintisiz) RMS dip-analiziyle 6 ayrı klip kesilip `objection-<id>.mp3` olarak kondu (ffmpeg; fade+loudnorm). Her karakterin farklı objection'ı var. Athena = kadın ses (kullanıcı seçti). ⚠️ Telif: bunlar Capcom IP'si; **kişisel kullanım** içindir, dağıtım için royalty-free/öz-üretim sesle değiştir.
- **Görseller:** karakter portreleri `src/assets/<id>.png` (kullanıcı "hepsi hazır" dedi). Mahkeme arka planı için `src/assets/bg/` içine görsel konursa `Courtroom.tsx` otomatik kullanır (glob). Portreler kare/arka-planlı geldiği için `.vn-char`'da vinyet maskesi var; şeffaf cutout PNG konursa daha iyi durur.
- Durum: `tsc --noEmit` ve `vite build` temiz. (Doğrulama için Electron `capturePage` ile ekran görüntüleri alındı; idle ortalanıyor, sahnede büst görünüyor, karar+rapor render oluyor.)

### ▶️ Codex'in yapacağı (öncelik sırası)
1. **Backend kod düzeltmeleri (küçük, net):**
   - `adapters/codex.py` — `MemberResponse.model_validate_json` `base._validate()`'i baypas ediyor (role-otoritesi + placeholder kontrolü atlanıyor). `json.loads` + `self._validate(data)`'ya çevir.
   - `adapters/api.py` — persona iki kez gidiyor (system message + `build_schema_member_prompt` başındaki persona). Birini çıkar.
2. **Faz 0/2/3 + orchestrator (EN BÜYÜK EKSİK).** Şu an sadece `phase1_open.py` var. `phases/phase0_frame.py` (Themis çerçeveleme), `phase2_clash.py` (fault-line + hedefli tur, §3 kuralları: itiraz başına max 1 alt-tur, toplam max 2 upheld), `phase3_verdict.py` (Themis sentez; confidence ASLA support/total DEĞİL). `orchestrator.py` 4 fazı bağlar. Themis için ayrı `ClaudeCodeAdapter` oturumu (persona değil, §7 yargıç talimatı).
3. **FastAPI + SSE (`main.py`).** Frontend kontratı HAZIR ve bekliyor:
   - `POST /api/trials` `{question}` → `{trial_id}`
   - `GET /api/trials/{trial_id}/events` → SSE; her event `frontend/src/types/trial.ts`'teki `TrialEvent` JSON'ı (phase_started/frame/member_started/member_response/objection/clash/verdict/error). Orchestrator fazları ilerledikçe bu eventleri yayınla. Frontend "GERÇEK SUNUCU" modu `http://localhost:8000`'e bağlanıyor.
4. **`requirements.txt`** (pin: pydantic, python-dotenv, pywinpty, pexpect, fastapi, uvicorn, httpx/requests). Şu an bağımlılıklar sadece `backend/.venv`'de.
5. API key'ler gelince ApiAdapter (DeepSeek+Grok) canlı test.

### 🔌 Frontend↔Backend kontrat özeti (değiştirme — frontend buna göre yazıldı)
`TrialEvent` tipleri ve `MemberResponse/Frame/Clash/Verdict` şekilleri `frontend/src/types/trial.ts` ile `backend/schemas.py` ZATEN birebir uyumlu. Backend SSE bu şekilleri aynen yollamalı (role değerleri: stratejist/supheci/yaratici/muhendis/realist).
