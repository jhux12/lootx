import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type UiPhase = 'LOBBY' | 'COUNTDOWN' | 'ROUND_INTRO' | 'SPINNING' | 'ROUND_REVEAL' | 'INTERMISSION' | 'FINAL_REVEAL' | 'COMPLETE';

type ReelPhase = 'IDLE' | 'SPIN' | 'STOPPED';

const INTRO_MS = 600;
const REVEAL_MS = 950;
const INTERMISSION_MS = 450;
const FINAL_REVEAL_MS = 1200;
const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const useBattlePlayback = ({
  battle,
  rounds,
  players
}: {
  battle: any;
  rounds: Array<any | null>;
  players: Array<{ uid: string; isPlaceholder?: boolean }>;
}) => {
  const [uiPhase, setUiPhase] = useState<UiPhase>('LOBBY');
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [animatedRounds, setAnimatedRounds] = useState<Set<number>>(new Set());
  const [spinKeysByUid, setSpinKeysByUid] = useState<Record<string, string>>({});
  const [reelPhase, setReelPhase] = useState<ReelPhase>('IDLE');
  const [resultTrayOpen, setResultTrayOpen] = useState(false);
  const [syncingRound, setSyncingRound] = useState<number | null>(null);

  const runCounterRef = useRef(0);
  const runningRef = useRef(false);
  const skipRef = useRef(false);

  const lastRoundIndex = useMemo(() => {
    const explicit = Number(battle?.roundCount ?? 0);
    if (explicit > 0) return explicit - 1;
    return Math.max(0, rounds.length - 1);
  }, [battle?.roundCount, rounds.length]);

  const skip = useCallback(() => {
    skipRef.current = true;
    const all = new Set<number>();
    for (let i = 0; i <= lastRoundIndex; i += 1) all.add(i);
    setAnimatedRounds(all);
    setCurrentRoundIndex(lastRoundIndex);
    setReelPhase('STOPPED');
    setUiPhase('COMPLETE');
    setResultTrayOpen(true);
  }, [lastRoundIndex]);

  const closeTray = useCallback(() => setResultTrayOpen(false), []);

  useEffect(() => {
    if (!battle?.id) return;
    if (battle.state === 'LOBBY') {
      setUiPhase('LOBBY');
      return;
    }
    if (battle.state === 'COUNTDOWN') {
      setUiPhase('COUNTDOWN');
      return;
    }
    if (battle.state !== 'RUNNING' && battle.state !== 'COMPLETE') return;
    if (runningRef.current) return;
    runningRef.current = true;
    skipRef.current = false;

    const spinMs = clamp(Number(battle.roundDurationMs ?? 3600), 2600, 4200);

    (async () => {
      for (let idx = 0; idx <= lastRoundIndex; idx += 1) {
        if (skipRef.current) return;
        setCurrentRoundIndex(idx);

        let waited = 0;
        while (!rounds[idx] && waited < 10000) {
          setSyncingRound(idx);
          setReelPhase('IDLE');
          await wait(400);
          waited += 400;
          if (skipRef.current) return;
        }
        setSyncingRound(null);
        if (!rounds[idx]) {
          while (!rounds[idx]) {
            await wait(500);
            if (skipRef.current) return;
          }
        }

        setUiPhase('ROUND_INTRO');
        await wait(INTRO_MS);
        if (skipRef.current) return;

        runCounterRef.current += 1;
        const nextSpinKeys: Record<string, string> = {};
        players.filter((p) => !p.isPlaceholder).forEach((p) => {
          nextSpinKeys[p.uid] = `${battle.id}-${idx}-${p.uid}-${runCounterRef.current}`;
        });
        setSpinKeysByUid(nextSpinKeys);

        setUiPhase('SPINNING');
        setReelPhase('SPIN');
        await wait(spinMs);
        if (skipRef.current) return;

        setUiPhase('ROUND_REVEAL');
        setReelPhase('STOPPED');
        setAnimatedRounds((prev) => new Set(prev).add(idx));
        await wait(REVEAL_MS);
        if (skipRef.current) return;

        if (idx < lastRoundIndex) {
          setUiPhase('INTERMISSION');
          await wait(INTERMISSION_MS);
        }
      }

      setUiPhase('FINAL_REVEAL');
      await wait(FINAL_REVEAL_MS);
      setResultTrayOpen(true);
      setUiPhase('COMPLETE');
    })().finally(() => {
      runningRef.current = false;
    });
  }, [battle?.id, battle?.state, battle?.roundDurationMs, lastRoundIndex, players, rounds]);

  return {
    uiPhase,
    currentRoundIndex,
    animatedRounds,
    spinKeysByUid,
    reelPhase,
    resultTrayOpen,
    syncingRound,
    actions: { skip, closeTray }
  };
};
