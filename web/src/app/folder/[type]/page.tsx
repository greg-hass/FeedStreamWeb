'use client';

import { useArticles } from "@/hooks/useArticles";
import { ArticleList } from "@/components/ArticleList";
import { useParams } from "next/navigation";
import { List } from "lucide-react";

export default function FolderPage() {
    const { type } = useParams() as { type: string };
    const articles = useArticles(type);
    const title = type === 'all' ? 'All Feeds' : type.charAt(0).toUpperCase() + type.slice(1);

    return (
        <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
            <header className="header-blur sticky top-0 z-30 border-b border-zinc-200/50 dark:border-zinc-800/50">
                <div className="h-14 flex items-center gap-3 px-4 sm:px-6">
                    <List className="text-zinc-500" size={20} />
                    <h1 className="text-xl font-bold tracking-tight">{title}</h1>
                </div>
            </header>
            <div className="flex-1 overflow-hidden">
                {articles && articles.length > 0 ? (
                    <ArticleList articles={articles} />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-2">
                        <List size={48} className="opacity-20" />
                        <p>No articles</p>
                    </div>
                )}
            </div>
        </div>
    );
}
