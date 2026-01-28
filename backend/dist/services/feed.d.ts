import { articles } from '../db/schema';
export declare class FeedService {
    syncFeed(feedId: string, userId: string): Promise<{
        newArticles: number;
        updated: number;
    }>;
    syncAllFeeds(userId: string, onProgress?: (current: number, total: number, feedTitle: string) => void): Promise<{
        totalFeeds: number;
        successful: number;
        failed: number;
        newArticles: number;
    }>;
    searchArticles(userId: string, query: string, limit?: number): Promise<typeof articles.$inferSelect[]>;
    getUnreadArticles(userId: string, limit?: number): Promise<Array<{
        article: typeof articles.$inferSelect;
        isRead: boolean;
        isBookmarked: boolean;
    }>>;
    private buildSearchVector;
}
//# sourceMappingURL=feed.d.ts.map