import React, { useMemo } from 'react';
import { Zap, Clock4, Users } from 'lucide-react';
import { CoinAmount } from './CoinAmount';
import { useFreeRain } from '../hooks/useFreeRain';
import { useSound } from '../context/SoundContext';

type FreeRainBannerProps = {
  className?: string;
};

const formatTimeRemaining = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const FreeRainBanner: React.FC<FreeRainBannerProps> = ({ className }) => {
  const {
    potCoins,
    joinCount,
    isJoined,
    isJoining,
    timeRemainingMs,
    eligibility,
    joinBonus,
    joinRain
  } = useFreeRain();
  const { playSound } = useSound();

  const timeLabel = useMemo(() => formatTimeRemaining(timeRemainingMs), [timeRemainingMs]);
  const buttonLabel = isJoined ? 'Joined' : isJoining ? 'Joining…' : 'Join';
  const buttonDisabled = isJoined || isJoining || !eligibility.eligible;

  const handleJoin = () => {
    playSound('click');
    void joinRain();
  };

  return (
    <div
      className={`p-3 bg-brand-bg relative overflow-hidden border-b border-gray-800 ${className ?? ''}`.trim()}
    >
      <div className="absolute inset-0 bg-green-900/10" aria-hidden />
      <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-bold text-green-400 uppercase tracking-wider flex items-center gap-1">
            <Zap className="w-3 h-3 fill-green-400" /> Free Rain
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            <div className="text-white font-mono font-bold text-lg flex items-center gap-2">
              <CoinAmount
                amount={potCoins}
                formatOptions={{ maximumFractionDigits: 0 }}
                className="text-white"
                iconClassName="w-4 h-4"
              />
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-300">
              <Users className="w-3.5 h-3.5" />
              <span className="font-semibold text-white">{joinCount}</span>
              <span className="text-gray-500">joined</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-300">
              <Clock4 className="w-3.5 h-3.5" />
              <span className="font-semibold text-white">{timeLabel}</span>
            </div>
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            +{joinBonus} coins per join • evenly split when timer ends
          </div>
          {!eligibility.eligible && (
            <div className="mt-2 text-[11px] text-amber-300/90">{eligibility.reason}</div>
          )}
        </div>
        <button
          onClick={handleJoin}
          disabled={buttonDisabled}
          className="w-full sm:w-auto bg-green-500 hover:bg-green-400 disabled:bg-green-500/60 disabled:text-black/70 text-black text-xs font-bold px-5 py-2.5 rounded transition-colors disabled:cursor-not-allowed"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
};
