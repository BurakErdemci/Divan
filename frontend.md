# Divan Frontend Brief

Bu dosya Gemini/agy tarafına verilecek frontend uygulama talimatıdır. Önce `CLAUDE.md` dosyasını oku; özellikle §0, §3, §4, §5, §10 ve §12 bağlayıcıdır. Bu brief, o anayasanın frontend uygulama planıdır; çelişki varsa `CLAUDE.md` kazanır.

## Amaç

Divan için React 18 + TypeScript + Vite tabanlı bir mahkeme/konsey arayüzü kur. Uygulama Ace Attorney hissini çağrıştırmalı ama Capcom asset'i, ripped sprite, ripped SFX veya birebir kopya UI kullanmamalı. Estetik: özgün pixel-courtroom visual novel.

İlk ekran pazarlama/landing değil, çalışan karar oturumu ekranı olmalı:
- Kullanıcı bir önerme/soru girer.
- Dava başlar.
- Faz 0-3 akışı sahnede görünür.
- Backend yoksa mock event stream ile aynı akış çalışır.
- Backend hazır olduğunda aynı UI SSE eventleriyle beslenir.

## Değişmez Kurallar

- Faz 1 izolasyonu UI metninde ve akışında korunur: üyeler arka planda paralel gelebilir ama birbirini görmemiş gibi sırayla ifade verir.
- Karar oylamayla verilmez; verdict Themis'e aittir. Oy sadece sinyaldir.
- `confidence = support / total` yapma.
- Azınlık raporu verdict ekranında görünür kalır.
- Uzun argüman metni her zaman rahat okunur olmalı. Pixel font sadece isimlik, banner, kısa başlık ve faz etiketlerinde.
- `prefers-reduced-motion` desteği zorunlu.
- In-app tutorial, açıklama panoları, "bu özellik şunu yapar" metinleri koyma. Arayüz kendini kullandırsın.

## Teknik Stack

Beklenen yapı:

```text
package.json
index.html
src/
  main.tsx
  App.tsx
  trial-machine.ts
  api/
    trialClient.ts
    mockTrialStream.ts
  components/
    Courtroom.tsx
    DialogueBox.tsx
    CharacterSprite.tsx
    ObjectionBanner.tsx
    PhaseIndicator.tsx
    CourtRecord.tsx
    VerdictCard.tsx
  styles/
    app.css
  assets/
    sfx/
```

Kullan:
- React 18 + TypeScript + Vite
- XState veya küçük, açık bir phase state machine
- Framer Motion
- Lucide React ikonları

Yeni backend yazma. Frontend backend'e sadece HTTP/SSE client olarak bağlansın. Model CLI/API çağrıları asla frontend'den yapılmaz.

## Backend Bağlantısı

Şimdilik backend endpointleri tam hazır olmayabilir. Bu yüzden iki modlu client yaz:

1. `mockTrialStream.ts`: frontend geliştirme için deterministic demo eventleri üretir.
2. `trialClient.ts`: gerçek backend hazır olunca SSE'ye bağlanır.

Önerilen gerçek backend kontratı:

```text
POST /api/trials
body: { "question": string }
response: { "trial_id": string }

GET /api/trials/{trial_id}/events
response: text/event-stream
```

SSE event payloadları:

```ts
type TrialEvent =
  | { type: "phase_started"; phase: "frame" | "opening" | "clash" | "verdict" }
  | { type: "frame"; data: Frame }
  | { type: "member_started"; member: MemberId }
  | { type: "member_response"; member: MemberId; data: MemberResponse }
  | { type: "clash"; data: Clash }
  | { type: "objection"; from: MemberId; target: MemberId; claim: string; ruling?: "upheld" | "overruled" }
  | { type: "verdict"; data: Verdict }
  | { type: "error"; message: string };
```

Şema isimleri `backend/schemas.py` ile uyumlu olsun:

```ts
type Role = "stratejist" | "supheci" | "yaratici" | "muhendis" | "realist";
type MemberId = "athena" | "socrates" | "apollo" | "hephaestus" | "atlas" | "themis";

interface Frame {
  raw_question: string;
  proposition: string;
  answer_format: "yes_no" | "choice" | "scalar";
  options: string[];
}

interface MemberResponse {
  role: Role;
  stance: string;
  reasons: string[];
  confidence: number;
  flip_condition: string;
}

interface Clash {
  fault_line: string;
  exchanges: Array<{
    from: Role;
    targets: Role;
    claim_challenged: string;
    argument: string;
    objection: boolean;
    ruling: "upheld" | "overruled" | null;
    sub_round: string | null;
  }>;
  upheld_count: number;
}

interface Verdict {
  decision: string;
  confidence: number;
  vote_signal: { support: number; oppose: number };
  confidence_weighted: string;
  dissenter: Role | null;
  dissent_is_load_bearing: boolean;
  consensus: string;
  fault_line: string;
  kill_condition: string;
  minority_report: string;
  open_questions: string[];
}
```

Backend yoksa `mockTrialStream` bu eventleri sırayla üretmeli. Mock içerik gerçekçi olsun; lorem ipsum kullanma.

## UI Düzeni

Tek ekranlı karar oturumu:

- Üst şerit: faz göstergesi, kısa dava/proposition etiketi, bağlantı durumu.
- Ana sahne: courtroom/pixel sahne. Aktif karakter ortada veya ilgili kürsüde görünür.
- Alt dialog box: isimlik + stance/reasons/flip_condition veya Themis/verdict konuşması.
- Sağ panel: court record. Önerme, üyelerin kısa notları, fault line, confidence, açık sorular.

Desktop:
- Sahne + dialog ana alan.
- Court record sağ panel.

Mobile:
- Sağ panel drawer/tab olur.
- Dialog box sahnenin altında kalır.
- Metinler taşmaz, butonlar sıkışmaz.

## Karakterler

Her üyeye özgün pixel avatar/placeholder üret:

| Member | Role | Renk | Görsel Ruh |
|---|---|---|---|
| Athena | Stratejist | Royal mor | Sakin, ileriye bakan |
| Socrates | Şüpheci | Kırmızı | Keskin, itiraz eden |
| Apollo | Yaratıcı | Teal/yeşil | Parlak, beklenmedik |
| Hephaestus | Mühendis | Çelik mavisi | Sağlam, pratik |
| Atlas | Realist | Amber/altın | Ağırbaşlı, veri odaklı |
| Themis | Yargıç | Nötr/altın | Tarafsız, merkezde |

Sprite state'leri:
- `idle`
- `speaking`
- `confident`
- `nervous`
- `objection`
- `conceding`

Basit CSS/pixel-art avatarlarla başla. Gerçek sprite sheet gerekiyorsa sonradan swap edilebilir yapı kur.

## Animasyonlar

Framer Motion ile:
- Faz geçişleri kısa ve tok.
- Üye konuşmaya başlarken küçük pop/slide.
- Objection anında desk slam + kırmızı/role-colored banner.
- Themis ruling anında gavel flash.
- Verdict ekranında confidence meter dolumu.

Kurallar:
- Argüman okunurken sahne sakin kalır.
- Efektler 300-900ms arası kısa olmalı.
- Reduced motion açıksa slam/banner animasyonlarını fade/instant yap.
- SFX optional olmalı; mute toggle koy.

## Kullanıcı Akışı

1. Kullanıcı soru/önerme yazar.
2. `Start Trial` butonu davayı başlatır.
3. Faz 0: Themis önerme çerçevesini gösterir.
4. Faz 1: Beş üye sequential reveal ile ifade verir.
5. Faz 2: Tek fault line ve itirazlar görünür. `OBJECTION!` yerine Türkçe `İTİRAZ!` banner kullan.
6. Faz 3: Verdict card açılır:
   - Net karar
   - Confidence
   - Vote signal
   - Fault line
   - Kill condition
   - Minority report
   - Open questions

Kullanıcı kontrolleri:
- Start Trial
- Skip/Instant Text
- Mute
- Open/Close Court Record
- Reset Trial

## Görsel Dil

Koyu ama tek renkli olmayan palette kullan:
- Zemin: koyu lacivert/siyah ağırlığı olabilir ama tek ton slate'e boğma.
- Ahşap mahkeme yüzeyleri, altın çizgiler, kırmızı itiraz bannerı, karakter imza renkleriyle çeşitlendir.
- Kart içinde kart yapma. Court record paneli tek panel; repeated itemlar card olabilir.
- Border radius 8px veya daha az.
- Font:
  - Uzun metin: system-ui.
  - İsimlik/banner/faz: pixel font veya CSS pixel hissi.

Ace Attorney hissi:
- Kürsü, isimlik, ifade verme, itiraz bannerı, tokmak, verdict dramı.
- Birebir asset, logo, ses, sprite, müzik kopyalama yok.

## Kabul Kriterleri

Frontend şu komutlarla çalışmalı:

```bash
npm install
npm run dev
```

Başarı ölçütleri:
- Mock modda tam bir trial uçtan uca çalışır.
- Metinler desktop ve mobile taşmaz.
- Faz 1 reveal, modellerin birbirini görmediği hissini verir.
- Objection ve ruling mekanik olarak görünürdür.
- Verdict ekranı §4 verdict şemasını eksiksiz render eder.
- Backend SSE hazır olduğunda sadece `trialClient.ts` endpointleriyle gerçek akışa geçilebilir.

