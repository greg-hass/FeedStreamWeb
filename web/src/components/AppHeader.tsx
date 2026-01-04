'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { FeedService } from '@/lib/feed-service';
import { useSettingsStore } from '@/store/settingsStore';
import { FeedSearchModal } from './FeedSearchModal';

interface AppHeaderProps {
    title: string;
    icon?: React.ReactNode;
    showRefresh?: boolean;
    showAddButton?: boolean;
}

export function AppHeader({ title, icon, showRefresh = true, showAddButton = true }: AppHeaderProps) {
    const [isSyncing, setIsSyncing] = useState(false);
    const { lastRefreshTime, setLastRefreshTime } = useSettingsStore();
    const [timeRemaining, setTimeRemaining] = useState<string>('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
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

    const handleSync = async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        try {
            await FeedService.syncWithFever();
            for (const feed of feeds) {
                if (feed.type === 'rss') {
                    await FeedService.refreshFeed(feed);
                }
            }
            setLastRefreshTime(Date.now());
        } catch (e) {
            console.error(e);
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <>
            <FeedSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
            <header className="header-blur sticky top-0 z-30 border-b border-zinc-200/50 dark:border-zinc-800/50">
                <div className="h-14 flex items-center justify-between px-4 sm:px-6">
                    <div className="flex items-center gap-3">
                        {icon}
                        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
                    </div>
                    <div className="flex items-center gap-2">
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
        </>
    );
}
