/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../services/firebase';
import { GenerationRecord, PlanTier, StudioModel, UserProfile } from '../types';
import { TIER_LIMITS } from '../constants/voices';
import { deleteAudioClip } from '../services/audioCache';

function getTodayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

interface SaveGenerationInput {
  id: string;
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
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  authReady: boolean;
  authLoading: boolean;
  authError: string | null;
  effectiveTier: 'guest' | PlanTier;
  dailyUsed: number;
  dailyLimit: number;
  maxCharacters: number;
  history: GenerationRecord[];
  historyLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  recordGeneration: (input: SaveGenerationInput) => Promise<void>;
  deleteGeneration: (generationId: string) => Promise<void>;
  switchPlanTier: (targetTier: PlanTier) => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [history, setHistory] = useState<GenerationRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [guestDailyUsed, setGuestDailyUsed] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem('adio_guest_used');
      return saved ? Number(saved) || 0 : 0;
    } catch {
      return 0;
    }
  });

  // Bootstrap or fetch user profile on sign in
  const ensureUserProfile = useCallback(async (firebaseUser: User) => {
    const userPath = `users/${firebaseUser.uid}`;
    const userRef = doc(db, 'users', firebaseUser.uid);
    try {
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        const cleanName = (firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Studio User')
          .trim()
          .slice(0, 100);
        const newProfile = {
          uid: firebaseUser.uid,
          displayName: cleanName || 'Studio User',
          tier: 'free' as PlanTier,
          dailyGenerations: 0,
          lastUsageDate: getTodayUtcDate(),
          totalGenerations: 0,
          totalCharacters: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        try {
          await setDoc(userRef, newProfile);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, userPath);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, userPath);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          await ensureUserProfile(firebaseUser);
        } catch (err: any) {
          console.error('Profile sync error:', err);
          setAuthError('Unable to sync your studio profile. Please refresh.');
        }
      } else {
        setProfile(null);
        setHistory([]);
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, [ensureUserProfile]);

  // Listen to user profile & generation history ONLY when authReady && user
  useEffect(() => {
    if (!authReady || !user) return;

    const userPath = `users/${user.uid}`;
    const unsubProfile = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, userPath);
      }
    );

    const historyPath = `users/${user.uid}/generations`;
    setHistoryLoading(true);
    const historyQuery = query(
      collection(db, 'users', user.uid, 'generations'),
      where('userId', '==', user.uid),
      limit(100)
    );

    const unsubHistory = onSnapshot(
      historyQuery,
      (snapshot) => {
        const items = snapshot.docs
          .map((d) => d.data() as GenerationRecord)
          .sort((a, b) => {
            const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return bTime - aTime;
          });
        setHistory(items);
        setHistoryLoading(false);
      },
      (error) => {
        setHistoryLoading(false);
        handleFirestoreError(error, OperationType.LIST, historyPath);
      }
    );

    return () => {
      unsubProfile();
      unsubHistory();
    };
  }, [authReady, user]);

  const signInWithGoogle = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setAuthError(err?.message || 'Google sign-in failed. Please allow popups and try again.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const signOutUser = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signOut(auth);
      setProfile(null);
      setHistory([]);
    } catch (err: any) {
      setAuthError(err?.message || 'Failed to sign out.');
    } finally {
      setAuthLoading(false);
    }
  };

  const today = getTodayUtcDate();
  const effectiveTier: 'guest' | PlanTier = user ? profile?.tier || 'free' : 'guest';
  const tierConfig = TIER_LIMITS[effectiveTier];

  const dailyUsed = user
    ? profile?.lastUsageDate === today
      ? profile.dailyGenerations
      : 0
    : guestDailyUsed;

  const recordGeneration = async (input: SaveGenerationInput) => {
    if (!user || !profile) {
      const next = guestDailyUsed + 1;
      setGuestDailyUsed(next);
      try {
        sessionStorage.setItem('adio_guest_used', String(next));
      } catch {}
      return;
    }

    const genPath = `users/${user.uid}/generations/${input.id}`;
    const cleanText = input.text.slice(0, 5500);
    const cleanStyle = (input.stylePrompt || '').slice(0, 500);

    const recordPayload: Record<string, any> = {
      id: input.id,
      userId: user.uid,
      text: cleanText,
      stylePrompt: cleanStyle,
      voiceId: input.voiceId.slice(0, 100),
      voiceName: input.voiceName.slice(0, 100),
      isMultiSpeaker: Boolean(input.isMultiSpeaker),
      category: input.category.slice(0, 60),
      language: input.language.slice(0, 40),
      model: input.model,
      charCount: Math.max(1, Math.min(5500, Math.round(input.charCount))),
      durationSec: Math.max(0, Math.min(3600, Number(input.durationSec) || 0)),
      createdAt: serverTimestamp(),
    };

    if (input.secondVoiceId) {
      recordPayload.secondVoiceId = input.secondVoiceId.slice(0, 100);
    }
    if (input.secondVoiceName) {
      recordPayload.secondVoiceName = input.secondVoiceName.slice(0, 100);
    }

    try {
      await setDoc(doc(db, 'users', user.uid, 'generations', input.id), recordPayload);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, genPath);
    }

    const userPath = `users/${user.uid}`;
    const isSameDay = profile.lastUsageDate === today;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        dailyGenerations: (isSameDay ? profile.dailyGenerations : 0) + 1,
        lastUsageDate: today,
        totalGenerations: (profile.totalGenerations || 0) + 1,
        totalCharacters: (profile.totalCharacters || 0) + recordPayload.charCount,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userPath);
    }
  };

  const deleteGeneration = async (generationId: string) => {
    if (!user) return;
    const genPath = `users/${user.uid}/generations/${generationId}`;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'generations', generationId));
      await deleteAudioClip(generationId);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, genPath);
    }
  };

  const switchPlanTier = async (targetTier: PlanTier) => {
    if (!user) {
      await signInWithGoogle();
      return;
    }
    const userPath = `users/${user.uid}`;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        tier: targetTier,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userPath);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        authReady,
        authLoading,
        authError,
        effectiveTier,
        dailyUsed,
        dailyLimit: tierConfig.dailyGenerations,
        maxCharacters: tierConfig.maxCharacters,
        history,
        historyLoading,
        signInWithGoogle,
        signOutUser,
        recordGeneration,
        deleteGeneration,
        switchPlanTier,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
