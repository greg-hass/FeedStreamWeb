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
    rawData?: any;
}
export declare function parseFeed(data: string | object, sourceUrl: string): Promise<ParsedFeed>;
