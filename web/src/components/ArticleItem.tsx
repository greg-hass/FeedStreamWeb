"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Check, Bookmark, Youtube, Radio, Rss, Mic, Play, MessageCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { Article, Feed } from '@/lib/db';
import { MemoizedArticleSwipeRow as ArticleSwipeRow } from './ArticleSwipeRow';
import { useAudioStore } from '@/store/audioStore';

const YOUTUBE_PATTERNS = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
];

const HTML_TAG_PATTERN = /<[^>]*>?/gm;

interface ArticleItemProps {
    article: Article;
    feed?: Feed;
    isSelected?: boolean;
    onToggleRead?: (id: string) => void;
    onToggleBookmark?: (id: string) => void;
}

function ArticleItemComponent({ article, feed, isSelected, onToggleRead, onToggleBookmark }: ArticleItemProps) {
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);



    // Selector optimization to prevent re-renders on audio progress
    const setTrack = useAudioStore((s) => s.setTrack);
    const play = useAudioStore((s) => s.play);

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

    // Extract YouTube video ID from contentHTML, URL, or Thumbnail
    const getYouTubeVideoId = (): string | null => {
        const extractFromUrl = (url: string | undefined | null) => {
            if (!url) return null;
            try {
                // If the URL is just an ID (11 chars), return it (rare but possible in some feeds)
                if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;

                const urlObj = new URL(url);
                const hostname = urlObj.hostname.replace('www.', '');

                if (hostname === 'youtu.be') return urlObj.pathname.slice(1);

                if (hostname.includes('youtube.com')) {
                    // v= query param
                    const v = urlObj.searchParams.get('v');
                    if (v) return v;

                    // Path segments: /embed/ID, /v/ID, /shorts/ID, /live/ID
                    const path = urlObj.pathname;
                    if (path.startsWith('/embed/')) return path.split('/')[2];
                    if (path.startsWith('/v/')) return path.split('/')[2];
                    if (path.startsWith('/shorts/')) return path.split('/')[2];
                    if (path.startsWith('/live/')) return path.split('/')[2];
                }
            } catch (e) {
                // Fallback for partial URLs or regex matching
                const match = url.match(YOUTUBE_PATTERNS[0]);
                if (match) return match[1];
            }
            return null;
        };

        // 1. Check contentHTML (regex is fine for iframes strings)
        if (article.contentHTML) {
            const match = article.contentHTML.match(YOUTUBE_PATTERNS[0]);
            if (match) return match[1];
        }

        // 2. Check Article URL
        const fromUrl = extractFromUrl(article.url);
        if (fromUrl) return fromUrl;

        // 3. Check Thumbnail Path (High confidence fallback)
        // Format: https://i.ytimg.com/vi/[ID]/maxresdefault.jpg
        if (article.thumbnailPath && article.thumbnailPath.includes('/vi/')) {
            const match = article.thumbnailPath.match(/\/vi\/([^\/]+)\//);
            if (match) return match[1];
        }

        return null;
    };

    // Memoize expensive computations to avoid recalculating on every render
    const TypeIcon = useMemo(() => {
        if (article.mediaKind === 'youtube') return Youtube;
        if (article.mediaKind === 'podcast') return Mic;
        if (feed?.type === 'reddit') return MessageCircle;
        return Rss;
    }, [article.mediaKind, feed?.type]);

    const previewText = useMemo(() => {
        if (article.summary) return article.summary.replace(HTML_TAG_PATTERN, '');
        if (article.contentHTML) return article.contentHTML.replace(HTML_TAG_PATTERN, '').slice(0, 200);
        return '';
    }, [article.summary, article.contentHTML]);

    const videoId = useMemo(() => {
        return article.mediaKind === 'youtube' ? getYouTubeVideoId() : null;
    }, [article.mediaKind, article.contentHTML, article.url, article.thumbnailPath]);

    // Memoize relative time - only recalculate when publishedAt changes
    const relativeTime = useMemo(() => {
        if (!article.publishedAt) return '';
        return formatDistanceToNow(article.publishedAt, { addSuffix: true });
    }, [article.publishedAt]);

    // Handle article click - podcasts play instead of navigating
    const handleArticleClick = (e: React.MouseEvent) => {
        if (article.mediaKind === 'podcast' && article.enclosureURL) {
            e.preventDefault();
            handlePlay(e);
        }
        // For non-podcasts, let the Link navigate normally
    };

    const handleVideoClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsVideoPlaying(true);
        
        // Load YouTube API if not present
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        }
    };

    const videoRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);

    useEffect(() => {
        if (isVideoPlaying && article.mediaKind === 'youtube' && videoId && videoRef.current) {
            const initPlayer = () => {
                playerRef.current = new window.YT.Player(videoRef.current, {
                    videoId: videoId,
                    playerVars: {
                        autoplay: 1,
                        playsinline: 1,
                        modestbranding: 1,
                        rel: 0,
                        start: Math.floor(article.playbackPosition || 0),
                    },
                    events: {
                        onStateChange: (event: any) => {
                            if (event.data === window.YT.PlayerState.PLAYING) {
                                const interval = setInterval(() => {
                                    if (playerRef.current?.getCurrentTime) {
                                        db.articles.update(article.id, { playbackPosition: playerRef.current.getCurrentTime() });
                                    }
                                }, 5000);
                                playerRef.current._posInterval = interval;
                            } else {
                                if (playerRef.current?._posInterval) clearInterval(playerRef.current._posInterval);
                                if (playerRef.current?.getCurrentTime) {
                                    db.articles.update(article.id, { playbackPosition: playerRef.current.getCurrentTime() });
                                }
                            }
                        }
                    }
                });
            };

            if (window.YT && window.YT.Player) initPlayer();
            else {
                const prev = window.onYouTubeIframeAPIReady;
                window.onYouTubeIframeAPIReady = () => {
                    if (prev) prev();
                    initPlayer();
                };
            }
        }

        return () => {
            if (playerRef.current) {
                if (playerRef.current._posInterval) clearInterval(playerRef.current._posInterval);
                playerRef.current.destroy();
                playerRef.current = null;
            }
        };
    }, [isVideoPlaying, videoId, article.id]);

    const isLocal = isNaN(parseInt(article.id));

    return (
        <ArticleSwipeRow
            isRead={article.isRead}
            isBookmarked={article.isBookmarked}
            onSwipeRight={() => onToggleRead?.(article.id)}
            onSwipeLeft={() => onToggleBookmark?.(article.id)}
        >
            <Link href={`/article/${article.id}`} className="block" onClick={handleArticleClick}>
                <article className={clsx(
                    "article-item relative px-4 sm:px-6 py-4 transition-colors select-none",
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
                                        decoding="async"
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
                                <time
                                    className="shrink-0 text-sm text-orange-500 dark:text-orange-400 font-medium flex items-center gap-1.5"
                                    suppressHydrationWarning
                                >
                                    {relativeTime}
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
                                {previewText}
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
                                    "mt-3 md:mt-0 md:shrink-0",
                                    "w-full aspect-video", // Mobile: Force 16:9 video ratio
                                    isVideoPlaying ? "md:w-[320px] md:h-[180px]" : "md:w-28 md:h-28 md:aspect-auto",
                                    "relative group/thumb cursor-pointer transition-all duration-300 ease-out"
                                )}
                                onClick={article.mediaKind === 'youtube' ? handleVideoClick : article.mediaKind === 'podcast' ? handlePlay : undefined}
                            >
                                {/* Show embedded video on mobile when playing */}
                                {isVideoPlaying && videoId ? (
                                    <div className="w-full h-full bg-black rounded-lg overflow-hidden">
                                        {article.mediaKind === 'youtube' ? (
                                            <div ref={videoRef} className="w-full h-full" />
                                        ) : (
                                            <iframe
                                                src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&modestbranding=1&rel=0`}
                                                className="w-full h-full"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                                                allowFullScreen
                                                style={{ border: 0, minHeight: '180px' }}
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <img
                                        src={article.thumbnailPath}
                                        alt=""
                                        className={clsx(
                                            "w-full object-cover rounded-lg bg-zinc-200 dark:bg-zinc-800 img-blur-up",
                                            "h-full", // Always fill container
                                            (article.mediaKind === 'podcast' || article.mediaKind === 'youtube') && "group-hover/thumb:brightness-75 transition-all"
                                        )}
                                        loading="lazy"
                                        decoding="async"
                                        onLoad={(e) => e.currentTarget.classList.add('loaded')}
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
