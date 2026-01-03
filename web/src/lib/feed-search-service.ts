
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
        // Trying a more stable instance or fallback
        const instances = [
            'https://pipedapi.kavin.rocks',
            'https://api.piped.io'
        ];

        for (const instance of instances) {
            try {
                // Ensure query params are correctly encoded and proxied
                const targetUrl = `${instance}/search?q=${encodeURIComponent(query)}&filter=channels`;
                const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;

                const res = await fetch(proxyUrl);
                if (!res.ok) continue;
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
                console.warn(`Piped instance ${instance} failed`, e);
            }
        }
        return [];
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
        const results: FeedSearchResult[] = [];

        // 1. Direct Web Discovery (if query looks like a domain)
        if (query.includes('.') && !query.includes(' ')) {
            try {
                let url = query.startsWith('http') ? query : `https://${query}`;
                const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
                const res = await fetch(proxyUrl);
                if (res.ok) {
                    const html = await res.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    const links = doc.querySelectorAll('link[type="application/rss+xml"], link[type="application/atom+xml"]');

                    links.forEach((link) => {
                        const href = link.getAttribute('href');
                        const title = link.getAttribute('title') || doc.title || query;
                        if (href) {
                            // Resolve relative URLs
                            const absoluteUrl = new URL(href, url).toString();
                            results.push({
                                title: title,
                                url: absoluteUrl,
                                description: `Detected feed from ${new URL(url).hostname}`,
                                type: 'rss',
                                source: 'rss'
                            });
                        }
                    });
                }
            } catch (e) {
                console.warn("Direct discovery failed", e);
            }
        }

        // 2. Google News RSS for topics (Fallback)
        try {
            results.push({
                title: `News: ${query}`,
                url: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`,
                description: `Google News feed for "${query}"`,
                type: 'rss',
                source: 'rss'
            });
        } catch (e) {
            // ignore
        }

        return results;
    }
}
