
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
        // Use Invidious API - more reliable than Piped
        const instances = [
            'https://vid.puffyan.us',
            'https://invidious.fdn.fr',
            'https://y.com.sb'
        ];

        for (const instance of instances) {
            try {
                const targetUrl = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=channel`;
                const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;

                const res = await fetch(proxyUrl);
                if (!res.ok) continue;
                const data = await res.json();

                if (Array.isArray(data) && data.length > 0) {
                    return data.slice(0, 5).map((item: any) => ({
                        title: item.author || item.name,
                        url: `https://www.youtube.com/feeds/videos.xml?channel_id=${item.authorId}`,
                        description: `${item.subCount || 0} subscribers`,
                        thumbnail: item.authorThumbnails?.[0]?.url,
                        type: 'youtube',
                        source: 'youtube'
                    }));
                }
            } catch (e) {
                console.warn(`Invidious instance ${instance} failed`, e);
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

        // Helper to scrape a URL for RSS feeds
        const scrapeForFeeds = async (url: string): Promise<FeedSearchResult[]> => {
            const found: FeedSearchResult[] = [];
            try {
                if (!url.startsWith('http')) url = `https://${url}`;
                const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
                const res = await fetch(proxyUrl);
                if (!res.ok) return found;

                const html = await res.text();

                // Check if URL itself is a feed
                if (html.trim().startsWith('<?xml') || html.includes('<rss') || html.includes('<feed')) {
                    found.push({
                        title: query,
                        url: url,
                        description: 'Direct feed URL',
                        type: 'rss',
                        source: 'rss'
                    });
                    return found;
                }

                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const links = doc.querySelectorAll('link[type="application/rss+xml"], link[type="application/atom+xml"]');

                links.forEach((link) => {
                    const href = link.getAttribute('href');
                    const title = link.getAttribute('title') || doc.title || query;
                    if (href) {
                        const absoluteUrl = new URL(href, url).toString();
                        found.push({
                            title: title,
                            url: absoluteUrl,
                            description: `Feed from ${new URL(url).hostname}`,
                            type: 'rss',
                            source: 'rss'
                        });
                    }
                });
            } catch (e) {
                console.warn(`Failed to scrape ${url}`, e);
            }
            return found;
        };

        // Strategy 1: If query looks like a URL/domain, scrape it directly
        if (query.includes('.') && !query.includes(' ')) {
            const directResults = await scrapeForFeeds(query);
            results.push(...directResults);
        }

        // Strategy 2: SMART SEARCH - Use DuckDuckGo to find the website, then scrape it
        // This enables typing "omg ubuntu" and finding omgubuntu.co.uk
        if (results.length === 0) {
            try {
                const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + ' site')}`;
                const proxyUrl = `/api/proxy?url=${encodeURIComponent(ddgUrl)}`;
                const res = await fetch(proxyUrl);

                if (res.ok) {
                    const html = await res.text();
                    // Extract first result URL from DDG HTML
                    const urlMatch = html.match(/uddg=([^&"]+)/);
                    if (urlMatch && urlMatch[1]) {
                        const foundUrl = decodeURIComponent(urlMatch[1]);
                        console.log(`Smart search found: ${foundUrl} for "${query}"`);
                        const smartResults = await scrapeForFeeds(foundUrl);
                        results.push(...smartResults);
                    }
                }
            } catch (e) {
                console.warn('Smart search failed', e);
            }
        }

        // Strategy 3: Google News RSS as fallback
        results.push({
            title: `Google News: ${query}`,
            url: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`,
            description: `News feed for "${query}"`,
            type: 'rss',
            source: 'rss'
        });

        return results;
    }
}
