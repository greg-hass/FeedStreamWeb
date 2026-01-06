import { db } from './db';
import Dexie from 'dexie';

export interface FeedStats {
    totalArticles: number;
    readArticles: number;
    unreadArticles: number;
    bookmarkedArticles: number;
    topFeeds: { id: string; title: string; count: number }[];
    readingStreak: number;
    ghostFeeds: { id: string; title: string; lastPostDate: Date }[];
}

export class StatsService {
    static async getStats(): Promise<FeedStats> {
        const totalArticles = await db.articles.count();
        const readArticles = await db.articles.where('isRead').equals(1).count();
        const unreadArticles = totalArticles - readArticles;
        const bookmarkedArticles = await db.articles.where('isBookmarked').equals(1).count();

        // 1. Top Feeds (Most Active in last 30 days) - Memory Efficient
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const feedCounts = new Map<string, number>();
        
        // Use each() to avoid loading all objects into memory
        await db.articles.where('publishedAt').above(thirtyDaysAgo).each(a => {
            // We only need feedID, but 'each' gives full object. 
            // Dexie optimization: if we used 'keys()' we wouldn't get feedID easily without compound index.
            // But 'each' is better than 'toArray'.
            const fid = a.feedID;
            feedCounts.set(fid, (feedCounts.get(fid) || 0) + 1);
        });

        const feeds = await db.feeds.toArray();
        const feedMap = new Map(feeds.map(f => [f.id, f]));

        const topFeeds = Array.from(feedCounts.entries())
            .map(([id, count]) => ({
                id,
                title: feedMap.get(id)?.title || 'Unknown Feed',
                count
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // 2. Ghost Feeds (No posts in 90 days) - Optimized with Index
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const realGhosts = [];
        
        for (const feed of feeds) {
            // Use [feedID+publishedAt] index to get just the latest article
            const latest = await db.articles
                .where('[feedID+publishedAt]')
                .between([feed.id, Dexie.minKey], [feed.id, Dexie.maxKey])
                .last();
            
            if (latest) {
                if (latest.publishedAt && latest.publishedAt < ninetyDaysAgo) {
                    realGhosts.push({
                        id: feed.id,
                        title: feed.title,
                        lastPostDate: latest.publishedAt
                    });
                }
            } else {
                // Never posted or cleared?
                // Treat as ghost if added > 90 days ago? 
                // For now, ignore purely empty feeds to avoid clutter
            }
        }

        return {
            totalArticles,
            readArticles,
            unreadArticles,
            bookmarkedArticles,
            topFeeds,
            readingStreak: await this.calculateStreak(),
            ghostFeeds: realGhosts.slice(0, 5)
        };
    }

    private static async calculateStreak(): Promise<number> {
        // Simple streak: Consecutive days with at least one 'read' article.
        // Needs 'readAt' timestamp which we don't strictly have (we have isRead boolean).
        // We only have 'publishedAt'. 
        // We can't calculate REAL reading streak without a 'readLog' table.
        // Fallback: Use 'publishedAt' of read items as a proxy? No, that's wrong.
        // Alternative: Just return 0 for now until we implement History Log.
        return 0; 
    }
}
