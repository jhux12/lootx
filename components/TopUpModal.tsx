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

  const amounts = [1000, 2500, 5000, 10000, 25000, 50000];

  const handleDeposit = () => {
      playSound('click');
      setIsLoading(true);

      // Simulate API Call
      setTimeout(() => {
          addBalance(amountCoins / 100);
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
      
      <div className="relative w-full max-w-md bg-[#131720] border border-gray-700 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
        
        {success ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mb-4 animate-bounce" />
                <h2 className="text-2xl font-black text-white mb-2">Deposit Successful!</h2>
                <p className="text-gray-400">Your coins have been added.</p>
            </div>
        ) : (
            <>
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-[#0b0e14]">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-blue-500" /> Top Up Coins
                    </h2>
                    <button 
                        onClick={() => setShowTopUpModal(false)} 
                        className="text-gray-500 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    {/* Method Selector */}
                    <div className="flex gap-3 mb-6">
                        <button 
                            onClick={() => { setMethod('card'); playSound('click'); }}
                            className={`flex-1 py-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${method === 'card' ? 'bg-blue-600/10 border-blue-500 text-white' : 'bg-[#0b0e14] border-gray-700 text-gray-500 hover:border-gray-500'}`}
                        >
                            <CreditCard className="w-6 h-6" />
                            <span className="text-xs font-bold">Credit Card</span>
                        </button>
                        <button 
                            onClick={() => { setMethod('crypto'); playSound('click'); }}
                            className={`flex-1 py-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${method === 'crypto' ? 'bg-orange-500/10 border-orange-500 text-white' : 'bg-[#0b0e14] border-gray-700 text-gray-500 hover:border-gray-500'}`}
                        >
                            <Bitcoin className="w-6 h-6" />
                            <span className="text-xs font-bold">Crypto</span>
                        </button>
                    </div>

                    {/* Amount Selector */}
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Select Coin Pack</label>
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        {amounts.map(amt => (
                            <button
                                key={amt}
                                onClick={() => { setAmountCoins(amt); playSound('click'); }}
                                className={`py-3 rounded-lg border font-bold transition-all ${amountCoins === amt ? 'bg-green-600 border-green-500 text-white shadow-lg shadow-green-900/20' : 'bg-[#0b0e14] border-gray-800 text-gray-400 hover:border-gray-600'}`}
                            >
                                <CoinAmount
                                  amount={amt / 100}
                                  formatOptions={{ maximumFractionDigits: 0 }}
                                  className="justify-center"
                                  iconClassName="w-3.5 h-3.5"
                                />
                            </button>
                        ))}
                    </div>

                    {/* Custom Amount Input */}
                    <div className="mb-6">
                        <div className="relative">
                            <span className="absolute inset-y-0 left-4 flex items-center">
                              <img src={COIN_ICON} alt="Coin" className="w-4 h-4" />
                            </span>
                            <input 
                                type="number"
                                min="0"
                                value={amountCoins}
                                onChange={(e) => setAmountCoins(Number(e.target.value))}
                                className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg py-3 pl-11 pr-4 text-white font-bold leading-none focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2">100 coins = $1</p>
                    </div>

                    {/* Submit Button */}
                    <button 
                        onClick={handleDeposit}
                        disabled={isLoading}
                        className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-black text-lg rounded-xl shadow-lg shadow-green-900/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                                  amount={amountCoins / 100}
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
