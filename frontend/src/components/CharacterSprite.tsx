import React from 'react';
import { MemberId } from '../types/trial';

export type SpriteState =
  | 'idle' | 'speaking' | 'confident' | 'nervous' | 'objection' | 'conceding';

interface CharacterSpriteProps {
  memberId: MemberId;
  state: SpriteState;
}

const assetModules = import.meta.glob('../assets/*.{png,jpg,jpeg,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});

function assetByPrefix(prefix: string): string {
  const lowerPrefix = prefix.toLowerCase();
  const entry = Object.entries(assetModules).find(([path]) => {
    const filename = path.split('/').pop()?.toLowerCase() ?? '';
    return filename.startsWith(`${lowerPrefix}-`) || filename === `${lowerPrefix}.png`;
  });
  return (entry?.[1] as string | undefined) ?? '';
}

export const MEMBER_IMAGES: Record<MemberId, string> = {
  athena: assetByPrefix('athena'),
  socrates: assetByPrefix('socrates'),
  apollo: assetByPrefix('apollo'),
  hephaestus: assetByPrefix('hephaestus'),
  atlas: assetByPrefix('atlas'),
  themis: assetByPrefix('themis'),
};

export const MEMBER_META: Record<MemberId, { color: string; name: string; title: string }> = {
  athena: { color: '#a855f7', name: 'Athena', title: 'Stratejist' },
  socrates: { color: '#ef4444', name: 'Socrates', title: 'Şüpheci' },
  apollo: { color: '#14b8a6', name: 'Apollo', title: 'Yaratıcı' },
  hephaestus: { color: '#3b82f6', name: 'Hephaestus', title: 'Mühendis' },
  atlas: { color: '#f59e0b', name: 'Atlas', title: 'Realist' },
  themis: { color: '#eab308', name: 'Themis', title: 'Yargıç' },
};

/**
 * Sahne büstü: tam yükseklik, zemine oturur, kart/çerçeve YOK (VN hissi).
 * Durum efektleri (ter, kıvılcım, itiraz vinyeti) görsel olarak üstte.
 */
export const StageCharacter: React.FC<CharacterSpriteProps> = ({ memberId, state }) => {
  const image = MEMBER_IMAGES[memberId] || MEMBER_IMAGES.themis;
  const meta = MEMBER_META[memberId] || MEMBER_META.themis;

  const isSpeaking = state === 'speaking';
  const isNervous = state === 'nervous';
  const isConfident = state === 'confident';
  const isObjection = state === 'objection';
  const isConceding = state === 'conceding';

  let imgClass = 'vn-char animate-char-enter';
  if (isObjection) imgClass += ' animate-slam';
  else if (isSpeaking) imgClass += ' animate-char-bob';

  let imgStyle: React.CSSProperties = {};
  if (isConceding) imgStyle = { filter: 'grayscale(45%) brightness(0.7)', transform: 'translateY(6px) rotate(1deg)' };
  if (isNervous) imgStyle = { filter: 'brightness(0.92) saturate(0.9)' };

  return (
    <div className="relative h-full flex items-end justify-center">
      {image ? (
        <img src={image} alt={meta.name} className={imgClass} style={imgStyle} draggable={false} />
      ) : (
        <div
          className={`${imgClass} w-[min(42vh,340px)] h-[min(58vh,520px)] rounded-t-full border-4 bg-slate-900/80`}
          style={{ ...imgStyle, borderColor: meta.color, boxShadow: `0 0 40px ${meta.color}55` }}
        />
      )}

      {/* Nervous: ter damlaları */}
      {isNervous && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <g className="animate-sweat">
            <path d="M64 22 Q62 28, 63 31" stroke="#7dd3fc" strokeWidth="1.6" fill="none" />
            <circle cx="63" cy="31" r="1.4" fill="#7dd3fc" />
          </g>
          <g className="animate-sweat" style={{ animationDelay: '0.7s' }}>
            <path d="M38 26 Q36 32, 37 35" stroke="#7dd3fc" strokeWidth="1.4" fill="none" />
            <circle cx="37" cy="35" r="1.2" fill="#7dd3fc" />
          </g>
        </svg>
      )}

      {/* Confident: kıvılcım */}
      {isConfident && (
        <svg className="absolute top-[12%] right-[24%] w-8 h-8 text-yellow-300 animate-pulse drop-shadow-[0_0_8px_rgba(250,204,21,0.9)] pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l2.4 7.6H22l-6.2 4.7 2.4 7.7-6.2-4.7-6.2 4.7 2.4-7.7L2 9.6h7.6z" />
        </svg>
      )}

      {/* Objection: kırmızı vinyet */}
      {isObjection && (
        <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 120px rgba(239,68,68,0.5)' }} />
      )}
    </div>
  );
};

/**
 * Roster chip: üst şeritteki küçük yuvarlak avatar.
 */
export const RosterChip: React.FC<{ memberId: MemberId; active: boolean; present: boolean }> = ({
  memberId, active, present,
}) => {
  const image = MEMBER_IMAGES[memberId];
  const meta = MEMBER_META[memberId];
  return (
    <div className="flex flex-col items-center gap-1 shrink-0" title={`${meta.name} — ${meta.title}`}>
      <div
        className="rounded-full overflow-hidden border-2 transition-all duration-300"
        style={{
          width: active ? 46 : 38,
          height: active ? 46 : 38,
          borderColor: active ? meta.color : 'rgba(100,116,139,0.5)',
          opacity: present ? 1 : 0.3,
          filter: present ? 'none' : 'grayscale(80%)',
          boxShadow: active ? `0 0 14px ${meta.color}` : 'none',
        }}
      >
        {image ? (
          <img src={image} alt={meta.name} className="w-full h-full object-cover" style={{ objectPosition: 'top center' }} draggable={false} />
        ) : (
          <div className="w-full h-full" style={{ backgroundColor: meta.color }} />
        )}
      </div>
      <span
        className="font-pixel leading-none tracking-tight"
        style={{ fontSize: 7, color: active ? meta.color : '#64748b' }}
      >
        {meta.name}
      </span>
    </div>
  );
};
