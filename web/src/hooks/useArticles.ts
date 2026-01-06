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
            collection = db.articles
                .where('[isBookmarked+publishedAt]')
                .between([1, Dexie.minKey], [1, Dexie.maxKey]);
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
            const redditSet = new Set(redditFeedIds);
            collection = db.articles.orderBy('publishedAt').filter(a => redditSet.has(a.feedID));
        } else if (view === 'rss') {
            const allowedFeedIds = await db.feeds.where('type').noneOf(['reddit', 'youtube', 'podcast']).primaryKeys();
            if (allowedFeedIds.length === 0) return [];
            const allowedSet = new Set(allowedFeedIds);
            collection = db.articles.orderBy('publishedAt').filter(a => allowedSet.has(a.feedID));
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
            id: a.id,
            feedID: a.feedID,
            title: a.title,
            summary: a.summary,
            // Exclude contentHTML and readerHTML
            publishedAt: a.publishedAt,
            isRead: a.isRead,
            isBookmarked: a.isBookmarked,
            mediaKind: a.mediaKind,
            thumbnailPath: a.thumbnailPath,
            author: a.author,
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
        if (lastArticlesRef.current === undefined && liveArticles !== undefined) {
            lastArticlesRef.current = liveArticles;
            setDebouncedArticles(liveArticles);
            return;
        }

        // Skip if liveArticles hasn't changed (shallow reference check)
        // or if the liveArticles are undefined
        if (liveArticles === undefined) return;

        // Clear any pending timer
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        // Read isSyncing from the store synchronously when timer fires
        // This prevents the effect dependency on isSyncing which resets the timer
        timerRef.current = setTimeout(() => {
            const currentSyncing = useUIStore.getState().isSyncing;
            // If still syncing, re-schedule with longer delay instead of updating
            if (currentSyncing) {
                timerRef.current = setTimeout(() => {
                    setDebouncedArticles(current => {
                        if (!liveArticles) return current;
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
                }, 1500); // Additional delay while syncing
                return;
            }

            setDebouncedArticles(current => {
                if (!liveArticles) return current;
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
        }, 300); // Short initial debounce, sync-aware logic inside

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [liveArticles]); // Only depend on liveArticles, NOT isSyncing

    return debouncedArticles;
}

