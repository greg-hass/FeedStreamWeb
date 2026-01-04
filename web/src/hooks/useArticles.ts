import { useLiveQuery } from "dexie-react-hooks";
import { db, Article } from "@/lib/db";

export function useArticles(view: 'today' | 'last24h' | 'week' | 'all' | 'saved' | 'history' | 'youtube' | 'podcasts' | 'reddit' | string = 'all', limit = 100) {
    return useLiveQuery(async () => {
        const now = new Date();

        if (view === 'today') {
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            return db.articles
                .where('publishedAt').above(startOfDay)
                .reverse()
                .limit(limit)
                .toArray();
        } else if (view === 'last24h') {
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            return db.articles
                .where('publishedAt').above(yesterday)
                .reverse()
                .limit(limit)
                .toArray();
        } else if (view === 'week') {
            const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return db.articles
                .where('publishedAt').above(lastWeek)
                .reverse()
                .limit(limit)
                .toArray();
        } else if (view === 'saved') {
            return db.articles
                .filter(a => a.isBookmarked)
                .reverse()
                .toArray();
        } else if (view === 'history') {
            return db.articles
                .where('isRead').equals(1) // Dexie booleans are 1/0 in Index
                .reverse()
                .limit(limit)
                .toArray();
        } else if (view === 'youtube') {
            return db.articles
                .where('mediaKind').equals('youtube')
                .reverse()
                .limit(limit)
                .toArray();
        } else if (view === 'podcasts') {
            return db.articles
                .where('mediaKind').equals('podcast')
                .reverse()
                .limit(limit)
                .toArray();
        } else if (view === 'reddit') {
            const redditFeeds = await db.feeds.where('type').equals('reddit').keys();
            if (redditFeeds.length === 0) return [];
            return db.articles
                .where('feedID').anyOf(redditFeeds as string[])
                .reverse()
                .limit(limit)
                .toArray();
        } else if (view === 'rss') {
            // Generic RSS/Articles - find feeds with type 'rss' or empty type
            const rssFeeds = await db.feeds.where('type').equals('rss').or('type').equals('').keys();
            if (rssFeeds.length === 0) return [];
            return db.articles
                .where('feedID').anyOf(rssFeeds as string[])
                .reverse()
                .limit(limit)
                .toArray();
        } else if (view === 'all') {
            return db.articles
                .orderBy('publishedAt')
                .reverse()
                .limit(limit)
                .toArray();
        } else {
            // Assume view is a feedID
            return db.articles
                .where('feedID').equals(view)
                .reverse()
                .toArray();
        }
    }, [view, limit]);
}
