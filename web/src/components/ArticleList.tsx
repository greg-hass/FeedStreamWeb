'use client';

import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { Article } from '@/lib/db';
import { ArticleItem } from './ArticleItem';
import { db } from '@/lib/db';
import { usePathname, useRouter } from 'next/navigation';
import { useScrollStore } from '@/store/scrollStore';
import { FeedService } from '@/lib/feed-service';
import { useLiveQuery } from 'dexie-react-hooks';
import { useKeyboardNav } from '@/hooks/useKeyboardNav';
import { Loader2, ArrowDown } from 'lucide-react';
import { clsx } from 'clsx';
import { useUIStore } from '@/store/uiStore';

import { RefreshProgress } from './RefreshProgress';

interface ArticleListProps {
    articles: Article[];
    onLoadMore?: () => void;
    header?: React.ReactNode;
}

export function ArticleList({ articles, onLoadMore, header }: ArticleListProps) {
    const pathname = usePathname();
    const router = useRouter();
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const { getScrollPosition, setScrollPosition } = useScrollStore();

    // Pull to Refresh State
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const touchStartY = useRef(0);
    const isDragging = useRef(false);
    const lastSyncTime = useRef<number>(0);
    const { startSync, setProgress, endSync } = useUIStore(); // Use global store

    // Auto-Sync on App Open / Visibility Change
    useEffect(() => {
        const attemptSync = async () => {
            if (!navigator.onLine) return;
            
            const now = Date.now();
            // Sync if it's been more than 10 minutes since last sync
            if (now - lastSyncTime.current > 10 * 60 * 1000) {
                console.log("[AutoSync] Triggering background sync...");
                lastSyncTime.current = now;
                try {
                    // We don't show full modal for auto-sync, maybe just a small indicator if needed
                    // But if we want to trigger the global sync logic:
                    await FeedService.syncWithFever();
                } catch (e) {
                    console.error("[AutoSync] Failed", e);
                }
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // Small delay to ensure DB/Network is woke
                setTimeout(attemptSync, 1000);
            }
        };

        // Listen for visibility changes (tab switching, app open from background)
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Try once on mount
        setTimeout(attemptSync, 1000);

        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (atTop && !isRefreshing) {
            touchStartY.current = e.touches[0].clientY;
            isDragging.current = true;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging.current || isRefreshing || !atTop) return;
        
        const currentY = e.touches[0].clientY;
        const delta = currentY - touchStartY.current;

        if (delta > 0) {
            // Add resistance
            const damped = Math.min(delta * 0.5, 120); 
            setPullDistance(damped);
        } else {
            setPullDistance(0);
        }
    };

    const handleTouchEnd = async () => {
        if (!isDragging.current) return;
        isDragging.current = false;

        if (pullDistance > 60) {
            // Trigger Refresh
            setIsRefreshing(true);
            setPullDistance(60); // Snap to loading position
            
            // Show global progress for manual refresh
            startSync(0);
            setProgress(0, 0, 'Refreshing...');

            try {
                // Determine if we should Sync (Fever) or Refresh All (Local)
                await FeedService.syncWithFever();
            } catch (e) {
                console.error("Refresh failed", e);
            } finally {
                setIsRefreshing(false);
                setPullDistance(0);
                endSync();
            }
        } else {
            setPullDistance(0);
        }
    };

    // Optimization: Debounce Feed Updates to prevent flickering during sync
    const rawFeeds = useLiveQuery(() => db.feeds.toArray());
    const [feeds, setFeeds] = useState(rawFeeds);

    useEffect(() => {
        const handler = setTimeout(() => {
            setFeeds(rawFeeds);
        }, 1000); // 1 second debounce for feed metadata updates (icons, lastSync, etc)

        return () => clearTimeout(handler);
    }, [rawFeeds]);

    const feedsMap = useMemo(() => {
        const map = new Map();
        if (feeds) {
            feeds.forEach(f => map.set(f.id, f));
        }
        return map;
    }, [feeds]);

    const handleToggleRead = async (id: string) => {
        const article = await db.articles.get(id);
        if (article) {
            await FeedService.toggleReadStatus(id, !article.isRead);
        }
    };

    const handleToggleBookmark = async (id: string) => {
        const article = await db.articles.get(id);
        if (article) {
            await FeedService.toggleBookmark(id, !article.isBookmarked);
        }
    };

    // Keyboard Navigation
    const { selectedIndex } = useKeyboardNav({
        count: articles?.length || 0,
        onNext: (index) => {
             virtuosoRef.current?.scrollToIndex({ index, align: 'center', behavior: 'smooth' });
        },
        onPrev: (index) => {
             virtuosoRef.current?.scrollToIndex({ index, align: 'center', behavior: 'smooth' });
        },
        onSelect: (index) => {
            const article = articles[index];
            if (article) {
                router.push(`/article/${article.id}`);
            }
        },
        onMarkRead: (index) => {
            const article = articles[index];
            if (article) {
                handleToggleRead(article.id);
            }
        }
    });

    const [atTop, setAtTop] = React.useState(true);
    const [showNewItems, setShowNewItems] = React.useState(false);
    const prevArticlesLength = useRef(articles?.length || 0);

    // Detect new items
    useEffect(() => {
        if (!articles) return;

        // If we have MORE articles than before
        if (articles.length > prevArticlesLength.current) {
            if (atTop) {
                // If at top, scroll to top to show new items
                setTimeout(() => {
                    virtuosoRef.current?.scrollToIndex({ index: 0, align: 'start', behavior: 'smooth' });
                }, 100);
            } else {
                // Show a "New Articles" pill
                setShowNewItems(true);
            }
        }
        prevArticlesLength.current = articles.length;
    }, [articles, atTop]);

    if (!articles || articles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-zinc-400">
                <p>No articles found.</p>
            </div>
        )
    }

    return (
        <div 
            className="h-full flex flex-col relative overflow-hidden touch-pan-y"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Refresh Progress Modal - Handled Globally by GlobalUI now */}

            {/* Pull Indicator */}
            <div 
                className="absolute top-0 left-0 right-0 flex items-center justify-center h-16 -mt-16 pointer-events-none z-10"
                style={{ 
                    transform: `translateY(${pullDistance}px)`,
                    opacity: pullDistance > 0 ? 1 : 0,
                    transition: isDragging.current ? 'none' : 'all 0.3s ease-out'
                }}
            >
                {isRefreshing ? (
                    <div className="bg-white dark:bg-zinc-800 rounded-full p-2 shadow-lg border border-zinc-200 dark:border-zinc-700">
                        <Loader2 className="animate-spin text-brand" size={20} />
                    </div>
                ) : (
                    <div className="bg-white dark:bg-zinc-800 rounded-full p-2 shadow-lg border border-zinc-200 dark:border-zinc-700" style={{ transform: `rotate(${pullDistance * 2}deg)` }}>
                        <ArrowDown className={clsx("text-zinc-500", pullDistance > 60 && "text-brand")} size={20} />
                    </div>
                )}
            </div>

            {/* New Articles Button */}
            {showNewItems && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
                    <button
                        onClick={() => {
                            virtuosoRef.current?.scrollToIndex({ index: 0, align: 'start', behavior: 'smooth' });
                            setShowNewItems(false);
                        }}
                        className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-full shadow-lg hover:brightness-110 active:scale-95 transition-all animate-in fade-in slide-in-from-top-4 flex items-center gap-2"
                    >
                        <span>New Articles</span>
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    </button>
                </div>
            )}

            <div 
                className="h-full w-full"
                style={{ 
                    transform: `translateY(${pullDistance}px)`,
                    transition: isDragging.current ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
                }}
            >
                <Virtuoso
                    ref={virtuosoRef}
                    data={articles}
                    components={{ Header: () => <>{header}</> }}
                    atTopStateChange={setAtTop}
                    initialTopMostItemIndex={getScrollPosition(pathname)}
                    endReached={onLoadMore}
                    itemContent={(index, article) => (
                        <ArticleItem
                            key={article.id}
                            article={article}
                            feed={feedsMap.get(article.feedID)}
                            isSelected={index === selectedIndex}
                            onToggleRead={handleToggleRead}
                            onToggleBookmark={handleToggleBookmark}
                        />
                    )}
                    rangeChanged={(range) => {
                        setScrollPosition(pathname, range.startIndex);
                        if (range.startIndex === 0) {
                            setShowNewItems(false);
                        }
                    }}
                    className="w-full h-full"
                />
            </div>
        </div>
    );
}
