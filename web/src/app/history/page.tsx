
'use client';

import { useArticles } from "@/hooks/useArticles";
import { ArticleList } from "@/components/ArticleList";

export default function HistoryPage() {
    const articles = useArticles('history');

    return (
        <div className="h-screen flex flex-col bg-white dark:bg-zinc-950">
            <header className="h-14 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-4 shrink-0">
                <h1 className="font-semibold text-lg">History</h1>
            </header>

            <div className="flex-1 overflow-hidden">
                {articles ? (
                    <ArticleList articles={articles} />
                ) : (
                    <div className="p-8 text-center text-zinc-500">Loading...</div>
                )}
            </div>
        </div>
    );
}
