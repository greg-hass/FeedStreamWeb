import { db } from './db';
import { useSettingsStore } from '@/store/settingsStore';

export interface FeedRecommendation {
    title: string;
    url: string;
    description: string;
    category: string;
    type: 'rss' | 'youtube' | 'reddit' | 'podcast';
}

/**
 * Helper to call AI APIs through the secure proxy
 */
async function callAIProxy(
    provider: 'openai' | 'gemini',
    endpoint: string,
    body: object,
    userApiKey?: string
): Promise<any> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    // If user has their own API key, pass it via header
    if (userApiKey) {
        headers['x-api-key'] = userApiKey;
    }

    const response = await fetch('/api/ai-proxy', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            provider,
            endpoint,
            body,
            useServerKey: !userApiKey,
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `AI API Error: ${response.status}`);
    }

    return data;
}

export class FeedDiscoveryService {

    static async generateRecommendations(): Promise<FeedRecommendation[]> {
        const { openaiApiKey, geminiApiKey } = useSettingsStore.getState();

        // 1. Build User Profile from existing feeds
        const feeds = await db.feeds.toArray();
        if (feeds.length === 0) {
            // Cold start: ask for generic popular feeds
            return this.fetchFromAI(null, openaiApiKey, geminiApiKey);
        }

        // Sample up to 30 feeds to avoid token limits
        const profile = feeds.slice(0, 30).map(f => `- ${f.title} (${f.type})`).join('\n');
        return this.fetchFromAI(profile, openaiApiKey, geminiApiKey);
    }

    private static async fetchFromAI(profile: string | null, openaiKey: string, geminiKey: string): Promise<FeedRecommendation[]> {
        const systemPrompt = `You are a Feed Discovery Engine.
        Analyze the user's subscriptions and suggest 5-8 high-quality, relevant NEW feeds they might like.
        Include a mix of RSS, YouTube Channels, and Subreddits if appropriate for their interests.

        Output valid JSON ONLY in this format:
        [
            {
                "title": "Feed Title",
                "url": "Feed URL (RSS xml, YouTube Channel URL, or Subreddit URL)",
                "description": "Why they might like it",
                "category": "Tech/Gaming/News etc",
                "type": "rss" | "youtube" | "reddit" | "podcast"
            }
        ]

        IMPORTANT: Ensure URLs are valid feed URLs where possible (e.g. youtube.com/feeds/videos.xml?channel_id=... or reddit.com/r/name.rss) OR standard URLs that can be auto-discovered.`;

        const userPrompt = profile
            ? `My Subscriptions:\n${profile}\n\nSuggest new feeds based on these interests.`
            : `I am a new user interested in Technology, Science, and World News. Suggest some starter feeds.`;

        try {
            let jsonString = "";

            // Prefer Gemini, fall back to OpenAI
            const useGemini = geminiKey || !openaiKey;

            if (useGemini) {
                const data = await callAIProxy(
                    'gemini',
                    'gemini-2.0-flash:generateContent',
                    {
                        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
                        generationConfig: { responseMimeType: "application/json" }
                    },
                    geminiKey || undefined
                );
                jsonString = data.candidates[0].content.parts[0].text;
            } else {
                const data = await callAIProxy(
                    'openai',
                    'chat/completions',
                    {
                        model: "gpt-4o-mini",
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userPrompt }
                        ],
                        response_format: { type: "json_object" }
                    },
                    openaiKey || undefined
                );
                jsonString = data.choices[0].message.content;
            }

            // Parse JSON
            // Handle potential wrapping in ```json ... ```
            const cleanJson = jsonString.replace(/```json\n?|\n?```/g, '').trim();
            const result = JSON.parse(cleanJson);
            
            // Handle { "feeds": [...] } wrapper if AI adds it despite instructions
            const items = Array.isArray(result) ? result : (result.feeds || result.recommendations || []);
            
            return items.map((item: any) => ({
                title: item.title,
                url: item.url,
                description: item.description,
                category: item.category,
                type: item.type || 'rss'
            }));

        } catch (error: any) {
            console.error("Feed Discovery Failed", error);
            throw new Error(error.message || "Failed to generate recommendations");
        }
    }
}