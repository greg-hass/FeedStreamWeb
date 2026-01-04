
'use client';

import React from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Article } from '@/lib/db';
import { ArticleItem } from './ArticleItem';
import { db } from '@/lib/db';

interface ArticleListProps {
    articles: Article[];
}

export function ArticleList({ articles }: ArticleListProps) {

    const handleToggleRead = async (id: string) => {
        const article = await db.articles.get(id);
        if (article) {
            await db.articles.update(id, { isRead: !article.isRead });
        }
    };

    const handleToggleBookmark = async (id: string) => {
        const article = await db.articles.get(id);
        if (article) {
            await db.articles.update(id, { isBookmarked: !article.isBookmarked });
        }
    };

    if (!articles || articles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-zinc-400">
                <p>No articles found.</p>
            </div>
        )
    }

    return (
        <Virtuoso
            data={articles}
            itemContent={(index, article) => (
                <ArticleItem
                    key={article.id}
                    article={article}
                    onToggleRead={handleToggleRead}
                    onToggleBookmark={handleToggleBookmark}
                />
            )}
            className="w-full h-full"
        />
    );
}
