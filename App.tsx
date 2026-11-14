/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { STUDIO_VOICES } from './constants/voices';
import {
  ActiveAudioTrack,
  AppTab,
  GenerationRecord,
  StudioModel,
  StudioVoice,
} from './types';
import TopBar from './components/TopBar';
import VoiceSidebar from './components/VoiceSidebar';
import TtsStudioWorkspace from './components/TtsStudioWorkspace';
import VoiceLibraryView from './components/VoiceLibraryView';
import HistoryView from './components/HistoryView';
import PlansView from './components/PlansView';
import AudioPlayerBar from './components/AudioPlayerBar';
import AiCastingModal from './components/AiCastingModal';
import { AlertCircle, X } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class StudioErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error?.message || 'Unexpected application error' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#131314] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-[#1E1F20] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Something went wrong
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-[#1A73E8] text-white text-sm font-medium"
            >
              Reload Studio
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const StudioShell: React.FC = () => {
  const { effectiveTier, authError, clearAuthError } = useAuth();

  const [activeTab, setActiveTab] = useState<AppTab>('studio');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('adio_theme') === 'dark';
    } catch {
      return false;
    }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [castingModalOpen, setCastingModalOpen] = useState(false);

  const defaultFreeVoice = STUDIO_VOICES.find((v) => !v.isPremium) || STUDIO_VOICES[0];
  const defaultSecondVoice =
    STUDIO_VOICES.find((v) => !v.isPremium && v.id !== defaultFreeVoice.id) || STUDIO_VOICES[1];

  const [selectedVoice, setSelectedVoice] = useState<StudioVoice>(defaultFreeVoice);
  const [secondVoice, setSecondVoice] = useState<StudioVoice>(defaultSecondVoice);
  const [scriptText, setScriptText] = useState<string>(defaultFreeVoice.sampleScript);
  const [secondScriptText, setSecondScriptText] = useState<string>(
    'Yes! Notice how natural the breath and conversational cadence sound together.'
  );
  const [stylePrompt, setStylePrompt] = useState<string>('');
  const [language, setLanguage] = useState<string>('Auto');
  const [isMultiSpeaker, setIsMultiSpeaker] = useState<boolean>(false);
  const [model, setModel] = useState<StudioModel>('gemini-3.8-flash-lite-tts');
  const [activeTrack, setActiveTrack] = useState<ActiveAudioTrack | null>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('adio_theme', isDarkMode ? 'dark' : 'light');
    } catch {}
  }, [isDarkMode]);

  const handleLoadFromHistory = (record: GenerationRecord) => {
    const matchedVoice = STUDIO_VOICES.find((v) => v.id === record.voiceId);
    if (matchedVoice && (!matchedVoice.isPremium || effectiveTier === 'pro')) {
      setSelectedVoice(matchedVoice);
    }
    setScriptText(record.text);
    setStylePrompt(record.stylePrompt || '');
    setLanguage(record.language || 'Auto');
    setModel(
      record.model === 'gemini-3.8-flash-tts' && effectiveTier === 'pro'
        ? 'gemini-3.8-flash-tts'
        : 'gemini-3.8-flash-lite-tts'
    );
    setIsMultiSpeaker(false);
    setActiveTab('studio');
  };

  const handleApplyRecommendation = (
    voice: StudioVoice,
    nextStyle: string,
    sampleScript: string
  ) => {
    setSelectedVoice(voice);
    setStylePrompt(nextStyle);
    if (sampleScript) setScriptText(sampleScript);
    if (voice.language && voice.language !== 'English') {
      setLanguage(voice.language);
    }
    setActiveTab('studio');
  };

  const mobileTabs: { id: AppTab; label: string }[] = [
    { id: 'studio', label: 'Studio' },
    { id: 'library', label: 'Voices' },
    { id: 'history', label: 'History' },
    { id: 'plans', label: 'Plans' },
  ];

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#F8F9FA] dark:bg-[#131314] text-zinc-900 dark:text-zinc-100">
      <TopBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode((d) => !d)}
        onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
      />

      {/* Mobile Navigation Sub-Strip */}
      <nav
        className="md:hidden shrink-0 h-11 bg-white dark:bg-[#1E1F20] border-b border-zinc-200 dark:border-zinc-800 px-2 flex items-center justify-around"
        aria-label="Mobile navigation"
      >
        {mobileTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-blue-50 dark:bg-blue-950/40 text-[#1A73E8] dark:text-[#8AB4F8]'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Auth Error Banner */}
      {authError && (
        <div className="shrink-0 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900 px-4 py-2 flex items-center justify-between gap-3 text-xs text-red-700 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{authError}</span>
          </div>
          <button type="button" onClick={clearAuthError} aria-label="Dismiss alert">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {activeTab === 'studio' && (
          <>
            <VoiceSidebar
              selectedVoice={selectedVoice}
              onSelectVoice={(v) => setSelectedVoice(v)}
              effectiveTier={effectiveTier}
              onRequestUpgrade={() => setActiveTab('plans')}
              mobileOpen={mobileSidebarOpen}
              onCloseMobile={() => setMobileSidebarOpen(false)}
            />
            <TtsStudioWorkspace
              selectedVoice={selectedVoice}
              onSelectVoice={setSelectedVoice}
              secondVoice={secondVoice}
              onSelectSecondVoice={setSecondVoice}
              scriptText={scriptText}
              onScriptTextChange={setScriptText}
              secondScriptText={secondScriptText}
              onSecondScriptTextChange={setSecondScriptText}
              stylePrompt={stylePrompt}
              onStylePromptChange={setStylePrompt}
              language={language}
              onLanguageChange={setLanguage}
              isMultiSpeaker={isMultiSpeaker}
              onToggleMultiSpeaker={setIsMultiSpeaker}
              model={model}
              onModelChange={setModel}
              onAudioGenerated={setActiveTrack}
              onOpenAiCasting={() => setCastingModalOpen(true)}
              onOpenPlans={() => setActiveTab('plans')}
            />
          </>
        )}

        {activeTab === 'library' && (
          <VoiceLibraryView
            selectedVoiceId={selectedVoice.id}
            effectiveTier={effectiveTier}
            onUseVoice={(v) => {
              setSelectedVoice(v);
              setActiveTab('studio');
            }}
            onRequestUpgrade={() => setActiveTab('plans')}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            onPlayTrack={setActiveTrack}
            onLoadIntoStudio={handleLoadFromHistory}
            onGoToStudio={() => setActiveTab('studio')}
          />
        )}

        {activeTab === 'plans' && <PlansView onBackToStudio={() => setActiveTab('studio')} />}
      </div>

      {/* Persistent Bottom Audio Player */}
      <AudioPlayerBar track={activeTrack} onClose={() => setActiveTrack(null)} />

      {/* AI Voice Match Modal */}
      {castingModalOpen && (
        <AiCastingModal
          effectiveTier={effectiveTier}
          onApplyRecommendation={handleApplyRecommendation}
          onOpenPlans={() => setActiveTab('plans')}
          onClose={() => setCastingModalOpen(false)}
        />
      )}
    </div>
  );
};

const App: React.FC = () => (
  <StudioErrorBoundary>
    <AuthProvider>
      <StudioShell />
    </AuthProvider>
  </StudioErrorBoundary>
);

export default App;