/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Play,
  Sparkles,
  Loader2,
  AlertCircle,
  Users,
  User,
  Lock,
  Wand2,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import {
  ActiveAudioTrack,
  StudioModel,
  StudioVoice,
} from '../types';
import {
  SAMPLE_SCRIPTS,
  STUDIO_LANGUAGES,
  STUDIO_VOICES,
  TIER_LIMITS,
} from '../constants/voices';
import { useAuth } from '../contexts/AuthContext';
import { saveAudioClip } from '../services/audioCache';

interface TtsStudioWorkspaceProps {
  selectedVoice: StudioVoice;
  onSelectVoice: (voice: StudioVoice) => void;
  secondVoice: StudioVoice;
  onSelectSecondVoice: (voice: StudioVoice) => void;
  scriptText: string;
  onScriptTextChange: (val: string) => void;
  secondScriptText: string;
  onSecondScriptTextChange: (val: string) => void;
  stylePrompt: string;
  onStylePromptChange: (val: string) => void;
  language: string;
  onLanguageChange: (val: string) => void;
  isMultiSpeaker: boolean;
  onToggleMultiSpeaker: (val: boolean) => void;
  model: StudioModel;
  onModelChange: (val: StudioModel) => void;
  onAudioGenerated: (track: ActiveAudioTrack) => void;
  onOpenAiCasting: () => void;
  onOpenPlans: () => void;
}

const VOCAL_TAGS = ['<breath>', '<laugh>', '<gasp>', '|yeah|', '|mhm|'];

const TtsStudioWorkspace: React.FC<TtsStudioWorkspaceProps> = ({
  selectedVoice,
  onSelectVoice,
  secondVoice,
  onSelectSecondVoice,
  scriptText,
  onScriptTextChange,
  secondScriptText,
  onSecondScriptTextChange,
  stylePrompt,
  onStylePromptChange,
  language,
  onLanguageChange,
  isMultiSpeaker,
  onToggleMultiSpeaker,
  model,
  onModelChange,
  onAudioGenerated,
  onOpenAiCasting,
  onOpenPlans,
}) => {
  const {
    user,
    effectiveTier,
    dailyUsed,
    dailyLimit,
    maxCharacters,
    signInWithGoogle,
    recordGeneration,
  } = useAuth();

  const [firstSpeakerName, setFirstSpeakerName] = useState('Alex');
  const [secondSpeakerName, setSecondSpeakerName] = useState('Sam');
  const [secondStylePrompt, setSecondStylePrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const totalChars = isMultiSpeaker
    ? scriptText.length + secondScriptText.length
    : scriptText.length;
  const isOverCharLimit = totalChars > maxCharacters;
  const isOverQuota = dailyUsed >= dailyLimit;
  const canUseProFeatures = effectiveTier === 'pro';

  const handleApplyPreset = (preset: (typeof SAMPLE_SCRIPTS)[number]) => {
    setError(null);
    setStatusNotice(null);
    onScriptTextChange(preset.text);
    onStylePromptChange(preset.stylePrompt);
    onLanguageChange(preset.language);

    if (preset.isMultiSpeaker && canUseProFeatures) {
      onToggleMultiSpeaker(true);
      onModelChange('gemini-3.8-flash-tts');
      if (preset.secondText) onSecondScriptTextChange(preset.secondText);
    } else {
      onToggleMultiSpeaker(false);
    }

    // Automatically match a suitable free/available voice for that preset/language
    if (preset.id === 'yt-kids-cartoon') {
      const kidVoice = STUDIO_VOICES.find((v) => v.id === 'milo-yt-boy');
      if (kidVoice) onSelectVoice(kidVoice);
    } else if (preset.id === 'urdu-kids-cartoon') {
      const urduKidVoice = STUDIO_VOICES.find((v) => v.id === 'chotu-urdu-kid');
      if (urduKidVoice) onSelectVoice(urduKidVoice);
    } else if (preset.language === 'Urdu') {
      const urduVoice = STUDIO_VOICES.find(
        (v) => v.language === 'Urdu' && (!v.isPremium || canUseProFeatures)
      );
      if (urduVoice) onSelectVoice(urduVoice);
    } else if (preset.language === 'Hindi') {
      const hindiVoice = STUDIO_VOICES.find(
        (v) => v.language === 'Hindi' && (!v.isPremium || canUseProFeatures)
      );
      if (hindiVoice) onSelectVoice(hindiVoice);
    } else if (preset.language === 'Arabic') {
      const arabicVoice = STUDIO_VOICES.find(
        (v) => v.language === 'Arabic' && (!v.isPremium || canUseProFeatures)
      );
      if (arabicVoice) onSelectVoice(arabicVoice);
    }
  };

  const handleInsertTag = (tag: string) => {
    const separator = scriptText && !scriptText.endsWith(' ') ? ' ' : '';
    onScriptTextChange(`${scriptText}${separator}${tag} `);
  };

  const handleModeSwitch = (multi: boolean) => {
    if (multi && !canUseProFeatures) {
      onOpenPlans();
      return;
    }
    onToggleMultiSpeaker(multi);
    if (multi) {
      onModelChange('gemini-3.8-flash-tts');
    }
  };

  const handleModelSelect = (nextModel: StudioModel) => {
    if (nextModel === 'gemini-3.8-flash-tts' && !canUseProFeatures) {
      onOpenPlans();
      return;
    }
    onModelChange(nextModel);
  };

  const handleGenerate = async () => {
    setError(null);
    setStatusNotice(null);

    if (!scriptText.trim()) {
      setError('Please enter a script to synthesize.');
      return;
    }

    if (isMultiSpeaker && !secondScriptText.trim()) {
      setError('Please enter dialogue text for Speaker 2 or switch to Single Speaker.');
      return;
    }

    if (selectedVoice.isPremium && !canUseProFeatures) {
      setError('This voice requires Pro Studio. Choose a Free voice or activate Pro Studio.');
      return;
    }

    if (isOverCharLimit) {
      setError(
        `Your script (${totalChars.toLocaleString()} chars) exceeds your ${TIER_LIMITS[effectiveTier].name} limit of ${maxCharacters.toLocaleString()} characters.`
      );
      return;
    }

    if (isOverQuota) {
      setError(
        user
          ? `You have reached your daily quota of ${dailyLimit} generations. Upgrade to Pro Studio for 200/day.`
          : `You have used all ${dailyLimit} guest previews. Sign in with Google for 15 free daily generations.`
      );
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: scriptText.trim(),
          stylePrompt: stylePrompt.trim() || selectedVoice.styleInstruction,
          voiceName: selectedVoice.prebuiltVoiceName,
          secondVoiceName: secondVoice.prebuiltVoiceName,
          firstSpeakerName,
          secondSpeakerName,
          secondSpeakerText: secondScriptText.trim(),
          secondSpeakerStyle: secondStylePrompt.trim() || secondVoice.styleInstruction,
          isMultiSpeaker,
          model,
          language,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.audioBase64) {
        throw new Error(data.error || 'Speech synthesis failed. Please try again.');
      }

      const genId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      await saveAudioClip(genId, data.audioBase64);

      const displayVoiceName = isMultiSpeaker
        ? `${selectedVoice.name} + ${secondVoice.name}`
        : selectedVoice.name;

      await recordGeneration({
        id: genId,
        text: isMultiSpeaker
          ? `${firstSpeakerName}: ${scriptText.trim()}\n${secondSpeakerName}: ${secondScriptText.trim()}`
          : scriptText.trim(),
        stylePrompt: stylePrompt.trim() || selectedVoice.styleInstruction,
        voiceId: selectedVoice.id,
        voiceName: displayVoiceName,
        secondVoiceId: isMultiSpeaker ? secondVoice.id : undefined,
        secondVoiceName: isMultiSpeaker ? secondVoice.name : undefined,
        isMultiSpeaker,
        category: selectedVoice.category,
        language,
        model: data.model || model,
        charCount: totalChars,
        durationSec: data.durationSec || 0,
      });

      onAudioGenerated({
        id: genId,
        title: scriptText.trim().slice(0, 60),
        voiceName: displayVoiceName,
        category: selectedVoice.category,
        language,
        model: data.model || model,
        durationSec: data.durationSec || 0,
        wavBase64: data.audioBase64,
        createdAtMs: Date.now(),
      });

      setStatusNotice('Audio generated and ready to play below.');
    } catch (err: any) {
      setError(err?.message || 'Failed to synthesize audio. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto studio-scrollbar p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Studio Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Text-to-Speech Workbench
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              Synthesize lifelike human speech with breath, pacing, and multilingual clarity.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onOpenAiCasting}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#1E1F20] hover:bg-zinc-50 dark:hover:bg-[#28292A] text-sm font-medium text-zinc-800 dark:text-zinc-100 transition-colors whitespace-nowrap shrink-0"
            >
              <Wand2 size={15} className="text-[#1A73E8] dark:text-[#8AB4F8]" />
              <span>AI Voice Match</span>
            </button>
          </div>
        </div>

        {/* Configuration Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white dark:bg-[#1E1F20] p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
          {/* Speaker Mode */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
              Speaker Mode
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-[#131314] border border-zinc-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => handleModeSwitch(false)}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  !isMultiSpeaker
                    ? 'bg-white dark:bg-[#28292A] text-zinc-900 dark:text-zinc-100 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <User size={13} />
                <span>Single</span>
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch(true)}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  isMultiSpeaker
                    ? 'bg-white dark:bg-[#28292A] text-zinc-900 dark:text-zinc-100 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <Users size={13} />
                <span>Dual</span>
                {!canUseProFeatures && <Lock size={11} className="text-amber-500" />}
              </button>
            </div>
          </div>

          {/* Model Selector */}
          <div>
            <label
              htmlFor="tts-model-select"
              className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5"
            >
              TTS Model
            </label>
            <select
              id="tts-model-select"
              value={model}
              onChange={(e) => handleModelSelect(e.target.value as StudioModel)}
              className="w-full py-2 px-3 rounded-lg bg-zinc-50 dark:bg-[#131314] border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#1A73E8]"
            >
              <option value="gemini-3.8-flash-lite-tts">
                gemini-3.8-flash-lite-tts (Fast Studio)
              </option>
              <option value="gemini-3.8-flash-tts">
                gemini-3.8-flash-tts {canUseProFeatures ? '(Expressive & Dual)' : '(Pro)'}
              </option>
            </select>
          </div>

          {/* Language Selector */}
          <div>
            <label
              htmlFor="tts-lang-select"
              className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5"
            >
              Language & Accent
            </label>
            <select
              id="tts-lang-select"
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="w-full py-2 px-3 rounded-lg bg-zinc-50 dark:bg-[#131314] border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#1A73E8]"
            >
              {STUDIO_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Voice Selection Summary */}
        <div className="bg-white dark:bg-[#1E1F20] p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Primary Voice */}
            <div>
              <label
                htmlFor="primary-voice-select"
                className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5"
              >
                {isMultiSpeaker ? 'Speaker 1 Voice' : 'Selected Voice'}
              </label>
              <select
                id="primary-voice-select"
                value={selectedVoice.id}
                onChange={(e) => {
                  const found = STUDIO_VOICES.find((v) => v.id === e.target.value);
                  if (!found) return;
                  if (found.isPremium && !canUseProFeatures) {
                    onOpenPlans();
                    return;
                  }
                  onSelectVoice(found);
                }}
                className="w-full py-2 px-3 rounded-lg bg-zinc-50 dark:bg-[#131314] border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#1A73E8]"
              >
                {STUDIO_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} — {v.category} ({v.language}){v.isPremium && !canUseProFeatures ? ' [Pro]' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
                {selectedVoice.toneTag} · {selectedVoice.gender} · {selectedVoice.pitch} Pitch
              </p>
            </div>

            {/* Secondary Voice when Dual-Speaker is active */}
            {isMultiSpeaker ? (
              <div>
                <label
                  htmlFor="second-voice-select"
                  className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5"
                >
                  Speaker 2 Voice
                </label>
                <select
                  id="second-voice-select"
                  value={secondVoice.id}
                  onChange={(e) => {
                    const found = STUDIO_VOICES.find((v) => v.id === e.target.value);
                    if (found) onSelectSecondVoice(found);
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-zinc-50 dark:bg-[#131314] border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#1A73E8]"
                >
                  {STUDIO_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} — {v.category} ({v.language})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
                  {secondVoice.toneTag} · {secondVoice.gender} · {secondVoice.pitch} Pitch
                </p>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="style-prompt-input"
                  className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5"
                >
                  Style & Emotion Prompt (Optional)
                </label>
                <input
                  id="style-prompt-input"
                  type="text"
                  dir="auto"
                  maxLength={500}
                  value={stylePrompt}
                  onChange={(e) => onStylePromptChange(e.target.value)}
                  placeholder="e.g. Read warmly with natural pauses / خوشی سے پڑھیں"
                  className="w-full py-2 px-3 rounded-lg bg-zinc-50 dark:bg-[#131314] border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-[#1A73E8]"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
                  Guide pacing, emotion, accent, or energy in any language.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Script Editor Card */}
        <div className="bg-white dark:bg-[#1E1F20] rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {/* Sample Preset Bar */}
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mr-1">
                Presets:
              </span>
              {SAMPLE_SCRIPTS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-100 dark:bg-[#28292A] hover:bg-blue-50 dark:hover:bg-blue-950/40 text-zinc-700 dark:text-zinc-200 hover:text-[#1A73E8] dark:hover:text-[#8AB4F8] transition-colors whitespace-nowrap"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                onScriptTextChange('');
                onSecondScriptTextChange('');
                onStylePromptChange('');
                setError(null);
                setStatusNotice(null);
              }}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 flex items-center gap-1 whitespace-nowrap"
            >
              <RotateCcw size={12} />
              <span>Clear</span>
            </button>
          </div>

          {/* Textarea(s) */}
          <div className="p-4 space-y-4">
            {isMultiSpeaker ? (
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={firstSpeakerName}
                      onChange={(e) => setFirstSpeakerName(e.target.value)}
                      aria-label="Speaker 1 name"
                      className="text-xs font-semibold px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-[#131314] border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 w-36"
                    />
                    <input
                      type="text"
                      value={stylePrompt}
                      onChange={(e) => onStylePromptChange(e.target.value)}
                      placeholder="Speaker 1 style direction..."
                      className="flex-1 text-xs px-2.5 py-1 rounded-md bg-zinc-50 dark:bg-[#131314] border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200"
                    />
                  </div>
                  <textarea
                    rows={4}
                    dir="auto"
                    value={scriptText}
                    onChange={(e) => onScriptTextChange(e.target.value)}
                    placeholder="Enter Speaker 1 lines... Use <breath>, <laugh>, or |mhm| for natural dialogue."
                    className="w-full p-3 rounded-lg bg-zinc-50 dark:bg-[#131314] border border-zinc-200 dark:border-zinc-700 text-sm sm:text-base leading-relaxed text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-[#1A73E8] resize-y"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={secondSpeakerName}
                      onChange={(e) => setSecondSpeakerName(e.target.value)}
                      aria-label="Speaker 2 name"
                      className="text-xs font-semibold px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-[#131314] border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 w-36"
                    />
                    <input
                      type="text"
                      value={secondStylePrompt}
                      onChange={(e) => setSecondStylePrompt(e.target.value)}
                      placeholder="Speaker 2 style direction..."
                      className="flex-1 text-xs px-2.5 py-1 rounded-md bg-zinc-50 dark:bg-[#131314] border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200"
                    />
                  </div>
                  <textarea
                    rows={4}
                    dir="auto"
                    value={secondScriptText}
                    onChange={(e) => onSecondScriptTextChange(e.target.value)}
                    placeholder="Enter Speaker 2 reply..."
                    className="w-full p-3 rounded-lg bg-zinc-50 dark:bg-[#131314] border border-zinc-200 dark:border-zinc-700 text-sm sm:text-base leading-relaxed text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-[#1A73E8] resize-y"
                  />
                </div>
              </div>
            ) : (
              <textarea
                rows={7}
                dir="auto"
                value={scriptText}
                onChange={(e) => onScriptTextChange(e.target.value)}
                placeholder="Type or paste your script in Urdu, English, Hindi, Arabic, or any supported language..."
                className="w-full p-3.5 rounded-lg bg-zinc-50 dark:bg-[#131314] border border-zinc-200 dark:border-zinc-700 text-base leading-relaxed text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-[#1A73E8] resize-y"
              />
            )}

            {/* Expressive Tags Toolbar (gemini-3.8-flash-tts) */}
            {model === 'gemini-3.8-flash-tts' && (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Natural vocal cues:
                </span>
                {VOCAL_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleInsertTag(tag)}
                    className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-[#28292A] border border-zinc-200 dark:border-zinc-700 text-xs font-mono text-zinc-700 dark:text-zinc-300 hover:border-[#1A73E8] transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Loading Progress Bar */}
          {isGenerating && (
            <div className="h-1 w-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div className="h-full w-full google-gradient-bar" />
            </div>
          )}

          {/* Footer Action Row */}
          <div className="px-4 py-3.5 bg-zinc-50/70 dark:bg-[#131314]/60 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
              <span
                className={
                  isOverCharLimit
                    ? 'text-red-600 dark:text-red-400 font-semibold'
                    : 'text-zinc-500 dark:text-zinc-400'
                }
              >
                {totalChars.toLocaleString()} / {maxCharacters.toLocaleString()} chars
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <span
                className={
                  isOverQuota
                    ? 'text-amber-600 dark:text-amber-400 font-semibold'
                    : 'text-zinc-500 dark:text-zinc-400'
                }
              >
                {dailyUsed} / {dailyLimit} generations {user ? 'today' : 'guest'}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              {!user && (
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-[#28292A] transition-colors whitespace-nowrap"
                >
                  Sign in for History & 15/day
                </button>
              )}

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || !scriptText.trim()}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors shadow-sm whitespace-nowrap shrink-0"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Generating Audio...</span>
                  </>
                ) : (
                  <>
                    <Play size={15} className="fill-current" />
                    <span>Generate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Inline Error or Status Feedback */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300"
          >
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{error}</p>
              {(isOverQuota || isOverCharLimit || selectedVoice.isPremium) &&
                effectiveTier !== 'pro' && (
                  <button
                    type="button"
                    onClick={onOpenPlans}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold underline hover:no-underline"
                  >
                    <Sparkles size={13} />
                    <span>View Pro Studio Plan</span>
                  </button>
                )}
            </div>
          </div>
        )}

        {statusNotice && !error && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 text-sm text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{statusNotice}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TtsStudioWorkspace;
