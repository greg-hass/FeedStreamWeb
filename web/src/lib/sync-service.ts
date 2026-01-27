import { db, Feed, Folder, Article } from './db';
import {
    SupabaseAuth,
    SupabaseDB,
    SyncFolder,
    SyncFeed,
    SyncArticleState,
    isSupabaseConfigured,
} from './supabase-client';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * Sync Service for FeedStream
 *
 * Handles bidirectional synchronization between local Dexie database and Supabase cloud.
 *
 * Features:
 * - Full sync (initial device setup)
 * - Incremental sync (since last sync)
 * - Offline queue processing
 * - Conflict resolution (last-write-wins with user intent preservation)
 */

export interface SyncState {
    isOnline: boolean;
    isSyncing: boolean;
    lastSyncAt: Date | null;
    pendingChanges: number;
    error: string | null;
}

export type SyncOperation = 'insert' | 'update' | 'delete';

export interface SyncQueueItem {
    id?: number;
    table: 'folders' | 'feeds' | 'articles';
    recordId: string;
    operation: SyncOperation;
    data: object;
    createdAt: Date;
    attempts: number;
}

// Event emitter for sync state changes
type SyncEventCallback = (state: SyncState) => void;
const syncListeners: Set<SyncEventCallback> = new Set();

// Current sync state
let currentSyncState: SyncState = {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    lastSyncAt: null,
    pendingChanges: 0,
    error: null,
};

function notifySyncStateChange() {
    syncListeners.forEach(cb => cb(currentSyncState));
}

function updateSyncState(updates: Partial<SyncState>) {
    currentSyncState = { ...currentSyncState, ...updates };
    notifySyncStateChange();
}

export class SyncService {
    /**
     * Initialize sync service
     * - Set up online/offline listeners
     * - Check for pending changes
     */
    static async initialize(): Promise<void> {
        if (typeof window === 'undefined') return;

        // Online/offline listeners
        window.addEventListener('online', () => {
            updateSyncState({ isOnline: true });
            // Auto-sync when coming back online
            this.processOfflineQueue().catch(console.error);
        });

        window.addEventListener('offline', () => {
            updateSyncState({ isOnline: false });
        });

        // Count pending changes
        await this.updatePendingCount();

        // Load last sync time from settings
        const settings = useSettingsStore.getState();
        if (settings.lastSyncAt) {
            currentSyncState.lastSyncAt = new Date(settings.lastSyncAt);
        }
    }

    /**
     * Get current sync state
     */
    static getState(): SyncState {
        return { ...currentSyncState };
    }

    /**
     * Subscribe to sync state changes
     */
    static subscribe(callback: SyncEventCallback): () => void {
        syncListeners.add(callback);
        // Immediately call with current state
        callback(currentSyncState);

        return () => {
            syncListeners.delete(callback);
        };
    }

    /**
     * Full sync - sync all data (used for initial setup or recovery)
     */
    static async fullSync(): Promise<void> {
        if (!isSupabaseConfigured()) {
            throw new Error('Supabase is not configured');
        }

        const isAuth = await SupabaseAuth.isAuthenticated();
        if (!isAuth) {
            throw new Error('Not authenticated');
        }

        updateSyncState({ isSyncing: true, error: null });

        try {
            // 1. Push local changes first
            await this.pushAllLocal();

            // 2. Pull all remote changes
            await this.pullAllRemote();

            // 3. Update last sync time
            const now = new Date();
            useSettingsStore.getState().setLastSyncAt(now.toISOString());
            updateSyncState({ lastSyncAt: now, isSyncing: false });

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Sync failed';
            updateSyncState({ isSyncing: false, error: message });
            throw error;
        }
    }

    /**
     * Incremental sync - only sync changes since last sync
     */
    static async incrementalSync(): Promise<void> {
        if (!isSupabaseConfigured()) return;

        const isAuth = await SupabaseAuth.isAuthenticated();
        if (!isAuth) return;

        if (currentSyncState.isSyncing) return; // Already syncing

        updateSyncState({ isSyncing: true, error: null });

        try {
            const since = currentSyncState.lastSyncAt || undefined;

            // 1. Process offline queue
            await this.processOfflineQueue();

            // 2. Pull remote changes
            await this.pullChanges(since);

            // 3. Update last sync time
            const now = new Date();
            useSettingsStore.getState().setLastSyncAt(now.toISOString());
            updateSyncState({ lastSyncAt: now, isSyncing: false });

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Sync failed';
            updateSyncState({ isSyncing: false, error: message });
            // Don't throw for incremental sync - it's often called automatically
            console.error('Incremental sync failed:', error);
        }
    }

    /**
     * Queue a change for sync
     */
    static async queueChange(
        table: 'folders' | 'feeds' | 'articles',
        recordId: string,
        operation: SyncOperation,
        data: object
    ): Promise<void> {
        await db.syncQueue.add({
            table,
            recordId,
            operation,
            data,
            createdAt: new Date(),
            attempts: 0,
        });

        await this.updatePendingCount();

        // Try to sync immediately if online
        if (currentSyncState.isOnline && !currentSyncState.isSyncing) {
            this.processOfflineQueue().catch(console.error);
        }
    }

    /**
     * Process offline queue
     * Uses atomic transactions to prevent partial syncs
     */
    static async processOfflineQueue(): Promise<void> {
        if (!currentSyncState.isOnline) return;
        if (!isSupabaseConfigured()) return;

        const isAuth = await SupabaseAuth.isAuthenticated();
        if (!isAuth) return;

        const queue = await db.syncQueue.toArray();
        
        if (queue.length === 0) return;

        // Process items in batches to avoid long-running transactions
        const BATCH_SIZE = 50;
        for (let i = 0; i < queue.length; i += BATCH_SIZE) {
            const batch = queue.slice(i, i + BATCH_SIZE);
            
            // Process each item in the batch atomically
            for (const item of batch) {
                try {
                    // Use transaction to ensure atomicity: process AND delete together
                    await db.transaction('rw', db.syncQueue, async () => {
                        await this.processSyncItem(item);
                        // Only delete if processing succeeded
                        if (item.id) {
                            await db.syncQueue.delete(item.id);
                        }
                    });
                } catch (error) {
                    // Transaction failed - item stays in queue
                    console.error(`Failed to sync item ${item.recordId}:`, error);
                    
                    // Increment attempt count (outside transaction to avoid conflicts)
                    if (item.id) {
                        try {
                            await db.syncQueue.update(item.id, { 
                                attempts: item.attempts + 1,
                                createdAt: new Date() // Update timestamp for retry ordering
                            });
                        } catch (updateError) {
                            console.error(`Failed to update attempt count for ${item.recordId}:`, updateError);
                        }
                    }
                    
                    // Stop processing if we've had too many consecutive failures
                    // to avoid hammering the server
                    if (item.attempts >= 5) {
                        console.warn(`Item ${item.recordId} has failed ${item.attempts} times, skipping for now`);
                    }
                }
            }
        }

        await this.updatePendingCount();
    }

    /**
     * Process a single sync queue item
     */
    private static async processSyncItem(item: SyncQueueItem): Promise<void> {
        switch (item.table) {
            case 'folders':
                if (item.operation === 'delete') {
                    await SupabaseDB.deleteFolder(item.recordId);
                } else {
                    await SupabaseDB.upsertFolder(this.localFolderToSync(item.data as Folder));
                }
                break;

            case 'feeds':
                if (item.operation === 'delete') {
                    await SupabaseDB.deleteFeed(item.recordId);
                } else {
                    await SupabaseDB.upsertFeed(this.localFeedToSync(item.data as Feed));
                }
                break;

            case 'articles':
                // Only sync article states, not full content
                const article = item.data as Article;
                await SupabaseDB.upsertArticleState({
                    id: article.id,
                    article_url: article.url || article.id,
                    feed_id: article.feedID,
                    is_read: article.isRead === 1,
                    is_bookmarked: article.isBookmarked === 1,
                    playback_position: article.playbackPosition || 0,
                });
                break;
        }
    }

    /**
     * Push all local data to cloud
     */
    private static async pushAllLocal(): Promise<void> {
        const { data: user } = await (await import('./supabase-client')).getSupabase().auth.getUser();
        if (!user.user) throw new Error('Not authenticated');

        // Push folders
        const folders = await db.folders.toArray();
        for (const folder of folders) {
            await SupabaseDB.upsertFolder({
                ...this.localFolderToSync(folder),
                user_id: user.user.id,
            });
        }

        // Push feeds
        const feeds = await db.feeds.toArray();
        for (const feed of feeds) {
            await SupabaseDB.upsertFeed({
                ...this.localFeedToSync(feed),
                user_id: user.user.id,
            });
        }

        // Push article states (not full content)
        const articles = await db.articles
            .filter(a => a.isRead === 1 || a.isBookmarked === 1 || (a.playbackPosition || 0) > 0)
            .toArray();

        for (const article of articles) {
            await SupabaseDB.upsertArticleState({
                id: article.id,
                user_id: user.user.id,
                article_url: article.url || article.id,
                feed_id: article.feedID,
                is_read: article.isRead === 1,
                is_bookmarked: article.isBookmarked === 1,
                playback_position: article.playbackPosition || 0,
            });
        }
    }

    /**
     * Pull all remote data
     */
    private static async pullAllRemote(): Promise<void> {
        await this.pullChanges();
    }

    /**
     * Pull changes from cloud (since optional date)
     */
    private static async pullChanges(since?: Date): Promise<void> {
        // Pull folders
        const remoteFolders = await SupabaseDB.getFolders(since);
        for (const rf of remoteFolders) {
            await this.mergeFolder(rf);
        }

        // Pull feeds
        const remoteFeeds = await SupabaseDB.getFeeds(since);
        for (const rf of remoteFeeds) {
            await this.mergeFeed(rf);
        }

        // Pull article states
        const remoteStates = await SupabaseDB.getArticleStates(since);
        for (const rs of remoteStates) {
            await this.mergeArticleState(rs);
        }
    }

    /**
     * Merge remote folder with local
     */
    private static async mergeFolder(remote: SyncFolder): Promise<void> {
        const local = await db.folders.get(remote.id);

        if (remote.deleted_at) {
            // Deleted remotely
            if (local) {
                await db.folders.delete(remote.id);
            }
            return;
        }

        if (!local) {
            // New folder from cloud
            // Check for name conflict (duplicate folder with different ID)
            // Note: Using filter() instead of where() since 'name' is not indexed
            const existingByName = await db.folders.filter(f => f.name === remote.name).first();

            if (existingByName) {
                console.log(`[Sync] Found duplicate folder by name: ${existingByName.name}. Migrating to remote ID...`);
                
                await db.transaction('rw', db.folders, db.feeds, async () => {
                    // 1. Move all feeds from old folder to new folder ID
                    await db.feeds.where('folderID').equals(existingByName.id).modify({ folderID: remote.id });
                    
                    // 2. Delete the old local folder
                    await db.folders.delete(existingByName.id);
                    
                    // 3. Add the new folder from remote
                    await db.folders.add(this.syncFolderToLocal(remote));
                });
            } else {
                await db.folders.add(this.syncFolderToLocal(remote));
            }
        } else {
            // Merge: last-write-wins based on updated_at
            // Local doesn't have updated_at, so we always take remote if newer
            await db.folders.update(remote.id, this.syncFolderToLocal(remote));
        }
    }

    /**
     * Merge remote feed with local
     */
    private static async mergeFeed(remote: SyncFeed): Promise<void> {
        await db.transaction('rw', db.feeds, db.articles, async () => {
            const local = await db.feeds.get(remote.id);

            if (remote.deleted_at) {
                if (local) {
                    await db.feeds.delete(remote.id);
                    await db.articles.where('feedID').equals(remote.id).delete();
                }
                // Also check if there's a local feed with same URL (different ID) that was "deleted" remotely
                const existingByUrl = await db.feeds.where('feedURL').equals(remote.feed_url).first();
                if (existingByUrl && existingByUrl.id !== remote.id) {
                    // Don't delete local feeds that have different IDs - they may be legitimate
                    console.log(`[Sync] Remote deleted ${remote.id}, but local ${existingByUrl.id} has same URL - keeping local`);
                }
                return;
            }

            const feedData = this.syncFeedToLocal(remote);

            if (!local) {
                // Check for URL conflict (same feed, different ID)
                const existingByUrl = await db.feeds.where('feedURL').equals(feedData.feedURL).first();

                if (existingByUrl) {
                    // Feed already exists locally with different ID - just update it, don't delete/re-add
                    console.log(`[Sync] Feed exists locally (${existingByUrl.id}) with same URL as remote (${remote.id}). Updating local.`);
                    await db.feeds.update(existingByUrl.id, {
                        title: feedData.title,
                        siteURL: feedData.siteURL,
                        folderID: feedData.folderID,
                        iconURL: feedData.iconURL,
                        type: feedData.type,
                        isPaused: feedData.isPaused,
                        sortOrder: feedData.sortOrder,
                        isFavorite: feedData.isFavorite,
                    });
                    // Don't migrate IDs - keep local ID stable to avoid loops
                } else {
                    await db.feeds.add(feedData);
                }
            } else {
                await db.feeds.update(remote.id, feedData);
            }
        });
    }

    /**
     * Merge remote article state with local
     * Uses user-intent preservation: OR logic for read/bookmarked, MAX for playback position
     */
    private static async mergeArticleState(remote: SyncArticleState): Promise<void> {
        // Find local article by URL (more stable than ID across devices)
        const local = await db.articles
            .where('url')
            .equals(remote.article_url)
            .first();

        if (!local) {
            // Article doesn't exist locally - might have been deleted or not fetched yet
            return;
        }

        // User intent preservation:
        // - isRead: OR (once read on any device, stays read)
        // - isBookmarked: OR (once bookmarked on any device, stays bookmarked)
        // - playbackPosition: MAX (preserve furthest progress)
        const mergedIsRead = local.isRead === 1 || remote.is_read ? 1 : 0;
        const mergedIsBookmarked = local.isBookmarked === 1 || remote.is_bookmarked ? 1 : 0;
        const mergedPlaybackPosition = Math.max(local.playbackPosition || 0, remote.playback_position || 0);

        await db.articles.update(local.id, {
            isRead: mergedIsRead,
            isBookmarked: mergedIsBookmarked,
            playbackPosition: mergedPlaybackPosition,
        });
    }

    /**
     * Update pending changes count
     */
    private static async updatePendingCount(): Promise<void> {
        const count = await db.syncQueue.count();
        updateSyncState({ pendingChanges: count });
    }

    // Conversion helpers
    private static localFolderToSync(folder: Folder): Partial<SyncFolder> {
        return {
            id: folder.id,
            name: folder.name,
            position: folder.position,
        };
    }

    private static syncFolderToLocal(sync: SyncFolder): Folder {
        return {
            id: sync.id,
            name: sync.name,
            position: sync.position,
        };
    }

    private static localFeedToSync(feed: Feed): Partial<SyncFeed> {
        return {
            id: feed.id,
            title: feed.title,
            feed_url: feed.feedURL,
            site_url: feed.siteURL || null,
            folder_id: feed.folderID || null,
            icon_url: feed.iconURL || null,
            type: feed.type,
            is_paused: feed.isPaused,
            sort_order: feed.sortOrder,
            is_favorite: feed.isFavorite,
        };
    }

    private static syncFeedToLocal(sync: SyncFeed): Feed {
        return {
            id: sync.id,
            title: sync.title,
            feedURL: sync.feed_url,
            siteURL: sync.site_url || undefined,
            folderID: sync.folder_id || undefined,
            iconURL: sync.icon_url || undefined,
            type: sync.type as Feed['type'],
            isPaused: sync.is_paused,
            sortOrder: sync.sort_order,
            isFavorite: sync.is_favorite,
            consecutiveFailures: 0,
        };
    }
}

// Note: React hook for sync state is provided in a separate file to avoid
// importing React in this service module. See useSyncState in hooks/useSyncState.ts
