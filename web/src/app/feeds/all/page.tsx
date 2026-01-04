'use client';

import { useArticles } from "@/hooks/useArticles";
import { ArticleList } from "@/components/ArticleList";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { FeedService } from "@/lib/feed-service";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { clsx } from "clsx";

export default function AllFeedsPage() {
    const articles = useArticles('all');
    const [isSyncing, setIsSyncing] = useState(false);
    const feeds = useLiveQuery(() => db.feeds.toArray()) || [];

    const handleSync = async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        try {
            for (const feed of feeds) {
                await FeedService.refreshFeed(feed);
            }
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
            <header className="header-blur sticky top-0 z-30 border-b border-zinc-200/50 dark:border-zinc-800/50">
                <div className="h-14 flex items-center justify-between px-4 sm:px-6">
                    <h1 className="text-xl font-bold tracking-tight">All Articles</h1>
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className={clsx(
                            "p-2 rounded-full transition-colors",
                            "text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800",
                            isSyncing && "opacity-50"
                        )}
                    >
                        <RefreshCw size={20} className={isSyncing ? "animate-spin" : ""} />
                    </button>
                </div>
            </header>
            <div className="flex-1 overflow-hidden">
                {articles ? <ArticleList articles={articles} /> : (
                    <div className="flex items-center justify-center h-full">
                        <div className="animate-pulse text-zinc-400">Loading...</div>
                    </div>
                )}
            </div>
        </div>
    );
}
