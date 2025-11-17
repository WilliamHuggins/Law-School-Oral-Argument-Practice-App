
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../App';
import { Page, Settings, Court } from '../types';
import { InfoIcon } from './icons';
import { COURT_RULE_PRESETS } from '../constants';

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-red-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-stanford-red"></div>
    </label>
);

const SettingsPage: React.FC = () => {
  const { settings: initialSettings, setSettings, setPage } = useAppContext();
  const [localSettings, setLocalSettings] = useState<Settings>(initialSettings);

  const handleSettingChange = <K extends keyof Settings,>(key: K, value: Settings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  // When court changes, update the recommended timer and bench style
  useEffect(() => {
    const preset = COURT_RULE_PRESETS[localSettings.court];
    setLocalSettings(prev => ({
      ...prev,
      timerLength: preset.recommendedTimerMinutes,
      benchStyle: preset.recommendedBenchStyle,
    }));
  }, [localSettings.court]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSettings(localSettings);
    setPage(Page.CaseSelection);
  };

  const selectedCourtPreset = COURT_RULE_PRESETS[localSettings.court];

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-serif font-bold mb-8 text-center">Configure Your Practice Session</h2>
      <form onSubmit={handleSubmit} className="space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Session Parameters Card */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-bold font-serif mb-4 border-b pb-2">Session Parameters</h3>
                <div className="space-y-6">
                    <div>
                        <label htmlFor="court" className="block text-sm font-medium text-gray-700 mb-1">Court & Rules</label>
                        <select id="court" value={localSettings.court} onChange={(e) => handleSettingChange('court', e.target.value as Court)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-stanford-red focus:border-stanford-red">
                            {Object.keys(COURT_RULE_PRESETS).map(courtName => (
                                <option key={courtName} value={courtName}>{courtName}</option>
                            ))}
                        </select>
                         <div className="mt-2 p-3 bg-gray-50 rounded-md border text-xs text-gray-600">
                            <p className="font-semibold">{selectedCourtPreset.description}</p>
                            <p className="mt-1">Recommended: {selectedCourtPreset.recommendedTimerMinutes} min timer, {selectedCourtPreset.recommendedBenchStyle} Bench. Addressed as "{selectedCourtPreset.addressForm}".</p>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="timerLength" className="block text-sm font-medium text-gray-700 mb-1">Oral Argument Time Limit</label>
                        <select id="timerLength" value={localSettings.timerLength} onChange={(e) => handleSettingChange('timerLength', parseInt(e.target.value))} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-stanford-red focus:border-stanford-red">
                            <option value="0">No Timer</option>
                            <option value="5">5 minutes</option>
                            <option value="10">10 minutes</option>
                            <option value="15">15 minutes</option>
                            <option value="20">20 minutes</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="benchStyle" className="block text-sm font-medium text-gray-700 mb-1">Judge's Bench Style</label>
                        <div className="flex items-center space-x-2 relative group">
                            <select id="benchStyle" value={localSettings.benchStyle} onChange={(e) => handleSettingChange('benchStyle', e.target.value as Settings['benchStyle'])} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-stanford-red focus:border-stanford-red">
                                <option value="Standard">Standard Bench</option>
                                <option value="Hot">Hot Bench</option>
                            </select>
                            <InfoIcon className="h-5 w-5 text-gray-400" />
                            <div className="absolute left-full ml-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                'Hot Bench' means the judge will interrupt frequently with tough questions.
                            </div>
                        </div>
                    </div>
                     <div>
                        <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700 mb-1">Difficulty (Law School Year)</label>
                        <select id="difficulty" value={localSettings.difficulty} onChange={(e) => handleSettingChange('difficulty', e.target.value as Settings['difficulty'])} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-stanford-red focus:border-stanford-red">
                            <option value="1L">1L</option>
                            <option value="2L">2L</option>
                            <option value="3L/LLM">3L/LLM</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Environment & Aids Card */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-bold font-serif mb-4 border-b pb-2">Environment & Aids</h3>
                <div className="space-y-6">
                     <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Courtroom Ambient Sound</span>
                        <ToggleSwitch checked={localSettings.courtroomSounds} onChange={(checked) => handleSettingChange('courtroomSounds', checked)} />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Co-Counsel Hints</span>
                         <ToggleSwitch checked={localSettings.coCounsel} onChange={(checked) => handleSettingChange('coCounsel', checked)} />
                    </div>
                    <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-md">
                        <p>The judge will have a standard female voice. This cannot be changed.</p>
                    </div>
                </div>
            </div>
        </div>

        <div className="text-center mt-12">
            <button type="submit" className="w-full md:w-auto px-12 py-3 bg-stanford-red text-white text-lg font-semibold rounded-lg shadow-md hover:bg-red-800 transition-colors duration-300">
                Continue to Case Selection
            </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsPage;