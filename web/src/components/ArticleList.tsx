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

    // Restore scroll position on mount
    useEffect(() => {
        const savedPosition = getScrollPosition(pathname);
        if (savedPosition > 0 && virtuosoRef.current) {
            virtuosoRef.current.scrollToIndex({ index: savedPosition, align: 'start' });
        }
    }, [pathname, getScrollPosition]);

    if (!articles || articles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-zinc-400">
                <p>No articles found.</p>
            </div>
        )
    }

    return (
        <Virtuoso
            ref={virtuosoRef}
            data={articles}
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
            }}
            className="w-full h-full"
        />
    );
}

