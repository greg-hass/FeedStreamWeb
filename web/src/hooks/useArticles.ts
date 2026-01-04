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
            // Get all Reddit feed IDs
            const redditFeedIds = await db.feeds
                .where('type')
                .equals('reddit')
                .primaryKeys();

            console.log('[useArticles] Reddit feed IDs:', redditFeedIds);

            if (redditFeedIds.length === 0) {
                console.log('[useArticles] No Reddit feeds found');
                return [];
            }

            const articles = await db.articles
                .where('feedID')
                .anyOf(redditFeedIds as string[])
                .reverse()
                .limit(limit)
                .toArray();

            console.log('[useArticles] Found', articles.length, 'Reddit articles');
            return articles;
        } else if (view === 'rss') {
            // Generic RSS/Articles - exclude reddit, youtube, podcast feeds
            const excludedFeeds = await db.feeds
                .where('type').anyOf(['reddit', 'youtube', 'podcast'])
                .keys();

            if (excludedFeeds.length === 0) {
                // No excluded feeds, show all
                return db.articles
                    .orderBy('publishedAt')
                    .reverse()
                    .limit(limit)
                    .toArray();
            }

            // Filter out articles from excluded feeds
            return db.articles
                .orderBy('publishedAt')
                .reverse()
                .limit(limit * 3) // Get more to filter
                .toArray()
                .then(articles =>
                    articles
                        .filter(a => !excludedFeeds.includes(a.feedID))
                        .slice(0, limit)
                );
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
