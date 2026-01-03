
import { db } from './db';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { FeedService } from './feed-service';

export class OpmlService {

    static async importOPML(xmlContent: string) {
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: ""
        });

        const result = parser.parse(xmlContent);
        const body = result.opml?.body;

        if (!body) throw new Error("Invalid OPML file");

        const outlines = Array.isArray(body.outline) ? body.outline : [body.outline];

        await this.processOutlines(outlines);
    }

    private static async processOutlines(outlines: any[], folderId?: string) {
        for (const node of outlines) {
            if (!node) continue;

            // Case 1: Subscription (has xmlUrl)
            if (node.xmlUrl) {
                try {
                    await FeedService.addFeed(node.xmlUrl, folderId);
                } catch (e) {
                    console.error(`Failed to import feed ${node.xmlUrl}`, e);
                }
            }
            // Case 2: Folder (Nested outlines)
            else if (node.outline) {
                // Create Folder
                const newFolderId = crypto.randomUUID();
                await db.folders.add({
                    id: newFolderId,
                    name: node.text || node.title || 'Untitled Folder',
                    position: 0
                });

                // Recursively process children
                const children = Array.isArray(node.outline) ? node.outline : [node.outline];
                await this.processOutlines(children, newFolderId);
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
