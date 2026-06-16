# Mahkeme arka planı (isteğe bağlı)

Bu klasöre bir görsel koyarsan (örn. `courtroom.png`) duruşma sahnesinin
arkasında **otomatik kullanılır**. Yoksa CSS ile çizilen sahne görünür.

- Önerilen boyut: **2560×1440** (16:9), yatay.
- Format: png / jpg / webp.
- Kompozisyon: orta-alt boş kalsın (karakter büstü oraya oturuyor),
  üst kenar roster/HUD ile, alt kenar diyalog kutusuyla örtülecek.

Karakter portrelerini **şeffaf arka planlı** sürümlerle değiştirmek istersen
`src/assets/` içine üye adıyla başlayan dosyalar koy:

- `athena-*.png`
- `socrates-*.png`
- `apollo-*.png`
- `hephaestus-*.png`
- `atlas-*.png`
- `themis-*.png`

Uygulama prefix ile otomatik bulur; upscayl/export suffix'i değişebilir.
