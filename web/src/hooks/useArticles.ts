import { useLiveQuery } from "dexie-react-hooks";
import { db, Article } from "@/lib/db";

export function useArticles(view: 'today' | 'all' | 'saved' | 'history' | 'youtube' | 'podcasts' | 'reddit' | string = 'all', limit = 100) {
    return useLiveQuery(async () => {
        if (view === 'today') {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            return db.articles
                .where('publishedAt').above(yesterday)
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
            // 'reddit' is a feed type, but valid article mediaKind is usually 'none' or 'video'
            // To filter by feed type, we need to join or find feeds first.
            // Efficient way: Get Reddit Feed IDs, then query articles.
            const redditFeeds = await db.feeds.where('type').equals('reddit').keys();
            if (redditFeeds.length === 0) return [];
            return db.articles
                .where('feedID').anyOf(redditFeeds as string[])
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
