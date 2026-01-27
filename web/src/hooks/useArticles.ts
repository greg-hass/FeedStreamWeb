import { useState, useEffect, useCallback } from "react";
import { Article } from "@/lib/db";
import { useUIStore } from "@/store/uiStore";
import { getArticles, searchArticles } from "@/lib/api-client";

/**
 * useArticles Hook - Backend Version
 * 
 * Fetches articles from the backend API instead of IndexedDB
 * Provides better performance for 230+ feeds
 * Supports server-side search
 */

interface ArticleWithState extends Article {
    isRead: boolean;
    isBookmarked: boolean;
    playbackPosition: number;
}

export function useArticles(
    view: 'today' | 'last24h' | 'week' | 'all' | 'saved' | 'history' | 'youtube' | 'podcasts' | 'reddit' | string = 'all',
    limit = 100,
    searchQuery: string = ''
) {
    const [articles, setArticles] = useState<ArticleWithState[] | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Subscribe to syncVersion to force re-query when sync completes
    const syncVersion = useUIStore(s => s.syncVersion);

    const fetchArticles = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            let data: any[] = [];

            if (searchQuery && searchQuery.trim().length > 0) {
                // Use backend search API
                data = await searchArticles(searchQuery, limit);
            } else {
                // Map view to API parameters
                const options: any = { limit };
                
                if (view === 'saved') {
                    options.bookmarked = true;
                } else if (view === 'history') {
                    // Fetch all and filter client-side for now
                    // In production, add a 'read' filter to backend
                } else if (view !== 'all' && view !== 'today' && view !== 'last24h' && view !== 'week') {
                    // Specific feed ID
                    if (!['youtube', 'podcasts', 'reddit', 'history'].includes(view)) {
                        options.feedId = view;
                    }
                }

                data = await getArticles(options);

                // Client-side filtering for views not yet supported by backend
                if (view === 'today') {
                    const startOfDay = new Date();
                    startOfDay.setHours(0, 0, 0, 0);
                    data = data.filter((a: any) => new Date(a.publishedAt) >= startOfDay);
                } else if (view === 'last24h') {
                    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
                    data = data.filter((a: any) => new Date(a.publishedAt) >= yesterday);
                } else if (view === 'week') {
                    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                    data = data.filter((a: any) => new Date(a.publishedAt) >= lastWeek);
                } else if (view === 'history') {
                    data = data.filter((a: any) => a.isRead);
                } else if (view === 'youtube' || view === 'podcasts' || view === 'reddit') {
                    // These would need backend support for mediaKind filtering
                    // For now, fetch all and filter
                    const mediaKind = view === 'youtube' ? 'youtube' : view === 'podcasts' ? 'podcast' : 'reddit';
                    data = data.filter((a: any) => a.mediaKind === mediaKind);
                }
            }

            // Map backend format to frontend format
            const mappedArticles: ArticleWithState[] = data.map((a: any) => ({
                id: a.id,
                feedID: a.feedId,
                title: a.title,
                author: a.author,
                summary: a.summary,
                contentHTML: a.content,
                url: a.url,
                publishedAt: a.publishedAt ? new Date(a.publishedAt) : undefined,
                updatedAt: undefined,
                isRead: a.isRead ? 1 : 0,
                isBookmarked: a.isBookmarked ? 1 : 0,
                mediaKind: a.mediaKind || 'none',
                thumbnailPath: a.thumbnailUrl,
                enclosureURL: a.enclosureUrl,
                enclosureType: a.enclosureType,
                playbackPosition: a.playbackPosition || 0,
                downloadStatus: 0,
                imageCacheStatus: 0,
            }));

            setArticles(mappedArticles);
        } catch (e: any) {
            console.error('[useArticles] Failed to fetch:', e);
            setError(e.message);
            setArticles([]);
        } finally {
            setIsLoading(false);
        }
    }, [view, limit, searchQuery]);

    useEffect(() => {
        fetchArticles();
    }, [fetchArticles, syncVersion]);

    return { articles, isLoading, error, refetch: fetchArticles };
}
