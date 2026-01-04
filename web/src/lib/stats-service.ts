import { db } from './db';

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

        // Top Feeds (Most Read) - This is heavy, optimization: Sample or separate counter table
        // For now, we do a somewhat expensive query but limited to 'isRead'
        // Actually, 'most active' might be better (most articles published recently)
        // Let's do "Most Active Feeds (Last 30 Days)"
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentArticles = await db.articles.where('publishedAt').above(thirtyDaysAgo).toArray();
        
        const feedCounts = new Map<string, number>();
        recentArticles.forEach(a => {
            feedCounts.set(a.feedID, (feedCounts.get(a.feedID) || 0) + 1);
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

        // Ghost Feeds (No posts in 90 days)
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const ghostFeeds = feeds
            .filter(f => {
                // If we have no articles for this feed newer than 90 days
                // This check is a bit tricky without doing N queries.
                // Simple heuristic: Check 'lastSuccessfulSync' or sortOrder? 
                // Better: We iterate feeds, and for each check if it has recent articles.
                // Given N feeds is usually small (<100), it's okay.
                return true; 
            })
            .filter(f => {
                // Filter logic handled in async map below to use DB
                return true;
            });
            
        // Refined Ghost check
        const realGhosts = [];
        for (const feed of feeds) {
            const latest = await db.articles
                .where('feedID').equals(feed.id)
                .reverse()
                .sortBy('publishedAt');
            
            if (latest.length > 0) {
                const lastDate = latest[0].publishedAt;
                if (lastDate && lastDate < ninetyDaysAgo) {
                    realGhosts.push({
                        id: feed.id,
                        title: feed.title,
                        lastPostDate: lastDate
                    });
                }
            } else {
                // Never posted?
                // realGhosts.push({ id: feed.id, title: feed.title, lastPostDate: new Date(0) });
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
