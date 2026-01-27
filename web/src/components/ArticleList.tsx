'use client';

import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { Article } from '@/lib/db';
import { ArticleItem } from './ArticleItem';
import { usePathname, useRouter } from 'next/navigation';
import { useScrollStore } from '@/store/scrollStore';
import { useSync } from '@/hooks/useSync';
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
    const [isRefreshing, setIsRefreshing] = useState(false);
    const pullDistanceRef = useRef(0);
    const pullIndicatorRef = useRef<HTMLDivElement>(null);
    const contentContainerRef = useRef<HTMLDivElement>(null);
    
    const touchStartY = useRef(0);
    const isDragging = useRef(false);
    const lastSyncTime = useRef<number>(0);
    const { startSync, setProgress, endSync, isSyncing } = useUIStore();

    const updatePullPosition = (distance: number, animate = false) => {
        pullDistanceRef.current = distance;
        
        if (pullIndicatorRef.current) {
            pullIndicatorRef.current.style.transition = animate ? 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none';
            pullIndicatorRef.current.style.transform = `translateY(${distance}px)`;
            pullIndicatorRef.current.style.opacity = distance > 0 ? '1' : '0';
            
            // Rotate the arrow icon if it exists
            const arrow = pullIndicatorRef.current.querySelector('.pull-arrow');
            if (arrow) {
                (arrow as HTMLElement).style.transform = `rotate(${distance * 2}deg)`;
                if (distance > 60) {
                    arrow.classList.add('text-brand');
                } else {
                    arrow.classList.remove('text-brand');
                }
            }
        }
        
        if (contentContainerRef.current) {
            contentContainerRef.current.style.transition = animate ? 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none';
            contentContainerRef.current.style.transform = `translateY(${distance}px) translateZ(0)`;
        }
    };

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
            updatePullPosition(damped);
        } else {
            updatePullPosition(0);
        }
    };

    const { runSync } = useSync();

    const handleTouchEnd = async () => {
        if (!isDragging.current) return;
        isDragging.current = false;

        const finalDistance = pullDistanceRef.current;

        if (finalDistance > 60) {
            // Trigger Refresh
            setIsRefreshing(true);
            updatePullPosition(60, true); // Snap to loading position

            try {
                await runSync();
            } catch (e) {
                console.error("Refresh failed", e);
            } finally {
                setIsRefreshing(false);
                updatePullPosition(0, true);
            }
        } else {
            updatePullPosition(0, true);
        }
    };

    // Optimization: Debounce Feed Updates to prevent flickering during sync
    // Note: With backend API, feeds are fetched separately
    const [feeds, setFeeds] = useState<any[]>([]);

    useEffect(() => {
        // Fetch feeds from backend on mount
        const fetchFeeds = async () => {
            try {
                const { getFeeds } = await import('@/lib/api-client');
                const feedsData = await getFeeds();
                setFeeds(feedsData);
            } catch (e) {
                console.error("Failed to fetch feeds:", e);
            }
        };
        fetchFeeds();
    }, []);

    const feedsMap = useMemo(() => {
        const map = new Map();
        if (feeds) {
            feeds.forEach(f => map.set(f.id, f));
        }
        return map;
    }, [feeds]);

    const handleToggleRead = useCallback(async (id: string) => {
        try {
            const { markArticleRead } = await import('@/lib/api-client');
            const article = articles?.find(a => a.id === id);
            if (article) {
                await markArticleRead(id, !article.isRead);
            }
        } catch (e) {
            console.error("Failed to toggle read status:", e);
        }
    }, [articles]);

    const handleToggleBookmark = useCallback(async (id: string) => {
        try {
            const { markArticleBookmarked } = await import('@/lib/api-client');
            const article = articles?.find(a => a.id === id);
            if (article) {
                await markArticleBookmarked(id, !article.isBookmarked);
            }
        } catch (e) {
            console.error("Failed to toggle bookmark:", e);
        }
    }, [articles]);

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

    // Stable callback for rangeChanged to prevent re-renders
    const handleRangeChanged = useCallback((range: { startIndex: number }) => {
        // Debounce scroll position updates to prevent jank
        // Only save every 5 items to reduce store updates
        const roundedIndex = Math.floor(range.startIndex / 5) * 5;
        setScrollPosition(pathname, roundedIndex);
        if (range.startIndex === 0) {
            setShowNewItems(false);
        }
    }, [pathname, setScrollPosition]);

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
                ref={pullIndicatorRef}
                className="absolute top-0 left-0 right-0 flex items-center justify-center h-16 -mt-16 pointer-events-none z-10 opacity-0"
            >
                {isRefreshing ? (
                    <div className="bg-white dark:bg-zinc-800 rounded-full p-2 shadow-lg border border-zinc-200 dark:border-zinc-700">
                        <Loader2 className="animate-spin text-brand" size={20} />
                    </div>
                ) : (
                    <div className="bg-white dark:bg-zinc-800 rounded-full p-2 shadow-lg border border-zinc-200 dark:border-zinc-700">
                        <ArrowDown className="pull-arrow text-zinc-500" size={20} />
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
                ref={contentContainerRef}
                className="h-full w-full pull-refresh-content"
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
                    rangeChanged={handleRangeChanged}
                    className="w-full h-full article-list-container ios-scroll"
                />
            </div>
        </div>
    );
}
