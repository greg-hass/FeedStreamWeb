import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseFeed } from '../lib/feed-parser';

// Mock crypto for stable ID generation in tests
if (typeof global.crypto === 'undefined') {
    (global as any).crypto = {
        subtle: {
            digest: async (algo: string, data: Uint8Array) => {
                // Return a dummy buffer for hash
                return new Uint8Array(32).buffer;
            }
        }
    };
}

const RSS_FIXTURE = `
<rss version="2.0">
    <channel>
        <title>Test Blog</title>
        <link>https://testblog.com</link>
        <item>
            <title>Hello World</title>
            <link>https://testblog.com/1</link>
            <guid>unique-1</guid>
            <pubDate>Mon, 05 Jan 2026 10:00:00 GMT</pubDate>
            <description>This is a description</description>
        </item>
    </channel>
</rss>
`;

const YOUTUBE_FIXTURE = `
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
    <title>Test Channel</title>
    <entry>
        <title>Great Video</title>
        <link rel="alternate" href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"/>
        <yt:videoId>dQw4w9WgXcQ</yt:videoId>
        <published>2026-01-05T12:00:00+00:00</published>
    </entry>
</feed>
`;

const JSON_FEED_FIXTURE = {
    title: "JSON Feed",
    home_page_url: "https://jsonfeed.org",
    items: [
        {
            id: "item-1",
            title: "JSON Item",
            url: "https://jsonfeed.org/item1",
            content_html: "<p>Hello</p>",
            date_published: "2026-01-05T15:00:00Z"
        }
    ]
};

describe('feed-parser', () => {
    it('should parse standard RSS feeds correctly', async () => {
        const result = await parseFeed(RSS_FIXTURE, 'https://testblog.com/rss');
        
        expect(result.title).toBe('Test Blog');
        expect(result.kind).toBe('rss');
        expect(result.articles).toHaveLength(1);
        
        const article = result.articles[0];
        expect(article.title).toBe('Hello World');
        expect(article.url).toBe('https://testblog.com/1');
        expect(article.summary).toBe('This is a description');
        expect(article.publishedAt).toBeInstanceOf(Date);
    });

    it('should detect and parse YouTube feeds with embeds', async () => {
        const result = await parseFeed(YOUTUBE_FIXTURE, 'https://www.youtube.com/feeds/videos.xml?channel_id=123');
        
        expect(result.kind).toBe('youtube');
        const article = result.articles[0];
        expect(article.mediaKind).toBe('youtube');
        expect(article.contentHTML).toContain('youtube.com/embed/dQw4w9WgXcQ');
        expect(article.thumbnailPath).toContain('dQw4w9WgXcQ');
    });

    it('should parse JSON feeds', async () => {
        const result = await parseFeed(JSON_FEED_FIXTURE, 'https://jsonfeed.org/feed.json');
        
        expect(result.title).toBe('JSON Feed');
        expect(result.kind).toBe('json');
        expect(result.articles[0].title).toBe('JSON Item');
    });

    it('should generate IDs consistently for deduplication', async () => {
        const res1 = await parseFeed(RSS_FIXTURE, 'https://testblog.com/rss');
        const res2 = await parseFeed(RSS_FIXTURE, 'https://testblog.com/rss');
        
        expect(res1.articles[0].id).toBe(res2.articles[0].id);
    });

    it('should handle malformed dates gracefully', async () => {
        const malformedRSS = RSS_FIXTURE.replace('Mon, 05 Jan 2026 10:00:00 GMT', 'Not a Date');
        const result = await parseFeed(malformedRSS, 'https://testblog.com/rss');
        
        expect(result.articles[0].publishedAt).toBeUndefined();
    });
});
