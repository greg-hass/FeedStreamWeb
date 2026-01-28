
'use client';

import React, { useEffect, useState, useRef } from 'react';
import DOMPurify from 'dompurify';
import { Article } from '@/lib/db';
import { format } from 'date-fns';
import { ExternalLink, BookOpen, ZoomIn, ZoomOut, Share, Palette, Moon, Sun, Headphones, Square } from 'lucide-react';
import { decodeHTMLEntities } from '@/lib/utils';
import { db } from '@/lib/db';
import { clsx } from 'clsx';
import { ArticleVideoPlayer } from './article/ArticleVideoPlayer';

import { toast } from 'sonner';
import './Reader.css';

// Whitelist for iframe domains
export const ALLOWED_IFRAME_DOMAINS = [
    'www.youtube.com',
    'youtube.com',
    'youtu.be',
    'www.youtube-nocookie.com',
    'player.vimeo.com',
];

export const getSanitizeOptions = () => {
    // We use a hook to strictly validate iframe sources
    DOMPurify.removeHook('beforeSanitizeElements');
    DOMPurify.addHook('beforeSanitizeElements', (node) => {
        if (node instanceof Element && node.tagName === 'IFRAME') {
            const src = node.getAttribute('src');
            if (src) {
                try {
                    const url = new URL(src, window.location.origin);
                    if (!ALLOWED_IFRAME_DOMAINS.includes(url.hostname)) {
                        node.remove();
                    }
                } catch (e) {
                    node.remove();
                }
            } else {
                node.remove();
            }
        }
    });

    return {
        ADD_TAGS: ['iframe'],
        ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'style'],
    };
};

interface ReaderProps {
    article: Article;
}

type ReaderTheme = 'light' | 'sepia' | 'navy' | 'black';

export function Reader({ article }: ReaderProps) {
    const [content, setContent] = useState<string>('');
    const [isReaderMode, setIsReaderMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [zoom, setZoom] = useState(100); // 100 = default, range 70-150
    const [theme, setTheme] = useState<ReaderTheme>('light');

    // TTS State
    const [isSpeaking, setIsSpeaking] = useState(false);
    const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

    // Load saved preferences if available (could be moved to store)
    useEffect(() => {
        const savedTheme = localStorage.getItem('reader-theme') as ReaderTheme;
        if (savedTheme) setTheme(savedTheme);
        const savedZoom = localStorage.getItem('reader-zoom');
        if (savedZoom) setZoom(parseInt(savedZoom));

        // Cleanup speech on unmount
        return () => {
            if (speechRef.current) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    const handleThemeChange = (newTheme: ReaderTheme) => {
        setTheme(newTheme);
        localStorage.setItem('reader-theme', newTheme);
    };

    const handleZoomChange = (newZoom: number) => {
        setZoom(newZoom);
        localStorage.setItem('reader-zoom', String(newZoom));
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: article.title,
                    text: article.summary,
                    url: article.url,
                });
            } catch (err) {
                console.error('Share failed:', err);
            }
        } else {
            // Fallback: Copy to clipboard
            navigator.clipboard.writeText(article.url || window.location.href);
            toast.success('Link copied to clipboard');
        }
    };

    const handleSpeak = () => {
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            return;
        }

        const textToRead = document.querySelector('.reader-content')?.textContent || article.summary || '';
        if (!textToRead) return;

        const utterance = new SpeechSynthesisUtterance(textToRead);
        utterance.onend = () => setIsSpeaking(false);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        // Try to select a good voice
        const voices = window.speechSynthesis.getVoices();
        // Prefer Google US English or native generic
        const preferredVoice = voices.find(v => v.name.includes('Google US English')) || voices.find(v => v.lang === 'en-US');
        if (preferredVoice) utterance.voice = preferredVoice;

        speechRef.current = utterance;
        window.speechSynthesis.speak(utterance);
        setIsSpeaking(true);
    };


    // Helper to fetch and parse with Readability
    const fetchReaderContent = async () => {
        if (!article.url) return null;

        try {
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(article.url)}`;
            const res = await fetch(proxyUrl);
            if (!res.ok) return null;
            const html = await res.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            const { Readability } = await import('@mozilla/readability');
            const reader = new Readability(doc);
            const parsed = reader.parse();

            if (parsed && parsed.content) {
                const cleanHtml = DOMPurify.sanitize(parsed.content, getSanitizeOptions());
                // Cache in DB
                await db.articles.update(article.id, { readerHTML: cleanHtml });
                return cleanHtml;
            }
        } catch (e) {
            console.error('Reader mode failed', e);
        }
        return null;
    };

    // Memoize options to avoid re-creating hook on every render
    const sanitizeOptions = React.useMemo(() => getSanitizeOptions(), []);

    // 1. Initial Content Resolution (Fast)
    useEffect(() => {
        // If we have cached reader content, use it immediately
        if (article.readerHTML && article.mediaKind !== 'youtube' && article.mediaKind !== 'podcast') {
            setContent(article.readerHTML);
            setIsReaderMode(true);
            return;
        }

        // Fallback to RSS content (Sanitize once)
        const initialHtml = article.contentHTML || article.summary || '';
        if (initialHtml) {
            // Decode entities first to handle double-escaped content (common in Reddit feeds)
            const decoded = decodeHTMLEntities(initialHtml);
            setContent(DOMPurify.sanitize(decoded, sanitizeOptions));
        }
    }, [article.id, article.readerHTML, article.contentHTML, article.summary, sanitizeOptions]);

    // 2. Background Fetch & Enhancement (Slow)
    useEffect(() => {
        const enhanceContent = async () => {
            // Auto-fetch reader content for RSS feeds if not cached
            const shouldAutoReader = article.mediaKind !== 'youtube' && article.mediaKind !== 'podcast';
            
            if (shouldAutoReader && article.url && !article.readerHTML) {
                setLoading(true);
                const readerContent = await fetchReaderContent();
                if (readerContent) {
                    setContent(readerContent);
                    setIsReaderMode(true);
                }
                setLoading(false);
            }

            // YouTube Injection
            if (article.mediaKind === 'youtube' && article.url) {
                let videoId: string | null = null;
                try {
                    const urlObj = new URL(article.url);
                    if (urlObj.searchParams.get('v')) videoId = urlObj.searchParams.get('v');
                    else if (urlObj.pathname.startsWith('/embed/')) videoId = urlObj.pathname.split('/')[2];
                    else if (urlObj.pathname.startsWith('/shorts/')) videoId = urlObj.pathname.split('/')[2];
                    else if (urlObj.hostname === 'youtu.be') videoId = urlObj.pathname.slice(1);
                } catch (e) { }

                if (videoId) {
                    // We render the video separately now to allow for position tracking
                    setYoutubeVideoId(videoId);
                }
            }
        };

        // Defer enhancement to next tick to allow initial render
        const timer = setTimeout(enhanceContent, 0);
        return () => clearTimeout(timer);
    }, [article.id, article.url, article.mediaKind, article.readerHTML]);

    const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);

    const toggleReaderMode = async () => {
        if (isReaderMode) {
            // Revert to RSS content
            const rawHtml = article.contentHTML || article.summary || '';
            const decoded = decodeHTMLEntities(rawHtml);
            setContent(DOMPurify.sanitize(decoded, getSanitizeOptions()));
            setIsReaderMode(false);
            return;
        }

        if (article.readerHTML) {
            setContent(article.readerHTML);
            setIsReaderMode(true);
            return;
        }

        if (!article.url) return;

        setLoading(true);
        try {
            // Fetch via proxy to avoid CORS
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(article.url)}`;
            const res = await fetch(proxyUrl);
            if (!res.ok) throw new Error("Failed to fetch article");
            const html = await res.text();

            // Client-side parsing using Readability
            // We need to create a DOM document from the string
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            // We need to dynamically import Readability to avoid SSR issues if any (though this is 'use client')
            const { Readability } = await import('@mozilla/readability');
            const reader = new Readability(doc);
            const parsed = reader.parse();

            if (parsed && parsed.content) {
                const cleanHtml = DOMPurify.sanitize(parsed.content, getSanitizeOptions());
                setContent(cleanHtml);
                setIsReaderMode(true);

                // Optional: Save to DB for cache
                await db.articles.update(article.id, {
                    readerHTML: cleanHtml
                });
            } else {
                toast.error("Could not parse article content");
            }

        } catch (e) {
            console.error(e);
            toast.error("Failed to load Reader View");
        } finally {
            setLoading(false);
        }
    };

    // Theme Classes - explicit colors that override system dark mode
    const getThemeClasses = () => {
        switch (theme) {
            case 'sepia': return 'bg-[#f4ecd8] text-[#5b4636]';
            case 'navy': return 'bg-[#1a202c] text-[#cbd5e0]';
            case 'black': return 'bg-black text-zinc-300';
            case 'light': return 'bg-white text-zinc-900'; // Force white regardless of system theme
            default: return 'bg-white text-zinc-900';
        }
    };

    return (
        <div className={clsx("min-h-screen transition-colors duration-300", getThemeClasses())}>
            <div className="max-w-3xl mx-auto px-4 py-8">
                {/* Toolbar */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8 pb-6 border-b border-zinc-200/50 dark:border-zinc-800/50">
                    {/* Theme Toggles */}
                    <div className="flex items-center gap-2">
                        <button onClick={() => handleThemeChange('light')} className="w-8 h-8 rounded-full bg-white border border-zinc-200 shadow-sm" aria-label="Light Theme" title="Light" />
                        <button onClick={() => handleThemeChange('sepia')} className="w-8 h-8 rounded-full bg-[#f4ecd8] border border-[#eaddc5] shadow-sm" aria-label="Sepia Theme" title="Sepia" />
                        <button onClick={() => handleThemeChange('navy')} className="w-8 h-8 rounded-full bg-[#1a202c] border border-zinc-700 shadow-sm" aria-label="Navy Theme" title="Navy" />
                        <button onClick={() => handleThemeChange('black')} className="w-8 h-8 rounded-full bg-black border border-zinc-800 shadow-sm" aria-label="Black Theme" title="Black" />
                    </div>

                    {/* Zoom & Tools */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => handleZoomChange(Math.max(70, zoom - 10))}
                            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                            disabled={zoom <= 70}
                            title="Decrease text size"
                        >
                            <ZoomOut size={18} />
                        </button>
                        <span className="text-sm font-mono w-12 text-center opacity-70">
                            {zoom}%
                        </span>
                        <button
                            onClick={() => handleZoomChange(Math.min(150, zoom + 10))}
                            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                            disabled={zoom >= 150}
                            title="Increase text size"
                        >
                            <ZoomIn size={18} />
                        </button>

                        <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-2" />

                        <button onClick={handleShare} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors" title="Share Article">
                            <Share size={20} />
                        </button>

                        <button
                            onClick={handleSpeak}
                            className={clsx(
                                "p-2 rounded-lg transition-colors",
                                isSpeaking ? "bg-brand/20 text-brand" : "hover:bg-black/5 dark:hover:bg-white/10"
                            )}
                            title={isSpeaking ? "Stop Speaking" : "Listen to Article"}
                        >
                            {isSpeaking ? <Square size={20} className="fill-current" /> : <Headphones size={20} />}
                        </button>
                    </div>
                </div>

                {/* Header / Hero Section */}
                <header className="mb-10 pb-6 border-b border-zinc-100 dark:border-zinc-800/50">
                    <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight mb-6">
                        {article.title}
                    </h1>

                    <div className="flex items-center justify-between opacity-70 text-sm mb-6">
                        <div className="flex items-center gap-2">
                            {article.author && <span className="font-medium">{article.author}</span>}
                            {article.author && <span>•</span>}
                            {article.publishedAt && <time>{format(article.publishedAt, 'MMMM d, yyyy')}</time>}
                        </div>

                        <div className="flex items-center gap-3">
                            <button onClick={toggleReaderMode} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors" title="Toggle Reader View">
                                <BookOpen size={20} className={isReaderMode ? "text-brand" : ""} />
                            </button>
                            <a href={article.url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors" title="Open Original">
                                <ExternalLink size={20} />
                            </a>
                        </div>
                    </div>

                    {/* Hero Image - Hide for YouTube (video is in content) */}
                    {article.thumbnailPath && article.mediaKind !== 'youtube' && (
                        <div className="relative w-full aspect-video rounded-2xl overflow-hidden mb-8 shadow-sm">
                            <img
                                src={article.thumbnailPath}
                                alt={article.title}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}
                </header>

                <div
                    className="reader-content prose prose-zinc dark:prose-invert prose-lg max-w-none"
                    style={{ fontSize: `${zoom}%` }}
                    dangerouslySetInnerHTML={{ __html: content }}
                />

                {
                    loading && (
                        <div className="fixed inset-0 flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm z-50">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
                        </div>
                    )
                }
            </div>
        </div >
    );
}
