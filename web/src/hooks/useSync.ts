
import { useCallback } from 'react';
import { useUIStore } from '@/store/uiStore';
import { db } from '@/lib/db';
import { FeedService } from '@/lib/feed-service';

export function useSync() {
    const { startSync, setProgress, endSync } = useUIStore();

    const runSync = useCallback(async () => {
        const localFeeds = await db.feeds.toArray();
        const feedsToSync = localFeeds.filter(f => !f.isPaused);

        console.log(`[useSync] Found ${localFeeds.length} feeds, ${feedsToSync.length} to sync`);

        if (feedsToSync.length === 0) {
            console.log('[useSync] No feeds to sync');
            return;
        }

        startSync(feedsToSync.length);

        try {
            // Use FeedService directly on main thread (more reliable than web worker)
            await FeedService.refreshAllFeeds((completed, total, message) => {
                setProgress(completed, total, message);
            });
        } catch (e) {
            console.error('[useSync] Refresh failed:', e);
        } finally {
            endSync();
        }

    }, [startSync, setProgress, endSync]);

    return { runSync };
}
