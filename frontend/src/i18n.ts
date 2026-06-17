import { useEffect, useState } from 'react';

export type Lang = 'tr' | 'en';
const KEY = 'divan_lang';
const EVT = 'divan-lang-change';

export function getLang(): Lang {
  const v = (typeof localStorage !== 'undefined' && localStorage.getItem(KEY)) as Lang | null;
  return v === 'en' ? 'en' : 'tr';
}

export function setLang(lang: Lang): void {
  localStorage.setItem(KEY, lang);
  window.dispatchEvent(new Event(EVT));
}

/** Dil değişimini dinleyen React hook'u (UI yeniden render olsun). */
export function useLang(): Lang {
  const [lang, setL] = useState<Lang>(getLang());
  useEffect(() => {
    const h = () => setL(getLang());
    window.addEventListener(EVT, h);
    window.addEventListener('storage', h);
    return () => {
      window.removeEventListener(EVT, h);
      window.removeEventListener('storage', h);
    };
  }, []);
  return lang;
}

type Entry = { tr: string; en: string };

const STR: Record<string, Entry> = {
  tagline: { tr: '5 Zihin · 1 Teşhis · Karar Değil Teşhis', en: '5 Minds · 1 Diagnosis · Not a Verdict' },
  caseFile: { tr: 'Dava Dosyası', en: 'Case File' },
  questionPlaceholder: {
    tr: 'Örn: Önümüzdeki hafta yeni sesli asistan özelliğini entegre etmeli miyiz?',
    en: 'e.g., Should we ship the new voice assistant feature next week?',
  },
  projectMd: { tr: 'Proje MD', en: 'Project MD' },
  startTrial: { tr: 'DURUŞMAYI BAŞLAT', en: 'START TRIAL' },
  settings: { tr: 'Ayarlar', en: 'Settings' },
  councilGathering: { tr: 'MECLİS TOPLANIYOR…', en: 'THE COUNCIL CONVENES…' },
  record: { tr: 'DOSYA', en: 'RECORD' },
  reset: { tr: 'SIFIRLA', en: 'RESET' },
  // Giriş ekranı (hardcoded olanlar i18n'e taşındı)
  select: { tr: 'SEÇ', en: 'SELECT' },
  projectPlaceholder: { tr: 'Proje detayını buraya yapıştır veya .md yükle.', en: 'Paste project details or upload a .md file.' },
  optionalContext: { tr: 'Opsiyonel bağlam', en: 'Optional context' },
  chars: { tr: 'karakter', en: 'chars' },
  modeSim: { tr: 'SİMÜLASYON', en: 'SIMULATION' },
  modeReal: { tr: 'GERÇEK SUNUCU', en: 'LIVE SERVER' },
  proposition: { tr: 'Önerme', en: 'Proposition' },
  liveWarning: {
    tr: "Masaüstü uygulaması backend'i otomatik açar; hata olursa kayıt backend/.divan/server.log dosyasına düşer.",
    en: 'The desktop app starts the backend automatically; on errors, logs go to backend/.divan/server.log.',
  },
  // Settings modal
  settingsTitle: { tr: '⚙ AYARLAR', en: '⚙ SETTINGS' },
  language: { tr: 'Dil', en: 'Language' },
  mode: { tr: 'Mod', en: 'Mode' },
  modeMulti: { tr: 'Çoklu provider (her karakter farklı)', en: 'Multi-provider (per character)' },
  modeSingle: { tr: 'Tek provider', en: 'Single provider' },
  singleProvider: { tr: 'Tek sağlayıcı', en: 'Single provider' },
  charToModel: { tr: 'Karakter → Model', en: 'Character → Model' },
  activeMembers: { tr: 'Aktif Üyeler', en: 'Active Members' },
  activeMembersHint: {
    tr: '5 üye zorunlu değil. İstemediğin üyeyi kapatabilirsin (en az 2 üye gerekir). Themis yargıçtır, hep açık.',
    en: 'All 5 are optional. Turn off any member you don’t want (at least 2 required). Themis is the judge and stays on.',
  },
  minMembersWarn: { tr: 'En az 2 üye açık olmalı.', en: 'At least 2 members must stay on.' },
  apiKeys: { tr: 'API Anahtarları', en: 'API Keys' },
  apiKeysHint: {
    tr: "Yalnızca API backend'i seçtiğin sağlayıcılar için gerekli. CLI ve Yerel için gerekmez.",
    en: 'Only needed for providers where you picked the API backend. Not needed for CLI or Local.',
  },
  save: { tr: 'Kaydet', en: 'Save' },
  cancel: { tr: 'İptal', en: 'Cancel' },
  saved: { tr: '✓ Kaydedildi.', en: '✓ Saved.' },
  loading: { tr: 'Yükleniyor…', en: 'Loading…' },
  // Backend label
  backendCli: { tr: 'CLI (abonelik)', en: 'CLI (subscription)' },
  backendApi: { tr: 'API (key)', en: 'API (key)' },
  backendLocal: { tr: 'Yerel', en: 'Local' },
};

export function t(key: keyof typeof STR | string, lang?: Lang): string {
  const l = lang ?? getLang();
  const e = STR[key as string];
  return e ? e[l] : (key as string);
}

// Faz 2 metinleri (parametreli / dile bağlı)
export const TRIAL_STR = {
  objection: { tr: 'İTİRAZ!', en: 'OBJECTION!' },
  holdit: { tr: 'DUR BAKALIM!', en: 'HOLD IT!' },
  judgeName: { tr: 'Themis (Yargıç)', en: 'Themis (Judge)' },
  upheld: { tr: 'KABUL EDİLDİ.', en: 'SUSTAINED.' },
  overruled: { tr: 'REDDEDİLDİ.', en: 'OVERRULED.' },
  freakout: {
    tr: 'Ne?! Hayır, hayır... bu olamaz! İtirazım haklıydı, kabul etmiyorum!',
    en: "What?! No, no... this can't be! My objection was right, I won't accept this!",
  },
};

export function rulingSentence(
  fromName: string, targetName: string, claim: string, ruling: 'upheld' | 'overruled', lang: Lang,
): string {
  const verdict = ruling === 'upheld' ? TRIAL_STR.upheld[lang] : TRIAL_STR.overruled[lang];
  if (lang === 'en') {
    return `${fromName} objects to ${targetName}'s claim: "${claim}".\n\nRuling: ${verdict}`;
  }
  return `${fromName}, ${targetName}'in "${claim}" iddiasına itiraz ediyor.\n\nHüküm: ${verdict}`;
}
