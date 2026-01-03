
import { XMLParser } from 'fast-xml-parser';
import { Feed, Article, FeedType } from './db';
import { decodeHTMLEntities, sha256, uuidv4 } from './utils';

export interface NormalizedFeed {
    title?: string;
    site?: string;
    kind: FeedType;
    articles: Article[];
    avatarURL?: string;
}

const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    removeNSPrefix: false // Keep namespaces to distinguish content vs media
});

// Date helpers
function parseDate(dateStr: string | undefined): Date | undefined {
    if (!dateStr) return undefined;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    return undefined;
}

// Stable ID generation (simplified version of iOS logic)
async function makeStableId(feedURL: string, entryId: string): Promise<string> {
    const input = `${feedURL}|${entryId}`;
    return sha256(input);
}

// Extraction helpers
function extractYouTubeVideoID(url: string): string | null {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length == 11) ? match[7] : null;
}

function youTubeEmbedHTML(videoID: string): string {
    return `<iframe width="100%" height="auto" style="aspect-ratio: 16/9" src="https://www.youtube.com/embed/${videoID}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
}

export async function parseFeed(data: string | object, sourceURL: string): Promise<NormalizedFeed> {
    // Check if JSON Feed
    if (typeof data === 'object' || (typeof data === 'string' && data.trim().startsWith('{'))) {
        try {
            const json = typeof data === 'string' ? JSON.parse(data) : data;
            return parseJSONFeed(json, sourceURL);
        } catch {
            // Fallback to XML
        }
    }

    // XML Feed
    return parseXMLFeed(typeof data === 'string' ? data : JSON.stringify(data), sourceURL);
}

async function parseJSONFeed(json: any, sourceURL: string): Promise<NormalizedFeed> {
    const articles: Article[] = [];

    const isYouTube = sourceURL.includes('youtube.com');
    const kind: FeedType = isYouTube ? 'youtube' : 'json';

    for (const item of (json.items || [])) {
        const uidSource = item.id || item.url || item.title || uuidv4();
        const articleID = await makeStableId(sourceURL, uidSource);

        let contentHTML = item.content_html || item.summary || '';
        let mediaKind: string = 'none';

        // YouTube detection
        if (item.url) {
            const vid = extractYouTubeVideoID(item.url);
            if (vid) {
                contentHTML = youTubeEmbedHTML(vid);
                mediaKind = 'youtube';
            }
        }

        const title = decodeHTMLEntities(item.title || item.url || 'Untitled');
        const summary = item.summary ? decodeHTMLEntities(item.summary) : undefined;

        articles.push({
            id: articleID,
            feedID: '', // Set by caller
            title: title,
            url: item.url,
            summary,
            contentHTML,
            publishedAt: parseDate(item.date_published),
            isRead: false,
            isBookmarked: false,
            mediaKind,
            playbackPosition: 0,
            downloadStatus: 0,
            imageCacheStatus: 0
        });
    }

    return {
        title: json.title,
        site: json.home_page_url,
        kind,
        articles
    };
}

async function parseXMLFeed(xmlData: string, sourceURL: string): Promise<NormalizedFeed> {
    const parsed = xmlParser.parse(xmlData);
    let channel = parsed.rss?.channel || parsed.feed;
    if (!channel && parsed['rdf:RDF']) {
        channel = parsed['rdf:RDF']; // RDF support
    }

    const feedTitle = channel?.title || channel?.['dc:title'];
    const feedLink = channel?.link || sourceURL;

    const isYouTube = sourceURL.includes('youtube.com') || (xmlData.includes('yt:videoId'));
    const isReddit = sourceURL.includes('reddit.com');
    const kind: FeedType = isYouTube ? 'youtube' : (isReddit ? 'reddit' : 'rss');

    let items = channel?.item || channel?.entry || [];
    if (!Array.isArray(items)) items = [items];

    const articles: Article[] = [];

    for (const item of items) {
        const titleRaw = item.title || item['dc:title'] || item.link || 'Untitled';
        const title = decodeHTMLEntities(String(titleRaw));

        const link = item.link && typeof item.link === 'string' ? item.link : (item.link?.['@_href'] || '');
        const guid = (item.guid && typeof item.guid === 'object' ? item.guid['#text'] : item.guid) || item.id || link;

        const articleID = await makeStableId(sourceURL, String(guid || title));

        let contentRaw = item['content:encoded'] || item.content || item.description || item.summary || '';
        if (typeof contentRaw === 'object' && contentRaw['#text']) contentRaw = contentRaw['#text'];

        let contentHTML = String(contentRaw);

        let mediaKind = 'none';
        let thumbnailPath: string | undefined = undefined;
        let enclosureURL: string | undefined = undefined;
        let enclosureType: string | undefined = undefined;

        // Enclosures / Media
        const enclosure = item.enclosure;
        if (enclosure) {
            enclosureURL = enclosure['@_url'];
            enclosureType = enclosure['@_type'];
            if (enclosureType?.startsWith('audio/')) mediaKind = 'podcast';
            else if (enclosureType?.startsWith('video/')) mediaKind = 'video';
        }

        // YouTube
        const ytId = item['yt:videoId'];
        if (ytId) {
            contentHTML = youTubeEmbedHTML(ytId);
            mediaKind = 'youtube';
            thumbnailPath = `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`;
        }

        // Pub Date
        const dateStr = item.pubDate || item.published || item['dc:date'] || item.updated;
        const publishedAt = parseDate(dateStr);

        // Thumbnails (media:thumbnail or itunes:image)
        if (!thumbnailPath) {
            const mediaThumb = item['media:thumbnail'];
            if (mediaThumb && mediaThumb['@_url']) thumbnailPath = mediaThumb['@_url'];
            else if (item['itunes:image']) thumbnailPath = item['itunes:image']['@_href'];
        }

        // Reddit Logic (Simplified for brevity but effective)
        if (isReddit && mediaKind === 'none') {
            const previewImage = contentHTML.match(/https:\/\/preview\.redd\.it\/[a-zA-Z0-9]+\.(jpg|png)/);
            if (previewImage) thumbnailPath = previewImage[0];
        }

        articles.push({
            id: articleID,
            feedID: '',
            title,
            url: link,
            summary: item.description ? decodeHTMLEntities(String(item.description)) : undefined,
            contentHTML,
            publishedAt,
            isRead: false,
            isBookmarked: false,
            mediaKind,
            thumbnailPath,
            enclosureURL,
            enclosureType,
            imageWidth: 0,
            imageHeight: 0,
            playbackPosition: 0,
            downloadStatus: 0,
            imageCacheStatus: 0
        });
    }

    return {
        title: String(feedTitle || ''),
        site: String(feedLink),
        kind,
        articles
    };
}
