import { useCallback } from 'react';
import { useUIStore } from '@/store/uiStore';
import { syncAllFeeds } from '@/lib/api-client';

/**
 * useSync Hook - Backend Version
 * 
 * Now uses the backend API to sync all feeds
 * This offloads the heavy lifting from the browser to the server
 */
export function useSync() {
    const { startSync, setProgress, endSync } = useUIStore();

    const runSync = useCallback(async () => {
        console.log('[useSync] Starting backend sync');

        startSync(0); // 0 = unknown total initially
        setProgress(0, 0, 'Connecting to server...');

        try {
            // Use backend API for feed syncing
            const result = await syncAllFeeds();
            
            console.log(`[useSync] Sync complete: ${result.successful}/${result.totalFeeds} feeds synced, ${result.newArticles} new articles`);
            
            setProgress(
                result.totalFeeds, 
                result.totalFeeds, 
                `Synced ${result.newArticles} new articles`
            );
            
            return result;
        } catch (e: any) {
            console.error('[useSync] Refresh failed:', e);
            setProgress(0, 0, `Sync failed: ${e.message}`);
            throw e;
        } finally {
            endSync();
        }
    }, [startSync, setProgress, endSync]);

    return { runSync };
}
