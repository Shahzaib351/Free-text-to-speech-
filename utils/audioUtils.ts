/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StudioVoice } from '../types';

const clientPreviewCache = new Map<string, string>();

export function base64ToWavBlob(base64: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: 'audio/wav' });
}

export function downloadWavBase64(wavBase64: string, filenameBase: string): void {
  const blob = base64ToWavBlob(wavBase64);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = filenameBase
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'voice-studio';
  a.href = url;
  a.download = `${safeName}-${Date.now()}.wav`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export async function getVoicePreviewUrl(voice: StudioVoice): Promise<string> {
  if (voice.audioSampleUrl) {
    return voice.audioSampleUrl;
  }

  const cached = clientPreviewCache.get(voice.id);
  if (cached) {
    return cached;
  }

  const res = await fetch('/api/tts/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      voiceId: voice.id,
      voiceName: voice.prebuiltVoiceName,
      sampleText: voice.sampleScript,
      stylePrompt: voice.styleInstruction,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.audioBase64) {
    throw new Error(data.error || 'Unable to load voice preview');
  }

  const blobUrl = URL.createObjectURL(base64ToWavBlob(data.audioBase64));
  clientPreviewCache.set(voice.id, blobUrl);
  return blobUrl;
}
