import { TrialEvent, MemberResponse, Verdict } from '../types/trial';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runMockTrial(
  question: string,
  onEvent: (event: TrialEvent) => void,
  onComplete: () => void,
  signal?: AbortSignal
) {
  try {
    const isVoiceAssistant = question.toLowerCase().includes('ses') || question.toLowerCase().includes('voice') || question.toLowerCase().includes('jarvan');

    // Manuel ilerleme var: olayların hepsini HIZLICA kuyruğa düşür, kullanıcı
    // kendi hızında geçsin. Eski uzun gecikmeler "sırada… takılıyor" hissi
    // veriyordu (segment bitince sıradaki olay henüz yayılmamış oluyordu).
    const delay = async (ms: number) => {
      if (signal?.aborted) throw new Error('Aborted');
      await sleep(Math.min(ms, 120));
      if (signal?.aborted) throw new Error('Aborted');
    };

    // ----------------------------------------------------
    // PHASE 0: framing (Çerçeveleme)
    // ----------------------------------------------------
    onEvent({ type: "phase_started", phase: "frame" });
    await delay(1000);

    onEvent({
      type: "frame",
      data: {
        raw_question: question,
        proposition: isVoiceAssistant 
          ? "Önümüzdeki 2 hafta içinde frontend overhaul'u durdurup Jarvan'a sesli modu (LLM Voice API) eklemek doğru bir öncelik midir?"
          : `Geliştirme önceliklerini değiştirip "${question}" önerisini uygulamaya koymak şu aşamada doğru bir karar mıdır?`,
        answer_format: "yes_no",
        options: ["Evet", "Hayır"]
      }
    });

    await delay(3500);

    // ----------------------------------------------------
    // PHASE 1: opening statements (Bağımsız Açılış)
    // ----------------------------------------------------
    onEvent({ type: "phase_started", phase: "opening" });
    await delay(1000);

    // 1. ATHENA (Stratejist - Mor)
    onEvent({ type: "member_started", member: "athena" });
    await delay(800);
    const athenaResp: MemberResponse = {
      role: "stratejist",
      stance: "Sesli mod stratejik olarak heyecan verici ancak zamanlama olarak büyük bir risk.",
      reasons: [
        "Erişilebilirlik ve mobil kullanım açısından uzun vadede rekabet avantajı sağlayabilir.",
        "Ancak, şu an öncelikli olan frontend overhaul'unu durdurmak ürün bütünlüğünü zedeler.",
        "Kısa vadeli heyecanlar yerine çekirdek altyapının tamamlanması önceliğimiz olmalıdır."
      ],
      confidence: 65,
      flip_condition: "Eğer rakip ürünlerin sesli asistanı 3 ay içinde pazarı domine edeceğine dair ampirik veri varsa fikrimi değiştiririm."
    };
    onEvent({ type: "member_response", member: "athena", data: athenaResp });
    await delay(6000);

    // 2. SOCRATES (Şüpheci - Kırmızı)
    onEvent({ type: "member_started", member: "socrates" });
    await delay(800);
    const socratesResp: MemberResponse = {
      role: "supheci",
      stance: "Geliştiricilerin kod yazarken konuşmak istediği varsayımı epistemik olarak temelsizdir.",
      reasons: [
        "Yazılımcılar odaklanmış çalışırken sesli komut vermek yerine sessizlik ve klavye kısayollarını tercih eder.",
        "Sesli modun hangi gerçek problemi çözdüğü tanımlanmamıştır; sadece trend takip edilmektedir.",
        "Temel varsayımlarınızı doğrulamadan yapılacak her yatırım mantıksal bir hatadır."
      ],
      confidence: 90,
      flip_condition: "Kullanıcıların en az %30'unun gürültülü ofislerde veya sessiz odalarda klavye yerine sesle kod yazmayı talep ettiğini gösteren tarafsız bir deney sunulursa."
    };
    onEvent({ type: "member_response", member: "socrates", data: socratesResp });
    await delay(6000);

    // 3. APOLLO (Yaratıcı - Yeşil)
    onEvent({ type: "member_started", member: "apollo" });
    await delay(800);
    const apolloResp: MemberResponse = {
      role: "yaratici",
      stance: "Klasik bir sesli mod yerine Jarvan'ı sesle yönetilen interaktif bir 'kod podcast radyosu' yapalım!",
      reasons: [
        "Sıradan bir sesli asistan sıkıcıdır; ama kodun arkasındaki mantığı size radyo programı gibi tartışan bir Jarvan eşsiz olur.",
        "Geliştirici kulaklığını takıp sadece dinleyerek ve arada mırıldanarak refactoring yaptırabilir.",
        "Problemi sesli komut almaktan çıkarıp, arka planda çalışan bir kod partneri olmaya kaydırmalıyız."
      ],
      confidence: 85,
      flip_condition: "Eğer kullanıcılar sadece basit bir 'kodu çalıştır' komutu istiyor ve bu derin interaktif ses vizyonunu karmaşık buluyorsa."
    };
    onEvent({ type: "member_response", member: "apollo", data: apolloResp });
    await delay(6000);

    // 4. HEPHAESTUS (Mühendis - Mavi)
    onEvent({ type: "member_started", member: "hephaestus" });
    await delay(800);
    const hephaestusResp: MemberResponse = {
      role: "muhendis",
      stance: "Mevcut altyapı ses akışını (real-time audio streaming) düşük gecikmeyle kaldırmaya hazır değil.",
      reasons: [
        "LLM ses API entegrasyonu istek başına gecikmeyi (latency) 2.5 saniyenin üzerine çıkaracaktır.",
        "Backend websocket altyapımız paralel ses stream'lerini işlemek için yeniden yazılmalıdır (yaklaşık 3 hafta).",
        "API maliyetleri token başına ses verisi yüzünden yaklaşık 4.2 kat artış gösterecektir."
      ],
      confidence: 75,
      flip_condition: "Eğer yerel (local) çalışan, gecikmesiz ve API maliyeti olmayan küçük bir whisper-size model entegrasyonu önerilirse."
    };
    onEvent({ type: "member_response", member: "hephaestus", data: hephaestusResp });
    await delay(6000);

    // 5. ATLAS (Realist - Altın)
    onEvent({ type: "member_started", member: "atlas" });
    await delay(800);
    const atlasResp: MemberResponse = {
      role: "realist",
      stance: "Geliştirici anketleri ve pazar analizi sesli özelliklerin yatırım getirisinin (ROI) sıfıra yakın olduğunu gösteriyor.",
      reasons: [
        "Pazardaki benzer araçlarda (örneğin GitHub Copilot Voice) aktif kullanım oranı sadece %2.1 seviyesinde kalmıştır.",
        "Kullanıcıların %88'i hızlı klavye kısayollarını ve IDE içi entegrasyonu sesli arayüzlere tercih etmektedir.",
        "Bu özellik yeni müşteri getirmeyeceği gibi mevcut müşterilerin de öncelikli talebi değildir."
      ],
      confidence: 95,
      flip_condition: "Eğer rakip Copilot veya Cursor'ın sesli sürümünün indirilme oranlarında son 1 ayda dikey bir artış (%50+) belgelenirse."
    };
    onEvent({ type: "member_response", member: "atlas", data: atlasResp });
    await delay(6500);

    // ----------------------------------------------------
    // PHASE 2: clash/objections (Çatışma)
    // ----------------------------------------------------
    onEvent({ type: "phase_started", phase: "clash" });
    await delay(1500);

    // Clash event - Socrates objects to Apollo
    onEvent({
      type: "objection",
      from: "socrates",
      target: "apollo",
      claim: "Jarvan'ı sesli kod podcast radyosuna çevirme fikri",
      ruling: "upheld"
    });
    
    await delay(4000); // UI displays objection shake, audio slams, and theme gavel strike

    // The sub-round dialogue for Socrates vs Apollo
    onEvent({
      type: "clash",
      data: {
        fault_line: "Kullanışlılık vs. Fantastik Fikirler",
        exchanges: [
          {
            from: "supheci",
            targets: "yaratici",
            claim_challenged: "Kod radyosu konseptinin pratikliği",
            argument: "Socrates: Geliştirici hata ayıklarken radyo programı dinlemez. Apollo'nun önerisi problemi çözmek yerine dikkati dağıtacak yeni bir karmaşıklık katmanı ekliyor. Bu mantıksal bir fantezidir!",
            objection: true,
            ruling: "upheld",
            sub_round: "Apollo: İtirazı anlıyorum. Ancak amacımız düz kod yazmak değil, yorulmuş bir yazılımcıya refakat etmek. Eğer bu dikkat dağıtacaksa, o halde sesli mod fikrinin kendisini sorgulamalıyız. Çekiliyorum."
          }
        ],
        upheld_count: 1
      }
    });

    await delay(6500);

    // Another Clash event - Athena objects to Atlas
    onEvent({
      type: "objection",
      from: "athena",
      target: "atlas",
      claim: "Pazar anketlerindeki %2.1'lik Copilot Voice kullanım oranının geleceği yansıttığı iddiası",
      ruling: "overruled"
    });

    await delay(4500);

    // Show the exchange output where Athena is overruled
    onEvent({
      type: "clash",
      data: {
        fault_line: "Gelecek Trendleri vs. Mevcut Pazar Verisi",
        exchanges: [
          {
            from: "stratejist",
            targets: "realist",
            claim_challenged: "Mevcut kullanım verilerinin gelecekteki potansiyeli sınırladığı iddiası",
            argument: "Athena: Copilot Voice'un başarısızlığı teknolojinin gereksizliğini değil, kötü entegrasyonu gösterir. Atlas, mevcut veriyi dogma kabul ederek gelecek vizyonu ıskalıyor!",
            objection: true,
            ruling: "overruled",
            sub_round: "Themis: İtiraz reddedildi. Atlas'ın sunduğu veriler ampiriktir ve şu anki bütçe kısıtlarımız altında Athena'nın gelecek vizyonu somut bir temel oluşturmamaktadır."
          }
        ],
        upheld_count: 1
      }
    });

    await delay(6500);

    // ----------------------------------------------------
    // PHASE 3: verdict (Sentez)
    // ----------------------------------------------------
    onEvent({ type: "phase_started", phase: "verdict" });
    await delay(1500);

    const verdict: Verdict = {
      decision: "Jarvan'a sesli asistan ekleme planını İPTAL EDİN. Bunun yerine mevcut klavye kısayollarını güçlendirin ve erişilebilirlik iyileştirmelerine odaklanın.",
      confidence: 85,
      vote_signal: { support: 1, oppose: 4 },
      confidence_weighted: "4 Karşı (Ortalama Güven: %81) / 1 Destek (Güven: %85)",
      dissenter: "yaratici",
      dissent_is_load_bearing: false,
      consensus: "Tüm meclis, LLM ses API entegrasyonunun yüksek maliyet, yüksek gecikme (latency) ve karmaşık altyapı gereksinimleri yaratacağı konusunda mutabıktır. Ayrıca kullanıcıların öncelikli talebi bu değildir.",
      fault_line: "Kullanıcı Alışkanlıkları ve Teknik Maliyet vs. Gelecek Vizyonu",
      kill_condition: "Eğer rakip IDE araçlarından biri sesli komut özelliğini çıkartıp 15 gün içinde aktif kullanıcı patlaması yaşarsa bu karar iptal edilmelidir.",
      minority_report: "Apollo (Yaratıcı): Sesli arayüzler sadece komut-komut şeklinde çalışmak zorunda değil. İlerleyen aşamalarda, geliştiriciye kod mantığını sesli özetleyen bir 'Podcast modülü' bağımsız bir eklenti (plugin) olarak ayrıca AR-GE kapsamında değerlendirilebilir. Bu vizyon tamamen çöpe atılmamalıdır.",
      open_questions: [
        "Kullanıcılarımızın klavye kısayollarındaki temel şikayetleri nelerdir?",
        "Erişilebilirlik (screen reader, keyboard-only navigasyon) iyileştirmeleri ne kadar sürede yapılabilir?",
        "Whisper modelini yerel (local) çalıştıracak kadar hafif bir API entegrasyonu ileride mümkün olur mu?"
      ]
    };

    onEvent({ type: "verdict", data: verdict });
    await delay(1000);
    onComplete();
  } catch (err) {
    if (err instanceof Error && err.message === 'Aborted') {
      console.log('Mock trial stream aborted.');
    } else {
      onEvent({ type: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }
}
