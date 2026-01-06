import { useLiveQuery } from "dexie-react-hooks";
import { db, Article } from "@/lib/db";
import Dexie from "dexie";
import { useState, useEffect } from "react";
import { useUIStore } from "@/store/uiStore";

export function useArticles(
    view: 'today' | 'last24h' | 'week' | 'all' | 'saved' | 'history' | 'youtube' | 'podcasts' | 'reddit' | string = 'all',
    limit = 100,
    searchQuery: string = ''
) {
    // Check if a sync is actively running
    const isSyncing = useUIStore((s) => s.isSyncing);

    // Raw live query - updates on every DB change
    const liveArticles = useLiveQuery(async () => {
        let collection: any; // Use any to avoid Dexie's complex generic type issues
        const now = new Date();

        // 1. Select the base collection strategy
        if (view === 'today') {
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            collection = db.articles.where('publishedAt').above(startOfDay);
        } else if (view === 'last24h') {
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            collection = db.articles.where('publishedAt').above(yesterday);
        } else if (view === 'week') {
            const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            collection = db.articles.where('publishedAt').above(lastWeek);
        } else if (view === 'saved') {
            collection = db.articles
                .where('[isBookmarked+publishedAt]')
                .between([1, Dexie.minKey], [1, Dexie.maxKey]);
        } else if (view === 'history') {
            collection = db.articles.where('isRead').equals(1);
        } else if (view === 'youtube') {
            collection = db.articles
                .where('[mediaKind+publishedAt]')
                .between(['youtube', Dexie.minKey], ['youtube', Dexie.maxKey]);
        } else if (view === 'podcasts') {
            collection = db.articles
                .where('[mediaKind+publishedAt]')
                .between(['podcast', Dexie.minKey], ['podcast', Dexie.maxKey]);
        } else if (view === 'reddit') {
            const redditFeedIds = await db.feeds.where('type').equals('reddit').primaryKeys();
            if (redditFeedIds.length === 0) return [];
            const redditSet = new Set(redditFeedIds);
            collection = db.articles.orderBy('publishedAt').filter(a => redditSet.has(a.feedID));
        } else if (view === 'rss') {
            const allowedFeedIds = await db.feeds.where('type').noneOf(['reddit', 'youtube', 'podcast']).primaryKeys();
            if (allowedFeedIds.length === 0) return [];
            const allowedSet = new Set(allowedFeedIds);
            collection = db.articles.orderBy('publishedAt').filter(a => allowedSet.has(a.feedID));
        } else if (view === 'all') {
            collection = db.articles.orderBy('publishedAt');
        } else {
            // Feed ID
            collection = db.articles.where('feedID').equals(view);
        }

        // 2. Apply Search Filter (if any)
        if (searchQuery && searchQuery.trim().length > 0) {
            const lowerQuery = searchQuery.toLowerCase();
            const originalCollection = collection;

            // Dexie collections are immutable-ish chains, so we filter
            // Note: This is an in-memory filter on the results of the index scan.
            // For massive datasets, we'd need a full-text index.
            collection = originalCollection.filter((a: Article) => {
                const titleMatch = a.title?.toLowerCase().includes(lowerQuery);
                const summaryMatch = a.summary?.toLowerCase().includes(lowerQuery);
                return !!(titleMatch || summaryMatch);
            });
        }

        // 3. Finalize Query & Optimization
        // We reduce the limit to avoid blocking the main thread.
        // We also manually map the results to exclude massive 'contentHTML' strings 
        // to save React memory diffing costs.
        const results = await collection.reverse().limit(limit).toArray();

        return results.map((a: Article) => ({
            id: a.id,
            feedID: a.feedID,
            title: a.title,
            summary: a.summary,
            // Exclude contentHTML and readerHTML
            publishedAt: a.publishedAt,
            isRead: a.isRead,
            isBookmarked: a.isBookmarked,
            mediaKind: a.mediaKind,
            thumbnailPath: a.thumbnailPath,
            author: a.author,
        })) as Article[];

    }, [view, limit, searchQuery]);

    // Debounce to prevent flickering during rapid sync updates
    // Use longer debounce (2s) during active sync, shorter (500ms) when idle
    const [debouncedArticles, setDebouncedArticles] = useState<Article[] | undefined>(undefined);

    useEffect(() => {
        // If we don't have debouncedArticles yet, set them immediately
        if (debouncedArticles === undefined && liveArticles !== undefined) {
            setDebouncedArticles(liveArticles);
            return; // Skip debounce for first load
        }

        const debounceMs = isSyncing ? 2000 : 500;

        const handler = setTimeout(() => {
            if (liveArticles !== undefined) {
                setDebouncedArticles(liveArticles);
            }
        }, debounceMs);

        return () => clearTimeout(handler);
    }, [liveArticles, isSyncing]);

    return debouncedArticles;
}

