import React from 'react';
import { Trophy, Medal, User, TrendingUp, Sparkles } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { MOCK_USERS } from '../constants';

export const Leaderboard: React.FC = () => {
    // Generate mock leaderboard data based on mock users + some extras with XP data
    const leaderboardData = [
        { ...MOCK_USERS[1], weeklyXp: 45200, profit: 12400 }, // Zeus
        { ...MOCK_USERS[2], weeklyXp: 38500, profit: -500 },  // CryptoKing
        { ...MOCK_USERS[0], weeklyXp: 25100, profit: 4200 },   // MarieJane
        { ...MOCK_USERS[3], weeklyXp: 18400, profit: 1100 },   // LootMaster
        { id: '5', name: 'HighRoller99', avatar: 'https://picsum.photos/seed/roller/100/100', level: 45, xp: 0, weeklyXp: 12500, profit: -8000 },
        { id: '6', name: 'LuckyStrike', avatar: 'https://picsum.photos/seed/lucky/100/100', level: 22, xp: 0, weeklyXp: 9800, profit: 15000 },
        { id: '7', name: 'CaseClosed', avatar: 'https://picsum.photos/seed/closed/100/100', level: 18, xp: 0, weeklyXp: 5400, profit: 200 },
    ].sort((a, b) => b.weeklyXp - a.weeklyXp);

    const getRankIcon = (index: number) => {
        if (index === 0) return <Trophy className="w-6 h-6 text-yellow-500 fill-yellow-500" />;
        if (index === 1) return <Medal className="w-6 h-6 text-gray-300 fill-gray-300" />;
        if (index === 2) return <Medal className="w-6 h-6 text-orange-700 fill-orange-700" />;
        return <span className="font-bold text-gray-500">#{index + 1}</span>;
    };

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-10">
                <h1 className="text-4xl font-black text-white mb-3 uppercase tracking-tight flex items-center justify-center gap-3">
                    <Sparkles className="w-8 h-8 text-brand-purple" /> 
                    Weekly XP Leaderboard
                </h1>
                <p className="text-gray-400">Top players by XP earned this week. Reset in <span className="text-white font-mono font-bold">2d 14h</span>.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                {/* Top 3 Cards */}
                {[1, 0, 2].map((idx) => {
                    const user = leaderboardData[idx];
                    if(!user) return null;
                    const isFirst = idx === 0;
                    return (
                        <div key={user.id} className={`bg-[#131720] border rounded-2xl p-6 flex flex-col items-center relative ${isFirst ? 'border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.15)] order-1 md:order-2 scale-105' : 'border-gray-800 order-2 md:order-1'}`}>
                            {isFirst && <div className="absolute -top-6"><Trophy className="w-12 h-12 text-yellow-500 drop-shadow-lg" /></div>}
                            
                            <div className="relative mt-4">
                                <img src={user.avatar} className={`w-24 h-24 rounded-full border-4 ${isFirst ? 'border-yellow-500' : 'border-gray-700'}`} />
                                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#0b0e14] px-3 py-1 rounded-full text-xs font-bold border border-gray-700 text-white whitespace-nowrap">
                                    Lvl {user.level}
                                </div>
                            </div>
                            
                            <h2 className="text-xl font-bold text-white mt-6 mb-1">{user.name}</h2>
                            <div className="text-brand-purple font-black text-lg">{user.weeklyXp.toLocaleString()} XP</div>
                            <div className="text-xs text-gray-500 uppercase font-bold mt-1">Weekly Earned</div>
                        </div>
                    )
                })}
            </div>

            {/* List View */}
            <div className="bg-[#131720] border border-gray-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[#0b0e14] text-gray-400 font-bold text-xs uppercase border-b border-gray-800">
                            <tr>
                                <th className="px-6 py-4">Rank</th>
                                <th className="px-6 py-4">Player</th>
                                <th className="px-6 py-4 text-right">Weekly XP</th>
                                <th className="px-6 py-4 text-right">Total Profit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800 text-sm">
                            {leaderboardData.map((user, index) => (
                                <tr key={user.id} className="hover:bg-[#1a2130] transition-colors">
                                    <td className="px-6 py-4 flex items-center justify-center md:justify-start w-20">
                                        {getRankIcon(index)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <img src={user.avatar} className="w-8 h-8 rounded-lg" />
                                            <div>
                                                <div className="font-bold text-white">{user.name}</div>
                                                <div className="text-xs text-gray-500">Level {user.level}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="text-brand-purple font-bold">{user.weeklyXp.toLocaleString()} XP</div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className={`font-bold ${user.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {user.profit >= 0 ? '+' : ''}${user.profit.toLocaleString()}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
