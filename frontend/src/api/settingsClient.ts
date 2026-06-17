import { DivanSettings, ProviderRegistry } from '../types/settings';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export async function getProviders(): Promise<ProviderRegistry> {
  const res = await fetch(`${API_BASE_URL}/api/providers`);
  if (!res.ok) throw new Error(`Provider listesi alınamadı: ${res.status}`);
  const data = await res.json();
  return data.providers as ProviderRegistry;
}

export async function getSettings(): Promise<DivanSettings> {
  const res = await fetch(`${API_BASE_URL}/api/settings`);
  if (!res.ok) throw new Error(`Ayarlar alınamadı: ${res.status}`);
  return (await res.json()) as DivanSettings;
}

export async function saveSettings(settings: DivanSettings): Promise<DivanSettings> {
  const res = await fetch(`${API_BASE_URL}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error(`Ayarlar kaydedilemedi: ${res.status}`);
  return (await res.json()) as DivanSettings;
}
