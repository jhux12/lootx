import React, { useState } from 'react';
import { DEFAULT_SETTINGS } from '../../components/upgrader/upgraderMockData';
import { Save, RefreshCw, Calculator, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

export default function UpgraderSettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [previewSource, setPreviewSource] = useState('100');
  const [previewTarget, setPreviewTarget] = useState('200');

  const handleSave = () => {
    // Mock save
    alert('Settings saved (mock)!');
  };

  const handleRotateSeed = () => {
    // Mock rotate
    alert('Server seed rotated (mock)!');
  };

  const calculatedChance = () => {
    const s = parseFloat(previewSource) || 0;
    const t = parseFloat(previewTarget) || 1;
    if (s >= t) return "0.00";
    const chance = (s / t) * settings.edgeMultiplier * 100;
    return Math.min(Math.max(chance, settings.minChance), settings.maxChance).toFixed(2);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tight">Upgrader Settings</h1>
            <p className="text-slate-400">Configure global parameters for the upgrader game.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleRotateSeed}
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Rotate Seed
            </button>
            <button 
              onClick={handleSave}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-bold transition-colors"
            >
              <Save className="w-4 h-4" /> Save Settings
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Main Settings */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-2 text-indigo-400 mb-2">
              <ShieldCheck className="w-5 h-5" />
              <h2 className="font-bold uppercase tracking-wider">Core Parameters</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl border border-slate-800">
                <span className="text-sm font-medium">Game Enabled</span>
                <button 
                  onClick={() => setSettings({...settings, enabled: !settings.enabled})}
                  className={`w-12 h-6 rounded-full transition-colors relative ${settings.enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.enabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Edge Multiplier (House Edge)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={settings.edgeMultiplier}
                  onChange={(e) => setSettings({...settings, edgeMultiplier: parseFloat(e.target.value)})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Min Chance (%)</label>
                  <input 
                    type="number" 
                    value={settings.minChance}
                    onChange={(e) => setSettings({...settings, minChance: parseFloat(e.target.value)})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Max Chance (%)</label>
                  <input 
                    type="number" 
                    value={settings.maxChance}
                    onChange={(e) => setSettings({...settings, maxChance: parseFloat(e.target.value)})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Cooldown (ms)</label>
                <input 
                  type="number" 
                  value={settings.cooldownMs}
                  onChange={(e) => setSettings({...settings, cooldownMs: parseInt(e.target.value)})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Preview Tool */}
          <div className="space-y-8">
            <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-2xl p-6 space-y-6">
              <div className="flex items-center gap-2 text-indigo-400 mb-2">
                <Calculator className="w-5 h-5" />
                <h2 className="font-bold uppercase tracking-wider">Chance Preview Tool</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-indigo-300/60 uppercase">Source Value</label>
                  <input 
                    type="number" 
                    value={previewSource}
                    onChange={(e) => setPreviewSource(e.target.value)}
                    className="w-full bg-slate-950/50 border border-indigo-500/20 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-indigo-300/60 uppercase">Target Value</label>
                  <input 
                    type="number" 
                    value={previewTarget}
                    onChange={(e) => setPreviewTarget(e.target.value)}
                    className="w-full bg-slate-950/50 border border-indigo-500/20 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="p-6 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 flex flex-col items-center justify-center">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Resulting Chance</span>
                <span className="text-5xl font-black text-white">{calculatedChance()}%</span>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Permissions</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={settings.allowFromFreeBox}
                    onChange={(e) => setSettings({...settings, allowFromFreeBox: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">Allow items from Free Boxes</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={settings.allowFromPromo}
                    onChange={(e) => setSettings({...settings, allowFromPromo: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">Allow items from Promo Codes</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
