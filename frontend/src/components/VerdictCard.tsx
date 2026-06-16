import React from 'react';
import { motion } from 'framer-motion';
import { Award, AlertTriangle, CheckCircle2, ShieldAlert, HelpCircle, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Verdict, Role } from '../types/trial';

interface VerdictCardProps {
  verdict: Verdict;
  onReset: () => void;
}

const ROLE_NAMES: Record<Role, string> = {
  stratejist: 'Athena (Stratejist)',
  supheci: 'Socrates (Şüpheci)',
  yaratici: 'Apollo (Yaratıcı)',
  muhendis: 'Hephaestus (Mühendis)',
  realist: 'Atlas (Realist)',
};

const ROLE_COLORS: Record<Role, string> = {
  stratejist: '#a855f7',
  supheci: '#ef4444',
  yaratici: '#14b8a6',
  muhendis: '#3b82f6',
  realist: '#f59e0b',
};

export const VerdictCard: React.FC<VerdictCardProps> = ({ verdict, onReset }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 100 }}
      className="w-full max-w-3xl mx-auto bg-slate-900 border-2 border-yellow-500/80 rounded-xl p-5 md:p-7 shadow-[0_15px_40px_rgba(234,179,8,0.15)] flex flex-col gap-6 text-left relative overflow-hidden font-sans backdrop-blur-md"
    >
      {/* Decorative Golden Ribbon overlay */}
      <div className="absolute -top-12 -right-12 w-28 h-28 bg-yellow-500/10 rounded-full blur-xl pointer-events-none" />
      <div className="absolute top-0 right-0 px-4 py-1.5 bg-yellow-500 text-slate-950 text-[9px] font-pixel rounded-bl-lg tracking-widest font-bold">
        KARAR (VERDICT)
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
        <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center border border-yellow-500/30">
          <Award className="text-yellow-500" size={24} />
        </div>
        <div>
          <h2 className="text-lg md:text-xl font-bold text-slate-100 font-pixel tracking-tight">Divan Hükmü</h2>
          <p className="text-xs text-slate-500 uppercase tracking-widest font-pixel mt-1">Nihai Teşhis ve Sentez Raporu</p>
        </div>
      </div>

      {/* Core Decision */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 md:p-5 flex flex-col gap-3">
        <span className="text-[10px] font-pixel text-yellow-500 uppercase tracking-wider">Hüküm ve Eylem Planı</span>
        <h3 className="text-slate-100 text-base md:text-lg font-bold leading-relaxed">
          {verdict.decision}
        </h3>
      </div>

      {/* Stats row: Confidence & Vote Signal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Confidence Meter */}
        <div className="bg-slate-950/40 border border-slate-800/60 rounded-lg p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center text-[10px] font-pixel text-slate-400 uppercase tracking-wider">
            <span>Güven Seviyesi (Confidence)</span>
            <span className="text-yellow-500 font-bold">%{verdict.confidence}</span>
          </div>
          
          {/* Animated Progress Bar */}
          <div className="w-full h-3 bg-slate-950 border border-slate-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${verdict.confidence}%` }}
              transition={{ delay: 0.3, duration: 1.2, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"
            />
          </div>
          <p className="text-[10px] text-slate-500 leading-normal">
            *Güven derecesi basit oy sayımından bağımsız; meclisin tutarlılığı, load-bearing dissenter (kritik muhalefet) analizi ve çürük faktörlerine dayanarak Yargıç tarafından hesaplanmıştır.
          </p>
        </div>

        {/* Vote Signal */}
        <div className="bg-slate-950/40 border border-slate-800/60 rounded-lg p-4 flex flex-col justify-between gap-3">
          <span className="text-[10px] font-pixel text-slate-400 uppercase tracking-wider block">Oylama Dağılımı (Signal)</span>
          <div className="flex items-center gap-6 py-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ThumbsUp size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-pixel font-bold text-emerald-400">{verdict.vote_signal.support}</span>
                <span className="text-[9px] text-slate-500 uppercase font-medium">Destek</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-red-950/40 border border-red-500/30 flex items-center justify-center text-red-400">
                <ThumbsDown size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-pixel font-bold text-red-400">{verdict.vote_signal.oppose}</span>
                <span className="text-[9px] text-slate-500 uppercase font-medium">Karşı</span>
              </div>
            </div>
          </div>
          
          <div className="text-[11px] text-slate-300 font-semibold bg-slate-950/30 px-2.5 py-1 rounded border border-slate-800/80">
            {verdict.confidence_weighted}
          </div>
        </div>
      </div>

      {/* Consensus & Fault Line */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Consensus */}
        <div className="border border-slate-800/80 rounded-lg p-4 bg-slate-950/20">
          <div className="flex items-center gap-2 text-emerald-500 mb-2">
            <CheckCircle2 size={14} />
            <h4 className="text-[10px] font-pixel uppercase tracking-wider">Uzlaşılan Noktalar</h4>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {verdict.consensus}
          </p>
        </div>

        {/* Fault Line */}
        <div className="border border-slate-800/80 rounded-lg p-4 bg-slate-950/20">
          <div className="flex items-center gap-2 text-yellow-500 mb-2">
            <AlertTriangle size={14} />
            <h4 className="text-[10px] font-pixel uppercase tracking-wider">Karar Fay Hattı</h4>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {verdict.fault_line}
          </p>
        </div>
      </div>

      {/* Kill Condition & Minority Report */}
      <div className="flex flex-col gap-4 border-t border-slate-800/80 pt-4">
        {/* Kill Condition (Warning Banner) */}
        <div className="bg-red-950/10 border border-red-900/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <ShieldAlert size={16} />
            <h4 className="text-[10px] font-pixel uppercase tracking-wider">Kill Condition (Geri Dönüş Eşiği)</h4>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">
            {verdict.kill_condition}
          </p>
        </div>

        {/* Minority Report (Dissenting Voice) */}
        <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] font-pixel uppercase tracking-wider text-purple-400">Azınlık Raporu (Muhalif Görüş)</h4>
            {verdict.dissenter && (
              <span 
                className="text-[9px] font-semibold px-2 py-0.5 rounded border"
                style={{ 
                  borderColor: ROLE_COLORS[verdict.dissenter], 
                  color: ROLE_COLORS[verdict.dissenter],
                  backgroundColor: `${ROLE_COLORS[verdict.dissenter]}10`
                }}
              >
                Muhalif: {ROLE_NAMES[verdict.dissenter]}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-300 italic leading-relaxed whitespace-pre-line">
            &ldquo;{verdict.minority_report}&rdquo;
          </p>
          {verdict.dissent_is_load_bearing && (
            <div className="mt-2.5 p-1.5 rounded bg-amber-950/20 text-[10px] text-amber-300 border border-amber-900/30 flex items-center gap-1.5 leading-none">
              <AlertTriangle size={12} />
              <span>UYARI: Bu muhalif görüş yük taşımaktadır (Load-bearing dissent). Kararın güvenliğini zayıflatır!</span>
            </div>
          )}
        </div>
      </div>

      {/* Open Questions / Next steps */}
      <div className="bg-slate-950/40 border border-slate-800/60 rounded-lg p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-cyan-400">
          <HelpCircle size={15} />
          <h4 className="text-[10px] font-pixel uppercase tracking-wider">Araştırılması Gereken Açık Sorular</h4>
        </div>
        <ul className="flex flex-col gap-2 pl-4 list-disc text-xs text-slate-300 leading-relaxed">
          {verdict.open_questions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="flex justify-center border-t border-slate-800/80 pt-5 mt-2">
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold transition-all shadow-lg active:scale-95 font-sans text-sm"
        >
          <RefreshCw size={15} />
          <span>Yeni Duruşma Başlat</span>
        </button>
      </div>
    </motion.div>
  );
};
