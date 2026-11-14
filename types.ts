/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type VoiceCategory =
  | 'Storytelling'
  | 'Broadcast'
  | 'Comedy'
  | 'Educational'
  | 'Cinematic'
  | 'Music'
  | 'Podcast'
  | 'Corporate'
  | 'Kids'
  | 'Meditation'
  | 'Multi-language';

export type StudioModel = 'gemini-3.8-flash-lite-tts' | 'gemini-3.8-flash-tts';

export type PlanTier = 'free' | 'pro';

export type AppTab = 'studio' | 'library' | 'history' | 'plans';

export interface StudioVoice {
  id: string;
  name: string;
  prebuiltVoiceName: string;
  category: VoiceCategory;
  language: string;
  gender: 'Female' | 'Male';
  pitch: 'Low' | 'Medium-Low' | 'Medium' | 'Medium-High' | 'High';
  toneTag: string;
  description: string;
  styleInstruction: string;
  sampleScript: string;
  audioSampleUrl?: string;
  isPremium: boolean;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  tier: PlanTier;
  dailyGenerations: number;
  lastUsageDate: string;
  totalGenerations: number;
  totalCharacters: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface GenerationRecord {
  id: string;
  userId: string;
  text: string;
  stylePrompt: string;
  voiceId: string;
  voiceName: string;
  secondVoiceId?: string;
  secondVoiceName?: string;
  isMultiSpeaker: boolean;
  category: string;
  language: string;
  model: StudioModel;
  charCount: number;
  durationSec: number;
  createdAt: any;
}

export interface ActiveAudioTrack {
  id: string;
  title: string;
  voiceName: string;
  category: string;
  language: string;
  model: StudioModel;
  durationSec: number;
  wavBase64: string;
  createdAtMs: number;
}

export interface CastingRecommendation {
  recommendedVoiceIds: string[];
  stylePrompt: string;
  sampleScript: string;
  rationale: string;
}

// Legacy compatibility types if referenced anywhere
export interface VoiceAnalysis {
  gender: string;
  pitch: string;
  characteristics: string[];
  visualDescription: string;
}

export interface Voice {
  name: string;
  pitch: string;
  characteristics: string[];
  audioSampleUrl: string;
  fileUri: string;
  analysis: VoiceAnalysis;
  imageUrl: string;
}

export interface FilterState {
  gender: string | 'All';
  pitch: string | 'All';
  search: string;
}

export interface AiRecommendation {
  voiceNames: string[];
  systemInstruction: string;
  sampleText: string;
}