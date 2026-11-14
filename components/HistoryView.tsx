/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Play,
  Download,
  Trash2,
  Loader2,
  LogIn,
  History as HistoryIcon,
  ArrowUpRight,
  AlertCircle,
} from 'lucide-react';
import { ActiveAudioTrack, GenerationRecord } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getAudioClip, saveAudioClip } from '../services/audioCache';
import { downloadWavBase64, formatTime } from '../utils/audioUtils';
import { STUDIO_VOICES } from '../constants/voices';

interface HistoryViewProps {
  onPlayTrack: (track: ActiveAudioTrack) => void;
  onLoadIntoStudio: (record: GenerationRecord) => void;
  onGoToStudio: () => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({
  onPlayTrack,
  onLoadIntoStudio,
  onGoToStudio,
}) => {
  const { user, history, historyLoading, signInWithGoogle, deleteGeneration } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolveAudioForRecord = async (record: GenerationRecord): Promise<string> => {
    const cached = await getAudioClip(record.id);
    if (cached) return cached;

    // Fallback: re-synthesize transparently if local IndexedDB cache was cleared or opened on another device
    const voiceObj = STUDIO_VOICES.find((v) => v.id === record.voiceId);
    const secondVoiceObj = record.secondVoiceId
      ? STUDIO_VOICES.find((v) => v.id === record.secondVoiceId)
      : undefined;

    const res = await fetch('/api/tts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: record.text,
        stylePrompt: record.stylePrompt,
        voiceName: voiceObj?.prebuiltVoiceName || 'Kore',
        secondVoiceName: secondVoiceObj?.prebuiltVoiceName || 'Puck',
        isMultiSpeaker: false,
        model: record.model,
        language: record.language,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.audioBase64) {
      throw new Error(data.error || 'Unable to load audio for this record.');
    }
    await saveAudioClip(record.id, data.audioBase64);
    return data.audioBase64;
  };

  const handlePlay = async (record: GenerationRecord) => {
    setError(null);
    setBusyId(record.id);
    try {
      const wavBase64 = await resolveAudioForRecord(record);
      onPlayTrack({
        id: record.id,
        title: record.text.slice(0, 60),
        voiceName: record.voiceName,
        category: record.category,
        language: record.language,
        model: record.model,
        durationSec: record.durationSec,
        wavBase64,
        createdAtMs: record.createdAt?.toMillis ? record.createdAt.toMillis() : Date.now(),
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to play history item.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (record: GenerationRecord) => {
    setError(null);
    setBusyId(record.id);
    try {
      const wavBase64 = await resolveAudioForRecord(record);
      downloadWavBase64(wavBase64, record.voiceName);
    } catch (err: any) {
      setError(err?.message || 'Failed to download audio.');
    } finally {
      setBusyId(null);
    }
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-[#1E1F20] border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#1A73E8] dark:text-[#8AB4F8] flex items-center justify-center mx-auto">
            <HistoryIcon size={22} />
          </div>
          <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Sign in to save your voice history
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Your synthesized scripts, voice settings, and downloadable WAV recordings are synced to your account.
          </p>
          <button
            type="button"
            onClick={signInWithGoogle}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-sm font-medium transition-colors"
          >
            <LogIn size={16} />
            <span>Sign In with Google</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto studio-scrollbar p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Generation History
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 tabular-nums">
              {history.length} saved audio {history.length === 1 ? 'clip' : 'clips'}
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToStudio}
            className="px-4 py-2 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-medium transition-colors"
          >
            New Synthesis
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {historyLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-20 rounded-xl bg-white dark:bg-[#1E1F20] border border-zinc-200 dark:border-zinc-800 animate-pulse"
              />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="bg-white dark:bg-[#1E1F20] border border-zinc-200 dark:border-zinc-800 rounded-xl p-12 text-center space-y-3">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              No synthesized audio clips yet.
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Generate your first voice clip in the Studio and it will appear here for playback and download.
            </p>
            <button
              type="button"
              onClick={onGoToStudio}
              className="mt-2 px-4 py-2 rounded-lg bg-[#1A73E8] text-white text-xs font-medium"
            >
              Open Studio
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#1E1F20] border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800">
            {history.map((item) => {
              const isBusy = busyId === item.id;
              const dateLabel = item.createdAt?.toDate
                ? item.createdAt.toDate().toLocaleString()
                : 'Just now';

              return (
                <div
                  key={item.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {item.voiceName}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {item.category} · {item.language} · {item.model}
                      </span>
                    </div>

                    <p
                      dir="auto"
                      className="text-sm text-zinc-600 dark:text-zinc-300 line-clamp-2"
                    >
                      {item.text}
                    </p>

                    <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-zinc-400 dark:text-zinc-500">
                      <span>{formatTime(item.durationSec)}</span>
                      <span>·</span>
                      <span>{item.charCount} chars</span>
                      <span>·</span>
                      <span>{dateLabel}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handlePlay(item)}
                      disabled={isBusy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-medium transition-colors"
                    >
                      {isBusy ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Play size={12} className="fill-current" />
                      )}
                      <span>Play</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownload(item)}
                      disabled={isBusy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Download size={13} />
                      <span>WAV</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onLoadIntoStudio(item)}
                      title="Load script into Studio"
                      className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <ArrowUpRight size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteGeneration(item.id)}
                      title="Delete from history"
                      aria-label="Delete history entry"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    >
                      <Trash2 size={14} />
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

export default HistoryView;
