import React from 'react';
import { Scale, MessageSquare, Flame, Award, LucideIcon } from 'lucide-react';

interface PhaseIndicatorProps {
  currentPhase: 'idle' | 'frame' | 'opening' | 'clash' | 'verdict';
}

interface Step {
  id: typeof PHASES[number];
  label: string;
  desc: string;
  icon: LucideIcon;
}

const PHASES = ['frame', 'opening', 'clash', 'verdict'] as const;

export const PhaseIndicator: React.FC<PhaseIndicatorProps> = ({ currentPhase }) => {
  const steps: Step[] = [
    { id: 'frame', label: 'Çerçeveleme', desc: 'Faz 0', icon: Scale },
    { id: 'opening', label: 'Açılış', desc: 'Faz 1', icon: MessageSquare },
    { id: 'clash', label: 'Çatışma', desc: 'Faz 2', icon: Flame },
    { id: 'verdict', label: 'Karar', desc: 'Faz 3', icon: Award },
  ];

  const getPhaseIndex = (phase: string) => {
    if (phase === 'idle') return -1;
    return PHASES.indexOf(phase as typeof PHASES[number]);
  };

  const activeIdx = getPhaseIndex(currentPhase);

  return (
    <div className="w-full bg-slate-900/60 border border-slate-800 rounded-lg p-3 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.3)] backdrop-blur-md">
      {/* Short badge for mobile, full steps on desktop */}
      <div className="flex items-center gap-2 md:hidden">
        <span className="text-[10px] font-pixel text-yellow-500 uppercase tracking-widest">Aşama:</span>
        <span className="text-xs font-semibold text-slate-100 uppercase tracking-wide">
          {activeIdx === -1 ? 'Giriş' : steps[activeIdx].label}
        </span>
      </div>

      <div className="hidden md:flex items-center justify-between w-full relative">
        {/* Background Connecting Line */}
        <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-800 -translate-y-1/2 z-0" />
        
        {/* Active Progress Line */}
        {activeIdx > 0 && (
          <div 
            className="absolute top-1/2 left-4 h-0.5 bg-yellow-500/50 -translate-y-1/2 z-0 transition-all duration-500" 
            style={{ width: `${(activeIdx / (steps.length - 1)) * 92}%` }}
          />
        )}

        {steps.map((step, index) => {
          const isCompleted = index < activeIdx;
          const isActive = index === activeIdx;
          const Icon = step.icon;

          return (
            <div 
              key={step.id} 
              className="flex items-center gap-3 z-10 bg-slate-900/95 px-3 py-1.5 rounded-full border transition-all duration-300"
              style={{
                borderColor: isActive 
                  ? '#eab308' // Gold
                  : isCompleted 
                    ? 'rgba(234, 179, 8, 0.4)'
                    : '#1e293b',
                boxShadow: isActive ? '0 0 10px rgba(234, 179, 8, 0.2)' : 'none'
              }}
            >
              <div 
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-300 ${
                  isActive 
                    ? 'bg-yellow-500 text-slate-950 font-bold' 
                    : isCompleted 
                      ? 'bg-yellow-600/20 text-yellow-500' 
                      : 'bg-slate-800 text-slate-500'
                }`}
              >
                <Icon size={12} className={isActive ? 'animate-pulse' : ''} />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[8px] font-pixel text-slate-500 uppercase tracking-wider leading-none">
                  {step.desc}
                </span>
                <span className={`text-[11px] font-medium leading-tight ${isActive ? 'text-yellow-400 font-bold' : 'text-slate-400'}`}>
                  {step.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Connection indicator */}
      <div className="flex items-center gap-2 pl-4 border-l border-slate-800">
        <div className={`w-2 h-2 rounded-full ${currentPhase !== 'idle' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
        <span className="text-[9px] font-pixel text-slate-500 uppercase tracking-widest">
          {currentPhase !== 'idle' ? 'BAĞLI' : 'BOŞTA'}
        </span>
      </div>
    </div>
  );
};
