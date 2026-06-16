import React, { useState, useEffect } from 'react';
import { useTrialMachine } from './trial-machine';
import { PhaseIndicator } from './components/PhaseIndicator';
import { Courtroom } from './components/Courtroom';
import { DialogueBox } from './components/DialogueBox';
import { CourtRecord } from './components/CourtRecord';
import { VerdictCard } from './components/VerdictCard';
import { CouncilReport } from './components/CouncilReport';
import { ObjectionBanner } from './components/ObjectionBanner';
import { MEMBER_IMAGES } from './components/CharacterSprite';
import { MemberId } from './types/trial';
import { Scale, BookOpen, AlertCircle, Play, Gavel } from 'lucide-react';
import './styles/app.css';

const ALL_MEMBERS: MemberId[] = ['socrates', 'athena', 'apollo', 'hephaestus', 'atlas', 'themis'];

export const App: React.FC = () => {
  const { state, startTrial, advance, reset, toggleMute } = useTrialMachine();

  const [question, setQuestion] = useState('');
  const [mode, setMode] = useState<'mock' | 'live'>('mock');
  const [isRecordOpen, setIsRecordOpen] = useState(false);

  const inTrial = state.phase !== 'idle' && state.phase !== 'verdict';

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
    startTrial(question, mode);
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#06060a] text-slate-100 font-sans selection:bg-yellow-500/30">
      {/* Tokmak ekran flaşı */}
      {state.gavelFlash && <div className="absolute inset-0 bg-white z-[60] pointer-events-none animate-flash" />}

      {/* İTİRAZ! bannerı */}
      <ObjectionBanner show={state.showObjectionBanner} text={state.objectionBannerText} color={state.objectionBannerColor} />

      {/* ======================== GİRİŞ / BAŞLANGIÇ EKRANI ======================== */}
      {state.phase === 'idle' && (
        <div className="vn-stage-bg absolute inset-0 flex flex-col items-center justify-center px-4">
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
            <p className="text-[10px] md:text-xs font-pixel text-slate-400 tracking-[0.3em] uppercase">5 Zihin · 1 Teşhis · Karar Değil Teşhis</p>
          </div>

          {/* Dava dosyası paneli */}
          <form
            onSubmit={handleSubmit}
            className="relative z-10 w-full max-w-lg bg-slate-950/80 border-2 border-yellow-500/30 rounded-xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.7)] backdrop-blur-md flex flex-col gap-4"
          >
            <div className="flex items-center gap-2 text-yellow-500">
              <Scale size={15} />
              <span className="text-[10px] font-pixel uppercase tracking-widest">Dava Dosyası</span>
            </div>

            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Örn: Önümüzdeki hafta yeni sesli asistan özelliğini entegre etmeli miyiz?"
              className="w-full h-24 p-3.5 rounded-lg bg-black/50 border border-slate-700 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 text-sm text-slate-100 placeholder-slate-600 focus:outline-none resize-none leading-relaxed"
              maxLength={300}
              autoFocus
            />

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
                  <span>{m === 'mock' ? 'SİMÜLASYON' : 'GERÇEK SUNUCU'}</span>
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
              <span className="text-xs font-pixel tracking-widest">DURUŞMAYI BAŞLAT</span>
            </button>

            {mode === 'live' && (
              <div className="flex gap-2 items-start text-[10px] text-slate-500 leading-normal">
                <AlertCircle size={13} className="text-yellow-600/80 shrink-0 mt-0.5" />
                <span>Gerçek sunucu modu local FastAPI backend'i gerektirir. Backend yoksa Simülasyon'u kullan.</span>
              </div>
            )}
          </form>
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
                <PhaseIndicator currentPhase={state.phase} />
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setIsRecordOpen(true); }}
                className="pointer-events-auto shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-[10px] font-pixel text-slate-300 hover:text-white border border-slate-800 transition-colors active:scale-95"
              >
                <BookOpen size={13} className="text-yellow-500" />
                <span className="hidden md:inline">DOSYA</span>
              </button>
            </div>

            {state.frame && (
              <div className="flex items-center gap-2 bg-black/40 border border-slate-800/70 rounded-md py-1.5 px-3 max-w-3xl">
                <span className="text-[8px] font-pixel text-yellow-500 shrink-0 uppercase tracking-widest">Önerme</span>
                <p className="text-[11px] md:text-xs font-medium text-slate-200 truncate">{state.frame.proposition}</p>
              </div>
            )}
          </div>

          {/* Hata bildirimi */}
          {state.error && (
            <div className="absolute top-28 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-lg bg-red-950/90 border border-red-800 text-red-200 p-3 rounded-lg text-sm flex gap-2 items-center shadow-xl">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <span className="flex-1">{state.error}</span>
              <button onClick={reset} className="text-xs px-2.5 py-1 bg-red-900/50 hover:bg-red-900 rounded font-pixel">SIFIRLA</button>
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
