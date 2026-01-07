import { useLiveQuery } from "dexie-react-hooks";
import { db, Article } from "@/lib/db";
import Dexie from "dexie";
import { useState, useEffect, useRef } from "react";
import { useUIStore } from "@/store/uiStore";

export function useArticles(
    view: 'today' | 'last24h' | 'week' | 'all' | 'saved' | 'history' | 'youtube' | 'podcasts' | 'reddit' | string = 'all',
    limit = 100,
    searchQuery: string = ''
) {
    // Note: We check isSyncing via useUIStore.getState() in the debounce effect
    // to avoid re-running the effect when sync status changes

    // Raw live query - updates on every DB change
    const liveArticles = useLiveQuery(async () => {
        // PERF: Skip heavy queries during sync
        if (useUIStore.getState().isSyncing) {
            return 'SYNCING_PAUSE';
        }

        let collection: any; // Use any to avoid Dexie's complex generic type issues
        const now = new Date();

        // 1. Select the base collection strategy
        if (view === 'today') {
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            collection = db.articles.where('publishedAt').above(startOfDay);
        } else if (view === 'last24h') {
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            collection = db.articles.where('publishedAt').above(yesterday);
        } else if (view === 'week') {
            const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            collection = db.articles.where('publishedAt').above(lastWeek);
        } else if (view === 'saved') {
            // Use simple index which is proven to work in Sidebar
            const allSaved = await db.articles.where('isBookmarked').equals(1).toArray();
            // Sort in memory (newest first)
            allSaved.sort((a, b) => {
                const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
                const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
                return dateB - dateA;
            });
            // Apply limit and map
            return allSaved.slice(0, limit).map(a => ({
                ...a,
                contentHTML: undefined,
                readerHTML: undefined,
            }));
        } else if (view === 'history') {
            collection = db.articles.where('isRead').equals(1);
        } else if (view === 'youtube') {
            collection = db.articles
                .where('[mediaKind+publishedAt]')
                .between(['youtube', Dexie.minKey], ['youtube', Dexie.maxKey]);
        } else if (view === 'podcasts') {
            collection = db.articles
                .where('[mediaKind+publishedAt]')
                .between(['podcast', Dexie.minKey], ['podcast', Dexie.maxKey]);
        } else if (view === 'reddit') {
            const redditFeedIds = await db.feeds.where('type').equals('reddit').primaryKeys();
            if (redditFeedIds.length === 0) return [];
            // Use index instead of full scan filter
            const results = await db.articles.where('feedID').anyOf(redditFeedIds as string[]).toArray();
            results.sort((a, b) => (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0));
            return results.slice(0, limit).map(a => ({ ...a, contentHTML: undefined, readerHTML: undefined }));
        } else if (view === 'rss') {
            const allowedFeedIds = await db.feeds.where('type').noneOf(['reddit', 'youtube', 'podcast']).primaryKeys();
            if (allowedFeedIds.length === 0) return [];
            // Use index instead of full scan filter
            const results = await db.articles.where('feedID').anyOf(allowedFeedIds as string[]).toArray();
            results.sort((a, b) => (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0));
            return results.slice(0, limit).map(a => ({ ...a, contentHTML: undefined, readerHTML: undefined }));
        } else if (view === 'all') {
            collection = db.articles.orderBy('publishedAt');
        } else {
            // Feed ID
            collection = db.articles.where('feedID').equals(view);
        }

        // 2. Apply Search Filter (if any)
        if (searchQuery && searchQuery.trim().length > 0) {
            const lowerQuery = searchQuery.toLowerCase();
            const originalCollection = collection;

            // Dexie collections are immutable-ish chains, so we filter
            // Note: This is an in-memory filter on the results of the index scan.
            // For massive datasets, we'd need a full-text index.
            collection = originalCollection.filter((a: Article) => {
                const titleMatch = a.title?.toLowerCase().includes(lowerQuery);
                const summaryMatch = a.summary?.toLowerCase().includes(lowerQuery);
                return !!(titleMatch || summaryMatch);
            });
        }

        // 3. Finalize Query & Optimization
        // We reduce the limit to avoid blocking the main thread.
        // We also manually map the results to exclude massive 'contentHTML' strings 
        // to save React memory diffing costs.
        const results = await collection.reverse().limit(limit).toArray();

        return results.map((a: Article) => ({
            ...a,
            contentHTML: undefined,
            readerHTML: undefined,
        })) as Article[];

    }, [view, limit, searchQuery]);

    // Debounce to prevent flickering during rapid sync updates
    // Use longer debounce (2s) during active sync, shorter (500ms) when idle
    const [debouncedArticles, setDebouncedArticles] = useState<Article[] | undefined>(undefined);
    const prevView = useRef(view);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const lastArticlesRef = useRef<Article[] | undefined>(undefined);

    // Reset state when view changes
    if (prevView.current !== view) {
        prevView.current = view;
        setDebouncedArticles(undefined);
        lastArticlesRef.current = undefined;
        // Cancel pending debounce on view change
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }

    useEffect(() => {
        // If we don't have debouncedArticles yet, set them immediately (first load)
        if (lastArticlesRef.current === undefined && liveArticles !== undefined && typeof liveArticles !== 'string') {
            lastArticlesRef.current = liveArticles;
            setDebouncedArticles(liveArticles);
            return;
        }

        // Skip if liveArticles hasn't changed (shallow reference check)
        // or if the liveArticles are undefined or we are pausing during sync
        if (liveArticles === undefined || typeof liveArticles === 'string') return;

        // Clear any pending timer
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        // Standard debounce for regular updates
        timerRef.current = setTimeout(() => {
            setDebouncedArticles(current => {
                if (!liveArticles || typeof liveArticles === 'string') return current;
                // Compare by article IDs and key properties to avoid unnecessary updates
                if (current && current.length === liveArticles.length) {
                    let isSame = true;
                    for (let i = 0; i < current.length; i++) {
                        if (current[i].id !== liveArticles[i].id ||
                            current[i].isRead !== liveArticles[i].isRead ||
                            current[i].isBookmarked !== liveArticles[i].isBookmarked) {
                            isSame = false;
                            break;
                        }
                    }
                    if (isSame) return current;
                }
                lastArticlesRef.current = liveArticles;
                return liveArticles;
            });
        }, 300);

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [liveArticles]); // Only depend on liveArticles, NOT isSyncing

    // Force update when sync finishes
    const isSyncing = useUIStore(s => s.isSyncing);
    useEffect(() => {
        if (!isSyncing && liveArticles && typeof liveArticles !== 'string') {
            setDebouncedArticles(liveArticles);
            lastArticlesRef.current = liveArticles;
        }
    }, [isSyncing, liveArticles]);

    return debouncedArticles;
}

