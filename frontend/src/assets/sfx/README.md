# Ses efektleri (isteğe bağlı)

Bu klasöre ses dosyası koyarsan **sentez yerine otomatik o çalınır**.
Dosya yoksa kod kendi sentezlediği sesi kullanır.

Tanınan dosya adları (uzantı: mp3 / wav / ogg / m4a):

| Dosya            | Ne zaman çalar                         |
|------------------|----------------------------------------|
| `objection.mp3`  | İtiraz anı ("İTİRAZ!")                  |
| `gavel.mp3`      | Tokmak (hüküm / karar açılışı)         |
| `desk-slam.mp3`  | Masaya vurma (itiraz darbesi)          |
| `verdict.mp3`    | Karar fanfarı                           |
| `blip.mp3`       | Yazı yazma "tık"ı (her ~2 karakter)    |

Örnek: `src/assets/sfx/objection.mp3` koy → itiraz sesi o olur.

> ⚠️ Telif: Ace Attorney'in orijinal ses klipleri Capcom'a aittir. Kişisel
> kullanım senin tercihin; ama projeyi paylaşır/dağıtırsan IP sorunu olur.
> Dağıtım için royalty-free ya da kendi ürettiğin sesleri kullan.
