import { db } from './db';
import { useSettingsStore } from '@/store/settingsStore';
import { format } from 'date-fns';

export class AIService {
    static async generateDailyBriefing(): Promise<string> {
        const { openaiApiKey, geminiApiKey } = useSettingsStore.getState();
        
        if (!openaiApiKey && !geminiApiKey) {
            throw new Error("No AI API Key found. Please add an OpenAI or Gemini key in Settings.");
        }

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

        const systemPrompt = "You are a smart news editor. Create a concise Daily Briefing grouping stories by topic using bullet points. Keep it under 300 words. Tone: Professional but conversational.";
        const userPrompt = `Articles:\n${articlesText}`;

        // 3. Call AI API
        try {
            let briefingContent = "";

            if (geminiApiKey) {
                // Use Gemini 2.5 Flash
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
                        }]
                    })
                });

                if (!response.ok) throw new Error(`Gemini API Error: ${await response.text()}`);
                const data = await response.json();
                briefingContent = data.candidates[0].content.parts[0].text;
            } else {
                // Use OpenAI fallback
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${openaiApiKey}`
                    },
                    body: JSON.stringify({
                        model: "gpt-4o-mini",
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userPrompt }
                        ]
                    })
                });

                if (!response.ok) throw new Error(`OpenAI API Error: ${await response.text()}`);
                const data = await response.json();
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
