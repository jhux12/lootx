import React, { useMemo, useState } from 'react';
import { X, Wallet, Loader2, ExternalLink, Sparkles } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';

export const TopUpModal: React.FC = () => {
  const { setShowTopUpModal, stripeSettings } = useGame();
  const { playSound } = useSound();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const packs = stripeSettings.packs ?? [];
  const selectedPack = packs.find((pack) => pack.id === selectedPackId) ?? packs[0];
  const selectedCheckoutLink = selectedPack?.checkoutLinkId?.trim() || stripeSettings.checkoutLinkId?.trim();
  const checkoutUrl = selectedCheckoutLink
    ? selectedCheckoutLink.startsWith('http')
      ? selectedCheckoutLink
      : `https://buy.stripe.com/${selectedCheckoutLink}`
    : '';
  const stripeReady = stripeSettings.enabled && Boolean(checkoutUrl);
  const formattedDepositAmount = useMemo(() => {
    if (!selectedPack) return '';
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: stripeSettings.currency || 'USD',
      maximumFractionDigits: 2
    }).format((selectedPack.coins || 0) / 100);
  }, [selectedPack, stripeSettings.currency]);
  const bonusCoins = selectedPack
    ? Math.floor((selectedPack.coins || 0) * ((selectedPack.bonusPercent || 0) / 100))
    : 0;
  const totalCoins = selectedPack ? (selectedPack.coins || 0) + bonusCoins : 0;

  const handleCheckout = () => {
      if (!stripeReady || !checkoutUrl) return;
      playSound('click');
      setIsLoading(true);
      window.location.href = checkoutUrl;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 py-6 sm:items-center">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" 
        onClick={() => setShowTopUpModal(false)}
      ></div>
      
      <div className="relative w-full max-w-md max-h-[calc(100dvh-3rem)] min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0f131c] shadow-2xl animate-in zoom-in-95 flex flex-col sm:max-h-[calc(100dvh-2rem)]">
        
        <>
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10">
                    <Wallet className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Top up</h2>
                    <p className="text-xs text-gray-500">Proceed to Stripe Checkout</p>
                  </div>
                </div>
                <button 
                    onClick={() => setShowTopUpModal(false)} 
                    className="text-gray-500 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
                    <div className={`mb-5 rounded-2xl border p-4 ${stripeReady ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-yellow-500/20 bg-yellow-500/10'}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase text-gray-300">Stripe checkout</p>
                          <div className="mt-2 text-sm text-gray-200">
                            {stripeReady ? (
                              <span>Stripe is ready in {stripeSettings.mode} mode.</span>
                            ) : (
                              <span>Stripe is not configured yet. Ask an admin to add a checkout link.</span>
                            )}
                          </div>
                          <div className="mt-2 text-[11px] text-gray-400">
                            Currency: {stripeSettings.currency || 'USD'}
                          </div>
                        </div>
                        <div className="rounded-full border border-white/10 bg-[#0b0e14] px-3 py-1 text-[10px] font-semibold uppercase text-gray-400">
                          Card
                        </div>
                      </div>
                    </div>

                    <div className="mb-5">
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Select a pack</label>
                      {packs.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-[#121826] p-4 text-sm text-gray-300">
                          <p className="font-semibold text-white">No packs available</p>
                          <p className="mt-2 text-xs text-gray-400">Ask an admin to add coin packs.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {packs.map((pack) => {
                            const packBonusCoins = Math.floor((pack.coins || 0) * ((pack.bonusPercent || 0) / 100));
                            const packTotalCoins = (pack.coins || 0) + packBonusCoins;
                            const packPrice = new Intl.NumberFormat(undefined, {
                              style: 'currency',
                              currency: stripeSettings.currency || 'USD',
                              maximumFractionDigits: 2
                            }).format((pack.coins || 0) / 100);
                            const isSelected = (selectedPack?.id ?? packs[0]?.id) === pack.id;

                            return (
                              <button
                                key={pack.id}
                                onClick={() => { setSelectedPackId(pack.id); playSound('click'); }}
                                className={`relative rounded-xl border px-4 py-3 text-left transition-all ${isSelected ? 'border-emerald-400 bg-emerald-500/10 text-white shadow-lg shadow-emerald-900/20' : 'border-white/10 bg-[#0b0e14] text-gray-300 hover:border-white/30'}`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-semibold">{pack.name}</span>
                                  {pack.bonusPercent > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                                      <Sparkles className="h-3 w-3" />
                                      +{pack.bonusPercent}%
                                    </span>
                                  )}
                                </div>
                                <div className="mt-2 text-xs text-gray-400">{packPrice} • {packTotalCoins.toLocaleString()} coins</div>
                                {packBonusCoins > 0 && (
                                  <div className="mt-1 text-[11px] text-emerald-300">Includes +{packBonusCoins.toLocaleString()} bonus</div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#121826] p-4 text-sm text-gray-300">
                      <p className="font-semibold text-white">Ready to purchase?</p>
                      <p className="mt-2 text-xs text-gray-400">
                        Clicking purchase will open Stripe Checkout in a new page.
                      </p>
                      {selectedPack && (
                        <div className="mt-3 text-xs text-gray-300">
                          <div>{formattedDepositAmount} deposit</div>
                          <div>Total {totalCoins.toLocaleString()} coins</div>
                        </div>
                      )}
                    </div>

                    {/* Submit Button */}
                    <button 
                        onClick={handleCheckout}
                        disabled={isLoading || !stripeReady || !selectedPack}
                        className="w-full rounded-xl bg-emerald-500 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {!stripeReady || !selectedPack ? (
                            <span className="text-center text-sm font-semibold text-white/90">Configure Stripe in Admin Settings</span>
                        ) : isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" /> Processing...
                            </>
                        ) : (
                            <span className="inline-flex items-center gap-2">
                              <span>Purchase</span>
                              <ExternalLink className="w-4 h-4" />
                            </span>
                        )}
                    </button>
                    
                    <p className="text-center text-[10px] text-gray-500 mt-4">
                        By purchasing you agree to our Terms of Service.
                    </p>
            </div>
        </>
      </div>
    </div>
  );
};
