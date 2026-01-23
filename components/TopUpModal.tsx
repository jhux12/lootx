import React, { useState } from 'react';
import { X, CreditCard, Wallet, Bitcoin, Loader2, CheckCircle } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { COIN_ICON } from '../constants';
import { CoinAmount } from './CoinAmount';

export const TopUpModal: React.FC = () => {
  const { setShowTopUpModal, addBalance } = useGame();
  const { playSound } = useSound();
  const [method, setMethod] = useState<'card' | 'crypto'>('card');
  const [amountCoins, setAmountCoins] = useState<number>(5000);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const formattedDepositAmount = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(amountCoins / 100);

  const coinPacks = [
    { coins: 1000, bonusPercent: 0 },
    { coins: 2500, bonusPercent: 5 },
    { coins: 5000, bonusPercent: 10 },
    { coins: 10000, bonusPercent: 15 },
    { coins: 25000, bonusPercent: 20 },
    { coins: 50000, bonusPercent: 25 }
  ];

  const getBonusPercent = (coins: number) => {
    if (coins >= 50000) return 25;
    if (coins >= 25000) return 20;
    if (coins >= 10000) return 15;
    if (coins >= 5000) return 10;
    if (coins >= 2500) return 5;
    return 0;
  };

  const bonusPercent = getBonusPercent(amountCoins);
  const bonusCoins = Math.floor(amountCoins * (bonusPercent / 100));
  const totalCoins = amountCoins + bonusCoins;

  const handleDeposit = () => {
      playSound('click');
      setIsLoading(true);

      // Simulate API Call
      setTimeout(() => {
          addBalance(totalCoins / 100);
          setIsLoading(false);
          setSuccess(true);
          playSound('coins');
          
          setTimeout(() => {
              setShowTopUpModal(false);
              setSuccess(false);
          }, 1500);
      }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" 
        onClick={() => setShowTopUpModal(false)}
      ></div>
      
      <div className="relative w-full max-w-md max-h-[calc(100vh-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#0f131c] shadow-2xl animate-in zoom-in-95 flex flex-col">
        
        {success ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mb-4 animate-bounce" />
                <h2 className="text-2xl font-black text-white mb-2">Deposit Successful!</h2>
                <p className="text-gray-400">Your coins have been added.</p>
            </div>
        ) : (
            <>
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10">
                        <Wallet className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white">Top up</h2>
                        <p className="text-xs text-gray-500">Choose a pack or enter a custom amount</p>
                      </div>
                    </div>
                    <button 
                        onClick={() => setShowTopUpModal(false)} 
                        className="text-gray-500 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {/* Method Selector */}
                    <div className="flex gap-3 mb-5">
                        <button 
                            onClick={() => { setMethod('card'); playSound('click'); }}
                            className={`flex-1 rounded-xl border px-3 py-3 text-left transition-all ${method === 'card' ? 'border-blue-400 bg-blue-500/10 text-white shadow-lg shadow-blue-900/10' : 'border-white/10 bg-[#0b0e14] text-gray-400 hover:border-white/30'}`}
                        >
                            <div className="flex items-center gap-2">
                              <CreditCard className="w-5 h-5" />
                              <span className="text-xs font-semibold">Card</span>
                            </div>
                            <span className="mt-2 block text-[11px] text-gray-500">Instant approval</span>
                        </button>
                        <button 
                            onClick={() => { setMethod('crypto'); playSound('click'); }}
                            className={`flex-1 rounded-xl border px-3 py-3 text-left transition-all ${method === 'crypto' ? 'border-orange-400 bg-orange-500/10 text-white shadow-lg shadow-orange-900/10' : 'border-white/10 bg-[#0b0e14] text-gray-400 hover:border-white/30'}`}
                        >
                            <div className="flex items-center gap-2">
                              <Bitcoin className="w-5 h-5" />
                              <span className="text-xs font-semibold">Crypto</span>
                            </div>
                            <span className="mt-2 block text-[11px] text-gray-500">BTC, ETH, USDC</span>
                        </button>
                    </div>

                    {/* Amount Selector */}
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Select a pack</label>
                    <div className="grid grid-cols-2 gap-3 mb-5 sm:grid-cols-3">
                        {coinPacks.map((pack) => {
                          const packBonusCoins = Math.floor(pack.coins * (pack.bonusPercent / 100));
                          const packTotalCoins = pack.coins + packBonusCoins;
                          const formattedPackPrice = new Intl.NumberFormat(undefined, {
                            style: 'currency',
                            currency: 'USD',
                            maximumFractionDigits: 2
                          }).format(pack.coins / 100);
                          const isBestValue = pack.coins === 50000;

                          return (
                            <button
                                key={pack.coins}
                                onClick={() => { setAmountCoins(pack.coins); playSound('click'); }}
                                className={`relative rounded-xl border px-3 py-3 text-left transition-all ${amountCoins === pack.coins ? 'border-emerald-400 bg-emerald-500/10 text-white shadow-lg shadow-emerald-900/20' : 'border-white/10 bg-[#0b0e14] text-gray-300 hover:border-white/30'}`}
                            >
                                {isBestValue && (
                                  <span className="absolute -top-2 right-2 rounded-full bg-gradient-to-r from-emerald-400 to-blue-500 px-2 py-0.5 text-[10px] font-bold uppercase text-black shadow">
                                    Best Value
                                  </span>
                                )}
                                <div className="flex flex-col gap-1">
                                  <span className="text-[11px] font-semibold text-gray-400">{formattedPackPrice}</span>
                                  <CoinAmount
                                    amount={pack.coins / 100}
                                    formatOptions={{ maximumFractionDigits: 0 }}
                                    className="text-white"
                                    iconClassName="w-3.5 h-3.5"
                                  />
                                  {pack.bonusPercent > 0 && (
                                    <span className="text-[10px] font-semibold text-emerald-400">
                                      +{packBonusCoins.toLocaleString()} bonus
                                    </span>
                                  )}
                                  <span className="text-[10px] text-gray-500">
                                    Total {packTotalCoins.toLocaleString()} coins
                                  </span>
                                </div>
                            </button>
                          );
                        })}
                    </div>

                    {/* Custom Amount Input */}
                    <div className="mb-5">
                        <div className="relative">
                            <span className="absolute inset-y-0 left-4 flex items-center">
                              <img src={COIN_ICON} alt="Coin" className="w-4 h-4" />
                            </span>
                            <input 
                                type="number"
                                min="0"
                                value={amountCoins}
                                onChange={(e) => setAmountCoins(Number(e.target.value))}
                                className="w-full rounded-xl border border-white/10 bg-[#0b0e14] py-3 pl-11 pr-4 text-white font-semibold leading-none focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
                          <span>100 coins = $1</span>
                          {bonusPercent > 0 && (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                              Bonus +{bonusCoins.toLocaleString()} coins ({bonusPercent}%)
                            </span>
                          )}
                        </div>
                    </div>

                    <div className="mb-5 rounded-2xl border border-white/10 bg-[#121826] p-4">
                      <p className="text-xs font-semibold uppercase text-emerald-200">You get</p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                        <CoinAmount
                          amount={totalCoins / 100}
                          formatOptions={{ maximumFractionDigits: 0 }}
                          className="text-lg font-black text-white"
                          iconClassName="w-5 h-5"
                        />
                        <div className="text-right text-xs text-emerald-200">
                          <div>{formattedDepositAmount} deposit</div>
                          {bonusPercent > 0 && (
                            <div>Includes +{bonusCoins.toLocaleString()} bonus coins</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button 
                        onClick={handleDeposit}
                        disabled={isLoading}
                        className="w-full rounded-xl bg-emerald-500 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" /> Processing...
                            </>
                        ) : (
                            <span className="inline-flex flex-col items-center gap-1 text-center sm:flex-row sm:gap-2">
                              <span>Deposit {formattedDepositAmount}</span>
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-white/80 sm:text-sm">
                                <CoinAmount
                                  amount={totalCoins / 100}
                                  formatOptions={{ maximumFractionDigits: 0 }}
                                  className="text-white"
                                  iconClassName="w-4 h-4"
                                />
                                coins
                              </span>
                            </span>
                        )}
                    </button>
                    
                    <p className="text-center text-[10px] text-gray-500 mt-4">
                        By depositing you agree to our Terms of Service.
                    </p>
                </div>
            </>
        )}
      </div>
    </div>
  );
};
