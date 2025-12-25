import React, { useState, useEffect } from 'react';
import { Gift, Calendar, Zap, Lock, Copy, CheckCircle, TrendingUp, ShieldCheck, ClipboardList, Loader2 } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';

export const Bonuses: React.FC = () => {
  const { user, addBalance, claimDaily, boxes, setView } = useGame();
  const { playSound } = useSound();
  
  const [promoCode, setPromoCode] = useState('');
  const [promoMessage, setPromoMessage] = useState('');
  const [isOfferLoading, setIsOfferLoading] = useState(false);

  // Identify daily box from context
  const dailyBox = boxes.find(b => b.isDaily);
  
  // Calculate if claimed
  const canClaim = !user.lastDailyClaim || (Date.now() - user.lastDailyClaim > 24 * 60 * 60 * 1000);

  const handleClaimDaily = () => {
    if (!canClaim) {
        playSound('error');
        return;
    }
    
    playSound('success');
    
    if (dailyBox) {
        // Redirect to spin
        claimDaily();
        setView({ type: 'CASE_OPENING', boxId: dailyBox.id, isFree: true });
    } else {
        // Fallback money reward if no daily box configured
        addBalance(100);
        claimDaily();
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

  const handleRedeem = () => {
    if (!promoCode) {
        playSound('error');
        return;
    }
    
    if (promoCode.toUpperCase() === 'WELCOME') {
        playSound('coins'); // Changed to specific coins sound
        addBalance(500);
        setPromoMessage('Code redeemed! +$500.00');
        setPromoCode('');
    } else {
        playSound('error');
        setPromoMessage('Invalid code.');
    }
    setTimeout(() => setPromoMessage(''), 3000);
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
                    <div className="flex justify-between text-xs font-bold text-gray-300 mb-1">
                        <span>XP Progress</span>
                        <span>{user.xp} / 5000</span>
                    </div>
                    <div className="h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                        <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400" 
                            style={{ width: `${(user.xp / 5000) * 100}%` }}
                        ></div>
                    </div>
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

          {/* Promo Code */}
          <div className="bg-[#131720] border border-gray-800 rounded-xl p-6 flex flex-col">
              <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-brand-purple/10 rounded-lg border border-brand-purple/20">
                      <Gift className="w-8 h-8 text-brand-purple" />
                  </div>
                  <div>
                      <h3 className="text-lg font-bold text-white">Promo Code</h3>
                      <p className="text-sm text-gray-500">Have a code? Enter it here.</p>
                  </div>
              </div>

              <div className="flex-1 flex flex-col justify-center">
                <label className="text-xs font-bold text-gray-400 mb-2 uppercase">Enter Code</label>
                <div className="flex gap-2 mb-2">
                    <input 
                        type="text" 
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        placeholder="Ex: WELCOME"
                        className="flex-1 bg-[#0b0e14] border border-gray-700 rounded-lg px-4 text-white focus:outline-none focus:border-brand-purple transition-colors uppercase font-bold"
                    />
                    <button 
                        onClick={handleRedeem}
                        className="px-6 bg-brand-purple hover:bg-purple-600 text-white font-bold rounded-lg transition-colors"
                    >
                        Redeem
                    </button>
                </div>
                {promoMessage && (
                    <div className={`text-xs font-bold ${promoMessage.includes('Invalid') ? 'text-red-500' : 'text-green-500'}`}>
                        {promoMessage}
                    </div>
                )}
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-800">
                  <div className="flex items-center justify-between text-sm text-gray-400 bg-[#0b0e14] p-3 rounded-lg border border-gray-800 border-dashed">
                      <span>Use code <span className="text-white font-bold">WELCOME</span></span>
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

              {/* Rakeback (Locked) */}
              <div className="bg-[#131720] border border-gray-800 rounded-xl p-6 flex-1 relative overflow-hidden">
                  <div className="flex items-center gap-4 mb-4">
                      <div className="p-2 bg-gray-800 rounded-lg">
                          <TrendingUp className="w-6 h-6 text-gray-500" />
                      </div>
                      <div>
                          <h3 className="font-bold text-gray-300">Rakeback</h3>
                          <p className="text-xs text-gray-600">Earn passive rewards</p>
                      </div>
                  </div>
                  
                  <div className="absolute inset-0 bg-[#0b0e14]/80 backdrop-blur-[1px] flex flex-col items-center justify-center text-center p-4">
                      <Lock className="w-8 h-8 text-gray-600 mb-2" />
                      <div className="text-sm font-bold text-gray-400">Unlocks at Level 20</div>
                      <div className="w-32 h-1.5 bg-gray-800 rounded-full mt-2 overflow-hidden">
                          <div className="h-full bg-gray-600 w-[60%]"></div>
                      </div>
                  </div>
              </div>

          </div>
      </div>
      
      {/* Affiliate Section */}
      <div className="mt-8 bg-[#131720] border border-gray-800 rounded-xl p-8 flex flex-col md:flex-row items-center gap-8">
          <div className="bg-green-500/10 p-6 rounded-full border border-green-500/20">
              <ShieldCheck className="w-12 h-12 text-green-500" />
          </div>
          <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl font-bold text-white mb-2">Affiliate Program</h3>
              <p className="text-gray-400 max-w-xl">Invite friends and earn a percentage of every bet they place. Forever. No limits on earnings.</p>
          </div>
          <button className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg shadow-lg shadow-green-900/20" onClick={() => playSound('click')}>
              Create Code
          </button>
      </div>

    </div>
  );
};