/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Search, Play, Square, Loader2, Lock, ArrowRight } from 'lucide-react';
import { StudioVoice, VoiceCategory } from '../types';
import { STUDIO_VOICES, VOICE_CATEGORIES } from '../constants/voices';
import { getVoicePreviewUrl } from '../utils/audioUtils';

interface VoiceLibraryViewProps {
  selectedVoiceId: string;
  effectiveTier: 'guest' | 'free' | 'pro';
  onUseVoice: (voice: StudioVoice) => void;
  onRequestUpgrade: () => void;
}

const VoiceLibraryView: React.FC<VoiceLibraryViewProps> = ({
  selectedVoiceId,
  effectiveTier,
  onUseVoice,
  onRequestUpgrade,
}) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'All' | VoiceCategory>('All');
  const [languageFilter, setLanguageFilter] = useState('All');
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const uniqueLanguages = useMemo(
    () => Array.from(new Set(STUDIO_VOICES.map((v) => v.language))).sort(),
    []
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return STUDIO_VOICES.filter((v) => {
      if (category !== 'All' && v.category !== category) return false;
      if (languageFilter !== 'All' && v.language !== languageFilter) return false;
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.toneTag.toLowerCase().includes(q) ||
        v.language.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q)
      );
    });
  }, [search, category, languageFilter]);

  const handlePreview = async (voice: StudioVoice) => {
    setError(null);
    if (previewingId === voice.id) {
      audioRef.current?.pause();
      setPreviewingId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setLoadingId(voice.id);
    try {
      const url = await getVoicePreviewUrl(voice);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPreviewingId(null);
      await audio.play();
      setPreviewingId(voice.id);
    } catch (err: any) {
      setError(err?.message || 'Unable to load preview.');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto studio-scrollbar p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Voice Library
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 tabular-nums">
              {STUDIO_VOICES.length} human-like voices across 11 categories ·{' '}
              {STUDIO_VOICES.filter((v) => !v.isPremium).length} free voices included
            </p>
          </div>

          {/* Search & Language Filter */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search voices..."
                className="pl-8 pr-3 py-2 text-sm rounded-lg bg-white dark:bg-[#1E1F20] border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#1A73E8] w-56"
              />
            </div>

            <select
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
              aria-label="Filter by language"
              className="py-2 px-3 text-sm rounded-lg bg-white dark:bg-[#1E1F20] border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-[#1A73E8]"
            >
              <option value="All">All Languages</option>
              {uniqueLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Interactive Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setCategory('All')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              category === 'All'
                ? 'bg-[#1A73E8] text-white'
                : 'bg-white dark:bg-[#1E1F20] border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
          >
            All ({STUDIO_VOICES.length})
          </button>
          {VOICE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                category === cat.id
                  ? 'bg-[#1A73E8] text-white'
                  : 'bg-white dark:bg-[#1E1F20] border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              {cat.shortLabel}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {/* Voice Grid */}
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-[#1E1F20] border border-zinc-200 dark:border-zinc-800 rounded-xl p-12 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No voices match your filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategory('All');
                setLanguageFilter('All');
              }}
              className="mt-3 px-4 py-2 rounded-lg bg-[#1A73E8] text-white text-xs font-medium"
            >
              Show All Voices
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((voice) => {
              const isLocked = voice.isPremium && effectiveTier !== 'pro';
              const isPreviewing = previewingId === voice.id;
              const isLoading = loadingId === voice.id;
              const isSelected = selectedVoiceId === voice.id;

              return (
                <div
                  key={voice.id}
                  className={`bg-white dark:bg-[#1E1F20] border rounded-xl p-4 flex flex-col justify-between gap-4 transition-colors ${
                    isSelected
                      ? 'border-[#1A73E8] dark:border-[#8AB4F8]'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {voice.name}
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {voice.category} · {voice.language} · {voice.gender}
                        </p>
                      </div>

                      {isLocked ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 shrink-0">
                          <Lock size={12} />
                          <span>Pro</span>
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 shrink-0">
                          {voice.isPremium ? 'Pro' : 'Free'}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-2.5 leading-relaxed line-clamp-2">
                      {voice.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => handlePreview(voice)}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      {isLoading ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : isPreviewing ? (
                        <Square size={11} className="fill-current text-[#1A73E8]" />
                      ) : (
                        <Play size={12} className="fill-current" />
                      )}
                      <span>{isPreviewing ? 'Stop' : 'Preview'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => (isLocked ? onRequestUpgrade() : onUseVoice(voice))}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                        isLocked
                          ? 'bg-zinc-100 dark:bg-[#28292A] text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                          : 'bg-[#1A73E8] hover:bg-[#1557B0] text-white'
                      }`}
                    >
                      <span>{isLocked ? 'Unlock Pro' : 'Use in Studio'}</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceLibraryView;
