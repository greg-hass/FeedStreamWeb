
import { db, Feed, Article } from './db';
import { parseFeed } from './feed-parser';
import { FeverAPI } from './fever-api';
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
            isRead: false
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

    static async refreshFeed(feed: Feed): Promise<number> {
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
                return 0;
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
            });

            // Fetch icon if missing or using generic fallback (so we can retry better extraction)
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
            console.error(`Failed to sync feed ${feed.title}`, e);
            await db.feeds.update(feed.id, {
                lastError: e.message || 'Unknown error',
                consecutiveFailures: (feed.consecutiveFailures || 0) + 1
            });
            return 0;
        }
    }
    static async syncWithFever() {
        const { syncEndpoint, syncUsername, syncApiKey, syncEnabled } = useSettingsStore.getState();
        if (!syncEnabled || !syncEndpoint || !syncApiKey) {
            console.log("Sync disabled or missing config");
            return;
        }

        // Fever API Authentication Strategy
        // Standard: api_key = md5(username + ":" + password)
        // We assume the user entered their "API Password" in the settings "API Key" field.

        console.log(`[FeedService] Sync Config -> Endpoint: ${syncEndpoint}, User: ${syncUsername}, KeyLength: ${syncApiKey.length}`);

        let finalKey = syncApiKey;

        // If we have a username, we should try to hash it according to spec
        if (syncUsername && syncApiKey) {
            // FreshRSS Fever API expects `api_key` to be MD5("username:api_password")
            // We log the *inputs* (carefully) to debug mismatches
            const inputString = `${syncUsername}:${syncApiKey}`;
            console.log(`[FeedService] Hashing input: "${syncUsername}:***" (Length: ${inputString.length})`);

            finalKey = await md5(inputString);
            console.log(`[FeedService] Generated Hash: ${finalKey}`);
        }

        const api = new FeverAPI(syncEndpoint, finalKey);

        try {
            console.log("Starting Sync...");

            // 1. Sequential Fetch: Groups, Feeds, Unread, Saved
            // We do this sequentially to avoid overwhelming the server or hitting browser connection limits on mobile
            console.log("[FeedService] Fetching Groups...");
            const groupsData = await api.getGroups();
            
            console.log("[FeedService] Fetching Feeds...");
            const feedsData = await api.getFeeds();
            
            console.log("[FeedService] Fetching Unread Items...");
            const unreadData = await api.getUnreadItemIds();
            
            console.log("[FeedService] Fetching Saved Items...");
            const savedData = await api.getSavedItemIds();

            // 2. Process Groups (Folders)
            const feedToFolderMap = new Map<string, string>();
            if (groupsData.groups) {
                await db.transaction('rw', db.folders, async () => {
                    // Clear existing folders first? Or merge? Fever source of truth usually implies sync.
                    // For now, upsert.
                    for (const g of groupsData.groups) {
                        await db.folders.put({
                            id: String(g.id),
                            name: g.title,
                            position: 0
                        });
                    }
                });
            }

            if (Array.isArray(feedsData.feeds_groups)) {
                for (const group of feedsData.feeds_groups) {
                    const groupId = group.group_id;
                    if (groupId === undefined || !group.feed_ids) continue;

                    const feedIds = String(group.feed_ids)
                        .split(/[ ,]/)
                        .map(id => id.trim())
                        .filter(Boolean);

                    for (const feedId of feedIds) {
                        // If a feed belongs to multiple groups, prefer the first mapping we encounter.
                        if (!feedToFolderMap.has(feedId)) {
                            feedToFolderMap.set(feedId, String(groupId));
                        }
                    }
                }
            }

            // 3. Process Feeds
            if (feedsData.feeds) {
                await db.transaction('rw', db.feeds, db.articles, async () => {
                    for (const f of feedsData.feeds) {
                        const feverId = String(f.id);
                        const mappedFolderId = feedToFolderMap.get(feverId);
                        
                        // Check for existing feed with same URL but different ID (Local vs Fever collision)
                        const existing = await db.feeds.where('feedURL').equals(f.url).first();
                        
                        if (existing && existing.id !== feverId) {
                            console.log(`[Sync] Resolving Feed Collision: "${f.title}" (Local: ${existing.id} -> Fever: ${feverId})`);
                            
                            // Migrate articles to new ID
                            await db.articles.where('feedID').equals(existing.id).modify({ feedID: feverId });
                            
                            // Delete old feed to free up the unique URL constraint
                            await db.feeds.delete(existing.id);
                        }

                        await db.feeds.put({
                            id: feverId,
                            title: f.title,
                            feedURL: f.url,
                            siteURL: f.site_url,
                            folderID: mappedFolderId ?? (f.group_id !== undefined ? String(f.group_id) : undefined),
                            isFaviconLoaded: false,
                            type: 'rss', // TODO: Infer from metadata if possible
                            dateAdded: new Date(f.last_updated_on_time * 1000),
                            consecutiveFailures: 0,
                            isPaused: false,
                            sortOrder: 0,
                            isFavorite: false
                        });
                    }
                });
            }

            // 4. Sync Read/Saved Status
            // This is critical. We need to update local state based on these ID lists.
            if (unreadData.unread_item_ids) {
                const unreadIds = unreadData.unread_item_ids.split(',').map(String);
                // Mark these as unread
                await db.articles.where('id').anyOf(unreadIds).modify({ isRead: false });
                
                // Implicitly, anything NOT in this list (and older than sync time) *could* be read.
                // But safer to just process the "unread" list for now.
            }

            if (savedData.saved_item_ids) {
                const savedIds = savedData.saved_item_ids.split(',').map(String);
                await db.articles.where('id').anyOf(savedIds).modify({ isBookmarked: true });
            }

            // 5. Fetch Items (Articles)
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
        const YOUTUBE_PATTERNS = [
            /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
        ];

        const extractYouTubeVideoID = (url: string): string | null => {
            try {
                const urlObj = new URL(url);
                const hostname = urlObj.hostname.replace('www.', '');
                if (hostname === 'youtu.be') return urlObj.pathname.slice(1);
                if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
                    const v = urlObj.searchParams.get('v');
                    if (v) return v;
                    if (urlObj.pathname.startsWith('/embed/')) return urlObj.pathname.split('/')[2];
                    if (urlObj.pathname.startsWith('/v/')) return urlObj.pathname.split('/')[2];
                }
            } catch (e) { }
            return null;
        };

        const articles = items.map(item => {
            let mediaKind = 'none';
            let contentHTML = item.html;
            let thumbnailPath: string | undefined = undefined;

            // YouTube Detection
            if (item.url) {
                const vid = extractYouTubeVideoID(item.url);
                if (vid) {
                    mediaKind = 'youtube';
                    contentHTML = `<iframe width="100%" height="auto" style="aspect-ratio: 16/9" src="https://www.youtube.com/embed/${vid}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
                    thumbnailPath = `https://i.ytimg.com/vi/${vid}/maxresdefault.jpg`;
                }
            }

            // Reddit Detection (Basic)
            if (item.url && item.url.includes('reddit.com')) {
                // Try to find image in HTML if not already there
                const imgMatch = contentHTML.match(/src="(https:\/\/i\.redd\.it\/[^"]+)"/);
                if (imgMatch) {
                    thumbnailPath = imgMatch[1];
                }
            }
            
            return {
                id: String(item.id), // Fever ID
                feedID: String(item.feed_id),
                title: item.title,
                url: item.url,
                author: item.author,
                contentHTML: contentHTML,
                summary: item.url, 
                publishedAt: new Date(item.created_on_time * 1000),
                isRead: item.is_read === 1,
                isBookmarked: item.is_saved === 1,
                mediaKind: mediaKind, 
                thumbnailPath: thumbnailPath,
                imageCacheStatus: 0,
                downloadStatus: 0,
                playbackPosition: 0,
            };
        });

        // Simplified merge: Just put them in.
        await db.articles.bulkPut(articles as any);
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
                            // Persist user state unless rule forced it?
                            // Simplest: OR logic. isRead = existing.isRead || item.isRead (from rule)
                            isRead: existing.isRead || item.isRead,
                            isBookmarked: existing.isBookmarked || item.isBookmarked,
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

    static async markFeedAsRead(feedId: string) {
        // 1. Local update
        const articles = await db.articles.where('feedID').equals(feedId).filter(a => !a.isRead).toArray();
        const ids = articles.map(a => a.id);

        if (ids.length === 0) return;

        await db.articles.bulkUpdate(articles.map(a => ({ key: a.id, changes: { isRead: true } })));

        // 2. Sync (Basic Loop for now, ideally batch if API supported)
        const { syncEndpoint, syncApiKey, syncEnabled } = useSettingsStore.getState();
        if (syncEnabled && syncEndpoint && syncApiKey) {
            const api = new FeverAPI(syncEndpoint, syncApiKey);
            for (const id of ids) {
                const numericId = parseInt(id);
                if (!isNaN(numericId)) {
                    // Fire and forget to avoid blocking UI
                    api.markItemRead(numericId).catch(console.error);
                }
            }
        }
    }

    static async markAllAsRead() {
        // 1. Local update: find all unread
        const unread = await db.articles.where('isRead').equals(0).toArray(); // Index scan
        if (unread.length === 0) return;

        // Bulk update is faster
        await db.articles.bulkUpdate(unread.map(a => ({ key: a.id, changes: { isRead: true } })));

        // 2. Sync
        const { syncEndpoint, syncApiKey, syncEnabled } = useSettingsStore.getState();
        if (syncEnabled && syncEndpoint && syncApiKey) {
            const api = new FeverAPI(syncEndpoint, syncApiKey);
            // This could be heavy. Fever API usually has "mark group as read" or similar but our basic client might not.
            // We'll limit to recent 50 to avoid flooding, or just accept the limitation.
            // Better strategy: Just mark visible/fetched ones? 
            // For now, we leave this as a "Best Effort" local action primarily.
            console.warn("Syncing 'Mark All Read' for all items is not fully optimized for Fever yet.");
        }
    }
}
