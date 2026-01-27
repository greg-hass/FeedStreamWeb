import { XMLParser } from 'fast-xml-parser';
import { createHash } from 'crypto';

export interface ParsedArticle {
  id: string;
  title: string;
  author?: string;
  summary?: string;
  content?: string;
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
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  removeNSPrefix: false,
  processEntities: false,
  ignoreDeclaration: true,
});

function parseDate(dateStr: string | undefined): Date | undefined {
  if (!dateStr) return undefined;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? undefined : d;
}

function generateArticleId(feedUrl: string, entryId: string): string {
  return createHash('sha256').update(`${feedUrl}|${entryId}`).digest('hex');
}

function extractYouTubeVideoId(url: string): string | null {
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
    }
  } catch {
    // Ignore
  }
  return null;
}

export async function parseFeed(data: string | object, sourceUrl: string): Promise<ParsedFeed> {
  if (typeof data === 'object' || (typeof data === 'string' && data.trim().startsWith('{'))) {
    try {
      const json = typeof data === 'string' ? JSON.parse(data) : data;
      return parseJSONFeed(json, sourceUrl);
    } catch {
      // Fallback to XML
    }
  }

  return parseXMLFeed(typeof data === 'string' ? data : JSON.stringify(data), sourceUrl);
}

async function parseJSONFeed(json: any, sourceUrl: string): Promise<ParsedFeed> {
  const articles: ParsedArticle[] = [];
  const isYouTube = sourceUrl.includes('youtube.com');

  for (const item of json.items || []) {
    const uidSource = item.id || item.url || item.title || crypto.randomUUID();
    const articleId = generateArticleId(sourceUrl, uidSource);

    let content = item.content_html || item.summary || '';
    let mediaKind = 'none';

    if (item.url) {
      const vid = extractYouTubeVideoId(item.url);
      if (vid) {
        content = `https://www.youtube.com/embed/${vid}`;
        mediaKind = 'youtube';
      }
    }

    articles.push({
      id: articleId,
      title: item.title || item.url || 'Untitled',
      url: item.url,
      summary: item.summary,
      content,
      publishedAt: parseDate(item.date_published),
      mediaKind,
    });
  }

  return {
    title: json.title || 'Untitled Feed',
    siteUrl: json.home_page_url,
    type: isYouTube ? 'youtube' : 'json',
    articles,
  };
}

async function parseXMLFeed(xmlData: string, sourceUrl: string): Promise<ParsedFeed> {
  const parsed = xmlParser.parse(xmlData);
  let channel = parsed.rss?.channel || parsed.feed;
  if (!channel && parsed['rdf:RDF']) {
    channel = parsed['rdf:RDF'];
  }

  let feedTitle = channel?.title || channel?.['dc:title'] || 'Untitled Feed';
  if (typeof feedTitle === 'object' && feedTitle !== null) {
    feedTitle = feedTitle['#text'] || feedTitle['#cdata'] || 'Untitled Feed';
  }

  const feedLink = channel?.link || sourceUrl;
  const isYouTube = sourceUrl.includes('youtube.com') || xmlData.includes('yt:videoId');
  const isReddit = sourceUrl.includes('reddit.com');

  let items = channel?.item || channel?.entry || [];
  if (!Array.isArray(items)) items = [items];

  const articles: ParsedArticle[] = [];

  for (const item of items) {
    let titleRaw = item.title || item['dc:title'] || item.link || 'Untitled';
    if (typeof titleRaw === 'object' && titleRaw !== null) {
      titleRaw = titleRaw['#text'] || titleRaw['#cdata'] || JSON.stringify(titleRaw);
    }
    const title = String(titleRaw);

    const link = item.link && typeof item.link === 'string' 
      ? item.link 
      : (item.link?.['@_href'] || '');
    const guid = (item.guid && typeof item.guid === 'object' ? item.guid['#text'] : item.guid) || item.id || link;
    const articleId = generateArticleId(sourceUrl, String(guid || title));

    let contentRaw = item['content:encoded'] || item.content || item.description || item.summary || '';
    if (typeof contentRaw === 'object' && contentRaw !== null) {
      contentRaw = contentRaw['#text'] || contentRaw['#cdata'] || JSON.stringify(contentRaw);
    }
    const content = String(contentRaw);

    let mediaKind = 'none';
    let thumbnailUrl: string | undefined;
    let enclosureUrl: string | undefined;
    let enclosureType: string | undefined;

    const enclosure = item.enclosure;
    if (enclosure) {
      enclosureUrl = enclosure['@_url'];
      enclosureType = enclosure['@_type'];
      if (enclosureType?.startsWith('audio/')) mediaKind = 'podcast';
      else if (enclosureType?.startsWith('video/')) mediaKind = 'video';
    }

    const ytId = item['yt:videoId'];
    if (ytId) {
      mediaKind = 'youtube';
      thumbnailUrl = `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`;
    }

    const dateStr = item.pubDate || item.published || item['dc:date'] || item.updated;
    const publishedAt = parseDate(dateStr);

    if (!thumbnailUrl) {
      const mediaThumb = item['media:thumbnail'];
      if (mediaThumb?.['@_url']) thumbnailUrl = mediaThumb['@_url'];
      else if (item['itunes:image']) thumbnailUrl = item['itunes:image']['@_href'];
    }

    // Reddit image extraction
    if (isReddit && !thumbnailUrl) {
      const patterns = [
        /href="(https:\/\/i\.redd\.it\/[a-zA-Z0-9]+\.(?:jpg|png|gif))"/,
        /src="(https:\/\/i\.redd\.it\/[a-zA-Z0-9]+\.(?:jpg|png|gif))"/,
        /src="(https:\/\/preview\.redd\.it\/[^"]+)"/,
      ];

      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match?.[1]) {
          thumbnailUrl = match[1].replace(/&amp;/g, '&');
          break;
        }
      }
    }

    articles.push({
      id: articleId,
      title,
      url: link,
      summary: item.description ? String(item.description) : undefined,
      content,
      publishedAt,
      mediaKind,
      thumbnailUrl,
      enclosureUrl,
      enclosureType,
    });
  }

  return {
    title: String(feedTitle),
    siteUrl: String(feedLink),
    type: isYouTube ? 'youtube' : (isReddit ? 'reddit' : 'rss'),
    articles,
  };
}
