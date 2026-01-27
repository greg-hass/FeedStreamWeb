'use client';

import { useArticles } from "@/hooks/useArticles";
import { ArticleList } from "@/components/ArticleList";
import { Bookmark } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

export default function SavedPage() {
    const { articles } = useArticles('saved');

    return (
        <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
            <AppHeader
                title="Bookmarks"
                icon={<Bookmark className="text-amber-500" size={20} />}
            />
            <div className="flex-1 overflow-hidden">
                {articles && articles.length > 0 ? (
                    <ArticleList articles={articles} />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-2">
                        <Bookmark size={48} className="opacity-20" />
                        <p>No bookmarked articles</p>
                    </div>
                )}
            </div>
        </div>
    );
}
