/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Search, Play, Square, Loader2, Lock, X, Check } from 'lucide-react';
import { StudioVoice, VoiceCategory } from '../types';
import { STUDIO_VOICES, VOICE_CATEGORIES } from '../constants/voices';
import { getVoicePreviewUrl } from '../utils/audioUtils';

interface VoiceSidebarProps {
  selectedVoice: StudioVoice;
  onSelectVoice: (voice: StudioVoice) => void;
  effectiveTier: 'guest' | 'free' | 'pro';
  onRequestUpgrade: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const VoiceSidebar: React.FC<VoiceSidebarProps> = ({
  selectedVoice,
  onSelectVoice,
  effectiveTier,
  onRequestUpgrade,
  mobileOpen,
  onCloseMobile,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | VoiceCategory>('All');
  const [tierFilter, setTierFilter] = useState<'All' | 'Free' | 'Pro'>('All');
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const filteredVoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return STUDIO_VOICES.filter((v) => {
      if (categoryFilter !== 'All' && v.category !== categoryFilter) return false;
      if (tierFilter === 'Free' && v.isPremium) return false;
      if (tierFilter === 'Pro' && !v.isPremium) return false;
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q) ||
        v.language.toLowerCase().includes(q) ||
        v.toneTag.toLowerCase().includes(q)
      );
    });
  }, [search, categoryFilter, tierFilter]);

  const stopPreview = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPreviewingId(null);
  };

  const handlePreview = async (e: React.MouseEvent, voice: StudioVoice) => {
    e.stopPropagation();
    setPreviewError(null);

    if (previewingId === voice.id) {
      stopPreview();
      return;
    }

    stopPreview();
    setLoadingPreviewId(voice.id);
    try {
      const url = await getVoicePreviewUrl(voice);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPreviewingId(null);
      audio.onerror = () => {
        setPreviewingId(null);
        setPreviewError('Preview failed to play.');
      };
      await audio.play();
      setPreviewingId(voice.id);
    } catch (err: any) {
      setPreviewError(err?.message || 'Unable to load preview');
    } finally {
      setLoadingPreviewId(null);
    }
  };

  const handleVoiceClick = (voice: StudioVoice) => {
    const isLocked = voice.isPremium && effectiveTier !== 'pro';
    if (isLocked) {
      onRequestUpgrade();
      return;
    }
    onSelectVoice(voice);
    onCloseMobile();
  };

  const sidebarBody = (
    <div className="flex flex-col h-full bg-white dark:bg-[#1E1F20] border-r border-zinc-200 dark:border-zinc-800">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Voice Cast
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums mt-0.5">
              {filteredVoices.length} of {STUDIO_VOICES.length} voices
            </p>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Close voice directory"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search voice, mood, language..."
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg bg-zinc-50 dark:bg-[#131314] border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-[#1A73E8] dark:focus:border-[#8AB4F8]"
          />
        </div>

        {/* Category Dropdown + Tier Filter */}
        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'All' | VoiceCategory)}
            aria-label="Filter voices by category"
            className="flex-1 min-w-0 py-1.5 px-2.5 text-xs font-medium rounded-lg bg-zinc-50 dark:bg-[#131314] border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 focus:outline-none focus:border-[#1A73E8]"
          >
            <option value="All">All Categories (11)</option>
            {VOICE_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>

          <div className="flex bg-zinc-100 dark:bg-[#131314] p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shrink-0">
            {(['All', 'Free', 'Pro'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTierFilter(t)}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                  tierFilter === t
                    ? 'bg-white dark:bg-[#28292A] text-zinc-900 dark:text-zinc-100 shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {previewError && (
          <p className="text-xs text-red-600 dark:text-red-400">{previewError}</p>
        )}
      </div>

      {/* Voices Scroll List */}
      <div className="flex-1 overflow-y-auto studio-scrollbar divide-y divide-zinc-100 dark:divide-zinc-800/70">
        {filteredVoices.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">No matching voices found.</p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategoryFilter('All');
                setTierFilter('All');
              }}
              className="mt-3 text-xs font-medium text-[#1A73E8] dark:text-[#8AB4F8] hover:underline"
            >
              Reset filters
            </button>
          </div>
        ) : (
          filteredVoices.map((voice) => {
            const isSelected = selectedVoice.id === voice.id;
            const isLocked = voice.isPremium && effectiveTier !== 'pro';
            const isPreviewing = previewingId === voice.id;
            const isLoadingPreview = loadingPreviewId === voice.id;

            return (
              <div
                key={voice.id}
                onClick={() => handleVoiceClick(voice)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleVoiceClick(voice);
                  }
                }}
                className={`px-4 py-3 cursor-pointer transition-colors flex items-start justify-between gap-2.5 ${
                  isSelected
                    ? 'bg-blue-50/70 dark:bg-blue-950/30'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-sm font-medium truncate ${
                        isSelected
                          ? 'text-[#1A73E8] dark:text-[#8AB4F8]'
                          : 'text-zinc-900 dark:text-zinc-100'
                      }`}
                    >
                      {voice.name}
                    </span>
                    {isSelected && (
                      <Check size={14} className="text-[#1A73E8] dark:text-[#8AB4F8] shrink-0" />
                    )}
                    {isLocked && (
                      <Lock
                        size={12}
                        className="text-amber-600 dark:text-amber-400 shrink-0"
                        aria-label="Pro voice"
                      />
                    )}
                  </div>

                  {/* Clean unboxed metadata */}
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                    <span>{voice.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{voice.language}</span>
                    <span aria-hidden="true">·</span>
                    <span>{voice.gender}</span>
                  </div>

                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                    {voice.description}
                  </p>
                </div>

                {/* Preview Button */}
                <button
                  type="button"
                  onClick={(e) => handlePreview(e, voice)}
                  disabled={isLoadingPreview}
                  aria-label={isPreviewing ? `Stop ${voice.name} preview` : `Preview ${voice.name}`}
                  title={isPreviewing ? 'Stop preview' : 'Preview voice'}
                  className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border transition-colors ${
                    isPreviewing
                      ? 'bg-[#1A73E8] border-[#1A73E8] text-white'
                      : 'bg-white dark:bg-[#28292A] border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-[#1A73E8] hover:text-[#1A73E8]'
                  }`}
                >
                  {isLoadingPreview ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : isPreviewing ? (
                    <Square size={11} className="fill-current" />
                  ) : (
                    <Play size={12} className="fill-current ml-0.5" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-80 shrink-0 h-full overflow-hidden">
        {sidebarBody}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative w-80 max-w-[88vw] h-full z-10 shadow-2xl">
            {sidebarBody}
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceSidebar;
