'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, Search, X, Rss, CheckCheck } from 'lucide-react';
import { clsx } from 'clsx';
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
    const [isSyncing, setIsSyncing] = useState(false);
    const { lastRefreshTime, setLastRefreshTime } = useSettingsStore();
    const [timeRemaining, setTimeRemaining] = useState<string>('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [refreshProgress, setRefreshProgress] = useState<{ current: number; total: number; feedName?: string } | null>(null);

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
        setIsSyncing(true);
        setRefreshProgress({ current: 0, total: 0, feedName: 'Syncing FreshRSS...' });

        try {
            // Always await sync to catch errors and report them
            await FeedService.syncWithFever();
            
            let localFeeds = await db.feeds.toArray();

            // Get relevant feeds to sync
            const feedsToSync = localFeeds.filter(f =>
                f.type === 'rss' || f.type === 'reddit' || f.type === 'youtube' || f.type === 'podcast'
            );

            setRefreshProgress({
                current: 0,
                total: feedsToSync.length,
                feedName: feedsToSync.length === 0 ? 'No feeds ready to refresh' : 'Preparing feeds...'
            });

            // Parallel execution with higher concurrency limit
            const CONCURRENCY_LIMIT = 5; // Reduced for stability
            let completedCount = 0;
            let currentIndex = 0;
            let totalNewArticles = 0;

            const processNext = async (): Promise<void> => {
                if (currentIndex >= feedsToSync.length) return;

                const feed = feedsToSync[currentIndex];
                currentIndex++;

                // Update progress
                setRefreshProgress(prev => ({
                    current: completedCount,
                    total: feedsToSync.length,
                    feedName: `Syncing ${feed.title}...`
                }));

                try {
                    const newCount = await FeedService.refreshFeed(feed);
                    if (typeof newCount === 'number') {
                        totalNewArticles += newCount;
                    }
                } catch (e) {
                    console.error(`Failed to refresh ${feed.title}`, e);
                } finally {
                    completedCount++;
                    setRefreshProgress(prev => ({
                        current: completedCount,
                        total: feedsToSync.length,
                        feedName: prev?.feedName // Keep current name or update?
                    }));

                    // Process next in queue
                    await processNext();
                }
            };

            // Start workers
            const workers = Array(Math.min(CONCURRENCY_LIMIT, feedsToSync.length))
                .fill(null)
                .map(() => processNext());

            await Promise.all(workers);

            setLastRefreshTime(Date.now());

            // Show summary notification
            if (totalNewArticles > 0) {
                console.log(`[Sync Complete] Refreshed ${feedsToSync.length} feeds. Found ${totalNewArticles} new articles.`);
                setTimeRemaining(`${totalNewArticles} new`);
                setTimeout(() => setTimeRemaining(''), 5000);
            } else {
                console.log(`[Sync Complete] Refreshed ${feedsToSync.length} feeds. No new articles.`);
            }
            
            // Clear progress immediately on success
            setRefreshProgress(null);
            setIsSyncing(false);

        } catch (e: any) {
            console.error('Sync failed:', e);
            // Show error to user
            setRefreshProgress({ 
                current: 0, 
                total: 0, 
                feedName: `Sync Failed: ${e.message || 'Unknown error'}` 
            });
            // Clear after 3 seconds so user can see it
            setTimeout(() => {
                setRefreshProgress(null);
                setIsSyncing(false);
            }, 3000);
        } finally {
            // Ensure we don't leave it hanging if something unexpected happens
            // But main logic is in try/catch for specific timing
            setLastRefreshTime(Date.now());
        }
    }, [isSyncing, setLastRefreshTime]); // Depend on isSyncing

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
