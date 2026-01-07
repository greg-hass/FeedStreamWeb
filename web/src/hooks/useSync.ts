
import { useCallback, useRef } from 'react';
import { useUIStore } from '@/store/uiStore';
import { db } from '@/lib/db';

export function useSync() {
    const { startSync, setProgress, endSync } = useUIStore();
    const workerRef = useRef<Worker | null>(null);

    const runSync = useCallback(async () => {
        const localFeeds = await db.feeds.toArray();
        const feedsToSync = localFeeds.filter(f => !f.isPaused);

        if (feedsToSync.length === 0) return;

        startSync(feedsToSync.length);

        if (!workerRef.current) {
            // Create the worker
            workerRef.current = new Worker(new URL('../workers/sync.ts', import.meta.url));
        }

        workerRef.current.onmessage = (e) => {
            const { type, payload } = e.data;

            switch (type) {
                case 'PROGRESS':
                    setProgress(payload.completed, payload.total, payload.feedName);
                    break;
                case 'COMPLETE':
                    endSync();
                    break;
                case 'ERROR':
                    console.error('Sync Worker Error:', payload);
                    endSync();
                    break;
            }
        };

        workerRef.current.postMessage({
            type: 'START_SYNC',
            payload: { feeds: feedsToSync }
        });

    }, [startSync, setProgress, endSync]);

    return { runSync };
}
