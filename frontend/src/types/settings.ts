export type Backend = 'cli' | 'api' | 'local';

export interface MemberCfg {
  provider: string;
  model: string;
  backend: Backend;
  enabled?: boolean; // false ise üye duruşmaya katılmaz (themis hariç). Varsayılan açık.
}

export type Language = 'tr' | 'en';

export interface DivanSettings {
  mode: 'multi' | 'single';
  language: Language;
  single_provider: string;
  single_model: string;
  single_backend: Backend;
  members: Record<string, MemberCfg>;
  api_keys: Record<string, string>;
}

export interface ProviderSpec {
  label: string;
  backends: Backend[];
  key: string | null;
  models: string[];
}

export type ProviderRegistry = Record<string, ProviderSpec>;

// Karakter id -> görünen ad (ayar panelinde sıralı gösterim)
export const MEMBER_LABELS: { id: string; name: string; role: string }[] = [
  { id: 'athena', name: 'Athena', role: 'Stratejist' },
  { id: 'socrates', name: 'Socrates', role: 'Şüpheci' },
  { id: 'apollo', name: 'Apollo', role: 'Yaratıcı' },
  { id: 'hephaestus', name: 'Hephaestus', role: 'Mühendis' },
  { id: 'atlas', name: 'Atlas', role: 'Realist' },
  { id: 'themis', name: 'Themis', role: 'Yargıç' },
];
