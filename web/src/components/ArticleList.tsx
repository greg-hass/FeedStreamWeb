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
import { Loader2, ArrowDown, Rss } from 'lucide-react';
import { clsx } from 'clsx';
import { useUIStore } from '@/store/uiStore';

import { RefreshProgress } from './RefreshProgress';
import { ArticleSkeleton } from './ArticleSkeleton';

interface ArticleListProps {
    articles: Article[] | undefined;
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
    const { startSync, setProgress, endSync, isSyncing, abortController } = useUIStore(); // Use global store

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
            startSync(0); // This creates a NEW abortController in store
            
            // Get the FRESH controller instance immediately after startSync update
            // However, React state update is async.
            // Better pattern: startSync returns the controller OR we access the store instance directly.
            // But useUIStore.getState().abortController is synchronous.
            const controller = useUIStore.getState().abortController;
            
            setProgress(0, 0, 'Refreshing...');

            try {
                // Determine if we should Sync (Fever) or Refresh All (Local)
                await FeedService.refreshAllFeeds((completed, total, message) => {
                    setProgress(completed, total, message);
                }, controller?.signal);
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
    const [feeds, setFeeds] = useState<typeof rawFeeds>([]);

    useEffect(() => {
        // Immediately set feeds if we have data and state is empty (first load)
        if (rawFeeds && rawFeeds.length > 0 && (!feeds || feeds.length === 0)) {
            setFeeds(rawFeeds);
            return;
        }

        // Debounce subsequent updates
        const handler = setTimeout(() => {
            setFeeds(current => {
                // Prevent unnecessary updates if data hasn't actually changed
                if (JSON.stringify(current) === JSON.stringify(rawFeeds)) return current;
                return rawFeeds ?? [];
            });
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
            const article = articles?.[index];
            if (article) {
                router.push(`/article/${article.id}`);
            }
        },
        onMarkRead: (index) => {
            const article = articles?.[index];
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
            // Don't auto-scroll as it causes flickering/jumping.
            // Just show the pill if we aren't at the very top (or even if we are, to be safe)
            // Actually, if we are at top, Virtuoso might shift us down.
            // Let's just always show the pill for manual user action.
            setShowNewItems(true);
        }
        prevArticlesLength.current = articles.length;
    }, [articles]);

    // Show skeletons if articles are loading
    if (articles === undefined) {
        return (
            <div className="flex-1 overflow-hidden">
                <ArticleSkeleton count={6} />
            </div>
        );
    }

    if (articles.length === 0) {
        // If we are currently syncing, don't show the "empty" message yet as it causes flickering
        if (isSyncing) {
            return (
                <div className="flex-1 overflow-hidden">
                    <ArticleSkeleton count={6} />
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center p-12 text-zinc-400 h-full">
                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800/50 rounded-full flex items-center justify-center mb-4">
                    <Rss size={32} className="opacity-20" />
                </div>
                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1">All Caught Up</h3>
                <p className="text-sm text-zinc-500 max-w-xs text-center">No articles found in this view. Try pulling to refresh or check other feeds.</p>
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
                        className="active-press px-4 py-2 bg-brand/90 backdrop-blur-md text-white text-sm font-medium rounded-full shadow-lg hover:bg-brand transition-all animate-in fade-in slide-in-from-top-4 flex items-center gap-2 border border-brand/50"
                    >
                        <span>New Articles</span>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                        </span>
                    </button>
                </div>
            )}

            <div
                className="h-full w-full pull-refresh-content"
                style={{
                    transform: `translateY(${pullDistance}px) translateZ(0)`,
                    transition: isDragging.current ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
                }}
            >
                <Virtuoso
                    ref={virtuosoRef}
                    data={articles}
                    overscan={200}
                    computeItemKey={(index, item) => item.id}
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
                    className="w-full h-full article-list-container ios-scroll"
                />
            </div>
        </div>
    );
}
