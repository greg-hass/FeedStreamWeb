'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Plus, Search, X, Rss } from 'lucide-react';
import { clsx } from 'clsx';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { FeedService } from '@/lib/feed-service';
import { useSettingsStore } from '@/store/settingsStore';
import { FeedSearchModal } from './FeedSearchModal';
import { RefreshProgress } from './RefreshProgress';
import Link from 'next/link';


interface AppHeaderProps {
    title?: string;
    icon?: React.ReactNode;
    showRefresh?: boolean;
    showAddButton?: boolean;
    showSearch?: boolean;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
}

export function AppHeader({
    title,
    icon,
    showRefresh = true,
    showAddButton = true,
    showSearch = false,
    searchValue = '',
    onSearchChange
}: AppHeaderProps) {
    const [isSyncing, setIsSyncing] = useState(false);
    const { lastRefreshTime, setLastRefreshTime } = useSettingsStore();
    const [timeRemaining, setTimeRemaining] = useState<string>('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [refreshProgress, setRefreshProgress] = useState<{ current: number; total: number; feedName?: string } | null>(null);
    const feeds = useLiveQuery(() => db.feeds.toArray()) || [];

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
        const interval = setInterval(updateTimer, 1000); // 1 second
        return () => clearInterval(interval);
    }, [lastRefreshTime]);

    // Auto-refresh when timer reaches 0
    useEffect(() => {
        if (!lastRefreshTime || !showRefresh) return;

        const checkAutoRefresh = () => {
            const now = Date.now();
            const nextRefresh = lastRefreshTime + 15 * 60 * 1000;
            if (now >= nextRefresh && !isSyncing) {
                handleSync();
            }
        };

        const interval = setInterval(checkAutoRefresh, 10000); // Check every 10 seconds
        return () => clearInterval(interval);
    }, [lastRefreshTime, isSyncing, showRefresh]);

    const handleSync = async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        setRefreshProgress({ current: 0, total: feeds.length });

        try {
            await FeedService.syncWithFever();

            for (let i = 0; i < feeds.length; i++) {
                const feed = feeds[i];
                setRefreshProgress({ current: i + 1, total: feeds.length, feedName: feed.title });

                if (feed.type === 'rss' || feed.type === 'reddit' || feed.type === 'youtube' || feed.type === 'podcast') {
                    await FeedService.refreshFeed(feed);
                }
            }

            setLastRefreshTime(Date.now());
        } catch (e) {
            console.error(e);
        } finally {
            setIsSyncing(false);
            // Keep progress visible for 1 second before hiding
            setTimeout(() => setRefreshProgress(null), 1000);
        }
    };

    return (
        <>
            <FeedSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
            <header className="header-blur sticky top-0 z-30 border-b border-zinc-200/50 dark:border-zinc-800/50">
                <div className="h-14 flex items-center gap-3 px-4 sm:px-6">
                    {/* Logo - Left */}
                    <div className="flex items-center gap-2 shrink-0">
                        {icon}
                        {title && <h1 className="text-lg font-semibold">{title}</h1>}
                    </div>

                    {/* Search Bar - Fills Space */}
                    {showSearch && (
                        <div className="flex-1 max-w-2xl relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-brand transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Search articles..."
                                value={searchValue}
                                onChange={(e) => onSearchChange?.(e.target.value)}
                                className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded-full py-1.5 pl-9 pr-8 text-sm focus:ring-2 focus:ring-brand/20 transition-all placeholder:text-zinc-500"
                            />
                            {searchValue && (
                                <button
                                    onClick={() => onSearchChange?.('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-full"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Action Buttons - Right */}
                    <div className="flex items-center gap-2 shrink-0">
                        {showRefresh && timeRemaining && (
                            <span className="hidden sm:inline-block text-xs font-mono text-zinc-400 dark:text-zinc-600 tabular-nums">
                                {timeRemaining}
                            </span>
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
                            >
                                <RefreshCw size={20} className={isSyncing ? "animate-spin" : ""} />
                            </button>
                        )}
                        {showAddButton && (
                            <button
                                onClick={() => setIsSearchOpen(true)}
                                className="p-2 rounded-full bg-brand text-white hover:brightness-110 transition-all shadow-lg shadow-brand/20"
                                title="Add Feed"
                            >
                                <Plus size={20} />
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Refresh Progress Indicator */}
            {refreshProgress && (
                <RefreshProgress
                    current={refreshProgress.current}
                    total={refreshProgress.total}
                    currentFeedName={refreshProgress.feedName}
                    onDismiss={() => setRefreshProgress(null)}
                />
            )}
        </>
    );
}
