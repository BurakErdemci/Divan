import React from 'react';
import { MemberId } from '../types/trial';
import { StageCharacter, RosterChip, MEMBER_META, SpriteState } from './CharacterSprite';

interface CourtroomProps {
  activeMember: MemberId | null;
  avatarState: SpriteState;
  screenShake: boolean;
  gavelFlash: boolean;
  members: Record<string, { active: boolean; isPresent: boolean }>;
}

const COUNCIL: MemberId[] = ['athena', 'socrates', 'apollo', 'hephaestus', 'atlas'];

// İsteğe bağlı mahkeme arka planı: src/assets/bg/ içine bir görsel koyarsan
// (örn. courtroom.png) sahnenin arkasında otomatik kullanılır; yoksa CSS sahne.
const bgMods = import.meta.glob('../assets/bg/*.{png,jpg,jpeg,webp}', {
  eager: true, query: '?url', import: 'default',
});
const bgUrls = Object.values(bgMods) as string[];
const COURTROOM_BG: string | null = bgUrls[0] ?? null;

export const Courtroom: React.FC<CourtroomProps> = ({
  activeMember,
  avatarState,
  screenShake,
  gavelFlash,
  members,
}) => {
  const speaker: MemberId = activeMember ?? 'themis';
  const halo = MEMBER_META[speaker]?.color ?? '#eab308';

  return (
    <div className={`vn-stage-bg absolute inset-0 overflow-hidden ${screenShake ? 'animate-shake' : ''}`}>
      {/* Mahkeme arka plan görseli (varsa) + okunabilirlik için karartma */}
      {COURTROOM_BG && (
        <>
          <img src={COURTROOM_BG} alt="" className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none select-none" draggable={false} />
          <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/55 via-black/25 to-black/80 pointer-events-none" />
        </>
      )}

      {/* Aktif konuşmacı arkası renkli hale */}
      <div className="vn-spotlight" style={{ '--halo': `${halo}40` } as React.CSSProperties} />

      {/* ÜST ROSTER ŞERİDİ — meclis + yargıç (üst HUD'un altında konumlanır) */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-start justify-center gap-4 px-6 pt-[100px] pb-3">
        <div className="flex items-start gap-4">
          {COUNCIL.map((id) => (
            <RosterChip
              key={id}
              memberId={id}
              active={activeMember === id}
              present={!!members[id]?.isPresent}
            />
          ))}
        </div>
        <div className="w-px h-10 bg-slate-700/50 mx-1 self-center" />
        <RosterChip memberId="themis" active={activeMember === 'themis'} present />
      </div>

      {/* BÜYÜK AKTİF BÜST — key ile her konuşmacı değişiminde giriş animasyonu */}
      <div className="absolute inset-x-0 bottom-0 top-[172px] flex items-end justify-center z-10">
        <div className="h-[88%]" key={speaker}>
          <StageCharacter memberId={speaker} state={avatarState} />
        </div>
      </div>

      {/* zemin gölge ovali (büstü zemine oturtur) */}
      <div className="absolute left-1/2 bottom-[2%] -translate-x-1/2 w-[34vw] h-6 rounded-[100%] bg-black/50 blur-md z-0 pointer-events-none" />

      {/* Tokmak flaşı */}
      {gavelFlash && <div className="absolute inset-0 bg-white z-40 animate-flash pointer-events-none" />}
    </div>
  );
};
