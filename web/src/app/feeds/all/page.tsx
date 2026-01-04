'use client';

import { useState } from "react";
import { useArticles } from "@/hooks/useArticles";
import { ArticleList } from "@/components/ArticleList";
import { AppHeader } from "@/components/AppHeader";
import { FeedService } from "@/lib/feed-service";

export default function AllFeedsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const articles = useArticles('all', 2000, searchQuery);

    const handleMarkAllRead = async () => {
        if (confirm('Mark ALL articles as read? This cannot be undone.')) {
            await FeedService.markAllAsRead();
        }
    };

    return (
        <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
            <AppHeader 
                title="All Articles" 
                showSearch
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                onMarkAllRead={handleMarkAllRead} 
            />
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
