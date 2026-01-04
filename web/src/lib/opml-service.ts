
import { db } from './db';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { FeedService } from './feed-service';
import { uuidv4 } from './utils';

export class OpmlService {

    static async importOPML(xmlContent: string, onProgress?: (current: number, total: number, message: string) => void) {
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: ""
        });

        const result = parser.parse(xmlContent);
        if (!result.opml && !result.OPML) throw new Error("Invalid OPML file: No <opml> tag found");

        const body = result.opml?.body || result.OPML?.body;
        if (!body) throw new Error("Invalid OPML file: No <body> tag found");

        const outlines = Array.isArray(body.outline) ? body.outline : (body.outline ? [body.outline] : []);

        // Count total feeds for progress
        let totalFeeds = 0;
        const count = (nodes: any[]) => {
            for (const node of nodes) {
                if (node.xmlUrl || node.xmlurl || node.url) {
                    totalFeeds++;
                } else if (node.outline) {
                    const children = Array.isArray(node.outline) ? node.outline : [node.outline];
                    count(children);
                }
            }
        };
        count(outlines);

        let processed = 0;
        const updateProgress = (name: string) => {
            if (onProgress) {
                onProgress(processed, totalFeeds, `Importing ${name}...`);
            }
        };

        await this.processOutlines(outlines, undefined, (name) => {
            processed++;
            updateProgress(name);
        });
    }

    private static async processOutlines(outlines: any[], folderId?: string, onFeedImported?: (name: string) => void) {
        for (const node of outlines) {
            if (!node) continue;

            const feedUrl = node.xmlUrl || node.xmlurl || node.url;
            const title = node.text || node.title || 'Untitled';

            // Case 1: Subscription
            if (feedUrl) {
                try {
                    await FeedService.addFeed(feedUrl, folderId);
                    if (onFeedImported) onFeedImported(title);
                } catch (e) {
                    console.error(`Failed to import feed ${feedUrl}`, e);
                    // Still count as processed even if failed
                    if (onFeedImported) onFeedImported(title + ' (Failed)');
                }
            }
            // Case 2: Folder
            else if (node.outline) {
                const newFolderId = uuidv4();
                await db.folders.add({
                    id: newFolderId,
                    name: title,
                    position: 0
                });

                const children = Array.isArray(node.outline) ? node.outline : [node.outline];
                await this.processOutlines(children, newFolderId, onFeedImported);
            }
        }
    }

    static async exportOPML(): Promise<string> {
        const feeds = await db.feeds.toArray();
        const folders = await db.folders.toArray();

        // Group feeds by folder
        const folderMap = new Map<string, any[]>();
        const rootFeeds: any[] = [];

        for (const feed of feeds) {
            if (feed.folderID) {
                if (!folderMap.has(feed.folderID)) folderMap.set(feed.folderID, []);
                folderMap.get(feed.folderID)?.push(feed);
            } else {
                rootFeeds.push(feed);
            }
        }

        let outlinesXML = '';

        // Add Folders and their feeds
        for (const folder of folders) {
            const children = folderMap.get(folder.id) || [];
            if (children.length > 0) {
                outlinesXML += `\t<outline text="${this.escape(folder.name)}" title="${this.escape(folder.name)}">\n`;
                for (const feed of children) {
                    outlinesXML += `\t\t<outline text="${this.escape(feed.title)}" title="${this.escape(feed.title)}" type="rss" xmlUrl="${this.escape(feed.feedURL)}" htmlUrl="${this.escape(feed.siteURL || '')}"/>\n`;
                }
                outlinesXML += `\t</outline>\n`;
            }
        }

        // Add Root Feeds
        for (const feed of rootFeeds) {
            outlinesXML += `\t<outline text="${this.escape(feed.title)}" title="${this.escape(feed.title)}" type="rss" xmlUrl="${this.escape(feed.feedURL)}" htmlUrl="${this.escape(feed.siteURL || '')}"/>\n`;
        }

        return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
    <head>
        <title>FeedStream Subscription Export</title>
        <dateCreated>${new Date().toUTCString()}</dateCreated>
    </head>
    <body>
${outlinesXML}
    </body>
</opml>`;
    }

    private static escape(str: string): string {
        if (!str) return '';
        return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}
