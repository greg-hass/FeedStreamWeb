import { useLiveQuery } from "dexie-react-hooks";
import { db, Article } from "@/lib/db";
import Dexie from "dexie";

export function useArticles(
    view: 'today' | 'last24h' | 'week' | 'all' | 'saved' | 'history' | 'youtube' | 'podcasts' | 'reddit' | string = 'all',
    limit = 2000,
    searchQuery: string = ''
) {
    return useLiveQuery(async () => {
        let collection: Dexie.Collection<Article, string> | Dexie.Table<Article, string>;
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
            collection = originalCollection.filter(a => {
                const titleMatch = a.title?.toLowerCase().includes(lowerQuery);
                const summaryMatch = a.summary?.toLowerCase().includes(lowerQuery);
                return !!(titleMatch || summaryMatch);
            });
        }

        // 3. Finalize Query (Reverse + Limit + Execute)
        // Note: reverse() usually applies to the index order.
        // If we used a 'where' clause that supports reverse, it works.
        // Some collections (like .filter()) return a Collection that supports reverse().
        return collection.reverse().limit(limit).toArray();

    }, [view, limit, searchQuery]);
}
