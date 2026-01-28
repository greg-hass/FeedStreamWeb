import { XMLParser } from 'fast-xml-parser';
import { decodeHTMLEntities, sha256, uuidv4 } from './utils';

export interface ParsedArticle {
  id: string;
  title: string;
  author?: string;
  summary?: string;
  content: string;
  url?: string;
  publishedAt?: Date;
  mediaKind: string;
  thumbnailUrl?: string;
  enclosureUrl?: string;
  enclosureType?: string;
}

export interface ParsedFeed {
  title: string;
  siteUrl?: string;
  type: string;
  articles: ParsedArticle[];
  iconUrl?: string;
  rawData?: any; // Raw parsed data for specific extraction (e.g. detailed icons)
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  removeNSPrefix: false,
  processEntities: false,
  ignoreDeclaration: true
});

// Date helpers
function parseDate(dateStr: string | undefined): Date | undefined {
  if (!dateStr) return undefined;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  return undefined;
}

// Stable ID generation
async function makeStableId(feedUrl: string, entryId: string): Promise<string> {
  const input = `${feedUrl}|${entryId}`;
  return sha256(input);
}

// Extraction helpers
function extractYouTubeVideoID(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');

    if (hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    }

    if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      const v = urlObj.searchParams.get('v');
      if (v) return v;

      if (urlObj.pathname.startsWith('/embed/')) {
        return urlObj.pathname.split('/')[2];
      }

      if (urlObj.pathname.startsWith('/v/')) {
        return urlObj.pathname.split('/')[2];
      }
    }
  } catch (e) {
    // Ignore
  }
  return null;
}

function youTubeEmbedHTML(videoID: string): string {
  return `<iframe width="100%" height="auto" style="aspect-ratio: 16/9" src="https://www.youtube.com/embed/${videoID}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
}

export async function parseFeed(data: string | object, sourceUrl: string): Promise<ParsedFeed> {
  // Check if JSON Feed
  if (typeof data === 'object' || (typeof data === 'string' && data.trim().startsWith('{'))) {
    try {
      const json = typeof data === 'string' ? JSON.parse(data) : data;
      return parseJSONFeed(json, sourceUrl);
    } catch {
      // Fallback to XML
    }
  }

  // XML Feed
  return parseXMLFeed(typeof data === 'string' ? data : JSON.stringify(data), sourceUrl);
}

async function parseJSONFeed(json: any, sourceUrl: string): Promise<ParsedFeed> {
  const articles: ParsedArticle[] = [];

  const isYouTube = sourceUrl.includes('youtube.com');
  const type = isYouTube ? 'youtube' : 'json';

  for (const item of (json.items || [])) {
    const uidSource = item.id || item.url || item.title || uuidv4();
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

    const title = decodeHTMLEntities(item.title || item.url || 'Untitled');
    const summary = item.summary ? decodeHTMLEntities(item.summary) : undefined;

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

async function parseXMLFeed(xmlData: string, sourceUrl: string): Promise<ParsedFeed> {
  const parsed = xmlParser.parse(xmlData);
  let channel = parsed.rss?.channel || parsed.feed;
  if (!channel && parsed['rdf:RDF']) {
    channel = parsed['rdf:RDF'];
  }

  let feedTitle: any = channel?.title || channel?.['dc:title'];
  if (typeof feedTitle === 'object' && feedTitle !== null) {
    feedTitle = feedTitle['#text'] || feedTitle['#cdata'] || '';
  }
  const feedLink = channel?.link || sourceUrl;

  const isYouTube = sourceUrl.includes('youtube.com') || (xmlData.includes('yt:videoId'));
  const isReddit = sourceUrl.includes('reddit.com');
  const type = isYouTube ? 'youtube' : (isReddit ? 'reddit' : 'rss');

  let items = channel?.item || channel?.entry || [];
  if (!Array.isArray(items)) items = [items];

  const articles: ParsedArticle[] = [];

  for (const item of items) {
    let titleRaw = item.title || item['dc:title'] || item.link || 'Untitled';
    if (typeof titleRaw === 'object' && titleRaw !== null) {
      titleRaw = titleRaw['#text'] || titleRaw['#cdata'] || JSON.stringify(titleRaw);
    }
    const title = decodeHTMLEntities(String(titleRaw));

    const link = item.link && typeof item.link === 'string' ? item.link : (item.link?.['@_href'] || '');
    const guid = (item.guid && typeof item.guid === 'object' ? item.guid['#text'] : item.guid) || item.id || link;

    const articleID = await makeStableId(sourceUrl, String(guid || title));

    let contentRaw = item['content:encoded'] || item.content || item.description || item.summary || '';
    if (typeof contentRaw === 'object' && contentRaw !== null) {
      contentRaw = contentRaw['#text'] || contentRaw['#cdata'] || JSON.stringify(contentRaw);
    }

    let contentHTML = decodeHTMLEntities(String(contentRaw));

    let mediaKind = 'none';
    let thumbnailUrl: string | undefined = undefined;
    let enclosureUrl: string | undefined = undefined;
    let enclosureType: string | undefined = undefined;

    const enclosure = item.enclosure;
    if (enclosure) {
      enclosureUrl = enclosure['@_url'];
      enclosureType = enclosure['@_type'];
      if (enclosureType?.startsWith('audio/')) mediaKind = 'podcast';
      else if (enclosureType?.startsWith('video/')) mediaKind = 'video';
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
      if (mediaThumb && mediaThumb['@_url']) thumbnailUrl = mediaThumb['@_url'];
      else if (item['itunes:image']) thumbnailUrl = item['itunes:image']['@_href'];
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
      summary: item.description ? decodeHTMLEntities(String(item.description)) : undefined,
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
