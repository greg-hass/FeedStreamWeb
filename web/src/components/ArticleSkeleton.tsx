'use client';

import React from 'react';
import { clsx } from 'clsx';

interface ArticleSkeletonProps {
    count?: number;
}

function SkeletonItem() {
    return (
        <div className="article-item px-4 sm:px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/50 animate-pulse">
            <div className="flex flex-col md:flex-row md:gap-4">
                {/* Content skeleton */}
                <div className="flex-1 min-w-0 flex flex-col">
                    {/* Meta line */}
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-4 h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
                        <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
                        <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
                    </div>

                    {/* Title */}
                    <div className="space-y-2 mb-2">
                        <div className="h-5 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
                        <div className="h-5 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 mt-2">
                        <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                        <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    </div>
                </div>

                {/* Thumbnail skeleton - mobile */}
                <div className="mt-3 md:mt-0 md:shrink-0 w-full md:w-28 aspect-video md:h-28 md:aspect-auto rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            </div>
        </div>
    );
}

export function ArticleSkeleton({ count = 5 }: ArticleSkeletonProps) {
    return (
        <div className="w-full">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonItem key={i} />
            ))}
        </div>
    );
}

export function ArticleSkeletonInline() {
    return <SkeletonItem />;
}
