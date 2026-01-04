import React from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Check, Bookmark, Youtube, Radio, Rss, Mic, Play } from 'lucide-react';
import { clsx } from 'clsx';
import { Article } from '@/lib/db';
import { ArticleSwipeRow } from './ArticleSwipeRow';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAudioStore } from '@/store/audioStore';

interface ArticleItemProps {
    article: Article;
    onToggleRead?: (id: string) => void;
    onToggleBookmark?: (id: string) => void;
}

export function ArticleItem({ article, onToggleRead, onToggleBookmark }: ArticleItemProps) {
    // Look up feed title from database
    const feed = useLiveQuery(() => db.feeds.get(article.feedID), [article.feedID]);

    const getMediaIcon = () => {
        if (article.mediaKind === 'youtube') return Youtube;
        if (article.mediaKind === 'podcast') return Radio;
        return null;
    };
    const MediaIcon = getMediaIcon();
    const { setTrack, play } = useAudioStore();

    const handlePlay = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (article.enclosureURL) {
            setTrack({
                id: article.id,
                url: article.enclosureURL,
                title: article.title,
                artist: feed?.title,
                artwork: article.thumbnailPath,
                duration: article.duration
            });
            play();
        }
    };

    return (
        <ArticleSwipeRow
            isRead={article.isRead}
            isBookmarked={article.isBookmarked}
            onSwipeRight={() => onToggleRead?.(article.id)}
            onSwipeLeft={() => onToggleBookmark?.(article.id)}
        >
            <Link href={`/article/${article.id}`} className="block">
                <article className={clsx(
                    "relative px-4 sm:px-6 py-4 transition-colors",
                    "hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50",
                    "border-b border-zinc-100 dark:border-zinc-800/50"
                )}>
                    <div className="flex gap-4">
                        {/* Thumbnail */}
                        {article.thumbnailPath && (
                            <div className="shrink-0 relative group/thumb cursor-pointer" onClick={article.mediaKind === 'podcast' ? handlePlay : undefined}>
                                <img
                                    src={article.thumbnailPath}
                                    alt=""
                                    className={clsx(
                                        "w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg",
                                        "bg-zinc-200 dark:bg-zinc-800",
                                        article.mediaKind === 'podcast' && "group-hover/thumb:brightness-75 transition-all"
                                    )}
                                    loading="lazy"
                                />
                                {article.mediaKind === 'podcast' && (
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                                        <div className="bg-white/90 dark:bg-black/80 rounded-full p-2 shadow-lg">
                                            <Play size={20} className="fill-current text-zinc-900 dark:text-zinc-100 ml-0.5" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex-1 min-w-0 flex flex-col">
                            {/* Meta Line */}
                            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-1">
                                {article.mediaKind === 'podcast' ? (
                                    <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                                        <Mic size={12} />
                                        <span className="font-medium text-purple-600 dark:text-purple-400 truncate max-w-[150px]">
                                            {feed?.title || 'Unknown Feed'}
                                        </span>
                                    </div>
                                ) : (
                                    <>
                                        {MediaIcon && <MediaIcon size={12} className="text-brand shrink-0" />}
                                        <span className="font-medium text-brand truncate max-w-[150px]">
                                            {feed?.title || 'Loading...'}
                                        </span>
                                    </>
                                )}
                                <span className="text-zinc-300 dark:text-zinc-600">•</span>
                                <time className="shrink-0 text-sm text-orange-500 dark:text-orange-400 font-medium">
                                    {article.publishedAt ? formatDistanceToNow(article.publishedAt, { addSuffix: true }) : ''}
                                </time>
                            </div>

                            {/* Title */}
                            <h3 className={clsx(
                                "text-[17px] font-semibold leading-snug line-clamp-2 tracking-tight flex items-start gap-2",
                                article.isRead
                                    ? "text-zinc-500 dark:text-zinc-500"
                                    : "text-zinc-900 dark:text-zinc-100"
                            )}>
                                {!article.isRead && (
                                    <span className="shrink-0 w-2 h-2 rounded-full bg-emerald-500 mt-1.5" title="Unread" />
                                )}
                                {article.title}
                            </h3>

                            {/* Summary (desktop only) */}
                            <p className="mt-1 text-sm text-zinc-500 line-clamp-2 hidden sm:block leading-relaxed">
                                {article.summary?.replace(/<[^>]*>/g, '').slice(0, 140)}
                            </p>

                            {/* Actions */}
                            <div className="mt-2 flex items-center gap-3">
                                <button
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleRead?.(article.id); }}
                                    className={clsx(
                                        "p-1.5 rounded-full transition-colors",
                                        article.isRead ? "text-brand bg-brand/10" : "text-zinc-400 hover:text-brand hover:bg-brand/10"
                                    )}
                                >
                                    <Check size={16} strokeWidth={2.5} />
                                </button>
                                <button
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleBookmark?.(article.id); }}
                                    className={clsx(
                                        "p-1.5 rounded-full transition-colors",
                                        article.isBookmarked ? "text-amber-500 bg-amber-500/10" : "text-zinc-400 hover:text-amber-500 hover:bg-amber-500/10"
                                    )}
                                >
                                    <Bookmark size={16} className={article.isBookmarked ? "fill-current" : ""} />
                                </button>
                            </div>
                        </div>
                    </div>
                </article>
            </Link>
        </ArticleSwipeRow>
    );
}

ArticleItem.displayName = 'ArticleItem';
