# Ses efektleri (isteğe bağlı)

Bu klasöre ses dosyası koyarsan **sentez yerine otomatik o çalınır**.
Dosya yoksa kod kendi sentezlediği sesi kullanır.

Tanınan dosya adları (uzantı: mp3 / wav / ogg / m4a):

| Dosya            | Ne zaman çalar                         |
|------------------|----------------------------------------|
| `objection.mp3`  | İlk itiraz anı ("İTİRAZ!")              |
| `holdit.mp3`     | Karşı atak ("DUR BAKALIM!") — itirazın 2./tek sıradaki turu; yoksa İTİRAZ'a düşer |
| `takethat.mp3`   | İtiraz KABUL olunca (kazananın "AL BAKALIM!" anı) |
| `freakout.mp3`   | İtiraz RED olunca (kaybeden çıldırır)   |
| `gavel.mp3`      | Tokmak (nihai hüküm)                    |
| `desk-slam.mp3`  | Masaya vurma (itiraz darbesi)          |
| `verdict.mp3`    | Karar fanfarı                           |
| `blip.mp3`       | Yazı yazma "tık"ı (her ~2 karakter)    |

> Not: Karaktere özel versiyon: `objection-<id>.mp3`, `desk-slam-<id>.mp3`,
> `holdit-<id>.mp3`, `takethat-<id>.mp3` (id: athena/socrates/apollo/hephaestus/atlas).
> Varsa karaktere özel olan, yoksa genel dosya çalar.
> Athena için kadın sesli `holdit-athena` / `objection-athena` / `takethat-athena` mevcut.

Örnek: `src/assets/sfx/objection.mp3` koy → itiraz sesi o olur.

> ⚠️ Telif: Ace Attorney'in orijinal ses klipleri Capcom'a aittir. Kişisel
> kullanım senin tercihin; ama projeyi paylaşır/dağıtırsan IP sorunu olur.
> Dağıtım için royalty-free ya da kendi ürettiğin sesleri kullan.
