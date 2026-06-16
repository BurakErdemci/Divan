import React from 'react';
import { Volume2, VolumeX, X } from 'lucide-react';

interface DialogueBoxProps {
  speaker: string;
  role: string;
  text: string;
  isStreaming: boolean;
  isTextStreaming: boolean;
  waitingForContinue: boolean;
  mute: boolean;
  onAdvance: () => void;
  onToggleMute: () => void;
  onReset: () => void;
}

const SPEAKER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  stratejist: { bg: '#3b0764', text: '#f5f3ff', border: '#a855f7' },
  supheci: { bg: '#450a0a', text: '#fef2f2', border: '#ef4444' },
  yaratici: { bg: '#042f2e', text: '#f0fdfa', border: '#14b8a6' },
  muhendis: { bg: '#1e3a8a', text: '#eff6ff', border: '#3b82f6' },
  realist: { bg: '#451a03', text: '#fffbeb', border: '#f59e0b' },
  yargic: { bg: '#3f2b0f', text: '#fef9c3', border: '#eab308' },
};

export const DialogueBox: React.FC<DialogueBoxProps> = ({
  speaker,
  role,
  text,
  isStreaming,
  isTextStreaming,
  waitingForContinue,
  mute,
  onAdvance,
  onToggleMute,
  onReset,
}) => {
  const colors = SPEAKER_COLORS[role] || { bg: '#1e293b', text: '#f8fafc', border: '#64748b' };

  // AA davranışı: kutuya tıkla → akıyorsa metni tamamla, bitmişse sıradakine geç.
  const handleBoxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAdvance();
  };

  return (
    <div
      className="vn-dialogue absolute bottom-0 left-0 right-0 z-30 px-4 md:px-10 pt-7 pb-5 cursor-pointer select-none"
      style={{ borderTopColor: colors.border, minHeight: 200 }}
      onClick={handleBoxClick}
    >
      {/* İsimlik sekmesi */}
      {speaker && (
        <div
          className="vn-nameplate absolute -top-4 left-6 md:left-10 px-5 py-2 rounded-md border-2 text-[11px] md:text-xs uppercase tracking-widest"
          style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
        >
          {speaker}
        </div>
      )}

      {/* Sağ üst kontroller (tıklama yayılmasın) */}
      <div className="absolute top-3 right-4 md:right-8 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onToggleMute}
          className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-800/70 hover:bg-slate-700 border border-slate-700 transition-colors active:scale-95"
          title={mute ? 'Sesi aç' : 'Sessize al'}
        >
          {mute ? <VolumeX size={15} className="text-red-400" /> : <Volume2 size={15} className="text-emerald-400" />}
        </button>
        {isStreaming && (
          <button
            onClick={onReset}
            className="w-8 h-8 flex items-center justify-center rounded-md bg-red-950/50 hover:bg-red-900/60 border border-red-900/60 transition-colors active:scale-95"
            title="Duruşmayı iptal et"
          >
            <X size={15} className="text-red-300" />
          </button>
        )}
      </div>

      {/* Metin alanı — her zaman tam ve okunur (CLAUDE.md §5) */}
      <div className="max-w-5xl mx-auto">
        <div className="text-slate-100 text-[15px] md:text-[17px] leading-relaxed font-sans whitespace-pre-line overflow-y-auto max-h-[26vh] pr-2 scrollbar-thin">
          {text || (
            <span className="text-slate-500 italic">Duruşma başlıyor…</span>
          )}
        </div>
      </div>

      {/* Devam / Atla göstergesi */}
      <div className="absolute bottom-3 right-6 md:right-10 flex items-center gap-3 text-[10px] font-pixel">
        {isTextStreaming ? (
          <button onClick={(e) => { e.stopPropagation(); onAdvance(); }} className="text-slate-400 hover:text-white transition-colors tracking-wider">
            ATLA ▸▸
          </button>
        ) : waitingForContinue ? (
          <span className="text-slate-400 tracking-wider flex items-center gap-2">
            DEVAM <span className="text-[8px] text-slate-600">(tıkla / boşluk)</span>
            <span className="animate-blink-tri text-base" style={{ color: colors.border }}>▼</span>
          </span>
        ) : (
          isStreaming && <span className="text-slate-500 tracking-wider">sırada…</span>
        )}
      </div>
    </div>
  );
};
