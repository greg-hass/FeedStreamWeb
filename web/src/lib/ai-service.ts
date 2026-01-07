import { db } from './db';
import { useSettingsStore } from '@/store/settingsStore';
import { format } from 'date-fns';

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
            useServerKey: !userApiKey, // Use server key if no user key provided
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        // Handle nested error structures from OpenAI/Gemini
        // OpenAI: { "error": { "message": "...", "type": "..." } }
        // Gemini: { "error": { "code": 400, "message": "..." } }
        const errorMessage = typeof data.error === 'string'
            ? data.error
            : data.error?.message || data.message || `AI API Error: ${response.status}`;
        throw new Error(errorMessage);
    }

    return data;
}

export class AIService {
    static async generateDailyBriefing(): Promise<string> {
        const { openaiApiKey, geminiApiKey } = useSettingsStore.getState();

        // 1. Get recent unread articles (last 24h, limited to 30)
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const articles = await db.articles
            .where('publishedAt').above(yesterday)
            .reverse()
            .limit(40)
            .toArray();

        // Filter for meaningful content
        const candidates = articles.filter(a => !a.isRead && (a.summary || a.contentHTML));

        if (candidates.length === 0) {
            return "No recent unread articles to summarize.";
        }

        // 2. Prepare Prompt
        const articlesText = candidates.slice(0, 20).map(a => {
            const text = (a.summary || a.contentHTML || '').replace(/<[^>]*>/g, '').slice(0, 400);
            return `- ${a.title}: ${text}`;
        }).join('\n');

        const systemPrompt = "You are a smart news editor. Create a concise Daily Briefing. Group stories by topic. Format using HTML: Use <h3><u>Topic Header</u></h3> for topics, <ul><li> for stories, and <b> for key terms. Add <br/> between sections. Keep it under 300 words. Tone: Professional but conversational.";
        const userPrompt = `Articles:\n${articlesText}`;

        // 3. Call AI API via secure proxy
        try {
            let briefingContent = "";

            // Prefer Gemini, fall back to OpenAI
            const useGemini = geminiApiKey || !openaiApiKey;

            if (useGemini) {
                // Use Gemini 2.5 Flash
                const data = await callAIProxy(
                    'gemini',
                    'gemini-2.5-flash:generateContent',
                    {
                        contents: [{
                            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
                        }]
                    },
                    geminiApiKey || undefined
                );
                briefingContent = data.candidates[0].content.parts[0].text;
            } else {
                // Use OpenAI
                const data = await callAIProxy(
                    'openai',
                    'chat/completions',
                    {
                        model: "gpt-4o-mini",
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userPrompt }
                        ]
                    },
                    openaiApiKey || undefined
                );
                briefingContent = data.choices[0].message.content;
            }

            // 4. Save to DB
            const todayKey = format(new Date(), 'yyyy-MM-dd');
            await db.briefings.put({
                id: todayKey,
                date: todayKey,
                content: briefingContent,
                generatedAt: new Date(),
                articlesCovered: candidates.map(c => c.id)
            });

            return briefingContent;

        } catch (error: any) {
            console.error("Briefing Generation Failed", error);
            throw error;
        }
    }

    static async getTodayBriefing(): Promise<string | null> {
        const todayKey = format(new Date(), 'yyyy-MM-dd');
        const briefing = await db.briefings.get(todayKey);
        return briefing ? briefing.content : null;
    }
}
