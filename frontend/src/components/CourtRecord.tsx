import React from 'react';
import { BookOpen, Flame, Scale } from 'lucide-react';
import { Frame, MemberResponse, Clash } from '../types/trial';

interface CourtRecordProps {
  isOpen: boolean;
  onClose: () => void;
  frame: Frame | null;
  members: Record<string, MemberResponse & { active: boolean; isPresent: boolean }>;
  clashes: Clash[];
  confidence: number | null;
}

const MEMBER_INFO: Record<string, { name: string; role: string; color: string }> = {
  athena: { name: 'Athena', role: 'Stratejist', color: '#a855f7' },
  socrates: { name: 'Socrates', role: 'Şüpheci', color: '#ef4444' },
  apollo: { name: 'Apollo', role: 'Yaratıcı', color: '#14b8a6' },
  hephaestus: { name: 'Hephaestus', role: 'Mühendis', color: '#3b82f6' },
  atlas: { name: 'Atlas', role: 'Realist', color: '#f59e0b' },
};

export const CourtRecord: React.FC<CourtRecordProps> = ({
  isOpen,
  onClose,
  frame,
  members,
  clashes,
  confidence,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-sm md:max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col font-sans text-left transition-all duration-300">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center gap-2">
          <BookOpen className="text-yellow-500" size={18} />
          <h2 className="text-xs font-pixel uppercase tracking-widest text-slate-100">Dava Dosyası (Court Record)</h2>
        </div>
        <button
          onClick={onClose}
          className="text-xs font-pixel text-slate-400 hover:text-white px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
        >
          KAPAT
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 scrollbar-thin">
        {/* Proposition Section */}
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3.5">
          <div className="flex items-center gap-2 mb-2 text-yellow-500">
            <Scale size={16} />
            <h3 className="text-[10px] font-pixel uppercase tracking-wider">İncelenen Önerme</h3>
          </div>
          {frame ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-slate-100 text-xs font-semibold leading-relaxed">
                {frame.proposition}
              </p>
              <div className="text-[9px] font-pixel text-slate-500 uppercase">
                Format: {frame.answer_format === 'yes_no' ? 'Evet / Hayır' : 'Çoktan Seçmeli'}
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-xs">Dava henüz başlatılmadı.</p>
          )}
        </div>

        {/* Confidence rating (if available) */}
        {confidence !== null && (
          <div className="bg-slate-950/30 border border-slate-800/80 rounded-lg p-3 flex items-center justify-between">
            <span className="text-[10px] font-pixel uppercase tracking-wider text-slate-400">Genel Güven (Confidence)</span>
            <span className="text-lg font-pixel font-bold text-yellow-400">%{confidence}</span>
          </div>
        )}

        {/* Member Statements Section */}
        <div className="flex flex-col gap-3">
          <h3 className="text-[10px] font-pixel uppercase tracking-wider text-slate-400 px-1">Üye İfadeleri</h3>
          <div className="flex flex-col gap-2">
            {Object.entries(MEMBER_INFO).map(([key, info]) => {
              const statement = members[key];
              const isPresent = statement?.isPresent;

              return (
                <div 
                  key={key} 
                  className={`border rounded-lg p-3 transition-colors ${
                    isPresent 
                      ? 'bg-slate-950/40 border-slate-800' 
                      : 'bg-slate-950/10 border-slate-900/40 opacity-40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2.5 h-2.5 rounded-full" 
                        style={{ backgroundColor: info.color }}
                      />
                      <span className="text-xs font-bold text-slate-200">{info.name}</span>
                      <span className="text-[9px] font-medium text-slate-500">({info.role})</span>
                    </div>
                    {isPresent && (
                      <span 
                        className="text-[8px] font-pixel px-1.5 py-0.5 rounded border"
                        style={{ 
                          borderColor: info.color, 
                          color: info.color,
                          backgroundColor: `${info.color}10`
                        }}
                      >
                        %{statement.confidence} GÜVEN
                      </span>
                    )}
                  </div>
                  {isPresent && statement.stance ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-[11px] text-slate-300 italic leading-relaxed">
                        &ldquo;{statement.stance}&rdquo;
                      </p>
                      
                      {/* Reason list toggler / summary */}
                      <div className="text-[10px] text-slate-400">
                        <ul className="list-disc pl-4 flex flex-col gap-1">
                          {statement.reasons.map((reason, i) => (
                            <li key={i}>{reason}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="text-[9px] border-t border-slate-800/80 pt-2 text-slate-500">
                        <strong className="text-yellow-600 font-normal">Duruş Değişme Koşulu:</strong> {statement.flip_condition}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-600">İfade bekleniyor...</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Clash Timeline Section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-slate-400 px-1">
            <Flame size={14} className="text-red-500" />
            <h3 className="text-[10px] font-pixel uppercase tracking-wider">Çatışma ve İtirazlar</h3>
          </div>
          {clashes.length > 0 ? (
            <div className="flex flex-col gap-2">
              {clashes.map((clash, idx) => (
                <div key={idx} className="bg-red-950/10 border border-red-900/20 rounded-lg p-3">
                  <div className="text-[9px] font-pixel text-red-400 mb-1">
                    Fay Hattı: {clash.fault_line}
                  </div>
                  <div className="flex flex-col gap-2 mt-2 pl-2 border-l border-red-900/30">
                    {clash.exchanges.map((ex, exIdx) => (
                      <div key={exIdx} className="text-xs">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-300">
                          <span className="capitalize">{ex.from}</span> 
                          <span className="text-[9px] text-slate-500">➔ Challenged</span>
                          <span className="capitalize">{ex.targets}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                          {ex.argument}
                        </p>
                        {ex.sub_round && (
                          <div className="bg-slate-950/40 p-2 rounded mt-1.5 border border-slate-800/50 text-[10px] text-slate-400 leading-normal italic">
                            {ex.sub_round}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-600 text-xs px-1">Henüz bir itiraz veya çatışma yaşanmadı.</p>
          )}
        </div>
      </div>

      {/* Footer information */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 text-center">
        <p className="text-[9px] font-pixel text-slate-600 uppercase tracking-widest">Gerekçe ve Veriler Arşivleniyor</p>
      </div>
    </div>
  );
};
