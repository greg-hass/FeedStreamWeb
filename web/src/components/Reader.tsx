
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

    useEffect(() => {
        const sanitizeOptions = {
            ADD_TAGS: ['iframe'],
            ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'style']
        };

        // Sanitize initial content
        if (article.contentHTML) {
            setContent(DOMPurify.sanitize(article.contentHTML, sanitizeOptions));
        } else if (article.summary) {
            setContent(DOMPurify.sanitize(article.summary, sanitizeOptions));
        }
    }, [article]);

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
            <header className="mb-8 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight leading-tight mb-4">
                    {article.title}
                </h1>

                <div className="flex items-center justify-between text-zinc-500 text-sm">
                    <div className="flex items-center gap-2">
                        {article.author && <span className="font-medium text-zinc-700 dark:text-zinc-300">{article.author}</span>}
                        {article.author && <span>•</span>}
                        {article.publishedAt && <time>{format(article.publishedAt, 'MMMM d, yyyy h:mm a')}</time>}
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
            </header>

            {/* YouTube videos are rendered directly in the content via the iframe in contentHTML */}

            {/* 
              User Update: "inline on mobile" often means effectively maximizing the video width.
              We'll add a CSS class to ensure iframes break out of padding on mobile.
            */}
            <style jsx global>{`
                .prose iframe {
                    width: 100%;
                    aspect-ratio: 16/9;
                    border-radius: 0.5rem;
                }
                @media (max-width: 640px) {
                    .prose iframe {
                        border-radius: 0;
                        margin-left: -1rem; /* Break out of parent padding (px-4) */
                        margin-right: -1rem;
                        width: calc(100% + 2rem);
                        max-width: none;
                    }
                }
            `}</style>

            <article className="prose prose-zinc dark:prose-invert lg:prose-lg max-w-none">
                {/* Render HTML safely */}
                <div dangerouslySetInnerHTML={{ __html: content }} />
            </article>

            {
                loading && (
                    <div className="fixed inset-0 flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
                    </div>
                )
            }
        </div >
    );
}
