'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, Search, X, Rss, CheckCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { db } from '@/lib/db';
import { FeedService } from '@/lib/feed-service';
import { useSettingsStore } from '@/store/settingsStore';
import { useUIStore } from '@/store/uiStore';
import { FeedSearchModal } from './FeedSearchModal';
import { RefreshProgress } from './RefreshProgress';
import Link from 'next/link';
import { useSync } from '@/hooks/useSync';


interface AppHeaderProps {
    title?: string;
    icon?: React.ReactNode;
    showRefresh?: boolean;
    showAddButton?: boolean;
    showSearch?: boolean;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    onMarkAllRead?: () => void;
}

export function AppHeader({
    title,
    icon,
    showRefresh = true,
    showAddButton = true,
    showSearch = false,
    searchValue = '',
    onSearchChange,
    onMarkAllRead
}: AppHeaderProps) {
    const { isSyncing } = useUIStore();
    const { lastRefreshTime, setLastRefreshTime } = useSettingsStore();
    const [timeRemaining, setTimeRemaining] = useState<string>('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const { runSync } = useSync();

    // Update countdown every second
    useEffect(() => {
        const updateTimer = () => {
            if (!lastRefreshTime) {
                setTimeRemaining('');
                return;
            }
            const now = Date.now();
            const nextRefresh = lastRefreshTime + 15 * 60 * 1000; // 15 minutes
            const diff = nextRefresh - now;

            if (diff <= 0) {
                setTimeRemaining('Now');
            } else {
                const minutes = Math.floor(diff / 60000);
                const seconds = Math.floor((diff % 60000) / 1000);
                setTimeRemaining(`${minutes}m ${seconds.toString().padStart(2, '0')}s`);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 10000); // 10 seconds (battery optimization)
        return () => clearInterval(interval);
    }, [lastRefreshTime]);

    const performSync = useCallback(async () => {
        if (isSyncing) return;
        setLastRefreshTime(Date.now());
        await runSync();
    }, [isSyncing, runSync, setLastRefreshTime]);

    // Auto-refresh when timer reaches 0
    useEffect(() => {
        if (!showRefresh) return;

        const checkAutoRefresh = async () => {
            if (!lastRefreshTime || isSyncing) return;

            const now = Date.now();
            const nextRefresh = lastRefreshTime + 15 * 60 * 1000;

            if (now >= nextRefresh) {
                console.log('[AutoRefresh] Timer expired, triggering refresh...');
                await performSync();
            }
        };

        const interval = setInterval(checkAutoRefresh, 60000); // Check every 60 seconds (battery optimization)
        checkAutoRefresh(); // Also check immediately
        return () => clearInterval(interval);
    }, [lastRefreshTime, isSyncing, showRefresh, performSync]); // Depend on performSync

    const handleSync = () => {
        performSync();
    };

    return (
        <>
            <FeedSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
            <header className="header-blur sticky top-0 z-30 border-b border-zinc-200/50 dark:border-zinc-800/50 pt-[env(safe-area-inset-top)]">
                <div className="h-14 flex items-center gap-4 px-4 sm:px-6">
                    {/* Logo with FeedStream - Always on LEFT */}
                    <Link href="/" className="flex items-center gap-2 shrink-0">
                        <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
                            <Rss className="text-white" size={18} />
                        </div>
                        <span className="font-bold text-lg hidden sm:block text-zinc-900 dark:text-white">FeedStream</span>
                    </Link>

                    {/* Search Bar - FILLS MIDDLE SPACE */}
                    {showSearch && (
                        <div className="flex-1 relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-brand transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Search articles..."
                                value={searchValue}
                                onChange={(e) => onSearchChange?.(e.target.value)}
                                className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded-full py-2 pl-10 pr-10 text-sm focus:ring-2 focus:ring-brand/30 transition-all placeholder:text-zinc-500"
                            />
                            {searchValue && (
                                <button
                                    onClick={() => onSearchChange?.('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Action Buttons - Always on RIGHT */}
                    <div className="flex items-center gap-2 shrink-0 ml-auto">
                        {showRefresh && timeRemaining && (
                            <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500 tabular-nums">
                                {timeRemaining}
                            </span>
                        )}
                        {onMarkAllRead && (
                            <button
                                onClick={onMarkAllRead}
                                className="p-2 rounded-full text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                                title="Mark all as read"
                            >
                                <CheckCheck size={20} />
                            </button>
                        )}
                        {showRefresh && (
                            <button
                                onClick={handleSync}
                                disabled={isSyncing}
                                className={clsx(
                                    "p-2 rounded-full transition-colors",
                                    "text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800",
                                    isSyncing && "opacity-50"
                                )}
                                title="Refresh Feeds"
                                aria-label="Refresh Feeds"
                            >
                                <RefreshCw size={20} className={isSyncing ? "animate-spin" : ""} />
                            </button>
                        )}
                        {showAddButton && (
                            <button
                                onClick={() => setIsSearchOpen(true)}
                                className="p-2 rounded-full bg-brand text-white hover:brightness-110 transition-all shadow-lg shadow-brand/20"
                                title="Add Feed"
                                aria-label="Add New Feed"
                            >
                                <Plus size={20} />
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Refresh Progress Indicator moved to Root Layout via UI Store */}
        </>
    );
}
