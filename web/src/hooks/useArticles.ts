import { useLiveQuery } from "dexie-react-hooks";
import { db, Article } from "@/lib/db";

export function useArticles(view: 'today' | 'last24h' | 'week' | 'all' | 'saved' | 'history' | 'youtube' | 'podcasts' | 'reddit' | string = 'all', limit = 2000) {
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
                .orderBy('publishedAt')
                .reverse()
                .filter(a => a.mediaKind === 'youtube')
                .limit(limit)
                .toArray();
        } else if (view === 'podcasts') {
            return db.articles
                .orderBy('publishedAt')
                .reverse()
                .filter(a => a.mediaKind === 'podcast')
                .limit(limit)
                .toArray();
        } else if (view === 'reddit') {
            // Get all Reddit feed IDs
            const redditFeedIds = await db.feeds
                .where('type')
                .equals('reddit')
                .primaryKeys();

            if (redditFeedIds.length === 0) {
                return [];
            }

            const redditSet = new Set(redditFeedIds);
            return db.articles
                .orderBy('publishedAt')
                .reverse()
                .filter(a => redditSet.has(a.feedID))
                .limit(limit)
                .toArray();
        } else if (view === 'rss') {
            // Generic RSS/Articles - exclude reddit, youtube, podcast feeds
            // Optimization: Find Allowed Feeds first
            const allowedFeedIds = await db.feeds
                .where('type').noneOf(['reddit', 'youtube', 'podcast'])
                .primaryKeys();

            if (allowedFeedIds.length === 0) {
                return [];
            }

            const allowedSet = new Set(allowedFeedIds);
            return db.articles
                .orderBy('publishedAt')
                .reverse()
                .filter(a => allowedSet.has(a.feedID))
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
