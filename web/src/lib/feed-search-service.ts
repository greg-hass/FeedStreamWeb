
import { FeedType } from './db';

export interface FeedSearchResult {
    title: string;
    url: string;
    description?: string;
    thumbnail?: string;
    type: FeedType;
    source: 'youtube' | 'podcast' | 'reddit' | 'rss';
}

export class FeedSearchService {

    static async search(query: string, type: 'all' | FeedType = 'all'): Promise<FeedSearchResult[]> {
        const results: FeedSearchResult[] = [];
        const promises: Promise<FeedSearchResult[]>[] = [];

        // Determine what to search based on type filter
        const searchYoutube = type === 'all' || type === 'youtube';
        const searchPodcasts = type === 'all' || type === 'podcast';
        const searchReddit = type === 'all' || type === 'reddit';
        const searchRss = type === 'all' || type === 'rss';

        if (searchYoutube) promises.push(this.searchYouTube(query));
        if (searchPodcasts) promises.push(this.searchPodcasts(query));
        if (searchReddit) promises.push(this.searchReddit(query));
        if (searchRss) promises.push(this.searchRSS(query));

        const outcomes = await Promise.allSettled(promises);

        for (const outcome of outcomes) {
            if (outcome.status === 'fulfilled') {
                results.push(...outcome.value);
            } else {
                console.warn('Search provider failed:', outcome.reason);
            }
        }

        return results;
    }

    private static async searchYouTube(query: string): Promise<FeedSearchResult[]> {
        // Use Piped API (public instance)
        // https://pipedapi.kavin.rocks/search?q=...&filter=channels
        try {
            const res = await fetch(`https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=channels`);
            if (!res.ok) return [];
            const data = await res.json();

            return (data.items || []).map((item: any) => ({
                title: item.name,
                url: `https://www.youtube.com/feeds/videos.xml?channel_id=${item.url.split('/').pop()}`,
                description: item.description,
                thumbnail: item.avatarUrl,
                type: 'youtube',
                source: 'youtube'
            }));
        } catch (e) {
            console.error('YouTube search failed', e);
            return [];
        }
    }

    private static async searchPodcasts(query: string): Promise<FeedSearchResult[]> {
        // iTunes Search API
        try {
            const res = await fetch(`https://itunes.apple.com/search?media=podcast&term=${encodeURIComponent(query)}&limit=5`);
            if (!res.ok) return [];
            const data = await res.json();

            return (data.results || []).map((item: any) => ({
                title: item.collectionName,
                url: item.feedUrl,
                description: item.artistName,
                thumbnail: item.artworkUrl600 || item.artworkUrl100,
                type: 'podcast',
                source: 'podcast'
            }));
        } catch (e) {
            console.error('Podcast search failed', e);
            return [];
        }
    }

    private static async searchReddit(query: string): Promise<FeedSearchResult[]> {
        // Simple heuristic: check if query looks like a subreddit or strict search
        // We can search subreddits via reddit.com/subreddits/search.json?q=...
        try {
            // 1. Exact match attempt if it looks like r/something
            const candidates: FeedSearchResult[] = [];
            const clean = query.replace(/^r\//, '');

            // 2. Subreddit search
            const res = await fetch(`https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(clean)}&limit=5`);
            if (res.ok) {
                const data = await res.json();
                const items = data.data?.children || [];
                candidates.push(...items.map((item: any) => {
                    const d = item.data;
                    return {
                        title: `r/${d.display_name}`,
                        url: `https://www.reddit.com/r/${d.display_name}/.rss`,
                        description: d.public_description,
                        thumbnail: d.icon_img || d.community_icon?.split('?')[0],
                        type: 'reddit',
                        source: 'reddit'
                    };
                }));
            }
            return candidates;
        } catch (e) {
            console.error('Reddit search failed', e);
            return [];
        }
    }

    private static async searchRSS(query: string): Promise<FeedSearchResult[]> {
        // 1. Google News RSS for topics
        try {
            return [{
                title: `News: ${query}`,
                url: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`,
                description: `Google News feed for "${query}"`,
                type: 'rss',
                source: 'rss'
            }];
        } catch (e) {
            return [];
        }
    }
}
