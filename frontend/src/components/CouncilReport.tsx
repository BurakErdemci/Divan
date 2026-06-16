import React from 'react';
import { MemberResponse, MemberId } from '../types/trial';
import { MEMBER_IMAGES, MEMBER_META } from './CharacterSprite';
import { Users } from 'lucide-react';

type MemberRow = MemberResponse & { active: boolean; isPresent: boolean };

interface CouncilReportProps {
  members: Record<string, MemberRow>;
}

const ORDER: MemberId[] = ['athena', 'socrates', 'apollo', 'hephaestus', 'atlas'];

/** Karar ekranında: her üyenin açılış görüşünü özetleyen rapor (CLAUDE.md §0/§4). */
export const CouncilReport: React.FC<CouncilReportProps> = ({ members }) => {
  const present = ORDER.filter((id) => members[id]?.isPresent && members[id]?.stance);
  if (present.length === 0) return null;

  return (
    <div className="w-full max-w-3xl mx-auto mt-4 bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <Users size={16} className="text-yellow-500" />
        <h3 className="text-[11px] font-pixel uppercase tracking-widest text-slate-200">Meclis Görüşleri — Kim Ne Dedi</h3>
      </div>

      {present.map((id) => {
        const m = members[id];
        const meta = MEMBER_META[id];
        return (
          <div key={id} className="flex gap-3 items-start">
            <div className="rounded-full overflow-hidden border-2 shrink-0" style={{ width: 44, height: 44, borderColor: meta.color }}>
              <img src={MEMBER_IMAGES[id]} alt={meta.name} className="w-full h-full object-cover" style={{ objectPosition: 'top center' }} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold" style={{ color: meta.color }}>
                  {meta.name} <span className="text-[10px] font-normal text-slate-500">· {meta.title}</span>
                </span>
                <span className="text-[10px] font-pixel shrink-0" style={{ color: meta.color }}>%{m.confidence}</span>
              </div>

              {/* güven çubuğu */}
              <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden my-1.5">
                <div className="h-full rounded-full" style={{ width: `${m.confidence}%`, backgroundColor: meta.color }} />
              </div>

              <p className="text-[13px] text-slate-200 font-semibold leading-snug">{m.stance}</p>

              {m.reasons.length > 0 && (
                <ul className="mt-1.5 flex flex-col gap-0.5 pl-4 list-disc text-[12px] text-slate-400 leading-snug">
                  {m.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}

              {m.flip_condition && (
                <p className="mt-1.5 text-[11px] text-slate-500 italic leading-snug">
                  <span className="text-slate-400 not-italic font-medium">Fikrini değiştirir:</span> {m.flip_condition}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
