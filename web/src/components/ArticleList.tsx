'use client';

import React, { useEffect, useRef } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { Article } from '@/lib/db';
import { ArticleItem } from './ArticleItem';
import { db } from '@/lib/db';
import { usePathname } from 'next/navigation';
import { useScrollStore } from '@/store/scrollStore';
import { FeedService } from '@/lib/feed-service';

interface ArticleListProps {
    articles: Article[];
}

export function ArticleList({ articles }: ArticleListProps) {
    const pathname = usePathname();
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const { getScrollPosition, setScrollPosition } = useScrollStore();

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

    const [atTop, setAtTop] = React.useState(true);
    const [showNewItems, setShowNewItems] = React.useState(false);
    const prevArticlesLength = useRef(articles?.length || 0);

    // Restore scroll position on mount
    useEffect(() => {
        const savedPosition = getScrollPosition(pathname);
        if (savedPosition > 0 && virtuosoRef.current) {
            virtuosoRef.current.scrollToIndex({ index: savedPosition, align: 'start' });
        }
    }, [pathname, getScrollPosition]);

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
        <div className="h-full flex flex-col relative">
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

            <Virtuoso
                ref={virtuosoRef}
                data={articles}
                atTopStateChange={setAtTop}
                itemContent={(index, article) => (
                    <ArticleItem
                        key={article.id}
                        article={article}
                        onToggleRead={handleToggleRead}
                        onToggleBookmark={handleToggleBookmark}
                    />
                )}
                rangeChanged={(range) => {
                    // Save scroll position when user scrolls
                    setScrollPosition(pathname, range.startIndex);

                    // Hide "New Items" if we scroll to top manually
                    if (range.startIndex === 0) {
                        setShowNewItems(false);
                    }
                }}
                className="w-full h-full"
            />
        </div>
    );
}
