import { useCallback } from 'react';
import { useUIStore } from '@/store/uiStore';
import { syncAllFeeds, getArticles } from '@/lib/api-client';
import { db } from '@/lib/db';

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
            
            // Pull fresh data down to local DB if new articles found
            if (result.newArticles > 0) {
                setProgress(result.totalFeeds, result.totalFeeds, 'Downloading new articles...');
                // Convert backend articles to local Article type if needed, or use Dexie's bulkPut
                // Assuming getArticles returns matching shape, but double check type safety in real world
                const freshArticles = await getArticles({ limit: 100 }); 
                
                // Map API response to DB schema if strictly typed, but for now assuming parity or casting
                // Note: apiClient.getArticles returns parsed objects. Ensure dates are Date objects if needed.
                const mappedArticles = (freshArticles as any[]).map(a => ({
                    ...a,
                    publishedAt: a.publishedAt ? new Date(a.publishedAt) : undefined,
                    readAt: a.readAt ? new Date(a.readAt) : undefined,
                    // Ensure all required DB fields exist
                }));

                await db.articles.bulkPut(mappedArticles);
                console.log(`[useSync] Downloaded ${mappedArticles.length} articles to local DB`);
            }

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
