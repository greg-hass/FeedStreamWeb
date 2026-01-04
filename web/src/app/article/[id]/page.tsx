
'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Reader } from '@/components/Reader';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';
import { FeedService } from '@/lib/feed-service';

export default function ArticlePage() {
    const { id } = useParams() as { id: string };

    const article = useLiveQuery(() => db.articles.get(id), [id]);

    useEffect(() => {
        if (article && !article.isRead) {
            FeedService.toggleReadStatus(id, true);
        }
    }, [article, id]);

    if (!article) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-4 py-1">
                        <div className="h-4 bg-zinc-200 rounded w-3/4"></div>
                        <div className="space-y-2">
                            <div className="h-4 bg-zinc-200 rounded"></div>
                            <div className="h-4 bg-zinc-200 rounded w-5/6"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950">
            <div className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-100 dark:border-zinc-800 p-4">
                <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                    <ArrowLeft size={16} />
                    Back
                </Link>
            </div>
            <Reader article={article} />
        </div>
    );
}
