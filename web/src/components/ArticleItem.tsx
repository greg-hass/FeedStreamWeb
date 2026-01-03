
import React from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Check, Bookmark, Play } from 'lucide-react';
import { clsx } from 'clsx';
import { Article } from '@/lib/db';

interface ArticleItemProps {
    article: Article;
    onToggleRead?: (id: string) => void;
    onToggleBookmark?: (id: string) => void;
}

export const ArticleItem = React.memo(({ article, onToggleRead, onToggleBookmark }: ArticleItemProps) => {
    return (
        <div className={clsx(
            "flex flex-col sm:flex-row gap-3 p-4 border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer",
            article.isRead && "opacity-60"
        )}>
            {/* Thumbnail (if present) */}
            {article.thumbnailPath && (
                <div className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={article.thumbnailPath}
                        alt=""
                        className="w-full sm:w-24 h-40 sm:h-24 object-cover rounded-md bg-zinc-200 dark:bg-zinc-800"
                        loading="lazy"
                    />
                </div>
            )}

            <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                        {/* Feed Source/Icon would go here if we had Feed Map */}
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{article.feedID}</span>
                        <span>•</span>
                        <span>{article.publishedAt ? formatDistanceToNow(article.publishedAt, { addSuffix: true }) : ''}</span>
                    </div>

                    <Link href={`/article/${article.id}`} className="block">
                        <h3 className={clsx(
                            "text-base font-semibold leading-tight line-clamp-2",
                            article.isRead ? "text-zinc-600 dark:text-zinc-400" : "text-zinc-900 dark:text-zinc-100"
                        )}>
                            {article.title}
                        </h3>
                    </Link>

                    <p className="text-sm text-zinc-500 line-clamp-2 hidden sm:block">
                        {article.summary?.replace(/<[^>]*>/g, '').slice(0, 150)}
                    </p>
                </div>

                <div className="mt-2 flex items-center gap-4 text-zinc-400">
                    <button
                        onClick={(e) => { e.preventDefault(); onToggleRead?.(article.id); }}
                        className="hover:text-brand transition-colors"
                    >
                        <Check size={16} className={clsx(article.isRead && "text-brand")} />
                    </button>

                    <button
                        onClick={(e) => { e.preventDefault(); onToggleBookmark?.(article.id); }}
                        className="hover:text-amber-500 transition-colors"
                    >
                        <Bookmark size={16} className={clsx(article.isBookmarked && "fill-current text-amber-500")} />
                    </button>

                    {article.mediaKind !== 'none' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 uppercase tracking-wide">
                            {article.mediaKind}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
});

ArticleItem.displayName = 'ArticleItem';
