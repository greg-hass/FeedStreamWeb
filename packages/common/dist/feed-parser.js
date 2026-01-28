"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFeed = parseFeed;
const fast_xml_parser_1 = require("fast-xml-parser");
const utils_1 = require("./utils");
const xmlParser = new fast_xml_parser_1.XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    removeNSPrefix: false,
    processEntities: false,
    ignoreDeclaration: true
});
// Date helpers
function parseDate(dateStr) {
    if (!dateStr)
        return undefined;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime()))
        return d;
    return undefined;
}
// Stable ID generation
async function makeStableId(feedUrl, entryId) {
    const input = `${feedUrl}|${entryId}`;
    return (0, utils_1.sha256)(input);
}
// Extraction helpers
function extractYouTubeVideoID(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace('www.', '');
        if (hostname === 'youtu.be') {
            return urlObj.pathname.slice(1);
        }
        if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
            const v = urlObj.searchParams.get('v');
            if (v)
                return v;
            if (urlObj.pathname.startsWith('/embed/')) {
                return urlObj.pathname.split('/')[2];
            }
            if (urlObj.pathname.startsWith('/v/')) {
                return urlObj.pathname.split('/')[2];
            }
        }
    }
    catch (e) {
        // Ignore
    }
    return null;
}
function youTubeEmbedHTML(videoID) {
    return `<iframe width="100%" height="auto" style="aspect-ratio: 16/9" src="https://www.youtube.com/embed/${videoID}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
}
async function parseFeed(data, sourceUrl) {
    // Check if JSON Feed
    if (typeof data === 'object' || (typeof data === 'string' && data.trim().startsWith('{'))) {
        try {
            const json = typeof data === 'string' ? JSON.parse(data) : data;
            return parseJSONFeed(json, sourceUrl);
        }
        catch {
            // Fallback to XML
        }
    }
    // XML Feed
    return parseXMLFeed(typeof data === 'string' ? data : JSON.stringify(data), sourceUrl);
}
async function parseJSONFeed(json, sourceUrl) {
    const articles = [];
    const isYouTube = sourceUrl.includes('youtube.com');
    const type = isYouTube ? 'youtube' : 'json';
    for (const item of (json.items || [])) {
        const uidSource = item.id || item.url || item.title || (0, utils_1.uuidv4)();
        const articleID = await makeStableId(sourceUrl, uidSource);
        let content = item.content_html || item.summary || '';
        let mediaKind = 'none';
        if (item.url) {
            const vid = extractYouTubeVideoID(item.url);
            if (vid) {
                content = youTubeEmbedHTML(vid);
                mediaKind = 'youtube';
            }
        }
        const title = (0, utils_1.decodeHTMLEntities)(item.title || item.url || 'Untitled');
        const summary = item.summary ? (0, utils_1.decodeHTMLEntities)(item.summary) : undefined;
        articles.push({
            id: articleID,
            title,
            url: item.url,
            summary,
            content,
            publishedAt: parseDate(item.date_published),
            mediaKind,
            thumbnailUrl: item.image || item.banner_image,
            author: item.author?.name
        });
    }
    return {
        title: json.title || 'Untitled Feed',
        siteUrl: json.home_page_url,
        type,
        articles,
        iconUrl: json.icon || json.favicon,
        rawData: json
    };
}
async function parseXMLFeed(xmlData, sourceUrl) {
    const parsed = xmlParser.parse(xmlData);
    let channel = parsed.rss?.channel || parsed.feed;
    if (!channel && parsed['rdf:RDF']) {
        channel = parsed['rdf:RDF'];
    }
    let feedTitle = channel?.title || channel?.['dc:title'];
    if (typeof feedTitle === 'object' && feedTitle !== null) {
        feedTitle = feedTitle['#text'] || feedTitle['#cdata'] || '';
    }
    const feedLink = channel?.link || sourceUrl;
    const isYouTube = sourceUrl.includes('youtube.com') || (xmlData.includes('yt:videoId'));
    const isReddit = sourceUrl.includes('reddit.com');
    const type = isYouTube ? 'youtube' : (isReddit ? 'reddit' : 'rss');
    let items = channel?.item || channel?.entry || [];
    if (!Array.isArray(items))
        items = [items];
    const articles = [];
    for (const item of items) {
        let titleRaw = item.title || item['dc:title'] || item.link || 'Untitled';
        if (typeof titleRaw === 'object' && titleRaw !== null) {
            titleRaw = titleRaw['#text'] || titleRaw['#cdata'] || JSON.stringify(titleRaw);
        }
        const title = (0, utils_1.decodeHTMLEntities)(String(titleRaw));
        const link = item.link && typeof item.link === 'string' ? item.link : (item.link?.['@_href'] || '');
        const guid = (item.guid && typeof item.guid === 'object' ? item.guid['#text'] : item.guid) || item.id || link;
        const articleID = await makeStableId(sourceUrl, String(guid || title));
        let contentRaw = item['content:encoded'] || item.content || item.description || item.summary || '';
        if (typeof contentRaw === 'object' && contentRaw !== null) {
            contentRaw = contentRaw['#text'] || contentRaw['#cdata'] || JSON.stringify(contentRaw);
        }
        let contentHTML = (0, utils_1.decodeHTMLEntities)(String(contentRaw));
        let mediaKind = 'none';
        let thumbnailUrl = undefined;
        let enclosureUrl = undefined;
        let enclosureType = undefined;
        const enclosure = item.enclosure;
        if (enclosure) {
            enclosureUrl = enclosure['@_url'];
            enclosureType = enclosure['@_type'];
            if (enclosureType?.startsWith('audio/'))
                mediaKind = 'podcast';
            else if (enclosureType?.startsWith('video/'))
                mediaKind = 'video';
        }
        const ytId = item['yt:videoId'];
        if (ytId) {
            contentHTML = youTubeEmbedHTML(ytId);
            mediaKind = 'youtube';
            thumbnailUrl = `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`;
        }
        const dateStr = item.pubDate || item.published || item['dc:date'] || item.updated;
        const publishedAt = parseDate(dateStr);
        if (!thumbnailUrl) {
            const mediaThumb = item['media:thumbnail'];
            if (mediaThumb && mediaThumb['@_url'])
                thumbnailUrl = mediaThumb['@_url'];
            else if (item['itunes:image'])
                thumbnailUrl = item['itunes:image']['@_href'];
        }
        if (isReddit && !thumbnailUrl) {
            const patterns = [
                /href="(https:\/\/i\.redd\.it\/[a-zA-Z0-9]+\.(?:jpg|png|gif))"/,
                /src="(https:\/\/i\.redd\.it\/[a-zA-Z0-9]+\.(?:jpg|png|gif))"/,
                /src="(https:\/\/preview\.redd\.it\/[^"]+)"/,
                /src="(https:\/\/external-preview\.redd\.it\/[^"]+)"/
            ];
            for (const pattern of patterns) {
                const match = contentHTML.match(pattern);
                if (match && match[1]) {
                    thumbnailUrl = match[1].replace(/&amp;/g, '&');
                    break;
                }
            }
        }
        articles.push({
            id: articleID,
            title,
            url: link,
            summary: item.description ? (0, utils_1.decodeHTMLEntities)(String(item.description)) : undefined,
            content: contentHTML,
            publishedAt,
            mediaKind,
            thumbnailUrl,
            enclosureUrl,
            enclosureType,
            author: item['dc:creator'] || item.author?.name
        });
    }
    return {
        title: String(feedTitle || ''),
        siteUrl: String(feedLink),
        type,
        articles,
        rawData: parsed
    };
}
