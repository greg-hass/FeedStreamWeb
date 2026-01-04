import React, { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Check, Bookmark, Youtube, Radio, Rss, Mic, Play, MessageCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { Article, Feed } from '@/lib/db';
import { ArticleSwipeRow } from './ArticleSwipeRow';
import { useAudioStore } from '@/store/audioStore';

interface ArticleItemProps {
    article: Article;
    feed?: Feed;
    isSelected?: boolean;
    onToggleRead?: (id: string) => void;
    onToggleBookmark?: (id: string) => void;
}

function ArticleItemComponent({ article, feed, isSelected, onToggleRead, onToggleBookmark }: ArticleItemProps) {
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);

    const getTypeIcon = () => {
        if (article.mediaKind === 'youtube') return Youtube;
        if (article.mediaKind === 'podcast') return Mic;
        if (feed?.type === 'reddit') return MessageCircle;
        return Rss;
    };
    const TypeIcon = getTypeIcon();
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

    const handleVideoClick = (e: React.MouseEvent) => {
        // On desktop (md breakpoint), let the click bubble to the Link for navigation
        if (typeof window !== 'undefined' && window.innerWidth >= 768) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();
        if (article.mediaKind === 'youtube') {
            setIsVideoPlaying(true);
        }
    };

    const getPreviewText = () => {
        let text = article.summary || article.contentHTML || '';

        // Strip HTML comments (like <!-- SC_OFF --> from Reddit)
        text = text.replace(/<!--[\s\S]*?-->/g, '');

        // Strip all HTML tags
        text = text.replace(/<[^>]*>/g, '');

        // Decode HTML entities (including numeric like &#32; and &#39;)
        text = text
            .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
            .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&nbsp;/g, ' ');

        // Clean up excessive whitespace
        text = text.replace(/\s+/g, ' ').trim();

        return text.slice(0, 160);
    };

    // Extract YouTube video ID from contentHTML or URL
    const getYouTubeVideoId = (): string | null => {
        if (!article.contentHTML) return null;
        const match = article.contentHTML.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
    };

    const videoId = article.mediaKind === 'youtube' ? getYouTubeVideoId() : null;

    // Handle article click - podcasts play instead of navigating
    const handleArticleClick = (e: React.MouseEvent) => {
        if (article.mediaKind === 'podcast' && article.enclosureURL) {
            e.preventDefault();
            handlePlay(e);
        }
        // For non-podcasts, let the Link navigate normally
    };

    return (
        <ArticleSwipeRow
            isRead={article.isRead}
            isBookmarked={article.isBookmarked}
            onSwipeRight={() => onToggleRead?.(article.id)}
            onSwipeLeft={() => onToggleBookmark?.(article.id)}
        >
            <Link href={`/article/${article.id}`} className="block" onClick={handleArticleClick}>
                <article className={clsx(
                    "relative px-4 sm:px-6 py-4 transition-colors",
                    "hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50",
                    "border-b border-zinc-100 dark:border-zinc-800/50",
                    isSelected && "bg-brand/5 dark:bg-brand/10 border-l-4 border-l-brand pl-3 sm:pl-5"
                )}>
                    {/* Mobile: Vertical Layout | Desktop: Horizontal Layout */}
                    <div className="flex flex-col md:flex-row md:gap-4">
                        {/* Content */}
                        <div className="flex-1 min-w-0 flex flex-col">
                            {/* Meta Line - Feed info ABOVE title on mobile */}
                            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2 md:order-2 md:mt-0">
                                {/* Feed Icon */}
                                {feed?.iconURL && (
                                    <img
                                        src={feed.iconURL}
                                        alt=""
                                        className="w-4 h-4 rounded object-cover shrink-0 bg-zinc-200 dark:bg-zinc-800"
                                        loading="lazy"
                                        onError={(e) => e.currentTarget.style.display = 'none'}
                                    />
                                )}

                                {article.mediaKind === 'podcast' ? (
                                    <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                                        {!feed?.iconURL && <Mic size={12} />}
                                        <span className="font-medium text-purple-600 dark:text-purple-400 truncate max-w-[150px]">
                                            {feed?.title || 'Unknown Feed'}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="font-medium text-brand truncate max-w-[150px] flex items-center gap-1">
                                        {feed?.title || 'Loading...'}
                                    </span>
                                )}
                                <span className="text-zinc-300 dark:text-zinc-600">•</span>
                                <time className="shrink-0 text-sm text-orange-500 dark:text-orange-400 font-medium flex items-center gap-1.5">
                                    {article.publishedAt ? formatDistanceToNow(article.publishedAt, { addSuffix: true }) : ''}
                                    <TypeIcon size={14} className="text-zinc-400 dark:text-zinc-500" />
                                </time>
                            </div>

                            {/* Title */}
                            <h3 className={clsx(
                                "text-[17px] font-semibold leading-snug line-clamp-2 tracking-tight flex items-start gap-2 mb-2 md:order-1",
                                article.isRead
                                    ? "text-zinc-500 dark:text-zinc-500"
                                    : "text-zinc-900 dark:text-zinc-100"
                            )}>
                                {!article.isRead && (
                                    <span className="shrink-0 w-2 h-2 rounded-full bg-emerald-500 mt-1.5" title="Unread" />
                                )}
                                {article.title}
                            </h3>

                            {/* Preview Text - Desktop only */}
                            <p className="hidden md:block text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed mb-2 md:order-3">
                                {getPreviewText()}
                            </p>

                            {/* Actions - Desktop only */}
                            <div className="hidden md:flex items-center gap-3 md:order-4">
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

                        {/* Image/Video - Full width on mobile, right side on desktop */}
                        {article.thumbnailPath && (
                            <div
                                className={clsx(
                                    "mt-3 md:mt-0 md:shrink-0 md:w-28 md:h-28",
                                    "relative group/thumb cursor-pointer"
                                )}
                                onClick={article.mediaKind === 'youtube' ? handleVideoClick : article.mediaKind === 'podcast' ? handlePlay : undefined}
                            >
                                {/* Show embedded video on mobile when playing */}
                                {isVideoPlaying && videoId ? (
                                    <div className="w-full aspect-video md:hidden bg-black rounded-lg overflow-hidden">
                                        <iframe
                                            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1`}
                                            className="w-full h-full"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        />
                                    </div>
                                ) : (
                                    <img
                                        src={article.thumbnailPath}
                                        alt=""
                                        className={clsx(
                                            "w-full object-cover rounded-lg bg-zinc-200 dark:bg-zinc-800",
                                            "md:w-full md:h-full",
                                            "aspect-video md:aspect-auto",
                                            (article.mediaKind === 'podcast' || article.mediaKind === 'youtube') && "group-hover/thumb:brightness-75 transition-all"
                                        )}
                                        loading="lazy"
                                        onError={(e) => {
                                            // Hide the entire thumbnail container when image fails to load
                                            const container = e.currentTarget.closest('.group\\/thumb');
                                            if (container) (container as HTMLElement).style.display = 'none';
                                        }}
                                    />
                                )}

                                {/* Play button overlay */}
                                {!isVideoPlaying && (article.mediaKind === 'podcast' || article.mediaKind === 'youtube') && (
                                    <div className="absolute inset-0 flex items-center justify-center opacity-80 group-hover/thumb:opacity-100 transition-opacity pointer-events-none">
                                        <div className="bg-white/90 dark:bg-black/80 rounded-full p-3 md:p-2 shadow-lg">
                                            <Play size={24} className="fill-current text-zinc-900 dark:text-zinc-100 ml-0.5 md:w-5 md:h-5" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Mobile Actions - Below image */}
                    <div className="flex md:hidden items-center gap-3 mt-3">
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
                </article>
            </Link>
        </ArticleSwipeRow>
    );
}

// Memoized to prevent re-renders during virtual scroll
export const ArticleItem = React.memo(ArticleItemComponent, (prev, next) => {
    return (
        prev.article.id === next.article.id &&
        prev.article.isRead === next.article.isRead &&
        prev.article.isBookmarked === next.article.isBookmarked &&
        prev.isSelected === next.isSelected &&
        prev.feed?.id === next.feed?.id
    );
});

ArticleItem.displayName = 'ArticleItem';
