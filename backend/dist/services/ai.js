"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
const config_1 = require("../config");
class AIService {
    geminiApiKey;
    constructor() {
        this.geminiApiKey = config_1.config.GEMINI_API_KEY;
    }
    async generateBriefing(articles) {
        if (!this.geminiApiKey) {
            throw new Error('Gemini API key not configured');
        }
        const articlesText = articles.slice(0, 20).map(a => {
            const text = (a.summary || a.content || '').replace(/<[^>]*>/g, '').slice(0, 400);
            return `- ${a.title}: ${text}`;
        }).join('\n');
        const systemPrompt = `You are a smart news editor. Create a concise Daily Briefing. Group stories by topic. Format using HTML: Use <h3><u>Topic Header</u></h3> for topics, <ul><li> for stories, and <b> for key terms. Add <br/> between sections. Keep it under 300 words. Tone: Professional but conversational.`;
        const userPrompt = `Articles:\n${articlesText}`;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.geminiApiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                        parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
                    }]
            }),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const message = errorData?.error?.message || `Gemini API error: ${response.status}`;
            throw new Error(message);
        }
        const data = await response.json();
        return data.candidates[0]?.content?.parts[0]?.text || 'No briefing generated';
    }
    async generateFeedRecommendations(userFeeds) {
        if (!this.geminiApiKey) {
            throw new Error('Gemini API key not configured');
        }
        const profile = userFeeds.slice(0, 30).map(f => `- ${f.title} (${f.type})`).join('\n');
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

IMPORTANT: Ensure URLs are valid feed URLs where possible.`;
        const userPrompt = profile
            ? `My Subscriptions:\n${profile}\n\nSuggest new feeds based on these interests.`
            : `I am a new user interested in Technology, Science, and World News. Suggest some starter feeds.`;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.geminiApiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                        parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
                    }],
                generationConfig: {
                    responseMimeType: 'application/json'
                }
            }),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const message = errorData?.error?.message || `Gemini API error: ${response.status}`;
            throw new Error(message);
        }
        const data = await response.json();
        const jsonString = data.candidates[0]?.content?.parts[0]?.text || '[]';
        try {
            const cleanJson = jsonString.replace(/```json\n?|\n?```/g, '').trim();
            const result = JSON.parse(cleanJson);
            return Array.isArray(result) ? result : (result.feeds || result.recommendations || []);
        }
        catch {
            throw new Error('Failed to parse AI recommendations');
        }
    }
}
exports.AIService = AIService;
//# sourceMappingURL=ai.js.map