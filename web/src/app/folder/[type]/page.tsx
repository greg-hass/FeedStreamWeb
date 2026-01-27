'use client';

import { useArticles } from "@/hooks/useArticles";
import { ArticleList } from "@/components/ArticleList";
import { useParams } from "next/navigation";
import { List } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useState } from "react";
import { Article } from "@/lib/db";

export default function FolderPage() {
    const { type } = useParams() as { type: string };
    const { articles } = useArticles(type);
    const title = type === 'all' ? 'All Feeds' : type.charAt(0).toUpperCase() + type.slice(1);

    return (
        <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
            <AppHeader
                showRefresh
                showSearch
                title={title}
            />
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
