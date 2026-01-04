'use client';

import { useParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Article } from '@/lib/db';
import { ArticleList } from '@/components/ArticleList';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { FeedService } from '@/lib/feed-service';
import Link from 'next/link';
import { clsx } from 'clsx';

export default function FeedPage() {
    const params = useParams();
    const feedId = params.id as string;
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

    if (!feed) {
        return (
            <div className="h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
                <div className="text-zinc-400">Loading feed...</div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
            <header className="header-blur sticky top-0 z-30 border-b border-zinc-200/50 dark:border-zinc-800/50">
                <div className="h-14 flex items-center gap-3 px-4 sm:px-6">
                    <Link
                        href="/"
                        className="p-2 -ml-2 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors md:hidden"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-bold tracking-tight truncate">{feed.title}</h1>
                        <p className="text-xs text-zinc-500 truncate">{feed.feedURL}</p>
                    </div>
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className={clsx(
                            "p-2 rounded-full transition-colors shrink-0",
                            "text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800",
                            isSyncing && "opacity-50"
                        )}
                    >
                        <RefreshCw size={20} className={isSyncing ? "animate-spin" : ""} />
                    </button>
                </div>
            </header>
            <div className="flex-1 overflow-hidden">
                {articles && articles.length > 0 ? (
                    <ArticleList articles={articles} />
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
