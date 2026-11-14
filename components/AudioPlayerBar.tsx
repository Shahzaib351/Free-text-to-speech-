/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Download, Volume2, VolumeX, X } from 'lucide-react';
import { ActiveAudioTrack } from '../types';
import { base64ToWavBlob, downloadWavBase64, formatTime } from '../utils/audioUtils';
import AudioVisualizer from './AudioVisualizer';

interface AudioPlayerBarProps {
  track: ActiveAudioTrack | null;
  onClose: () => void;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({ track, onClose }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    if (!track) {
      setAudioUrl(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    const blob = base64ToWavBlob(track.wavBase64);
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);
    setCurrentTime(0);
    setDuration(track.durationSec || 0);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [track]);

  // Auto-play newly generated or loaded track
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    audio.playbackRate = playbackRate;
    audio.volume = isMuted ? 0 : volume;
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  if (!track) return null;

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      await audio.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(e.target.value);
    setCurrentTime(nextTime);
    if (audioRef.current) {
      audioRef.current.currentTime = nextTime;
    }
  };

  return (
    <div className="shrink-0 bg-white dark:bg-[#1E1F20] border-t border-zinc-200 dark:border-zinc-800 px-4 lg:px-6 py-3 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] animate-slide-up">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={() => {
            if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
          }}
          onLoadedMetadata={() => {
            if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
              setDuration(audioRef.current.duration);
            }
          }}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-6">
        {/* Track Info + Play/Pause */}
        <div className="flex items-center justify-between md:justify-start gap-3 min-w-0 md:w-64 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
              className="w-10 h-10 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white flex items-center justify-center shrink-0 transition-colors shadow-sm"
            >
              {isPlaying ? (
                <Pause size={16} className="fill-current" />
              ) : (
                <Play size={16} className="fill-current ml-0.5" />
              )}
            </button>

            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {track.voiceName}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                {track.category} · {track.language}
              </p>
            </div>
          </div>

          {/* Mobile Download + Close */}
          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => downloadWavBase64(track.wavBase64, track.voiceName)}
              className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-medium flex items-center gap-1.5"
            >
              <Download size={14} />
              <span>WAV</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close player"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Center: Seek Bar + Time + Mini Visualizer */}
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <div className="hidden sm:block w-16 h-8 shrink-0">
            <AudioVisualizer isPlaying={isPlaying} />
          </div>

          <span className="text-xs font-mono tabular-nums text-zinc-600 dark:text-zinc-400 w-11 text-right shrink-0">
            {formatTime(currentTime)}
          </span>

          <input
            type="range"
            min={0}
            max={Math.max(duration, 0.1)}
            step={0.05}
            value={Math.min(currentTime, Math.max(duration, 0.1))}
            onChange={handleSeek}
            aria-label="Seek audio position"
            className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#1A73E8]"
          />

          <span className="text-xs font-mono tabular-nums text-zinc-600 dark:text-zinc-400 w-11 shrink-0">
            {formatTime(duration)}
          </span>
        </div>

        {/* Right: Speed, Volume, Download */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <select
            value={playbackRate}
            onChange={(e) => setPlaybackRate(Number(e.target.value))}
            aria-label="Playback speed"
            className="px-2 py-1.5 rounded-lg bg-zinc-100 dark:bg-[#28292A] border border-zinc-200 dark:border-zinc-700 text-xs font-mono tabular-nums text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-[#1A73E8] cursor-pointer"
          >
            {SPEED_OPTIONS.map((rate) => (
              <option key={rate} value={rate}>
                {rate}x
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsMuted((m) => !m)}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(Number(e.target.value));
                if (isMuted) setIsMuted(false);
              }}
              aria-label="Volume"
              className="w-16 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#1A73E8]"
            />
          </div>

          <button
            type="button"
            onClick={() => downloadWavBase64(track.wavBase64, track.voiceName)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Download size={14} />
            <span>Download WAV</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss audio player"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayerBar;
