'use client';

import { useArticles } from "@/hooks/useArticles";
import { ArticleList } from "@/components/ArticleList";
import { AppHeader } from "@/components/AppHeader";

export default function AllFeedsPage() {
    const articles = useArticles('all');

    return (
        <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
            <AppHeader title="All Articles" />
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
