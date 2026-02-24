import React, { useMemo, useState } from 'react';
import { useGame } from '../context/GameContext';
import { useBattleData } from '../hooks/useBattleData';
import { useBattleProgressDriver } from '../hooks/useBattleProgressDriver';
import { useBattlePlayback } from '../hooks/useBattlePlayback';
import { BattleHUD } from '../components/battles/BattleHUD';
import { ArenaBody } from '../components/battles/ArenaBody';
import { RoundRecapOverlay } from '../components/battles/RoundRecapOverlay';
import { BattleResultTray } from '../components/battles/BattleResultTray';

export const BattlePage: React.FC<{ battleId: string }> = ({ battleId }) => {
  const { setView, user, items, createBattle } = useGame();
  const [showFair, setShowFair] = useState(false);
  const { battle, rounds, playersByTeam, loadedAtLeastOnce } = useBattleData(battleId);
  const { driverWarning } = useBattleProgressDriver(battleId, battle);

  const players = useMemo(() => [...playersByTeam.A, ...playersByTeam.B], [playersByTeam]);

  const playback = useBattlePlayback({ battle, rounds, players });

  const fillerPool = useMemo(() => (items || []).slice(0, 100).map((it) => ({
    id: String(it.id),
    name: String(it.name),
    imageUrl: String(it.image || ''),
    value: Number(it.price ?? 0),
    rarity: it.rarity
  })), [items]);

  const getWinningItem = (uid: string) => {
    const row = rounds[playback.currentRoundIndex];
    const raw = row?.resultsByUid?.[uid];
    if (!raw) return null;
    return {
      id: String(raw.id || raw.itemId || raw.name || 'item'),
      name: String(raw.name || raw.itemName || 'Item'),
      imageUrl: String(raw.imageUrl || raw.image || ''),
      value: Number(raw.value ?? raw.price ?? 0),
      rarity: raw.rarity
    };
  };

  const totals = useMemo(() => {
    const t = { A: 0, B: 0 };
    rounds.forEach((r) => {
      if (!r) return;
      playersByTeam.A.forEach((p) => { t.A += Number(r.resultsByUid?.[p.uid]?.value ?? 0); });
      playersByTeam.B.forEach((p) => { t.B += Number(r.resultsByUid?.[p.uid]?.value ?? 0); });
    });
    return t;
  }, [rounds, playersByTeam]);

  const currentUid = user.id;
  const winnerTeam = String(battle?.winnerTeam ?? '').toUpperCase();
  const isParticipant = players.some((p) => p.uid === currentUid);
  const variant: 'WIN' | 'LOSE' | 'SPECTATE' = !isParticipant ? 'SPECTATE' : winnerTeam === 'B'
    ? (playersByTeam.B.some((p) => p.uid === currentUid) ? 'WIN' : 'LOSE')
    : (playersByTeam.A.some((p) => p.uid === currentUid) ? 'WIN' : 'LOSE');

  const allWonItems = rounds.flatMap((r) => !r ? [] : Object.values(r.resultsByUid || {}));
  const bestHit = allWonItems.reduce((best: any, i: any) => (Number(i?.value ?? 0) > Number(best?.value ?? 0) ? i : best), null);

  if (!loadedAtLeastOnce) {
    return <div className="mx-auto mt-6 max-w-6xl rounded-2xl border border-white/10 bg-[#0b111b] p-4 text-sm text-gray-400">Loading battle...</div>;
  }

  if (!battle) {
    return <div className="mx-auto mt-6 max-w-6xl rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">Battle unavailable.</div>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-2 sm:p-4">
      <div className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-[#0e1420] to-[#090d15] p-2 sm:p-4">
        <BattleHUD
          battle={battle}
          currentRoundIndex={playback.currentRoundIndex}
          driverWarning={driverWarning}
          onSkip={playback.actions.skip}
          onBack={() => setView({ type: 'BATTLES' })}
          onOpenFair={() => setShowFair((v) => !v)}
        />

        {showFair && <div className="mb-3 rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-gray-200">Verify battle fairness at <a className="text-cyan-300 underline" href={`/fairness/battles/${battleId}`}>/fairness/battles/{battleId}</a>.</div>}

        <div className="relative">
          <RoundRecapOverlay open={playback.uiPhase === 'ROUND_REVEAL'} roundIndex={playback.currentRoundIndex} teamWinnerLabel={`Team ${winnerTeam || '-'}`} />
          <ArenaBody
            teamA={playersByTeam.A}
            teamB={playersByTeam.B}
            getWinningItem={getWinningItem}
            spinKeysByUid={playback.spinKeysByUid}
            fillerPool={fillerPool}
            reelPhase={playback.reelPhase}
            spinMs={Math.min(Math.max(Number(battle.roundDurationMs ?? 3600), 2600), 4200)}
            currentRoundIndex={playback.currentRoundIndex}
            animatedRounds={playback.animatedRounds}
            totals={totals}
            battle={battle}
          />
        </div>

        {playback.syncingRound !== null && <div className="mt-2 text-center text-xs text-amber-300">Syncing round {playback.syncingRound + 1}…</div>}
      </div>

      <BattleResultTray
        open={playback.resultTrayOpen}
        variant={variant}
        headline={variant === 'WIN' ? 'Victory!' : variant === 'LOSE' ? 'Defeat' : 'Battle Complete'}
        bestHit={bestHit}
        items={allWonItems as any[]}
        totals={totals}
        onRecreate={() => createBattle({
          mode: String(battle.mode ?? 'Standard'),
          format: String(battle.format ?? '1v1'),
          roundCount: Number(battle.roundCount ?? 1),
          cases: Array.isArray(battle.cases) ? battle.cases : []
        })}
        onClose={playback.actions.closeTray}
      />
    </div>
  );
};
