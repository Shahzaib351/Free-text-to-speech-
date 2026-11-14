/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, LogIn, LogOut, Menu, ChevronDown, Sparkles } from 'lucide-react';
import { AppTab } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface TopBarProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onOpenMobileSidebar: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onTabChange,
  isDarkMode,
  onToggleTheme,
  onOpenMobileSidebar,
}) => {
  const { user, profile, authLoading, effectiveTier, dailyUsed, dailyLimit, signInWithGoogle, signOutUser } =
    useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const navItems: { id: AppTab; label: string }[] = [
    { id: 'studio', label: 'Studio' },
    { id: 'library', label: 'Voice Library' },
    { id: 'history', label: 'History' },
    { id: 'plans', label: 'Plans' },
  ];

  return (
    <header className="h-14 shrink-0 bg-white dark:bg-[#1E1F20] border-b border-zinc-200 dark:border-zinc-800 px-4 lg:px-6 flex items-center justify-between gap-8 z-40">
      {/* Zone 1: Brand Title + Mobile Drawer Trigger */}
      <div className="flex items-center gap-3 shrink-0">
        {activeTab === 'studio' && (
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 -ml-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Open voice directory"
          >
            <Menu size={18} />
          </button>
        )}
        <button
          type="button"
          onClick={() => onTabChange('studio')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <rect x="2" y="9" width="3" height="6" rx="1.5" fill="#1A73E8" />
            <rect x="7" y="5" width="3" height="14" rx="1.5" fill="#EA4335" />
            <rect x="12" y="3" width="3" height="18" rx="1.5" fill="#FBBC04" />
            <rect x="17" y="7" width="3" height="10" rx="1.5" fill="#34A853" />
          </svg>
          <span className="font-display font-semibold text-base tracking-tight text-zinc-900 dark:text-zinc-100 whitespace-nowrap shrink-0">
            AI Voice Studio
          </span>
        </button>
      </div>

      {/* Zone 2: Single-line Navigation Links */}
      <nav className="hidden md:flex items-center gap-6" aria-label="Primary navigation">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`relative py-4 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded ${
                isActive
                  ? 'text-[#1A73E8] dark:text-[#8AB4F8]'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {item.label}
              {isActive && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#1A73E8] dark:bg-[#8AB4F8] rounded-t" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Theme Toggle + Primary Account Action */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onToggleTheme}
          className="p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
          aria-label={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
          title={isDarkMode ? 'Light theme' : 'Dark theme'}
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {user ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 py-1.5 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={profile?.displayName || 'User'}
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-[#1A73E8] text-white text-xs font-semibold flex items-center justify-center shrink-0">
                  {(profile?.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <span className="hidden sm:inline text-sm font-medium text-zinc-900 dark:text-zinc-100 max-w-[120px] truncate">
                {profile?.displayName || user.displayName || 'Account'}
              </span>
              <ChevronDown size={14} className="text-zinc-500 dark:text-zinc-400 shrink-0" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white dark:bg-[#28292A] border border-zinc-200 dark:border-zinc-700 shadow-lg py-2 z-50 animate-fade-in">
                <div className="px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-700">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {profile?.displayName || user.displayName}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                    {user.email}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300 tabular-nums">
                    <span>{effectiveTier === 'pro' ? 'Pro Studio Plan' : 'Starter Free Plan'}</span>
                    <span>
                      {dailyUsed} / {dailyLimit} today
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onTabChange('plans');
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 flex items-center gap-2 transition-colors"
                >
                  <Sparkles size={15} className="text-[#1A73E8] dark:text-[#8AB4F8]" />
                  <span>{effectiveTier === 'pro' ? 'Manage Pro Plan' : 'Upgrade to Pro Studio'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    signOutUser();
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 flex items-center gap-2 transition-colors"
                >
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={authLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            <LogIn size={15} />
            <span>{authLoading ? 'Signing in...' : 'Sign In'}</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default TopBar;
