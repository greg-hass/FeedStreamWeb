
'use client';

import React, { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { Article } from '@/lib/db';
import { format } from 'date-fns';
import { ExternalLink, BookOpen, ZoomIn, ZoomOut, Share, Palette, Moon, Sun } from 'lucide-react';
import { decodeHTMLEntities } from '@/lib/utils';
import { db } from '@/lib/db';
import { clsx } from 'clsx';

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

    // Load saved preferences if available (could be moved to store)
    useEffect(() => {
        const savedTheme = localStorage.getItem('reader-theme') as ReaderTheme;
        if (savedTheme) setTheme(savedTheme);
        const savedZoom = localStorage.getItem('reader-zoom');
        if (savedZoom) setZoom(parseInt(savedZoom));
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
            alert('Link copied to clipboard');
        }
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
                const cleanHtml = DOMPurify.sanitize(parsed.content, { ADD_TAGS: ['iframe', 'img'] });
                // Cache in DB
                await db.articles.update(article.id, { readerHTML: cleanHtml });
                return cleanHtml;
            }
        } catch (e) {
            console.error('Reader mode failed', e);
        }
        return null;
    };

    useEffect(() => {
        const sanitizeOptions = {
            ADD_TAGS: ['iframe'],
            ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'style']
        };

        // For RSS articles (not youtube/podcast), auto-invoke Readability
        const shouldAutoReader = article.mediaKind !== 'youtube' && article.mediaKind !== 'podcast';

        const init = async () => {
            // If we have cached reader content, use it
            if (article.readerHTML && shouldAutoReader) {
                setContent(article.readerHTML);
                setIsReaderMode(true);
                return;
            }

            // Set initial content from RSS
            if (article.contentHTML) {
                setContent(DOMPurify.sanitize(article.contentHTML, sanitizeOptions));
            } else if (article.summary) {
                setContent(DOMPurify.sanitize(article.summary, sanitizeOptions));
            }

            // Auto-fetch reader content for RSS feeds
            if (shouldAutoReader && article.url) {
                setLoading(true);
                const readerContent = await fetchReaderContent();
                if (readerContent) {
                    setContent(readerContent);
                    setIsReaderMode(true);
                }
                setLoading(false);
            }
        };

        init();
    }, [article.id]);

    const toggleReaderMode = async () => {
        if (isReaderMode) {
            // Revert to RSS content
            setContent(DOMPurify.sanitize(article.contentHTML || article.summary || ''));
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
                const cleanHtml = DOMPurify.sanitize(parsed.content, { ADD_TAGS: ['iframe', 'img'] });
                setContent(cleanHtml);
                setIsReaderMode(true);

                // Optional: Save to DB for cache
                await db.articles.update(article.id, {
                    readerHTML: cleanHtml
                });
            } else {
                alert("Could not parse article content");
            }

        } catch (e) {
            console.error(e);
            alert("Failed to load Reader View");
        } finally {
            setLoading(false);
        }
    };

    // Theme Classes
    const getThemeClasses = () => {
        switch (theme) {
            case 'sepia': return 'bg-[#f4ecd8] text-[#5b4636]';
            case 'navy': return 'bg-[#1a202c] text-[#cbd5e0]';
            case 'black': return 'bg-black text-zinc-300';
            default: return 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100';
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

                    {/* Hero Image */}
                    {article.thumbnailPath && (
                        <div className="relative w-full aspect-video rounded-2xl overflow-hidden mb-8 shadow-sm">
                            <img
                                src={article.thumbnailPath}
                                alt={article.title}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}
                </header>

                {/* Global Styles for Content - Updated for Themes */}
                <style jsx global>{`
                    .reader-content {
                        font-size: 1.125rem; /* 18px */
                        line-height: 1.8;
                    }
                    .reader-content p {
                        margin-bottom: 2em;
                    }
                    .reader-content h2 {
                        font-size: 1.8rem;
                        font-weight: 700;
                        margin-top: 3em;
                        margin-bottom: 1em;
                        letter-spacing: -0.025em;
                    }
                    .reader-content h3 {
                        font-size: 1.5rem;
                        font-weight: 600;
                        margin-top: 2.5em;
                        margin-bottom: 1em;
                    }
                    .reader-content img, .reader-content video, .reader-content figure {
                        margin: 2.5em 0;
                        border-radius: 0.75rem;
                        width: 100%;
                        height: auto;
                    }
                    .reader-content iframe {
                        width: 100%;
                        aspect-ratio: 16/9;
                        border-radius: 0.75rem;
                        margin: 2.5em 0;
                    }
                    .reader-content blockquote {
                        border-left: 4px solid currentColor;
                        padding-left: 1.5em;
                        font-style: italic;
                        opacity: 0.8;
                        margin: 2em 0;
                    }
                    .reader-content a {
                        color: #ec4899; /* pink-500 (brand) */
                        text-decoration: underline;
                        text-underline-offset: 2px;
                    }
                    .reader-content ul, .reader-content ol {
                        margin-bottom: 2em;
                        padding-left: 1.5em;
                    }
                    .reader-content li {
                        margin-bottom: 0.5em;
                        list-style-type: disc;
                    }
                    
                    /* Mobile tweaks */
                    @media (max-width: 640px) {
                        .reader-content iframe, .reader-content img {
                            border-radius: 0;
                            margin-left: -1rem; /* Break out */
                            margin-right: -1rem;
                            width: calc(100% + 2rem);
                            max-width: none;
                        }
                    }
                `}</style>

                {/* Content */}
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
