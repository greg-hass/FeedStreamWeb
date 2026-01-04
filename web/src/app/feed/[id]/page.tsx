'use client';

import { useParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Article } from '@/lib/db';
import { ArticleList } from '@/components/ArticleList';
import { AppHeader } from '@/components/AppHeader';
import { useState } from 'react';
import { FeedService } from '@/lib/feed-service';

export default function FeedPage() {
    const params = useParams();
    const feedId = params.id as string;
    const [searchQuery, setSearchQuery] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);

    const feed = useLiveQuery(() => db.feeds.get(feedId), [feedId]);
    const articles = useLiveQuery(
        () => db.articles.where('feedID').equals(feedId).reverse().sortBy('publishedAt'),
        [feedId]
    ) as Article[] | undefined;

    const handleSync = async () => {
        if (isSyncing || !feed) return;
        setIsSyncing(true);
        try {
            await FeedService.refreshFeed(feed);
        } finally {
            setIsSyncing(false);
        }
    };

    const filteredArticles = articles?.filter(article => {
        if (!searchQuery) return true;
        return article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            article.summary?.toLowerCase().includes(searchQuery.toLowerCase());
    });

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
            />
            <div className="flex-1 overflow-hidden">
                {filteredArticles && filteredArticles.length > 0 ? (
                    <ArticleList articles={filteredArticles} />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-2">
                        <p>No articles yet</p>
                        <button onClick={handleSync} className="text-brand hover:underline">
                            Refresh Feed
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
