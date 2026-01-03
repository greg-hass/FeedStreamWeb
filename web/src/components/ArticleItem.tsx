
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

import { ArticleSwipeRow } from './ArticleSwipeRow';

export function ArticleItem({ article, onToggleRead, onToggleBookmark }: ArticleItemProps) {
    return (
        <ArticleSwipeRow
            isRead={article.isRead}
            isBookmarked={article.isBookmarked}
            onSwipeRight={() => onToggleRead?.(article.id)}
            onSwipeLeft={() => onToggleBookmark?.(article.id)}
        >
            <div className="relative group hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors py-4 px-4 sm:px-6">
                {/* Main touch target for navigation */}
                <Link href={`/article/${article.id}`} className="absolute inset-0 z-0" aria-label={`Read ${article.title}`} />

                <div className="flex gap-4 relative z-10 pointer-events-none">
                    {/* Thumbnail */}
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
                                <span className="font-medium text-zinc-700 dark:text-zinc-300">{article.feedID}</span>
                                <span>•</span>
                                <span>{article.publishedAt ? formatDistanceToNow(article.publishedAt, { addSuffix: true }) : ''}</span>
                            </div>

                            <h3 className={clsx(
                                "text-base font-semibold leading-tight line-clamp-2",
                                article.isRead ? "text-zinc-600 dark:text-zinc-400" : "text-zinc-900 dark:text-zinc-100"
                            )}>
                                {article.title}
                            </h3>

                            <p className="text-sm text-zinc-500 line-clamp-2 hidden sm:block">
                                {article.summary?.replace(/<[^>]*>/g, '').slice(0, 150)}
                            </p>
                        </div>

                        <div className="mt-2 flex items-center gap-4 text-zinc-400 pointer-events-auto">
                            <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleRead?.(article.id); }}
                                className="hover:text-brand transition-colors p-1 -ml-1"
                            >
                                <Check size={18} className={clsx(article.isRead && "text-brand")} />
                            </button>

                            <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleBookmark?.(article.id); }}
                                className="hover:text-amber-500 transition-colors p-1"
                            >
                                <Bookmark size={18} className={clsx(article.isBookmarked && "fill-current text-amber-500")} />
                            </button>

                            {article.mediaKind !== 'none' && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 uppercase tracking-wide">
                                    {article.mediaKind}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </ArticleSwipeRow>
    );
}
    );
}

ArticleItem.displayName = 'ArticleItem';
