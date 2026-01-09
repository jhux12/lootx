import React, { useState, useEffect } from 'react';
import { Gift, Calendar, Lock, Copy, TrendingUp, ShieldCheck, ClipboardList, Loader2, Zap, Timer } from 'lucide-react';
import { calculateLevelProgress, useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { XP_ICON } from '../constants';

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
    setShowLoginModal,
    updateUserFlags,
    generateAffiliateCode
  } = useGame();
  const { playSound } = useSound();
  const progress = calculateLevelProgress(user.xp || 0);
  
  const [affiliateInput, setAffiliateInput] = useState('');
  const [affiliateMessage, setAffiliateMessage] = useState('');
  const [isOfferLoading, setIsOfferLoading] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [tapStreak, setTapStreak] = useState(0);
  const [tappedBlocks, setTappedBlocks] = useState<boolean[]>(() => Array.from({ length: 50 }, () => false));
  const [frenzyActive, setFrenzyActive] = useState(false);
  const [frenzyTimeLeft, setFrenzyTimeLeft] = useState<number | null>(null);
  const [frenzyBonusAwarded, setFrenzyBonusAwarded] = useState<number | null>(null);
  const [frenzyMessage, setFrenzyMessage] = useState('');

  // Identify daily box from context
  const dailyBox = boxes.find(b => b.isDaily);
  
  // Calculate if claimed
  const canClaim = !user.lastDailyClaim || (Date.now() - user.lastDailyClaim > 24 * 60 * 60 * 1000);
  const rakebackUnlocked = user.level >= 10;
  const affiliateUnlocked = user.level >= 3;
  const availableRakeback = Number(user.rakebackBalance ?? 0);
  const hasReferral = Boolean(user.referredBy);
  const blockTarget = 50;
  const frenzyDuration = 12;

  useEffect(() => {
    if (!frenzyActive || frenzyTimeLeft === null) return;
    if (frenzyTimeLeft <= 0) {
      setFrenzyActive(false);
      return;
    }

    const timer = setTimeout(() => {
      setFrenzyTimeLeft((prev) => (prev ? prev - 1 : prev));
    }, 1000);

    return () => clearTimeout(timer);
  }, [frenzyActive, frenzyTimeLeft]);

  const handleClaimDaily = () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    if (!canClaim) {
        playSound('error');
        return;
    }
    
    playSound('success');
    
    if (dailyBox) {
        // Redirect to spin
        setView({ type: 'CASE_OPENING', boxId: dailyBox.id, isFree: true });
    } else {
        // Fallback money reward if no daily box configured
        addBalance(100);
        claimDaily();
    }
  };

  const resetFrenzy = (options?: { keepMessage?: boolean }) => {
    setTapStreak(0);
    setTappedBlocks(Array.from({ length: blockTarget }, () => false));
    setFrenzyActive(false);
    setFrenzyTimeLeft(null);
    setFrenzyBonusAwarded(null);
    if (!options?.keepMessage) {
      setFrenzyMessage('');
    }
  };

  const calculateFrenzyBonus = (level: number) => {
    const baseBonus = 0.25;
    const levelBonus = 0.05 * Math.max(0, level);
    return Math.min(2.5, baseBonus + levelBonus);
  };

  const handleBlockTap = (index: number) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    if (frenzyActive) {
      playSound('error');
      return;
    }

    if (tappedBlocks[index]) {
      playSound('error');
      resetFrenzy({ keepMessage: true });
      setFrenzyMessage('Oops! Re-tapped block. Streak reset.');
      return;
    }

    const updatedBlocks = [...tappedBlocks];
    updatedBlocks[index] = true;
    const nextStreak = tapStreak + 1;

    setTappedBlocks(updatedBlocks);
    setTapStreak(nextStreak);
    playSound('click');

    if (nextStreak >= blockTarget) {
      const bonus = Number(calculateFrenzyBonus(user.level).toFixed(2));
      addBalance(bonus);
      setFrenzyBonusAwarded(bonus);
      setFrenzyActive(true);
      setFrenzyTimeLeft(frenzyDuration);
      setFrenzyMessage(`Frenzy unlocked! +$${bonus.toFixed(2)} added.`);
      playSound('coins');
    }
  };

  const handleOfferWall = () => {
     if (isOfferLoading) return;
     
     playSound('click');
     setIsOfferLoading(true);

     // Simulate connecting to offer partner and completing a task for demo purposes
     setTimeout(() => {
         playSound('coins');
         addBalance(45.50); // Simulate a specific offer payout
         setIsOfferLoading(false);
         // Optional: You could show a notification here
     }, 2000);
  };

  const handleApplyAffiliateCode = async () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
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

    try {
      await updateUserFlags({ referredBy: formattedCode });
      setAffiliateMessage('Affiliate linked successfully!');
      playSound('success');
      setAffiliateInput('');
    } catch (error) {
      console.error('Failed to apply affiliate code', error);
      setAffiliateMessage('Something went wrong. Please try again.');
    }
    setTimeout(() => setAffiliateMessage(''), 4000);
  };

  const handleGenerateCode = async () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
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

  const handleClaimRakeback = () => {
    if (!rakebackUnlocked) {
      playSound('error');
      return;
    }
    if (availableRakeback <= 0) {
      playSound('error');
      return;
    }
    playSound('coins');
    claimRakeback();
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
                disabled={!canClaim}
                className={`w-full py-3 rounded-lg font-bold text-sm transition-all ${!canClaim ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg shadow-yellow-500/20'}`}
              >
                  {!canClaim ? 'Come back later' : 'Claim Free Spin'}
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
                    <input 
                        type="text" 
                        value={affiliateInput}
                        onChange={(e) => setAffiliateInput(e.target.value)}
                        placeholder="Ex: STREAMER123"
                        className="flex-1 min-w-0 bg-[#0b0e14] border border-gray-700 rounded-lg px-4 text-white focus:outline-none focus:border-brand-purple transition-colors uppercase font-bold"
                        disabled={hasReferral}
                    />
                    <button 
                        onClick={handleApplyAffiliateCode}
                        disabled={hasReferral}
                        className="px-6 py-3 sm:py-[13px] bg-brand-purple hover:bg-purple-600 text-white font-bold rounded-lg transition-colors w-full sm:w-auto sm:flex-shrink-0 whitespace-nowrap"
                    >
                        {hasReferral ? 'Linked' : 'Apply'}
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
                  <p className="text-xs text-gray-500 mb-4">Complete surveys, install apps, and play games to earn free balance.</p>
                  <button 
                    onClick={handleOfferWall} 
                    disabled={isOfferLoading}
                    className="w-full py-2 bg-[#0b0e14] hover:bg-gray-800 border border-gray-700 text-gray-300 font-bold rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                  >
                      {isOfferLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Connecting...
                        </>
                      ) : 'Browse Offers'}
                  </button>
              </div>

              {/* Rakeback */}
              <div className="bg-[#131720] border border-gray-800 rounded-xl p-6 flex-1 relative overflow-hidden">
                  <div className="flex items-center gap-4 mb-4">
                      <div className="p-2 bg-gray-800 rounded-lg">
                          <TrendingUp className="w-6 h-6 text-gray-500" />
                      </div>
                      <div>
                          <h3 className="font-bold text-gray-300">Rakeback</h3>
                          <p className="text-xs text-gray-600">Earn 1% back on every bet</p>
                      </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-3xl font-bold text-white">${availableRakeback.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">Unlocked at level 10</div>
                    <button 
                      onClick={handleClaimRakeback}
                      disabled={!rakebackUnlocked || availableRakeback <= 0}
                      className={`w-full py-2 rounded-lg font-bold text-sm transition-all ${!rakebackUnlocked || availableRakeback <= 0 ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-green-500 hover:bg-green-400 text-black shadow-lg shadow-green-500/20'}`}
                    >
                      {rakebackUnlocked ? 'Collect Rakeback' : 'Locked'}
                    </button>
                  </div>
                  
                  {!rakebackUnlocked && (
                    <div className="absolute inset-0 bg-[#0b0e14]/80 backdrop-blur-[1px] flex flex-col items-center justify-center text-center p-4">
                        <Lock className="w-8 h-8 text-gray-600 mb-2" />
                        <div className="text-sm font-bold text-gray-400">Unlocks at Level 10</div>
                        <div className="w-32 h-1.5 bg-gray-800 rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-gray-600 w-[60%]"></div>
                        </div>
                    </div>
                  )}
              </div>

          </div>
      </div>

      {/* Block Frenzy */}
      <div className="mt-8 bg-[#131720] border border-gray-800 rounded-xl p-6">
          <div className="flex flex-col gap-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                      <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                              <Zap className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                              <h3 className="text-lg font-bold text-white">Block Frenzy</h3>
                              <p className="text-sm text-gray-400">Tap 50 blocks in a row to unlock a quick frenzy bonus.</p>
                          </div>
                      </div>
                      <div className="text-xs text-gray-500">
                          Bonus scales slightly with your level and stays modest.
                      </div>
                  </div>
                  <div className="flex flex-col items-start md:items-end gap-2 text-xs text-gray-400">
                      <div className="flex items-center gap-2">
                          <Timer className="w-4 h-4 text-blue-400" />
                          {frenzyActive ? (
                            <span className="text-blue-300 font-bold">Frenzy live: {frenzyTimeLeft ?? 0}s</span>
                          ) : (
                            <span>Frenzy timer: {frenzyDuration}s</span>
                          )}
                      </div>
                      {frenzyBonusAwarded !== null && (
                        <div className="text-green-400 font-semibold">+${frenzyBonusAwarded.toFixed(2)} awarded</div>
                      )}
                  </div>
              </div>

              <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-gray-400 mb-2">
                      <span>{tapStreak} / {blockTarget} taps</span>
                      <span>{frenzyActive ? 'Keep the energy up!' : 'Don’t re-tap the same block.'}</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all"
                        style={{ width: `${Math.min(100, (tapStreak / blockTarget) * 100)}%` }}
                      ></div>
                  </div>
                  {frenzyMessage && (
                    <div className="text-xs text-blue-300 mt-2">{frenzyMessage}</div>
                  )}
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {Array.from({ length: blockTarget }, (_, index) => {
                    const isTapped = tappedBlocks[index];
                    return (
                      <button
                        key={index}
                        onClick={() => handleBlockTap(index)}
                        disabled={frenzyActive}
                        aria-label={`Tap block ${index + 1}`}
                        aria-pressed={isTapped}
                        className={`aspect-square w-full rounded-lg border text-[10px] font-bold transition-all ${
                          isTapped
                            ? 'bg-green-500/30 border-green-400 text-green-200'
                            : 'bg-[#0b0e14] border-gray-700 text-gray-500 hover:border-blue-400 hover:text-blue-200'
                        } ${frenzyActive ? 'opacity-60 cursor-not-allowed' : 'active:scale-95'}`}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                  <button
                    onClick={() => resetFrenzy()}
                    disabled={frenzyActive && frenzyTimeLeft !== null && frenzyTimeLeft > 0}
                    className={`px-4 py-2 rounded-lg font-bold transition-colors border ${
                      frenzyActive ? 'bg-gray-900 border-gray-700 text-gray-500 cursor-not-allowed' : 'bg-[#0b0e14] border-gray-700 text-gray-300 hover:text-white hover:border-gray-500'
                    }`}
                  >
                    Reset Streak
                  </button>
                  <span>Hit 50 taps to unlock frenzy mode.</span>
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
                {user.affiliateCode ? 'Copy Code' : isGeneratingCode ? 'Generating...' : 'Create Code'}
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
