/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Check, Loader2, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { STUDIO_VOICES, TIER_LIMITS } from '../constants/voices';

const PlansView: React.FC<{ onBackToStudio: () => void }> = ({ onBackToStudio }) => {
  const { user, effectiveTier, dailyUsed, dailyLimit, switchPlanTier, signInWithGoogle } = useAuth();
  const [updating, setUpdating] = useState(false);

  const freeCount = STUDIO_VOICES.filter((v) => !v.isPremium).length;
  const totalCount = STUDIO_VOICES.length;

  const handleSwitch = async (target: 'free' | 'pro') => {
    setUpdating(true);
    try {
      await switchPlanTier(target);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto studio-scrollbar p-4 sm:p-6 lg:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Studio Tiers & Limits
          </h1>
          <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400">
            Start free across every voice category, or unlock all {totalCount} voices, dual-speaker podcasting, and 5,000-character scripts.
          </p>
          {user && (
            <p className="text-xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400 pt-1">
              Current usage today: {dailyUsed} / {dailyLimit} generations
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Starter Free */}
          <div
            className={`bg-white dark:bg-[#1E1F20] rounded-xl border p-6 flex flex-col justify-between ${
              effectiveTier === 'free'
                ? 'border-[#1A73E8] dark:border-[#8AB4F8]'
                : 'border-zinc-200 dark:border-zinc-800'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Starter Free
                </h2>
                <span className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                  $0 / mo
                </span>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                For testing scripts, previews, and everyday voiceovers.
              </p>

              <ul className="mt-6 space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="tabular-nums">
                    {TIER_LIMITS.free.dailyGenerations} voice generations per day
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="tabular-nums">
                    Up to {TIER_LIMITS.free.maxCharacters.toLocaleString()} characters per clip
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="tabular-nums">
                    {freeCount} core voices (Urdu, Hindi, Arabic, English)
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>gemini-3.8-flash-lite-tts & WAV download</span>
                </li>
              </ul>
            </div>

            <div className="mt-8">
              {!user ? (
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="w-full py-2.5 px-4 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center gap-2 transition-colors"
                >
                  <LogIn size={15} />
                  <span>Sign In for Free Tier</span>
                </button>
              ) : effectiveTier === 'free' ? (
                <button
                  type="button"
                  onClick={onBackToStudio}
                  className="w-full py-2.5 px-4 rounded-lg bg-zinc-100 dark:bg-[#28292A] text-sm font-medium text-zinc-900 dark:text-zinc-100"
                >
                  Active Plan — Return to Studio
                </button>
              ) : (
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => handleSwitch('free')}
                  className="w-full py-2.5 px-4 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Switch to Free
                </button>
              )}
            </div>
          </div>

          {/* Pro Studio */}
          <div
            className={`bg-white dark:bg-[#1E1F20] rounded-xl border p-6 flex flex-col justify-between ${
              effectiveTier === 'pro'
                ? 'border-[#1A73E8] dark:border-[#8AB4F8]'
                : 'border-zinc-200 dark:border-zinc-800'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Pro Studio
                </h2>
                <span className="font-mono text-sm font-semibold text-[#1A73E8] dark:text-[#8AB4F8] tabular-nums">
                  Studio Pass
                </span>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                For creators, podcasters, trailers, and multilingual production.
              </p>

              <ul className="mt-6 space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-[#1A73E8] dark:text-[#8AB4F8] shrink-0" />
                  <span className="tabular-nums">
                    {TIER_LIMITS.pro.dailyGenerations} voice generations per day
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-[#1A73E8] dark:text-[#8AB4F8] shrink-0" />
                  <span className="tabular-nums">
                    Up to {TIER_LIMITS.pro.maxCharacters.toLocaleString()} characters per clip
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-[#1A73E8] dark:text-[#8AB4F8] shrink-0" />
                  <span className="tabular-nums">
                    All {totalCount} Premium voices unlocked across 11 categories
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-[#1A73E8] dark:text-[#8AB4F8] shrink-0" />
                  <span>Dual-Speaker Podcast mode & gemini-3.8-flash-tts</span>
                </li>
              </ul>
            </div>

            <div className="mt-8">
              {!user ? (
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <LogIn size={15} />
                  <span>Sign In to Activate Pro</span>
                </button>
              ) : effectiveTier === 'pro' ? (
                <button
                  type="button"
                  onClick={onBackToStudio}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-sm font-medium transition-colors"
                >
                  Pro Active — Open Studio
                </button>
              ) : (
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => handleSwitch('pro')}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  {updating && <Loader2 size={15} className="animate-spin" />}
                  <span>Activate Pro Studio</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlansView;
