
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
        // Sanitize initial content
        if (article.contentHTML) {
            setContent(DOMPurify.sanitize(article.contentHTML));
        } else if (article.summary) {
            setContent(DOMPurify.sanitize(article.summary));
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
            // Here we would call an API end point that fetches the URL and runs Readability
            // For now, we'll simulate or simple-proxy fetch and client-side parse if possible, 
            // but Readability is better on server/API to avoid CORS/Parsing issues fully. 
            // We'll trust the simple content for now or implement a specific /api/readability endpoint later.
            console.log("Reader mode requested");
            // Placeholder for phase 4 polish
        } catch (e) {
            console.error(e);
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

            <article className="prose prose-zinc dark:prose-invert lg:prose-lg max-w-none">
                {/* Render HTML safely */}
                <div dangerouslySetInnerHTML={{ __html: content }} />
            </article>

            {loading && (
                <div className="fixed inset-0 flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
                </div>
            )}
        </div>
    );
}
