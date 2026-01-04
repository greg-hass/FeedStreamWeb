
import { db, Feed, Article } from './db';
import { parseFeed } from './feed-parser';
import { FeverAPI } from './fever-api';
import { useSettingsStore } from '@/store/settingsStore';
import { md5, uuidv4 } from './utils';
import { IconService } from './icon-service';

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
        const articlesWithFeedId = normalized.articles.map(a => ({
            ...a,
            feedID: feedId,
            isRead: false
        }));

        await db.articles.bulkAdd(articlesWithFeedId);

        // 4. Fetch and update feed icon
        const feed = await db.feeds.get(feedId);
        if (feed) {
            await IconService.updateFeedIcon(feed, normalized.rawData);
        }

        return feedId;
    }

    static async refreshFeed(feed: Feed): Promise<void> {
        console.log(`[RefreshFeed] Starting refresh for: ${feed.title}`);
        try {
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(feed.feedURL)}`;
            const response = await fetch(proxyUrl);

            if (!response.ok) {
                console.error(`[RefreshFeed] HTTP error ${response.status} for ${feed.title}`);
                await db.feeds.update(feed.id, {
                    lastError: `HTTP ${response.status}`,
                    consecutiveFailures: (feed.consecutiveFailures || 0) + 1
                });
                return;
            }

            const text = await response.text();
            console.log(`[RefreshFeed] Fetched ${text.length} bytes for ${feed.title}`);
            const normalized = await parseFeed(text, feed.feedURL);
            console.log(`[RefreshFeed] Parsed ${normalized.articles.length} articles for ${feed.title}`);

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
            console.log(`[RefreshFeed] Completed refresh for ${feed.title}`);

        } catch (e: any) {
            console.error(`Failed to sync feed ${feed.title}`, e);
            await db.feeds.update(feed.id, {
                lastError: e.message || 'Unknown error',
                consecutiveFailures: (feed.consecutiveFailures || 0) + 1
            });
        }
    }

    static async syncWithFever() {
        const { syncEndpoint, syncApiKey, syncEnabled } = useSettingsStore.getState();
        if (!syncEnabled || !syncEndpoint || !syncApiKey) {
            console.log("Sync disabled or missing config");
            return;
        }

        // Fever expects API key = MD5(username:password) usually, or we provide it raw if user gave raw.
        // Assuming user provided the already computed key or we compute it in settings.
        // Let's assume the store holds the valid key for now.

        // In Fever, the api_key parameter is md5(email + ":" + password).
        // We will assume the prompt sends us the computed hash for now or simple API key.

        const api = new FeverAPI(syncEndpoint, syncApiKey);

        try {
            console.log("Starting Sync...");

            // 1. Sync Groups (Folders)
            const groupsData = await api.getGroups();
            if (groupsData.groups) {
                await db.transaction('rw', db.folders, async () => {
                    for (const g of groupsData.groups) {
                        await db.folders.put({
                            id: String(g.id),
                            name: g.title,
                            position: 0 // Fever doesn't strictly give position in basic response
                        });
                    }
                });
            }

            // 2. Sync Feeds
            const feedsData = await api.getFeeds();
            if (feedsData.feeds) {
                await db.transaction('rw', db.feeds, async () => {
                    for (const f of feedsData.feeds) {
                        await db.feeds.put({
                            id: String(f.id),
                            title: f.title,
                            feedURL: f.url,
                            siteURL: f.site_url, // Changed from link to siteURL to match DB schema
                            folderID: String(f.group_id),
                            isFaviconLoaded: false,
                            type: 'rss', // Assume RSS default
                            dateAdded: new Date(f.last_updated_on_time * 1000), // Fever uses unix timestamp
                            consecutiveFailures: 0,
                            isPaused: false,
                            sortOrder: 0,
                            isFavorite: false
                        });
                    }
                });
            }

            // 3. Sync Unread Status
            // Fever gives list of unread item IDs "1,2,3"
            const unreadData = await api.getUnreadItemIds();
            if (unreadData.unread_item_ids) {
                const unreadIds = new Set(unreadData.unread_item_ids.split(',').map(String));
                // Mark local articles as read if NOT in this list?
                // Or just ensure these are unread.
                // Usually we mark everything older than X as read, and specific IDs as unread.
                // For simplicity: We trust server. If server says X is unread, we mark unread.
                // If server implies read (implied by absence?), strictly speaking only if we have full history.

                // Getting all unread items from API
                // Note: Fever doesn't give content in 'unread_item_ids', just IDs.
                // We need to fetch the items if we don't have them.
            }

            // 4. Fetch Items (Articles)
            // We fetch latest 50 items for now.
            const itemsData = await api.getItems();
            if (itemsData.items) {
                await this.processFeverItems(itemsData.items);
            }

        } catch (e) {
            console.error("Sync Failed", e);
            throw e;
        }
    }

    private static async processFeverItems(items: any[]) {
        const articles = items.map(item => ({
            id: String(item.id), // Fever ID
            feedID: String(item.feed_id),
            title: item.title,
            url: item.url,
            author: item.author,
            contentHTML: item.html,
            summary: item.url, // Fever doesn't always distinguish summary/content perfectly
            publishedAt: new Date(item.created_on_time * 1000),
            isRead: item.is_read === 1,
            isBookmarked: item.is_saved === 1,
            mediaKind: 'none', // parsing needed if we want podcast
            imageCacheStatus: 0,
            downloadStatus: 0,
            playbackPosition: 0,
        }));

        // Simplified merge: Just put them in.
        /*
           Critical: We need to map Article Type from DB.
           But here we just put them in Articles table.
        */
        await db.articles.bulkPut(articles as any);
    }

    private static async mergeArticles(feedId: string, incoming: Article[]) {
        console.log(`[MergeArticles] Processing ${incoming.length} articles for feed ${feedId}`);

        // 1. Get existing articles for this feed to check status
        // Optimization: Just get IDs and their Read status if needed, 
        // but Dexie bulkGet might be slower than just strict ID check if we have hash.

        // We used `makeStableId` so IDs are deterministic based on URL/GUID.
        const incomingIds = incoming.map(a => a.id);
        const existingArticles = await db.articles.where('id').anyOf(incomingIds).toArray();
        const existingMap = new Map(existingArticles.map(a => [a.id, a]));

        console.log(`[MergeArticles] Found ${existingArticles.length} existing articles`);

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
                // Only update if content has actually changed
                const hasChanged =
                    existing.title !== item.title ||
                    existing.summary !== item.summary ||
                    existing.contentHTML !== item.contentHTML ||
                    existing.url !== item.url;

                if (hasChanged) {
                    updates.push({
                        ...item,
                        feedID: feedId,
                        isRead: existing.isRead,
                        isBookmarked: existing.isBookmarked,
                        playbackPosition: existing.playbackPosition,
                        downloadStatus: existing.downloadStatus,
                        contentPrefetchedAt: existing.contentPrefetchedAt
                    });
                }
                // If nothing changed, skip the update entirely
            }
        }

        console.log(`[MergeArticles] Adding ${newArticles.length} new articles, updating ${updates.length} changed articles (skipped ${existingArticles.length - updates.length} unchanged)`);

        if (newArticles.length > 0) {
            // Use bulkPut to be safe, though bulkAdd is fine since we checked existence
            await db.articles.bulkPut(newArticles);
            console.log(`[MergeArticles] Successfully added ${newArticles.length} articles`);
        }

        if (updates.length > 0) {
            await db.articles.bulkPut(updates);
            console.log(`[MergeArticles] Successfully updated ${updates.length} articles`);
        }
    }

    static async deleteFeed(id: string) {
        await db.transaction('rw', db.feeds, db.articles, async () => {
            await db.articles.where('feedID').equals(id).delete();
            await db.feeds.delete(id);
        });
    }

    static async toggleReadStatus(articleId: string, isRead: boolean) {
        // 1. Optimistic Update Local
        await db.articles.update(articleId, { isRead });

        // 2. Sync with Fever if enabled
        const { syncEndpoint, syncApiKey, syncEnabled } = useSettingsStore.getState();
        if (syncEnabled && syncEndpoint && syncApiKey) {
            // Fever API expects numeric ID? Our IDs are strings (UUIDs or hashes). 
            // If we synced FROM Fever, the ID is numeric string. 
            // If we are Local-Only, we can't sync this item anyway.
            // Check if ID is numeric-like (Fever assumption)
            const numericId = parseInt(articleId);
            if (!isNaN(numericId)) {
                try {
                    const api = new FeverAPI(syncEndpoint, syncApiKey);
                    if (isRead) {
                        await api.markItemRead(numericId);
                    } else {
                        await api.markItemUnread(numericId);
                    }
                } catch (e) {
                    console.error('Failed to sync read status:', e);
                    // Optionally revert local change if strictly required, 
                    // but optimistic UI usually keeps local state and retries later.
                }
            }
        }
    }

    static async toggleBookmark(articleId: string, isBookmarked: boolean) {
        // 1. Optimistic Update Local
        await db.articles.update(articleId, { isBookmarked });

        // 2. Sync with Fever if enabled
        const { syncEndpoint, syncApiKey, syncEnabled } = useSettingsStore.getState();
        if (syncEnabled && syncEndpoint && syncApiKey) {
            const numericId = parseInt(articleId);
            if (!isNaN(numericId)) {
                try {
                    const api = new FeverAPI(syncEndpoint, syncApiKey);
                    if (isBookmarked) {
                        await api.markItemSaved(numericId);
                    } else {
                        await api.markItemUnsaved(numericId);
                    }
                } catch (e) {
                    console.error('Failed to sync bookmark status:', e);
                }
            }
        }
    }
}
