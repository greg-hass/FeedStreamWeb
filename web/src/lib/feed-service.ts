
import { db, Feed, Article } from './db';
import { parseFeed } from './feed-parser';

export class FeedService {

    static async addFeed(url: string, folderId?: string): Promise<string> {
        // 1. Fetch and Parse to validate and get Meta
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Failed to fetch feed');

        const text = await response.text();
        const normalized = await parseFeed(text, url);

        const feedId = crypto.randomUUID();

        // 2. Add Feed to DB
        await db.feeds.add({
            id: feedId,
            title: normalized.title || 'Untitled Feed',
            feedURL: url,
            siteURL: normalized.site,
            type: normalized.kind,
            folderID: folderId,
            isPaused: false,
            consecutiveFailures: 0,
            sortOrder: 0,
            isFavorite: false,
            dateAdded: new Date()
        });

        // 3. Add Articles
        // Since it's new, we can just bulk add all
        const articlesWithFeedId = normalized.articles.map(a => ({
            ...a,
            feedID: feedId,
            isRead: false
        }));

        await db.articles.bulkAdd(articlesWithFeedId);

        return feedId;
    }

    static async refreshFeed(feed: Feed): Promise<void> {
        try {
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(feed.feedURL)}`;
            const response = await fetch(proxyUrl);

            if (!response.ok) {
                await db.feeds.update(feed.id, {
                    lastError: `HTTP ${response.status}`,
                    consecutiveFailures: (feed.consecutiveFailures || 0) + 1
                });
                return;
            }

            const text = await response.text();
            const normalized = await parseFeed(text, feed.feedURL);

            // Update Feed Meta (if changed, optional, but good for title updates)
            await db.feeds.update(feed.id, {
                lastSuccessfulSync: new Date(),
                lastError: undefined,
                consecutiveFailures: 0,
                // Only update title if it was default or empty? Or always?
                // iOS usually respects user edits, but here we assume sync logic.
                // Let's keep existing title if present to avoid overwriting user rename (if we had rename)
            });

            // Merge Articles
            await this.mergeArticles(feed.id, normalized.articles);

        } catch (e: any) {
            console.error(`Failed to sync feed ${feed.title}`, e);
            await db.feeds.update(feed.id, {
                lastError: e.message || 'Unknown error',
                consecutiveFailures: (feed.consecutiveFailures || 0) + 1
            });
        }
    }

    private static async mergeArticles(feedId: string, incoming: Article[]) {
        // 1. Get existing articles for this feed to check status
        // Optimization: Just get IDs and their Read status if needed, 
        // but Dexie bulkGet might be slower than just strict ID check if we have hash.

        // We used `makeStableId` so IDs are deterministic based on URL/GUID.
        const incomingIds = incoming.map(a => a.id);
        const existingArticles = await db.articles.where('id').anyOf(incomingIds).toArray();
        const existingMap = new Map(existingArticles.map(a => [a.id, a]));

        const newArticles: Article[] = [];
        const updates: Article[] = [];

        for (const item of incoming) {
            const existing = existingMap.get(item.id);

            if (!existing) {
                newArticles.push({
                    ...item,
                    feedID: feedId
                });
            } else {
                // Update existing: Keep user state (isRead, isBookmarked)
                // Update content, title, etc. in case of corrections
                updates.push({
                    ...item,
                    feedID: feedId, // Ensure feedID is consistent
                    isRead: existing.isRead,
                    isBookmarked: existing.isBookmarked,
                    // Preserve other local states
                    playbackPosition: existing.playbackPosition,
                    downloadStatus: existing.downloadStatus,
                    contentPrefetchedAt: existing.contentPrefetchedAt
                });
            }
        }

        if (newArticles.length > 0) {
            // Use bulkPut to be safe, though bulkAdd is fine since we checked existence
            await db.articles.bulkPut(newArticles);
        }

        if (updates.length > 0) {
            await db.articles.bulkPut(updates);
        }
    }

    static async deleteFeed(id: string) {
        await db.transaction('rw', db.feeds, db.articles, async () => {
            await db.articles.where('feedID').equals(id).delete();
            await db.feeds.delete(id);
        });
    }
}
