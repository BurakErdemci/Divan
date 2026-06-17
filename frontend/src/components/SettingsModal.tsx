import React, { useEffect, useState } from 'react';
import {
  Backend,
  DivanSettings,
  MEMBER_LABELS,
  ProviderRegistry,
} from '../types/settings';
import { getProviders, getSettings, saveSettings } from '../api/settingsClient';
import { t, setLang, getLang, useLang, Lang } from '../i18n';

interface Props {
  open: boolean;
  onClose: () => void;
}

const backendLabel = (b: Backend, lang: Lang): string =>
  t(`backend${b.charAt(0).toUpperCase()}${b.slice(1)}`, lang);

const SINGLE_PRESETS = [
  { provider: 'google', label: 'Sadece Gemini' },
  { provider: 'anthropic', label: 'Sadece Claude' },
  { provider: 'openai', label: 'Sadece OpenAI' },
  { provider: 'ollama', label: 'Sadece Yerel (Ollama)' },
];

export const SettingsModal: React.FC<Props> = ({ open, onClose }) => {
  const lang = useLang();
  const [registry, setRegistry] = useState<ProviderRegistry | null>(null);
  const [settings, setSettings] = useState<DivanSettings | null>(null);
  const [status, setStatus] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStatus(t('loading'));
    Promise.all([getProviders(), getSettings()])
      .then(([reg, s]) => {
        setRegistry(reg);
        setSettings(s);
        if (s.language && s.language !== getLang()) setLang(s.language); // UI'ı ayara göre senkronla
        setStatus('');
      })
      .catch((e) => setStatus(`Hata: ${e.message} (backend açık mı?)`));
  }, [open]);

  if (!open) return null;

  const updateMember = (id: string, patch: Partial<DivanSettings['members'][string]>) => {
    setSettings((s) => (s ? { ...s, members: { ...s.members, [id]: { ...s.members[id], ...patch } } } : s));
  };

  const isEnabled = (id: string) => settings?.members[id]?.enabled !== false;
  const enabledCount = settings
    ? MEMBER_LABELS.filter((m) => m.id !== 'themis' && settings.members[m.id]?.enabled !== false).length
    : 0;

  const toggleMember = (id: string) => {
    if (!settings) return;
    const turningOff = isEnabled(id);
    if (turningOff && enabledCount <= 2) {
      setStatus(t('minMembersWarn', lang));
      setTimeout(() => setStatus(''), 2000);
      return;
    }
    updateMember(id, { enabled: !turningOff });
  };

  const onProviderChange = (id: string, provider: string) => {
    if (!registry) return;
    const spec = registry[provider];
    updateMember(id, { provider, model: spec.models[0], backend: spec.backends[0] });
  };

  const onSave = async () => {
    if (!settings) return;
    setSaving(true);
    setStatus(t('loading'));
    try {
      const saved = await saveSettings(settings);
      setSettings(saved);
      setStatus(t('saved'));
      setTimeout(() => setStatus(''), 1500);
    } catch (e) {
      setStatus(`Hata: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[88vh] overflow-y-auto scrollbar-thin rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Başlık */}
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-4">
          <h2 className="font-pixel text-sm text-amber-400">{t('settingsTitle', lang)}</h2>
          <button onClick={onClose} className="rounded-lg px-3 py-1 text-slate-400 hover:bg-slate-800 hover:text-white">✕</button>
        </div>

        {status && <div className="px-6 pt-3 text-xs text-amber-300">{status}</div>}

        {registry && settings && (
          <div className="space-y-6 p-6">
            {/* Dil seçimi */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('language', lang)}</h3>
              <div className="flex gap-2">
                {(['tr', 'en'] as Lang[]).map((l) => (
                  <ModeBtn
                    key={l}
                    active={settings.language === l}
                    onClick={() => { setSettings({ ...settings, language: l }); setLang(l); }}
                  >
                    {l === 'tr' ? 'Türkçe' : 'English'}
                  </ModeBtn>
                ))}
              </div>
            </section>

            {/* Mod seçimi */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('mode', lang)}</h3>
              <div className="flex gap-2">
                <ModeBtn active={settings.mode === 'multi'} onClick={() => setSettings({ ...settings, mode: 'multi' })}>
                  {t('modeMulti', lang)}
                </ModeBtn>
                <ModeBtn active={settings.mode === 'single'} onClick={() => setSettings({ ...settings, mode: 'single' })}>
                  {t('modeSingle', lang)}
                </ModeBtn>
              </div>
            </section>

            {/* Aktif üyeler — 5 üye zorunlu değil, istenmeyen kapatılabilir (themis hariç) */}
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t('activeMembers', lang)} <span className="text-slate-500">({enabledCount}/5)</span>
              </h3>
              <p className="mb-2 text-[11px] text-slate-500">{t('activeMembersHint', lang)}</p>
              <div className="flex flex-wrap gap-2">
                {MEMBER_LABELS.filter((m) => m.id !== 'themis').map(({ id, name, role }) => (
                  <button
                    key={id}
                    onClick={() => toggleMember(id)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs border transition-colors ${
                      isEnabled(id)
                        ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                        : 'border-slate-700 bg-slate-800/40 text-slate-500 line-through'
                    }`}
                  >
                    <span className={`inline-block h-2 w-2 rounded-full ${isEnabled(id) ? 'bg-amber-400' : 'bg-slate-600'}`} />
                    <span className="font-medium">{name}</span>
                    <span className="text-[10px] opacity-70">{role}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Single provider presetleri */}
            {settings.mode === 'single' && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('singleProvider', lang)}</h3>
                <div className="flex flex-wrap gap-2">
                  {SINGLE_PRESETS.map((p) => (
                    <ModeBtn
                      key={p.provider}
                      active={settings.single_provider === p.provider}
                      onClick={() => {
                        const spec = registry[p.provider];
                        setSettings({
                          ...settings,
                          single_provider: p.provider,
                          single_model: spec.models[0],
                          single_backend: spec.backends[0],
                        });
                      }}
                    >
                      {p.label}
                    </ModeBtn>
                  ))}
                </div>

                {/* Tek-provider: model + backend seçimi */}
                {registry[settings.single_provider] && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-slate-400">Model:</span>
                    <select
                      className="rounded bg-slate-900 px-2 py-1.5 text-xs text-slate-200 border border-slate-700"
                      value={settings.single_model}
                      onChange={(e) => setSettings({ ...settings, single_model: e.target.value })}
                    >
                      {registry[settings.single_provider].models.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <span className="ml-2 text-[11px] text-slate-400">Kaynak:</span>
                    {registry[settings.single_provider].backends.map((b) => (
                      <button
                        key={b}
                        onClick={() => setSettings({ ...settings, single_backend: b })}
                        className={`rounded px-2 py-1 text-[10px] border transition-colors ${
                          settings.single_backend === b
                            ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                            : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        {backendLabel(b, lang)}
                      </button>
                    ))}
                  </div>
                )}

                <p className="mt-2 text-xs text-slate-500">
                  Tüm karakterler {registry[settings.single_provider]?.label} · {settings.single_model} üzerinden çalışır (rol farkı sadece kişilik).
                </p>
              </section>
            )}

            {/* Çoklu: karakter başına seçim */}
            {settings.mode === 'multi' && (
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('charToModel', lang)}</h3>
                <div className="space-y-3">
                  {MEMBER_LABELS.map(({ id, name, role }) => {
                    const cfg = settings.members[id];
                    if (!cfg) return null;
                    if (id !== 'themis' && cfg.enabled === false) return null; // kapalı üye gizli
                    const spec = registry[cfg.provider];
                    return (
                      <div key={id} className="grid grid-cols-12 items-center gap-2 rounded-lg border border-slate-800 bg-slate-800/40 p-2">
                        <div className="col-span-3">
                          <div className="text-sm font-medium text-slate-100">{name}</div>
                          <div className="text-[10px] text-slate-500">{role}</div>
                        </div>
                        <select
                          className="col-span-3 rounded bg-slate-900 px-2 py-1.5 text-xs text-slate-200 border border-slate-700"
                          value={cfg.provider}
                          onChange={(e) => onProviderChange(id, e.target.value)}
                        >
                          {Object.entries(registry).map(([pid, p]) => (
                            <option key={pid} value={pid}>{p.label}</option>
                          ))}
                        </select>
                        <select
                          className="col-span-3 rounded bg-slate-900 px-2 py-1.5 text-xs text-slate-200 border border-slate-700"
                          value={cfg.model}
                          onChange={(e) => updateMember(id, { model: e.target.value })}
                        >
                          {(spec?.models ?? []).map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <div className="col-span-3 flex flex-wrap gap-1">
                          {(spec?.backends ?? []).map((b) => (
                            <button
                              key={b}
                              onClick={() => updateMember(id, { backend: b })}
                              className={`rounded px-2 py-1 text-[10px] border transition-colors ${
                                cfg.backend === b
                                  ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                                  : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                              }`}
                            >
                              {backendLabel(b, lang)}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* API key'ler */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('apiKeys', lang)}</h3>
              <p className="mb-2 text-[11px] text-slate-500">
                {t('apiKeysHint', lang)} <code>backend/.divan/settings.json</code>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(registry)
                  .filter(([, p]) => p.key)
                  .map(([pid, p]) => (
                    <div key={pid} className="flex flex-col gap-1">
                      <label className="text-[11px] text-slate-400">{p.label}</label>
                      <input
                        type="password"
                        placeholder="sk-…"
                        value={settings.api_keys[p.key as string] ?? ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            api_keys: { ...settings.api_keys, [p.key as string]: e.target.value },
                          })
                        }
                        className="rounded bg-slate-900 px-2 py-1.5 text-xs text-slate-200 border border-slate-700"
                      />
                    </div>
                  ))}
              </div>
            </section>

            {/* Kaydet */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:bg-slate-800">{t('cancel', lang)}</button>
              <button
                onClick={onSave}
                disabled={saving}
                className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
              >
                {t('save', lang)}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ModeBtn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`rounded-lg px-3 py-2 text-xs border transition-colors ${
      active ? 'border-amber-500 bg-amber-500/20 text-amber-300' : 'border-slate-700 text-slate-300 hover:bg-slate-800'
    }`}
  >
    {children}
  </button>
);
