/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Wand2, Loader2, ArrowRight, Lock } from 'lucide-react';
import { CastingRecommendation, StudioVoice } from '../types';
import { STUDIO_VOICES } from '../constants/voices';

interface AiCastingModalProps {
  effectiveTier: 'guest' | 'free' | 'pro';
  onApplyRecommendation: (voice: StudioVoice, stylePrompt: string, sampleScript: string) => void;
  onOpenPlans: () => void;
  onClose: () => void;
}

const CASTING_EXAMPLES = [
  'Warm Urdu female storyteller for an evening radio tale',
  'Deep, suspenseful movie trailer narrator with slow dramatic pauses',
  'Energetic Hindi educational host explaining science clearly',
];

const AiCastingModal: React.FC<AiCastingModalProps> = ({
  effectiveTier,
  onApplyRecommendation,
  onOpenPlans,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CastingRecommendation | null>(null);

  const handleMatch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const voicesSummary = STUDIO_VOICES.map((v) => ({
        id: v.id,
        name: v.name,
        category: v.category,
        language: v.language,
        gender: v.gender,
        pitch: v.pitch,
        toneTag: v.toneTag,
        isPremium: v.isPremium,
      }));

      const res = await fetch('/api/tts/cast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), voicesSummary }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Voice matching failed.');
      }
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Unable to find matching voices.');
    } finally {
      setLoading(false);
    }
  };

  const matchedVoices = (result?.recommendedVoiceIds || [])
    .map((id) => STUDIO_VOICES.find((v) => v.id === id))
    .filter((v): v is StudioVoice => Boolean(v));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-cast-title"
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#1E1F20] border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Wand2 size={18} className="text-[#1A73E8] dark:text-[#8AB4F8]" />
            <h2 id="ai-cast-title" className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              AI Voice Match
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto studio-scrollbar">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Describe the mood, language, or character you need and Gemini will select the top 3 studio voices with a tailored style prompt.
          </p>

          <textarea
            rows={3}
            dir="auto"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. A calm, poetic Urdu narrator for a documentary about Lahore..."
            className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-[#131314] border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#1A73E8]"
          />

          <div className="flex flex-wrap gap-1.5">
            {CASTING_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setQuery(ex)}
                className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-[#28292A] text-xs text-zinc-700 dark:text-zinc-300 hover:text-[#1A73E8] transition-colors text-left"
              >
                {ex}
              </button>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleMatch}
              disabled={loading || !query.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
              <span>{loading ? 'Analyzing Catalog...' : 'Find Matching Voices'}</span>
            </button>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          {result && (
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{result.rationale}</p>

              <div className="space-y-2">
                {matchedVoices.map((voice) => {
                  const isLocked = voice.isPremium && effectiveTier !== 'pro';
                  return (
                    <div
                      key={voice.id}
                      className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#131314] border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {voice.name}
                          </span>
                          {isLocked && <Lock size={12} className="text-amber-500" />}
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {voice.category} · {voice.language} · {voice.toneTag}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (isLocked) {
                            onClose();
                            onOpenPlans();
                          } else {
                            onApplyRecommendation(voice, result.stylePrompt, result.sampleScript);
                            onClose();
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-medium flex items-center gap-1 shrink-0"
                      >
                        <span>{isLocked ? 'Unlock Pro' : 'Apply'}</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiCastingModal;
