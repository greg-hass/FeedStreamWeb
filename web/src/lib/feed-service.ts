
import { db, Feed, Article } from './db';
import { parseFeed } from './feed-parser';
import { useSettingsStore } from '@/store/settingsStore';
import { md5, uuidv4 } from './utils';
import { IconService } from './icon-service';
import { RulesEngine } from './rules-engine';

export class FeedService {

    static async addFeed(url: string, folderId?: string): Promise<string> {
        // 1. Fetch and Parse to validate and get Meta
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Failed to fetch feed');

        const text = await response.text();
        const normalized = await parseFeed(text, url);

        const feedId = uuidv4();

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
        let articlesWithFeedId = normalized.articles.map(a => ({
            ...a,
            feedID: feedId,
            isRead: 0
        }));

        // Apply Rules
        articlesWithFeedId = await RulesEngine.applyRules(articlesWithFeedId);

        if (articlesWithFeedId.length > 0) {
            await db.articles.bulkAdd(articlesWithFeedId);
        }

        // 4. Fetch and update feed icon
        const feed = await db.feeds.get(feedId);
        if (feed) {
            await IconService.updateFeedIcon(feed, normalized.rawData);
        }

        return feedId;
    }

    static async refreshFeed(feed: Feed, signal?: AbortSignal, baseUrl: string = ''): Promise<number> {
        console.log(`[RefreshFeed] Starting refresh for: ${feed.title}`);
        try {
            if (signal?.aborted) return 0;
            const proxyUrl = `${baseUrl}/api/proxy?url=${encodeURIComponent(feed.feedURL)}`;

            // Build headers with conditional caching
            const headers: Record<string, string> = {};
            if (feed.etag) headers['If-None-Match'] = feed.etag;
            if (feed.lastModified) headers['If-Modified-Since'] = feed.lastModified;

            const response = await fetch(proxyUrl, { headers, signal });

            // Handle 304 Not Modified - feed unchanged, skip parsing
            if (response.status === 304) {
                console.log(`[RefreshFeed] ${feed.title} unchanged (304)`);
                await db.feeds.update(feed.id, {
                    lastSuccessfulSync: new Date(),
                    lastError: undefined,
                    consecutiveFailures: 0,
                });
                return 0;
            }

            if (!response.ok) {
                console.error(`[RefreshFeed] HTTP error ${response.status} for ${feed.title}`);
                await db.feeds.update(feed.id, {
                    lastError: `HTTP ${response.status}`,
                    consecutiveFailures: (feed.consecutiveFailures || 0) + 1
                });
                return 0;
            }

            // Store cache headers for next request
            const newEtag = response.headers.get('etag');
            const newLastModified = response.headers.get('last-modified');

            const text = await response.text();
            if (signal?.aborted) return 0;

            console.log(`[RefreshFeed] Fetched ${text.length} bytes for ${feed.title}`);
            const normalized = await parseFeed(text, feed.feedURL);
            console.log(`[RefreshFeed] Parsed ${normalized.articles.length} articles for ${feed.title}`);

            // Update Feed Meta (if changed, optional, but good for title updates)
            await db.feeds.update(feed.id, {
                lastSuccessfulSync: new Date(),
                lastError: undefined,
                consecutiveFailures: 0,
                ...(newEtag && { etag: newEtag }),
                ...(newLastModified && { lastModified: newLastModified }),
            });

            // Fetch icon if missing or using generic fallback (so we can retry better extraction)
            const isMissingOrGeneric = !feed.iconURL || feed.iconURL.includes('google.com/s2/favicons');
            if (isMissingOrGeneric) {
                // Non-blocking update
                IconService.updateFeedIcon(feed, normalized.rawData).catch(console.error);
            }

            // Merge Articles
            const newCount = await this.mergeArticles(feed.id, normalized.articles);
            console.log(`[RefreshFeed] Completed refresh for ${feed.title} (New: ${newCount})`);
            return newCount;

        } catch (e: any) {
            if (e.name === 'AbortError') {
                console.log(`[RefreshFeed] Aborted: ${feed.title}`);
                return 0;
            }
            console.error(`Failed to sync feed ${feed.title}`, e);
            await db.feeds.update(feed.id, {
                lastError: e.message || 'Unknown error',
                consecutiveFailures: (feed.consecutiveFailures || 0) + 1
            });
            return 0;
        }
    }

    static async refreshAllFeeds(onProgress?: (completed: number, total: number, message: string) => void, signal?: AbortSignal): Promise<number> {
        const localFeeds = await db.feeds.toArray();
        const feedsToSync = localFeeds.filter(f => !f.isPaused);

        console.log(`[RefreshAll] Found ${localFeeds.length} feeds, syncing ${feedsToSync.length}`);

        if (feedsToSync.length === 0) {
            console.log('[RefreshAll] No feeds to sync.');
            return 0;
        }

        const CONCURRENCY_LIMIT = 2; // Reduced to prevent UI freezing on mobile
        let completedCount = 0;
        let startedCount = 0;
        let totalNewArticles = 0;
        const total = feedsToSync.length;

        const processNext = async (): Promise<void> => {
            if (signal?.aborted || startedCount >= total) return;

            const feed = feedsToSync[startedCount];
            startedCount++;

            if (onProgress) {
                onProgress(completedCount, total, `Updating ${feed.title}...`);
            }

            // YIELD TO MAIN THREAD: Critical for UI smoothness
            await new Promise(resolve => setTimeout(resolve, 50));

            try {
                const newCount = await this.refreshFeed(feed, signal);
                totalNewArticles += newCount;
            } catch (e) {
                console.error(`[RefreshAll] Error refreshing ${feed.title}:`, e);
            } finally {
                completedCount++;
                if (onProgress && !signal?.aborted) {
                    onProgress(completedCount, total, completedCount === total ? 'Finished' : `Updating feeds...`);
                }
                await processNext();
            }
        };

        const workers = Array(Math.min(CONCURRENCY_LIMIT, feedsToSync.length))
            .fill(null)
            .map(() => processNext());

        await Promise.all(workers);
        console.log(`[RefreshAll] Completed, ${totalNewArticles} new articles`);
        return totalNewArticles;
    }


    private static async mergeArticles(feedId: string, incoming: Article[]): Promise<number> {
        console.log(`[MergeArticles] Processing ${incoming.length} articles for feed ${feedId}`);

        // Apply Rules FIRST
        const mappedIncoming = incoming.map(a => ({ ...a, feedID: feedId }));
        const processedIncoming = await RulesEngine.applyRules(mappedIncoming);

        // 1. Get existing articles for this feed to check status
        const incomingIds = processedIncoming.map(a => a.id);
        if (incomingIds.length === 0) return 0; // All filtered out

        return await db.transaction('rw', db.articles, async () => {
            const existingArticles = await db.articles.where('id').anyOf(incomingIds).toArray();
            const existingMap = new Map(existingArticles.map(a => [a.id, a]));

            console.log(`[MergeArticles] Found ${existingArticles.length} existing articles`);

            const newArticles: Article[] = [];
            const updates: Article[] = [];

            for (const item of processedIncoming) {
                const existing = existingMap.get(item.id);

                if (!existing) {
                    newArticles.push(item);
                } else {
                    // Only update if content has actually changed
                    const hasChanged =
                        existing.title !== item.title ||
                        existing.summary !== item.summary ||
                        existing.contentHTML !== item.contentHTML ||
                        existing.url !== item.url;

                    if (hasChanged) {
                        updates.push({
                            ...item,
                            // Persist user state unless rule forced it
                            // Using bitwise OR as numeric boolean logic (if either is 1, result is 1)
                            isRead: existing.isRead | item.isRead,
                            isBookmarked: existing.isBookmarked | item.isBookmarked,
                            playbackPosition: existing.playbackPosition,
                            downloadStatus: existing.downloadStatus,
                            contentPrefetchedAt: existing.contentPrefetchedAt
                        });
                    }
                }
            }

            console.log(`[MergeArticles] Adding ${newArticles.length} new articles, updating ${updates.length} changed articles`);

            if (newArticles.length > 0) {
                await db.articles.bulkPut(newArticles);
                console.log(`[MergeArticles] Successfully added ${newArticles.length} articles`);
            }

            if (updates.length > 0) {
                await db.articles.bulkPut(updates);
                console.log(`[MergeArticles] Successfully updated ${updates.length} articles`);
            }

            return newArticles.length;
        });
    }

    static async deleteFeed(id: string) {
        await db.transaction('rw', db.feeds, db.articles, async () => {
            await db.articles.where('feedID').equals(id).delete();
            await db.feeds.delete(id);
        });
    }

    static async toggleReadStatus(articleId: string, isRead: boolean) {
        // 1. Optimistic Update Local
        await db.articles.update(articleId, { isRead: isRead ? 1 : 0 });
    }

    static async toggleBookmark(articleId: string, isBookmarked: boolean) {
        // 1. Optimistic Update Local
        await db.articles.update(articleId, { isBookmarked: isBookmarked ? 1 : 0 });
    }

    static async markFeedAsRead(feedId: string) {
        // 1. Local update
        const articles = await db.articles.where('feedID').equals(feedId).filter(a => a.isRead === 0).toArray();
        const ids = articles.map(a => a.id);

        if (ids.length === 0) return;

        await db.articles.bulkUpdate(articles.map(a => ({ key: a.id, changes: { isRead: 1 } })));
    }

    static async markAllAsRead() {
        // 1. Local update: find all unread
        const unread = await db.articles.where('isRead').equals(0).toArray(); // Index scan
        if (unread.length === 0) return;

        // Bulk update is faster
        await db.articles.bulkUpdate(unread.map(a => ({ key: a.id, changes: { isRead: 1 } })));
    }
}
