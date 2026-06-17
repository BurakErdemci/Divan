import { useState, useEffect, useRef, useCallback } from 'react';
import { TrialEvent, MemberId, MemberResponse, Clash, Verdict, Frame, Role } from './types/trial';
import { runMockTrial } from './api/mockTrialStream';
import { startTrial as apiStartTrial, listenToTrialStream } from './api/trialClient';
import { audioService } from './utils/audio';
import { getLang, TRIAL_STR, rulingSentence } from './i18n';

export interface TrialState {
  phase: 'idle' | 'loading' | 'frame' | 'opening' | 'clash' | 'verdict';
  rawQuestion: string;
  frame: Frame | null;
  activeMember: MemberId | null;
  members: Record<string, MemberResponse & { active: boolean; isPresent: boolean }>;
  clashes: Clash[];
  verdict: Verdict | null;
  error: string | null;
  isStreaming: boolean;
  mute: boolean;

  dialogueSpeaker: string;
  dialogueSpeakerRole: Role | 'yargic' | '';
  dialogueText: string;
  isTextStreaming: boolean;
  waitingForContinue: boolean; // metin bitti, kullanıcının "devam"ını bekliyor
  avatarState: 'idle' | 'speaking' | 'confident' | 'nervous' | 'objection' | 'conceding';

  showObjectionBanner: boolean;
  objectionBannerText: string;
  objectionBannerColor: string;
  screenShake: boolean;
  gavelFlash: boolean;
}

const DEFAULT_MEMBERS = {
  athena: { role: 'stratejist' as Role, stance: '', reasons: [], confidence: 50, flip_condition: '', active: false, isPresent: false },
  socrates: { role: 'supheci' as Role, stance: '', reasons: [], confidence: 50, flip_condition: '', active: false, isPresent: false },
  apollo: { role: 'yaratici' as Role, stance: '', reasons: [], confidence: 50, flip_condition: '', active: false, isPresent: false },
  hephaestus: { role: 'muhendis' as Role, stance: '', reasons: [], confidence: 50, flip_condition: '', active: false, isPresent: false },
  atlas: { role: 'realist' as Role, stance: '', reasons: [], confidence: 50, flip_condition: '', active: false, isPresent: false },
};

const MEMBER_NAMES: Record<string, string> = {
  athena: 'Athena (Stratejist)',
  socrates: 'Socrates (Şüpheci)',
  apollo: 'Apollo (Yaratıcı)',
  hephaestus: 'Hephaestus (Mühendis)',
  atlas: 'Atlas (Realist)',
  themis: 'Themis (Yargıç)',
};

const MEMBER_COLORS: Record<string, string> = {
  athena: '#a855f7', socrates: '#ef4444', apollo: '#14b8a6',
  hephaestus: '#3b82f6', atlas: '#f59e0b', themis: '#eab308',
};

const initialState = (): TrialState => ({
  phase: 'idle',
  rawQuestion: '',
  frame: null,
  activeMember: null,
  members: JSON.parse(JSON.stringify(DEFAULT_MEMBERS)),
  clashes: [],
  verdict: null,
  error: null,
  isStreaming: false,
  mute: audioService.isMuted(),
  dialogueSpeaker: '',
  dialogueSpeakerRole: '',
  dialogueText: '',
  isTextStreaming: false,
  waitingForContinue: false,
  avatarState: 'idle',
  showObjectionBanner: false,
  objectionBannerText: 'İTİRAZ!',
  objectionBannerColor: '#ef4444',
  screenShake: false,
  gavelFlash: false,
});

export function useTrialMachine() {
  const [state, setState] = useState<TrialState>(initialState);

  const eventQueueRef = useRef<TrialEvent[]>([]);
  const isProcessingRef = useRef(false);
  const textStreamTimerRef = useRef<number | null>(null);
  const fullTextRef = useRef('');
  const fullTextRoleRef = useRef<Role | 'yargic' | ''>('');
  const currentTextIndexRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sseUnsubscribeRef = useRef<(() => void) | null>(null);

  // Manuel ilerleme ref'leri (keydown listener stale closure görmesin)
  const streamingRef = useRef(false);
  const waitingRef = useRef(false);
  const proceedRef = useRef<(() => void) | null>(null);
  // Bir olayın içinde sıraya eklenen ekstra replik beat'leri (ör. itiraz
  // reddedilince konuşmacının çıldırma repliği). Kuyruğa geçmeden önce oynar.
  type Beat = { speaker: string; role: Role | 'yargic' | ''; text: string; onShow?: () => void };
  const injectedRef = useRef<Beat[]>([]);
  // İtiraz sırası: çift index → İTİRAZ!, tek index → DUR BAKALIM! (AA gidiş-geliş)
  const objectionCountRef = useRef(0);
  const membersRef = useRef(state.members);
  membersRef.current = state.members;

  const toggleMute = () => setState(s => ({ ...s, mute: audioService.toggleMute() }));

  const reset = useCallback(() => {
    if (textStreamTimerRef.current) { window.clearInterval(textStreamTimerRef.current); textStreamTimerRef.current = null; }
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (sseUnsubscribeRef.current) { sseUnsubscribeRef.current(); sseUnsubscribeRef.current = null; }
    eventQueueRef.current = [];
    isProcessingRef.current = false;
    streamingRef.current = false;
    waitingRef.current = false;
    proceedRef.current = null;
    injectedRef.current = [];
    objectionCountRef.current = 0;
    fullTextRef.current = '';
    currentTextIndexRef.current = 0;
    setState(initialState());
  }, []);

  useEffect(() => () => {
    if (textStreamTimerRef.current) window.clearInterval(textStreamTimerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (sseUnsubscribeRef.current) sseUnsubscribeRef.current();
  }, []);

  const poseFor = (role: Role | 'yargic' | ''): TrialState['avatarState'] => {
    if (role === 'yargic' || role === '') return 'idle';
    const m = membersRef.current[role];
    if (m && m.confidence >= 80) return 'confident';
    if (m && m.confidence <= 49) return 'nervous';
    return 'idle';
  };

  // metin bitince çağrılacak kanca (hold)
  const holdForContinue = () => {
    waitingRef.current = true;
    setState(s => ({ ...s, waitingForContinue: true }));
  };

  // Metni karakter karakter akıt; bitince holdForContinue.
  const sayThenHold = (speaker: string, role: Role | 'yargic' | '', text: string) => {
    if (textStreamTimerRef.current) window.clearInterval(textStreamTimerRef.current);
    fullTextRef.current = text;
    fullTextRoleRef.current = role;
    currentTextIndexRef.current = 0;
    streamingRef.current = true;

    setState(s => ({
      ...s,
      dialogueSpeaker: speaker,
      dialogueSpeakerRole: role,
      dialogueText: '',
      isTextStreaming: true,
      waitingForContinue: false,
      avatarState: 'speaking',
    }));

    let blip = 0;
    textStreamTimerRef.current = window.setInterval(() => {
      const idx = currentTextIndexRef.current;
      if (idx < text.length) {
        const ch = text.charAt(idx);
        setState(s => ({ ...s, dialogueText: s.dialogueText + ch }));
        if (blip % 2 === 0 && ch !== ' ' && ch !== '\n') audioService.playTextBlip();
        blip++;
        currentTextIndexRef.current++;
      } else {
        if (textStreamTimerRef.current) { window.clearInterval(textStreamTimerRef.current); textStreamTimerRef.current = null; }
        streamingRef.current = false;
        setState(s => ({ ...s, isTextStreaming: false, avatarState: poseFor(role) }));
        holdForContinue();
      }
    }, 28);
  };

  // Akan metni anında tamamla, sonra hold.
  const finishText = () => {
    if (!streamingRef.current) return;
    if (textStreamTimerRef.current) { window.clearInterval(textStreamTimerRef.current); textStreamTimerRef.current = null; }
    streamingRef.current = false;
    setState(s => ({ ...s, dialogueText: fullTextRef.current, isTextStreaming: false, avatarState: poseFor(fullTextRoleRef.current) }));
    holdForContinue();
  };

  // Kullanıcı "ilerle": akıyorsa tamamla; bekliyorsa önce enjekte beat varsa
  // onu oynat, yoksa sıradaki kuyruk olayına geç.
  const advance = useCallback(() => {
    if (streamingRef.current) { finishText(); return; }
    if (waitingRef.current) {
      waitingRef.current = false;
      setState(s => ({ ...s, waitingForContinue: false }));
      if (injectedRef.current.length > 0) {
        const beat = injectedRef.current.shift()!;
        sayThenHold(beat.speaker, beat.role, beat.text); // isProcessing TRUE kalır (aynı olay)
        beat.onShow?.();
      } else {
        isProcessingRef.current = false;
        processNextEvent();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // function declaration → hoist edilir, helper'lar serbestçe referans verebilir.
  function processNextEvent() {
    if (isProcessingRef.current || waitingRef.current || eventQueueRef.current.length === 0) return;
    isProcessingRef.current = true;
    const event = eventQueueRef.current.shift()!;

    try {
      switch (event.type) {
        case 'phase_started':
          setState(s => ({ ...s, phase: event.phase }));
          isProcessingRef.current = false;
          processNextEvent();
          break;

        case 'frame': {
          setState(s => ({ ...s, frame: event.data }));
          sayThenHold('Themis (Yargıç)', 'yargic', `Mahkeme açılmıştır. Karara bağlanacak önerme:\n\n"${event.data.proposition}"`);
          break;
        }

        case 'member_started': {
          setState(s => ({
            ...s,
            activeMember: event.member,
            members: { ...s.members, [event.member]: { ...s.members[event.member], isPresent: true, active: true } },
          }));
          sayThenHold('Themis (Yargıç)', 'yargic', `${MEMBER_NAMES[event.member]} kürsüye çıkıyor.`);
          break;
        }

        case 'member_response': {
          const mId = event.member;
          const data = event.data;
          setState(s => ({ ...s, activeMember: mId, members: { ...s.members, [mId]: { ...data, isPresent: true, active: true } } }));
          const speech =
            `"${data.stance}"\n\nGerekçelerim:\n${data.reasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}` +
            `\n\n[Fikrimi değiştirecek koşul] ${data.flip_condition}`;
          sayThenHold(MEMBER_NAMES[mId], data.role, speech);
          break;
        }

        case 'objection': {
          const color = MEMBER_COLORS[event.from] || '#ef4444';
          const fromName = MEMBER_NAMES[event.from] || event.from;
          const targetName = MEMBER_NAMES[event.target] || event.target;
          const fromRole = (DEFAULT_MEMBERS[event.from as keyof typeof DEFAULT_MEMBERS]?.role) ?? 'supheci';

          // 1) Bağırış: ilk atak İTİRAZ!, karşı atak DUR BAKALIM! (holdit dosyası
          //    varsa). Dosya yoksa İTİRAZ'a düşer — sessiz boşluk olmaz.
          const lang = getLang();
          const idx = objectionCountRef.current++;
          const useHoldIt = idx % 2 === 1 && audioService.hasHoldIt(event.from);
          const bannerText = useHoldIt ? TRIAL_STR.holdit[lang] : TRIAL_STR.objection[lang];
          if (useHoldIt) audioService.playHoldIt(event.from, 0.95);
          else audioService.playObjection(event.from);
          setState(s => ({
            ...s, showObjectionBanner: true, objectionBannerText: bannerText, objectionBannerColor: color,
            screenShake: true, avatarState: 'objection', activeMember: event.from,
          }));
          setTimeout(() => setState(s => ({ ...s, screenShake: false })), 350);
          // 2) Bağırış BİTTİKTEN sonra masaya vuruş (üst üste binmesin)
          setTimeout(() => audioService.playObjectionSlam(event.from, 0.9), 950);

          // 3) Banner kapanır, Yargıç hükmü açıklar (tokmak sesi YOK — o sadece nihai hükümde)
          setTimeout(() => {
            setState(s => ({ ...s, showObjectionBanner: false }));
            const rulingVal = event.ruling === 'upheld' ? 'upheld' : 'overruled';
            const txt = rulingSentence(fromName, targetName, event.claim, rulingVal, lang);
            sayThenHold(TRIAL_STR.judgeName[lang], 'yargic', txt);

            // 4) RED ise: hükümden SONRA, reddedilen kişi kendi repliğiyle çıldırır
            //    (ayrı beat — kullanıcı hükmü gördükten sonra ilerleyince oynar).
            if (event.ruling === 'overruled') {
              injectedRef.current.push({
                speaker: fromName,
                role: fromRole,
                text: TRIAL_STR.freakout[lang],
                onShow: () => {
                  audioService.playSampleOnly('freakout', 0.85);
                  setState(s => ({ ...s, activeMember: event.from, avatarState: 'nervous', screenShake: true }));
                  setTimeout(() => setState(s => ({ ...s, screenShake: false })), 1200);
                },
              });
            } else if (event.ruling === 'upheld') {
              // İtiraz haklı çıktı → kazanan kanıtı masaya koyar: AL BAKALIM!
              setTimeout(() => {
                audioService.playTakeThat(event.from, 0.95);
                setState(s => ({ ...s, activeMember: event.from, avatarState: 'confident' }));
              }, 1200);
            }
          }, 2200);
          break;
        }

        case 'clash': {
          setState(s => ({ ...s, clashes: [...s.clashes, event.data] }));
          const ex = event.data.exchanges[event.data.exchanges.length - 1];
          if (!ex) { isProcessingRef.current = false; processNextEvent(); break; }
          const fromId = (Object.keys(DEFAULT_MEMBERS).find(
            k => DEFAULT_MEMBERS[k as keyof typeof DEFAULT_MEMBERS].role === ex.from
          ) as MemberId) || 'socrates';
          const speech = ex.argument + (ex.sub_round ? `\n\n--- Hüküm sonrası ---\n${ex.sub_round}` : '');
          setState(s => ({ ...s, activeMember: fromId }));
          sayThenHold(MEMBER_NAMES[fromId], ex.from, speech);
          break;
        }

        case 'verdict': {
          audioService.playGavel();
          setState(s => ({ ...s, gavelFlash: true }));
          setTimeout(() => setState(s => ({ ...s, gavelFlash: false })), 600);
          setTimeout(() => {
            audioService.playVerdictFanfare();
            setState(s => ({ ...s, verdict: event.data, phase: 'verdict', activeMember: 'themis' }));
            isProcessingRef.current = false; // akış biter; karar ekranı gösterilir
          }, 1200);
          break;
        }

        case 'error':
          setState(s => ({ ...s, error: event.message, isStreaming: false }));
          eventQueueRef.current = [];
          isProcessingRef.current = false;
          break;

        case 'complete':
          isProcessingRef.current = false;
          break;
      }
    } catch (e) {
      console.error('Trial event error', e);
      isProcessingRef.current = false;
    }
  }

  const onNewEvents = () => {
    if (!isProcessingRef.current && !waitingRef.current && eventQueueRef.current.length > 0) processNextEvent();
  };

  const startTrial = async (question: string, mode: 'mock' | 'live', projectContext = '') => {
    reset();
    setState(s => ({ ...s, phase: 'loading', rawQuestion: question, isStreaming: true }));
    audioService.init();

    if (mode === 'mock') {
      const ac = new AbortController();
      abortControllerRef.current = ac;
      runMockTrial(
        question,
        (event) => { eventQueueRef.current.push(event); onNewEvents(); },
        () => setState(s => ({ ...s, isStreaming: false })),
        ac.signal
      );
    } else {
      try {
        const trialId = await apiStartTrial(question, projectContext);
        sseUnsubscribeRef.current = listenToTrialStream(
          trialId,
          (event) => {
            if (event.type === 'error') {
              eventQueueRef.current = [];
              setState(s => ({ ...s, error: event.message, isStreaming: false }));
              return;
            }
            if (event.type !== 'complete') {
              eventQueueRef.current.push(event);
            }
          },
          (err) => setState(s => ({ ...s, error: err, isStreaming: false })),
          () => {
            setState(s => ({ ...s, isStreaming: false }));
            onNewEvents();
          }
        );
      } catch (err) {
        setState(s => ({ ...s, error: err instanceof Error ? err.message : 'Backend bağlantısı kurulamadı.', isStreaming: false }));
      }
    }
  };

  return { state, startTrial, advance, reset, toggleMute };
}
