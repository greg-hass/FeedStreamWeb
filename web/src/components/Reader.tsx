
'use client';

import React, { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { Article } from '@/lib/db';
import { format } from 'date-fns';
import { ExternalLink, BookOpen } from 'lucide-react';
import { decodeHTMLEntities } from '@/lib/utils';
import { db } from '@/lib/db';

interface ReaderProps {
    article: Article;
}

export function Reader({ article }: ReaderProps) {
    const [content, setContent] = useState<string>('');
    const [isReaderMode, setIsReaderMode] = useState(false);
    const [loading, setLoading] = useState(false);

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

    return (
        <div className="max-w-3xl mx-auto px-4 py-8 bg-white dark:bg-zinc-950 min-h-screen">
            {/* Header / Hero Section */}
            <header className="mb-10 pb-6 border-b border-zinc-100 dark:border-zinc-800">
                <h1 className="text-3xl md:text-5xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight leading-tight mb-6">
                    {article.title}
                </h1>

                <div className="flex items-center justify-between text-zinc-500 text-sm mb-6">
                    <div className="flex items-center gap-2">
                        {article.author && <span className="font-medium text-zinc-700 dark:text-zinc-300">{article.author}</span>}
                        {article.author && <span>•</span>}
                        {article.publishedAt && <time>{format(article.publishedAt, 'MMMM d, yyyy')}</time>}
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={toggleReaderMode} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors" title="Toggle Reader View">
                            <BookOpen size={20} className={isReaderMode ? "text-brand" : ""} />
                        </button>
                        <a href={article.url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors" title="Open Original">
                            <ExternalLink size={20} />
                        </a>
                    </div>
                </div>

                {/* Hero Image */}
                {article.image && (
                    <div className="relative w-full aspect-video rounded-2xl overflow-hidden mb-8 shadow-sm">
                        <img
                            src={article.image}
                            alt={article.title}
                            className="w-full h-full object-cover"
                        />
                    </div>
                )}
            </header>

            {/* Global Styles for Content */}
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
                    border-left: 4px solid #e4e4e7; /* zinc-200 */
                    padding-left: 1.5em;
                    font-style: italic;
                    color: #52525b; /* zinc-600 */
                    margin: 2em 0;
                }
                .dark .reader-content blockquote {
                    border-color: #3f3f46; /* zinc-700 */
                    color: #a1a1aa; /* zinc-400 */
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

            <article className="reader-content text-zinc-800 dark:text-zinc-200 max-w-none">
                <div dangerouslySetInnerHTML={{ __html: content }} />
            </article>

            {
                loading && (
                    <div className="fixed inset-0 flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm z-50">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
                    </div>
                )
            }
        </div >
    );
}
