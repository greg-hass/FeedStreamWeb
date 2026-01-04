'use client';

import { useParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Article } from '@/lib/db';
import { ArticleList } from '@/components/ArticleList';
import { ArrowLeft, FolderOpen } from 'lucide-react';
import Link from 'next/link';

export default function FolderViewPage() {
    const params = useParams();
    const folderId = params.folderId as string;

    const folder = useLiveQuery(() => db.folders.get(folderId), [folderId]);
    const feeds = useLiveQuery(() => db.feeds.where('folderID').equals(folderId).toArray(), [folderId]) || [];
    const feedIds = feeds.map(f => f.id);

    const articles = useLiveQuery(async () => {
        if (feedIds.length === 0) return [];
        const allArticles: Article[] = [];
        for (const feedId of feedIds) {
            const feedArticles = await db.articles.where('feedID').equals(feedId).toArray();
            allArticles.push(...feedArticles);
        }
        // Sort by publishedAt descending (newest first)
        return allArticles.sort((a, b) => {
            const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
            const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
            return dateB - dateA;
        });
    }, [feedIds.join(',')]) as Article[] | undefined;

    if (!folder) {
        return (
            <div className="h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
                <div className="text-zinc-400">Loading folder...</div>
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
                    <FolderOpen className="text-amber-500" size={20} />
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-bold tracking-tight truncate">{folder.name}</h1>
                        <p className="text-xs text-zinc-500">{feeds.length} feeds • {articles?.length || 0} articles</p>
                    </div>
                </div>
            </header>
            <div className="flex-1 overflow-hidden">
                {articles && articles.length > 0 ? (
                    <ArticleList articles={articles} />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-2">
                        <FolderOpen size={48} className="opacity-20" />
                        <p>No articles in this folder</p>
                    </div>
                )}
            </div>
        </div>
    );
}
