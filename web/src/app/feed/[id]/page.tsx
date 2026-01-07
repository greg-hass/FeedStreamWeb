'use client';

import { useParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Article } from '@/lib/db';
import { ArticleList } from '@/components/ArticleList';
import { AppHeader } from '@/components/AppHeader';
import { useState } from 'react';
import { FeedService } from '@/lib/feed-service';
import { useArticles } from '@/hooks/useArticles';

export default function FeedPage() {
    const params = useParams();
    const feedId = params.id as string;
    const [searchQuery, setSearchQuery] = useState('');
    const [limit, setLimit] = useState(100);

    const feed = useLiveQuery(() => db.feeds.get(feedId), [feedId]);
    const articles = useArticles(feedId, limit, searchQuery);

    const handleMarkAllRead = async () => {
        if (confirm('Mark all articles in this feed as read?')) {
            await FeedService.markFeedAsRead(feedId);
        }
    };

    const handleLoadMore = () => {
        setLimit(prev => prev + 100);
    };

    if (!feed) {
        return (
            <div className="h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
                <div className="text-zinc-400">Loading feed...</div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
            <AppHeader
                showRefresh
                showSearch
                onSearchChange={setSearchQuery}
                onMarkAllRead={handleMarkAllRead}
            />
            <div className="flex-1 overflow-hidden">
                {articles && articles.length > 0 ? (
                    <ArticleList 
                        articles={articles} 
                        onLoadMore={handleLoadMore}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-2">
                        <p>No articles yet</p>
                    </div>
                )}
            </div>
        </div>
    );
}
