import { parseFeed as commonParseFeed, ParsedFeed, ParsedArticle } from '@feedstream/common';
import { Article, FeedType } from './db';

export interface NormalizedFeed {
    title?: string;
    site?: string;
    kind: FeedType;
    articles: Article[];
    avatarURL?: string;
    rawData?: any;
}

export async function parseFeed(data: string | object, sourceURL: string): Promise<NormalizedFeed> {
    const parsed = await commonParseFeed(data, sourceURL);
    
    // Map FeedType
    let kind: FeedType = 'rss';
    if (parsed.type === 'youtube') kind = 'youtube';
    else if (parsed.type === 'reddit') kind = 'reddit';
    else if (parsed.type === 'json') kind = 'json';
    
    // Map Articles
    const articles: Article[] = parsed.articles.map(a => ({
        id: a.id,
        feedID: '', // Set by caller
        title: a.title,
        url: a.url,
        summary: a.summary,
        contentHTML: a.content, // Map content -> contentHTML
        publishedAt: a.publishedAt,
        isRead: 0,
        isBookmarked: 0,
        mediaKind: a.mediaKind || 'none',
        thumbnailPath: a.thumbnailUrl, // Map thumbnailUrl -> thumbnailPath
        enclosureURL: a.enclosureUrl,
        enclosureType: a.enclosureType,
        imageWidth: 0,
        imageHeight: 0,
        playbackPosition: 0,
        downloadStatus: 0,
        imageCacheStatus: 0,
        author: a.author
    }));

    return {
        title: parsed.title,
        site: parsed.siteUrl,
        kind,
        articles,
        avatarURL: parsed.iconUrl,
        rawData: parsed.rawData
    };
}
