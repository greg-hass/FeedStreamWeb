
import { db, Feed } from '../lib/db';
import { FeedService } from '../lib/feed-service';

/**
 * Sync Worker
 * Handles the heavy lifting of fetching and parsing feeds off the main thread.
 */

self.onmessage = async (e: MessageEvent) => {
    const { type, payload } = e.data;

    if (type === 'START_SYNC') {
        const { feeds, baseUrl } = payload;
        
        try {
            let totalNewArticles = 0;
            const total = feeds.length;
            
            // We use the same logic as FeedService but it now runs in the worker
            for (let i = 0; i < feeds.length; i++) {
                const feed = feeds[i];
                
                // Notify progress
                self.postMessage({
                    type: 'PROGRESS',
                    payload: {
                        completed: i,
                        total,
                        message: `Updating ${feed.title}...`,
                        feedName: feed.title
                    }
                });

                try {
                    // refreshFeed performs fetch + parse + merge
                    const newCount = await FeedService.refreshFeed(feed, undefined, baseUrl);
                    totalNewArticles += newCount;
                } catch (err) {
                    console.error(`Worker failed to sync ${feed.title}:`, err);
                }
            }

            self.postMessage({
                type: 'COMPLETE',
                payload: {
                    totalNewArticles,
                    total
                }
            });

        } catch (error: any) {
            self.postMessage({
                type: 'ERROR',
                payload: error.message
            });
        }
    }
};

export {};
