
import { md5 } from '@/lib/utils';

export interface FeverAuth {
    endpoint: string;
    apiKey: string; // MD5(username:apiKey)
}

export interface FeverResponse {
    api_version: number;
    auth: 0 | 1;
    last_refreshed_on_time: number;
    [key: string]: any;
}

export class FeverAPI {
    private endpoint: string;
    private apiKey: string; // Already MD5 hashed

    constructor(endpoint: string, apiKey: string) {
        this.endpoint = endpoint;
        this.apiKey = apiKey; // Expecting MD5 hash of "username:apikey"
    }

    private async fetch(params: Record<string, string | number | undefined> = {}): Promise<any> {
        // Construct the ACTUAL query string for the external API
        const targetUrl = new URL(this.endpoint);
        targetUrl.searchParams.append('api', '');

        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) {
                targetUrl.searchParams.append(key, String(value));
            }
        });

        // Use our local Proxy to bypass CORS
        const proxyUrl = `/api/fever-proxy?url=${encodeURIComponent(targetUrl.toString())}`;

        // POST request with api_key
        const formData = new FormData();
        formData.append('api_key', this.apiKey);

        try {
            const response = await fetch(proxyUrl, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Fever API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (data.error) {
                throw new Error(`Proxy Error: ${data.error}`);
            }

            if (data.auth === 0) {
                throw new Error("Fever API Authentication Failed");
            }

            return data;
        } catch (error) {
            console.error("Fever API Request Failed", error);
            throw error;
        }
    }

    async getGroups() {
        return this.fetch({ groups: 1 });
    }

    async getFeeds() {
        return this.fetch({ feeds: 1 });
    }

    async getFavicons() {
        return this.fetch({ favicons: 1 });
    }

    async getItems(sinceId?: number) {
        return this.fetch({ items: 1, since_id: sinceId });
    }

    async getUnreadItemIds() {
        return this.fetch({ unread_item_ids: 1 });
    }

    async getSavedItemIds() {
        return this.fetch({ saved_item_ids: 1 });
    }

    async markItemRead(id: number) {
        return this.fetch({ mark: 'item', as: 'read', id });
    }

    async markItemUnread(id: number) {
        return this.fetch({ mark: 'item', as: 'unread', id });
    }

    async markItemSaved(id: number) {
        return this.fetch({ mark: 'item', as: 'saved', id });
    }

    async markItemUnsaved(id: number) {
        return this.fetch({ mark: 'item', as: 'unsaved', id });
    }
}
