import React, { useState, useEffect } from 'react';
import { useTrialMachine } from './trial-machine';
import { PhaseIndicator } from './components/PhaseIndicator';
import { Courtroom } from './components/Courtroom';
import { DialogueBox } from './components/DialogueBox';
import { CourtRecord } from './components/CourtRecord';
import { VerdictCard } from './components/VerdictCard';
import { CouncilReport } from './components/CouncilReport';
import { ObjectionBanner } from './components/ObjectionBanner';
import { SettingsModal } from './components/SettingsModal';
import { MEMBER_IMAGES } from './components/CharacterSprite';
import { MemberId } from './types/trial';
import { Scale, BookOpen, AlertCircle, Play, Gavel, LoaderCircle, FileText, Settings } from 'lucide-react';
import { t, useLang, setLang } from './i18n';
import { getSettings } from './api/settingsClient';
import './styles/app.css';

const ALL_MEMBERS: MemberId[] = ['socrates', 'athena', 'apollo', 'hephaestus', 'atlas', 'themis'];

export const App: React.FC = () => {
  const { state, startTrial, advance, reset, toggleMute } = useTrialMachine();

  const [question, setQuestion] = useState('');
  const [projectContext, setProjectContext] = useState('');
  const [projectFileName, setProjectFileName] = useState('');
  const [mode, setMode] = useState<'mock' | 'live'>('live');
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const lang = useLang();

  // Açılışta kayıtlı dili (settings.json) UI'a uygula — localStorage'tan bağımsız.
  useEffect(() => {
    getSettings()
      .then((s) => { if (s.language) setLang(s.language); })
      .catch(() => {});
  }, []);

  const isLoading = state.phase === 'loading';
  const inTrial = state.phase !== 'idle' && state.phase !== 'loading' && state.phase !== 'verdict';

  // Manuel ilerleme: duruşma sırasında Boşluk / Enter / → ile geç.
  useEffect(() => {
    if (!inTrial) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inTrial, advance]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    startTrial(question, mode, projectContext);
  };

  const handleProjectFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setProjectContext(text.slice(0, 12000));
    setProjectFileName(file.name);
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#06060a] text-slate-100 font-sans selection:bg-yellow-500/30">
      {/* Tokmak ekran flaşı */}
      {state.gavelFlash && <div className="absolute inset-0 bg-white z-[60] pointer-events-none animate-flash" />}

      {/* İTİRAZ! bannerı */}
      <ObjectionBanner show={state.showObjectionBanner} text={state.objectionBannerText} color={state.objectionBannerColor} />

      {/* Ayarlar modalı (her ekrandan erişilebilir) */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* ======================== GİRİŞ / BAŞLANGIÇ EKRANI ======================== */}
      {state.phase === 'idle' && (
        <div className="vn-stage-bg absolute inset-0 flex flex-col items-center justify-center px-4">
          {/* Ayarlar butonu (sağ üst) */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="absolute top-4 right-4 z-20 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-[10px] font-pixel uppercase tracking-widest text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Settings size={14} className="text-yellow-500" />
            {t('settings', lang)}
          </button>

          {/* Arka planda soluk meclis büstleri */}
          <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-2 opacity-[0.13] pointer-events-none select-none">
            {ALL_MEMBERS.map((id) => (
              <img key={id} src={MEMBER_IMAGES[id]} alt="" className="h-[44vh] object-contain" draggable={false} />
            ))}
          </div>

          {/* Başlık */}
          <div className="relative z-10 flex flex-col items-center gap-3 mb-7">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-yellow-500 flex items-center justify-center text-slate-950 shadow-[0_0_30px_rgba(234,179,8,0.5)]">
                <Gavel size={24} strokeWidth={2.5} />
              </div>
              <h1 className="text-3xl md:text-4xl font-pixel font-bold tracking-widest text-yellow-500 drop-shadow-[0_3px_0_rgba(0,0,0,0.6)]">DİVAN</h1>
            </div>
            <p className="text-[10px] md:text-xs font-pixel text-slate-400 tracking-[0.3em] uppercase">{t('tagline', lang)}</p>
          </div>

          {/* Dava dosyası paneli */}
          <form
            onSubmit={handleSubmit}
            className="relative z-10 w-full max-w-3xl bg-slate-950/80 border-2 border-yellow-500/30 rounded-xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.7)] backdrop-blur-md flex flex-col gap-4"
          >
            <div className="flex items-center gap-2 text-yellow-500">
              <Scale size={15} />
              <span className="text-[10px] font-pixel uppercase tracking-widest">{t('caseFile', lang)}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1.15fr_0.85fr] gap-3">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t('questionPlaceholder', lang)}
                className="w-full h-28 p-3.5 rounded-lg bg-black/50 border border-slate-700 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 text-sm text-slate-100 placeholder-slate-600 focus:outline-none resize-none leading-relaxed"
                maxLength={300}
                autoFocus
              />

              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-black/40 border border-slate-800 text-[10px] font-pixel text-slate-400 uppercase tracking-wider">
                  <span className="flex items-center gap-2">
                    <FileText size={13} className="text-yellow-500" />
                    {t('projectMd', lang)}
                  </span>
                  <input
                    type="file"
                    accept=".md,.markdown,.txt,text/markdown,text/plain"
                    className="hidden"
                    onChange={(e) => handleProjectFile(e.target.files?.[0] ?? null)}
                  />
                  <span className="text-yellow-500">{t('select', lang)}</span>
                </label>
                <textarea
                  value={projectContext}
                  onChange={(e) => {
                    setProjectContext(e.target.value.slice(0, 12000));
                    setProjectFileName('');
                  }}
                  placeholder={t('projectPlaceholder', lang)}
                  className="w-full h-20 p-3 rounded-lg bg-black/45 border border-slate-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 text-xs text-slate-200 placeholder-slate-600 focus:outline-none resize-none leading-relaxed"
                />
                <div className="min-h-4 text-[10px] text-slate-500 truncate">
                  {projectFileName || (projectContext ? `${projectContext.length}/12000 ${t('chars', lang)}` : t('optionalContext', lang))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(['mock', 'live'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`px-4 py-2.5 rounded-lg border text-[11px] font-pixel tracking-wider flex flex-col items-center gap-1 transition-all ${
                    mode === m ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400 font-bold' : 'border-slate-800 bg-black/30 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <span className="text-[8px] uppercase tracking-widest opacity-50">{m === 'mock' ? 'MOD 1' : 'MOD 2'}</span>
                  <span>{m === 'mock' ? t('modeSim', lang) : t('modeReal', lang)}</span>
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={!question.trim()}
              className={`w-full py-3.5 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg transition-all ${
                question.trim() ? 'bg-yellow-500 hover:bg-yellow-400 text-slate-950 hover:scale-[1.01] active:scale-95' : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              <Play size={16} fill="currentColor" />
              <span className="text-xs font-pixel tracking-widest">{t('startTrial', lang)}</span>
            </button>

            {mode === 'live' && (
              <div className="flex gap-2 items-start text-[10px] text-slate-500 leading-normal">
                <AlertCircle size={13} className="text-yellow-600/80 shrink-0 mt-0.5" />
                <span>{t('liveWarning', lang)}</span>
              </div>
            )}
          </form>
        </div>
      )}

      {/* ======================== YÜKLEME / PRECOMPUTE EKRANI ======================== */}
      {isLoading && (
        <div className="vn-stage-bg absolute inset-0 flex items-center justify-center px-4">
          <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-2 opacity-[0.16] pointer-events-none select-none">
            {ALL_MEMBERS.map((id) => (
              <img key={id} src={MEMBER_IMAGES[id]} alt="" className="h-[46vh] object-contain" draggable={false} />
            ))}
          </div>

          <div className="relative z-10 flex flex-col items-center text-center gap-5">
            <div className="w-16 h-16 rounded-full border border-yellow-500/40 bg-black/45 flex items-center justify-center shadow-[0_0_40px_rgba(234,179,8,0.25)]">
              <LoaderCircle size={34} className="text-yellow-400 animate-spin" />
            </div>
            <div className="flex flex-col items-center gap-3">
              <p className="font-pixel text-yellow-400 text-sm md:text-lg tracking-widest">{t('councilGathering', lang)}</p>
              <p className="max-w-xl text-sm md:text-base text-slate-300 leading-relaxed">{state.rawQuestion}</p>
            </div>

            {state.error && (
              <div className="w-[90vw] max-w-lg bg-red-950/90 border border-red-800 text-red-200 p-3 rounded-lg text-sm flex gap-2 items-center shadow-xl">
                <AlertCircle size={16} className="text-red-400 shrink-0" />
                <span className="flex-1 text-left">{state.error}</span>
                <button onClick={reset} className="text-xs px-2.5 py-1 bg-red-900/50 hover:bg-red-900 rounded font-pixel">{t('reset', lang)}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================== DURUŞMA SAHNESİ ======================== */}
      {inTrial && (
        // Sahnenin herhangi bir yerine tıklamak = ilerle (akan metni tamamla / sıradakine geç)
        <div className="absolute inset-0" onClick={advance}>
          {/* Tam ekran sahne */}
          <Courtroom
            activeMember={state.activeMember}
            avatarState={state.avatarState}
            screenShake={state.screenShake}
            gavelFlash={state.gavelFlash}
            members={state.members}
          />

          {/* ÜST HUD: logo + faz + record + önerme */}
          <div className="absolute top-0 inset-x-0 z-40 flex flex-col gap-1.5 px-3 md:px-5 pt-2 pb-2 bg-gradient-to-b from-black/85 via-black/55 to-transparent pointer-events-none">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-7 h-7 rounded-lg bg-yellow-500 flex items-center justify-center text-slate-950">
                  <Gavel size={15} strokeWidth={2.5} />
                </div>
                <span className="font-pixel text-yellow-500 text-[11px] tracking-widest hidden md:inline">DİVAN</span>
              </div>
              <div className="flex-1 min-w-0 pointer-events-auto">
                <PhaseIndicator currentPhase={state.phase === 'loading' ? 'idle' : state.phase} />
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setIsRecordOpen(true); }}
                className="pointer-events-auto shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-[10px] font-pixel text-slate-300 hover:text-white border border-slate-800 transition-colors active:scale-95"
              >
                <BookOpen size={13} className="text-yellow-500" />
                <span className="hidden md:inline">{t('record', lang)}</span>
              </button>
            </div>

            {state.frame && (
              <div className="flex items-center gap-2 bg-black/40 border border-slate-800/70 rounded-md py-1.5 px-3 max-w-3xl">
                <span className="text-[8px] font-pixel text-yellow-500 shrink-0 uppercase tracking-widest">{t('proposition', lang)}</span>
                <p className="text-[11px] md:text-xs font-medium text-slate-200 truncate">{state.frame.proposition}</p>
              </div>
            )}
          </div>

          {/* Hata bildirimi */}
          {state.error && (
            <div className="absolute top-28 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-lg bg-red-950/90 border border-red-800 text-red-200 p-3 rounded-lg text-sm flex gap-2 items-center shadow-xl">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <span className="flex-1">{state.error}</span>
              <button onClick={reset} className="text-xs px-2.5 py-1 bg-red-900/50 hover:bg-red-900 rounded font-pixel">{t('reset', lang)}</button>
            </div>
          )}

          {/* Alt diyalog */}
          <DialogueBox
            speaker={state.dialogueSpeaker}
            role={state.dialogueSpeakerRole}
            text={state.dialogueText}
            isStreaming={state.isStreaming}
            isTextStreaming={state.isTextStreaming}
            waitingForContinue={state.waitingForContinue}
            mute={state.mute}
            onAdvance={advance}
            onToggleMute={toggleMute}
            onReset={reset}
          />
        </div>
      )}

      {/* ======================== KARAR EKRANI ======================== */}
      {state.phase === 'verdict' && state.verdict && (
        <div className="absolute inset-0 z-40 vn-stage-bg overflow-y-auto scrollbar-thin py-8 px-4">
          <div className="flex flex-col items-center">
            <VerdictCard verdict={state.verdict} onReset={reset} />
            {/* Her üyenin ne dediğini özetleyen rapor */}
            <CouncilReport members={state.members} />
          </div>
        </div>
      )}

      {/* Court record çekmecesi */}
      <CourtRecord
        isOpen={isRecordOpen}
        onClose={() => setIsRecordOpen(false)}
        frame={state.frame}
        members={state.members}
        clashes={state.clashes}
        confidence={state.verdict ? state.verdict.confidence : null}
      />
    </div>
  );
};
