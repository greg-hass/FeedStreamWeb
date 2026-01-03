
'use client';

import { useArticles } from "@/hooks/useArticles";
import { ArticleList } from "@/components/ArticleList";
import { useParams } from "next/navigation";

export default function FolderPage() {
    const { type } = useParams() as { type: string };
    const articles = useArticles(type);

    const title = type.charAt(0).toUpperCase() + type.slice(1);

    return (
        <div className="h-screen flex flex-col bg-white dark:bg-zinc-950">
            <header className="h-14 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-4 shrink-0">
                <h1 className="font-semibold text-lg">{title}</h1>
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
