import React, { useState, useEffect } from 'react';
import { Gift, Calendar, Lock, Copy, TrendingUp, ShieldCheck, ClipboardList } from 'lucide-react';
import { calculateLevelProgress, useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { XP_ICON } from '../constants';
import { CoinAmount } from './CoinAmount';
import { Input } from './ui/Input';
import { auth } from '../firebase';

export const Bonuses: React.FC = () => {
  const { 
    user, 
    users,
    addBalance, 
    claimDaily, 
    claimRakeback,
    boxes, 
    setView,
    isAuthenticated,
    openAuthModal,
    updateUserFlags,
    generateAffiliateCode,
    bonusSettings
  } = useGame();
  const { playSound } = useSound();
  const progress = calculateLevelProgress(user.xp || 0);
  
  const [affiliateInput, setAffiliateInput] = useState('');
  const [affiliateMessage, setAffiliateMessage] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isClaimingDaily, setIsClaimingDaily] = useState(false);
  const [isApplyingAffiliate, setIsApplyingAffiliate] = useState(false);
  const [isLoadingOfferWall, setIsLoadingOfferWall] = useState(false);
  const [isClaimingRakeback, setIsClaimingRakeback] = useState(false);
  const [cpxUrl, setCpxUrl] = useState<string | null>(null);

  // Identify daily box from context
  const dailyBox = boxes.find(b => b.isDaily);
  
  // Calculate if claimed
  const canClaim = !user.lastDailyClaim || (Date.now() - user.lastDailyClaim > 24 * 60 * 60 * 1000);
  const rakebackUnlocked = user.level >= bonusSettings.rakebackUnlockLevel;
  const affiliateUnlocked = user.level >= 3;
  const availableRakeback = Number(user.rakebackBalance ?? 0);
  const hasReferral = Boolean(user.referredBy);

  const handleClaimDaily = () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }

    if (!canClaim) {
        playSound('error');
        return;
    }

    playSound('success');
    setIsClaimingDaily(true);
    
    if (dailyBox) {
        // Redirect to spin
        setView({ type: 'CASE_OPENING', boxId: dailyBox.id, isFree: true });
    } else {
        // Fallback coin reward if no daily box configured
        addBalance(100);
        claimDaily();
        setIsClaimingDaily(false);
    }
  };

  const handleOfferWall = async () => {
    playSound('click');
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    if (isLoadingOfferWall) return;
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setOfferMessage('Please sign in to access the offer wall.');
      setTimeout(() => setOfferMessage(''), 4000);
      return;
    }

    setIsLoadingOfferWall(true);
    setOfferMessage('');
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/cpx-frame-url', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Unable to load offer wall.');
      }
      const data = await response.json();
      if (!data?.url) {
        throw new Error('Offer wall is unavailable.');
      }
      setCpxUrl(data.url);
    } catch (error) {
      console.error('Failed to load offer wall', error);
      setOfferMessage('Unable to load offer wall. Please try again.');
      setTimeout(() => setOfferMessage(''), 4000);
    } finally {
      setIsLoadingOfferWall(false);
    }
  };

  const handleCloseOfferWall = () => {
    playSound('click');
    setCpxUrl(null);
  };

  const handleOfferWallFrameError = () => {
    setOfferMessage('Offer wall failed to load. Please try again.');
    setTimeout(() => setOfferMessage(''), 4000);
    setCpxUrl(null);
  };

  const handleApplyAffiliateCode = async () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }

    if (hasReferral) {
      setAffiliateMessage('You are already linked to an affiliate.');
      return;
    }

    const formattedCode = affiliateInput.trim().toUpperCase();
    if (!formattedCode) {
      playSound('error');
      setAffiliateMessage('Please enter a valid affiliate code.');
      return;
    }

    if (user.affiliateCode && formattedCode === user.affiliateCode.toUpperCase()) {
      playSound('error');
      setAffiliateMessage('You cannot use your own affiliate code.');
      return;
    }

    const affiliateOwner = users.find((u) => u.affiliateCode?.toUpperCase() === formattedCode);
    if (!affiliateOwner) {
      playSound('error');
      setAffiliateMessage('Affiliate code not found.');
      return;
    }

    setIsApplyingAffiliate(true);
    try {
      await updateUserFlags({ referredBy: formattedCode });
      setAffiliateMessage('Affiliate linked successfully!');
      playSound('success');
      setAffiliateInput('');
    } catch (error) {
      console.error('Failed to apply affiliate code', error);
      setAffiliateMessage('Something went wrong. Please try again.');
    } finally {
      setIsApplyingAffiliate(false);
    }
    setTimeout(() => setAffiliateMessage(''), 4000);
  };

  const handleGenerateCode = async () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    if (!affiliateUnlocked) {
      playSound('error');
      return;
    }
    if (user.affiliateCode) {
      navigator.clipboard?.writeText(user.affiliateCode || '');
      setAffiliateMessage('Your code is ready to share!');
      setTimeout(() => setAffiliateMessage(''), 3000);
      return;
    }
    setIsGeneratingCode(true);
    const code = await generateAffiliateCode();
    setIsGeneratingCode(false);
    if (code) {
      playSound('success');
      setAffiliateMessage('Affiliate code generated!');
      setTimeout(() => setAffiliateMessage(''), 3000);
    }
  };

  const handleClaimRakeback = async () => {
    if (!rakebackUnlocked) {
      playSound('error');
      return;
    }
    if (availableRakeback <= 0) {
      playSound('error');
      return;
    }
    if (isClaimingRakeback) {
      return;
    }
    playSound('coins');
    setIsClaimingRakeback(true);
    try {
      await claimRakeback();
    } finally {
      setIsClaimingRakeback(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 animate-in fade-in duration-500">
      
      {/* Header Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-blue-900 to-brand-bg p-8 mb-8 border border-blue-800">
         <div className="absolute top-0 right-0 p-32 bg-blue-500 rounded-full mix-blend-overlay blur-3xl opacity-20 animate-pulse"></div>
         
         <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
             <div className="bg-blue-600/20 p-4 rounded-2xl border border-blue-500/30">
                 <img src={user.avatar} className="w-20 h-20 rounded-xl" />
             </div>
             <div className="flex-1 text-center md:text-left">
                 <h1 className="text-3xl font-black text-white italic uppercase tracking-wider mb-2">VIP Club & Rewards</h1>
                 <p className="text-blue-200">Level {user.level} Member</p>
                 
                 {/* XP Progress */}
                 <div className="mt-4 max-w-md">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-gray-300 mb-1">
                        <div className="flex items-center gap-2">
                            <img src={XP_ICON} alt="XP" className="w-5 h-5 object-contain" />
                            <span>XP Progress</span>
                        </div>
                        <span className="text-right">{progress.xpIntoLevel} / {progress.xpForNextLevel}</span>
                    </div>
                    <div className="h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                        <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400" 
                            style={{ width: `${Math.min(100, (progress.xpIntoLevel / progress.xpForNextLevel) * 100)}%` }}
                        ></div>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {progress.xpToNextLevel} XP to reach level {progress.level + 1}
                    </p>
                 </div>
             </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Daily Case */}
          <div className="bg-[#131720] border border-gray-800 rounded-xl p-6 relative group overflow-hidden">
              <div className="absolute top-0 right-0 p-20 bg-yellow-500 rounded-full blur-[80px] opacity-5 group-hover:opacity-10 transition-opacity"></div>
              
              <div className="flex items-center gap-4 mb-6 relative z-10">
                  <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                      <Calendar className="w-8 h-8 text-yellow-500" />
                  </div>
                  <div>
                      <h3 className="text-lg font-bold text-white">Daily Free Case</h3>
                      <p className="text-sm text-gray-500">Come back every 24h</p>
                  </div>
              </div>
              
              <div className="flex justify-center mb-6">
                  <img src={dailyBox ? dailyBox.image : "https://picsum.photos/id/175/150/150"} className="w-32 h-32 object-contain drop-shadow-lg" />
              </div>

              <button 
                onClick={handleClaimDaily}
                disabled={!canClaim || isClaimingDaily}
                className={`w-full py-3 rounded-lg font-bold text-sm transition-all ${!canClaim || isClaimingDaily ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg shadow-yellow-500/20'}`}
              >
                  <span className="flex items-center justify-center gap-2">
                    {isClaimingDaily && (
                      <span className="h-4 w-4 animate-spin rounded-full border border-gray-400/60 border-t-transparent" aria-hidden="true" />
                    )}
                    {!canClaim ? 'Come back later' : isClaimingDaily ? 'Claiming...' : 'Claim Free Spin'}
                  </span>
              </button>
          </div>

          {/* Affiliate Code Entry */}
          <div className="bg-[#131720] border border-gray-800 rounded-xl p-6 flex flex-col">
              <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-brand-purple/10 rounded-lg border border-brand-purple/20">
                      <Gift className="w-8 h-8 text-brand-purple" />
                  </div>
                  <div>
                      <h3 className="text-lg font-bold text-white">Affiliate Code</h3>
                      <p className="text-sm text-gray-500">Support a creator to unlock special rewards.</p>
                  </div>
              </div>

              <div className="flex-1 flex flex-col justify-center">
                <label className="text-xs font-bold text-gray-400 mb-2 uppercase">Enter Affiliate Code</label>
                <div className="flex flex-col sm:flex-row sm:flex-nowrap gap-2 mb-2 items-stretch sm:items-center min-w-0">
                    <Input 
                        type="text" 
                        value={affiliateInput}
                        onChange={(e) => setAffiliateInput(e.target.value)}
                        placeholder="Ex: STREAMER123"
                        className="flex-1 min-w-0 px-4 py-3 uppercase font-bold"
                        disabled={hasReferral}
                    />
                    <button 
                        onClick={handleApplyAffiliateCode}
                        disabled={hasReferral || isApplyingAffiliate}
                        className="px-6 py-3 sm:py-[13px] bg-brand-purple hover:bg-purple-600 text-white font-bold rounded-lg transition-colors w-full sm:w-auto sm:flex-shrink-0 whitespace-nowrap"
                    >
                        <span className="flex items-center justify-center gap-2">
                          {isApplyingAffiliate && (
                            <span className="h-4 w-4 animate-spin rounded-full border border-white/70 border-t-transparent" aria-hidden="true" />
                          )}
                          {hasReferral ? 'Linked' : isApplyingAffiliate ? 'Applying...' : 'Apply'}
                        </span>
                    </button>
                </div>
                {affiliateMessage && (
                    <div className={`text-xs font-bold ${affiliateMessage.toLowerCase().includes('not') || affiliateMessage.toLowerCase().includes('cannot') ? 'text-red-500' : 'text-green-500'}`}>
                        {affiliateMessage}
                    </div>
                )}
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-800">
                  <div className="flex items-center justify-between text-sm text-gray-400 bg-[#0b0e14] p-3 rounded-lg border border-gray-800 border-dashed">
                      <span>Link a creator to start earning extra rewards</span>
                      <Copy className="w-4 h-4 cursor-pointer hover:text-white" onClick={() => playSound('click')} />
                  </div>
              </div>
          </div>

          {/* Offer Wall & Rakeback */}
          <div className="flex flex-col gap-6">
              
              {/* Offer Wall */}
              <div className="bg-[#131720] border border-gray-800 rounded-xl p-6 flex-1">
                  <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-white flex items-center gap-2">
                          <ClipboardList className="w-4 h-4 text-orange-500" /> Offer Wall
                      </h3>
                      <span className="text-xs font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded">High Payer</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">Complete surveys, install apps, and play games to earn free coins.</p>
                  {!cpxUrl ? (
                    <button 
                      onClick={handleOfferWall}
                      disabled={isLoadingOfferWall}
                      className="w-full py-2 bg-[#0b0e14] hover:bg-gray-800 border border-gray-700 text-gray-300 font-bold rounded-lg transition-colors text-sm flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-80"
                    >
                        {isLoadingOfferWall && (
                          <span className="h-4 w-4 animate-spin rounded-full border border-gray-400/60 border-t-transparent" aria-hidden="true" />
                        )}
                        {isLoadingOfferWall ? 'Loading...' : 'Open Offer Wall'}
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={handleCloseOfferWall}
                          className="w-full sm:w-auto px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold rounded-lg text-xs uppercase tracking-wide"
                        >
                          Close
                        </button>
                      </div>
                      <div className="rounded-xl border border-gray-700 bg-[#0b0e14] overflow-hidden">
                        <iframe
                          title="CPX Offer Wall"
                          src={cpxUrl}
                          className="w-full h-[600px] sm:h-[700px] lg:h-[780px]"
                          allow="clipboard-write"
                          onError={handleOfferWallFrameError}
                        />
                      </div>
                    </div>
                  )}
                  {offerMessage && (
                    <p className="mt-2 text-xs text-gray-500 text-center">{offerMessage}</p>
                  )}
              </div>

              {/* Rakeback */}
              <div className="bg-[#131720] border border-gray-800 rounded-xl p-6 flex-1 relative overflow-hidden">
                  <div className="flex items-center gap-4 mb-4">
                      <div className="p-2 bg-gray-800 rounded-lg">
                          <TrendingUp className="w-6 h-6 text-gray-500" />
                      </div>
                      <div>
                          <h3 className="font-bold text-gray-300">Rakeback</h3>
                          <p className="text-xs text-gray-600">Earn {bonusSettings.rakebackBasePercent}% back on every bet</p>
                      </div>
                  </div>

                  <div className="space-y-3">
                    <CoinAmount
                      amount={availableRakeback}
                      formatOptions={{ maximumFractionDigits: 0 }}
                      className="text-3xl font-bold text-white"
                      iconClassName="w-5 h-5"
                    />
                    <div className="text-xs text-gray-500">Unlocked at level {bonusSettings.rakebackUnlockLevel}</div>
                    <button 
                      onClick={handleClaimRakeback}
                      disabled={!rakebackUnlocked || availableRakeback <= 0 || isClaimingRakeback}
                      className={`w-full py-2 rounded-lg font-bold text-sm transition-all ${!rakebackUnlocked || availableRakeback <= 0 || isClaimingRakeback ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-green-500 hover:bg-green-400 text-black shadow-lg shadow-green-500/20'}`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        {isClaimingRakeback && (
                          <span className="h-4 w-4 animate-spin rounded-full border border-gray-400/60 border-t-transparent" aria-hidden="true" />
                        )}
                        {rakebackUnlocked ? isClaimingRakeback ? 'Collecting...' : 'Collect Rakeback' : 'Locked'}
                      </span>
                    </button>
                  </div>
                  
                  {!rakebackUnlocked && (
                    <div className="absolute inset-0 bg-[#0b0e14]/80 backdrop-blur-[1px] flex flex-col items-center justify-center text-center p-4">
                        <Lock className="w-8 h-8 text-gray-600 mb-2" />
                        <div className="text-sm font-bold text-gray-400">Unlocks at Level {bonusSettings.rakebackUnlockLevel}</div>
                        <div className="w-32 h-1.5 bg-gray-800 rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-gray-600 w-[60%]"></div>
                        </div>
                    </div>
                  )}
              </div>

          </div>
      </div>
      
      {/* Affiliate Section */}
      <div className="mt-8 bg-[#131720] border border-gray-800 rounded-xl p-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
          <div className="bg-green-500/10 p-6 rounded-full border border-green-500/20">
              <ShieldCheck className="w-12 h-12 text-green-500" />
          </div>
          <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl font-bold text-white mb-2">Affiliate Program</h3>
              <p className="text-gray-400 max-w-xl">Invite followers and earn a percentage of every bet they place. Forever. No limits on earnings.</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button 
              className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg shadow-lg shadow-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleGenerateCode}
              disabled={!affiliateUnlocked || isGeneratingCode}
            >
                <span className="flex items-center justify-center gap-2">
                  {isGeneratingCode && (
                    <span className="h-4 w-4 animate-spin rounded-full border border-white/70 border-t-transparent" aria-hidden="true" />
                  )}
                  {user.affiliateCode ? 'Copy Code' : isGeneratingCode ? 'Generating...' : 'Create Code'}
                </span>
            </button>
            {user.affiliateCode && (
              <div className="flex items-center gap-2 bg-[#0b0e14] border border-green-800/40 px-4 py-2 rounded-lg">
                <span className="text-green-400 font-bold text-sm">{user.affiliateCode}</span>
                <Copy className="w-4 h-4 cursor-pointer text-green-400" onClick={() => { navigator.clipboard?.writeText(user.affiliateCode || ''); playSound('click'); }} />
              </div>
            )}
          </div>
          {!affiliateUnlocked && (
            <div className="absolute inset-0 bg-[#0b0e14]/80 backdrop-blur-[1px] flex flex-col items-center justify-center text-center p-4 rounded-xl">
                <Lock className="w-8 h-8 text-gray-600 mb-2" />
                <div className="text-sm font-bold text-gray-400">Affiliate codes unlock at Level 3</div>
            </div>
          )}
      </div>

    </div>
  );
};
