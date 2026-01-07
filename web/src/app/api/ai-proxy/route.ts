import { NextRequest, NextResponse } from 'next/server';

/**
 * AI API Proxy Route
 *
 * Securely proxies requests to OpenAI and Gemini APIs, keeping API keys server-side.
 *
 * Features:
 * - Rate limiting (100 requests/minute per IP)
 * - Request size limit (100KB)
 * - Endpoint allowlist (prevents abuse)
 * - Server-side API keys with optional user override
 */

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;
const MAX_REQUEST_SIZE = 100 * 1024; // 100KB

// In-memory rate limiting store (consider Redis for production at scale)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Allowed API endpoints (prevent SSRF and abuse)
const ALLOWED_ENDPOINTS = {
    openai: {
        baseUrl: 'https://api.openai.com/v1',
        endpoints: [
            'chat/completions',
            'completions',
            'embeddings',
        ],
    },
    gemini: {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
        endpoints: [
            'gemini-2.0-flash:generateContent',
            'gemini-2.5-flash:generateContent',
            'gemini-1.5-flash:generateContent',
            'gemini-1.5-pro:generateContent',
        ],
    },
};

interface AIProxyRequest {
    provider: 'openai' | 'gemini';
    endpoint: string;
    body: object;
    useServerKey?: boolean;
}

function getClientIP(request: NextRequest): string {
    // Check various headers for the real IP
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    const realIP = request.headers.get('x-real-ip');
    if (realIP) {
        return realIP;
    }
    // Fallback (won't work well in production behind proxies)
    return 'unknown';
}

function checkRateLimit(clientIP: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const record = rateLimitStore.get(clientIP);

    if (!record || now > record.resetAt) {
        // Create new rate limit window
        const newRecord = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
        rateLimitStore.set(clientIP, newRecord);
        return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetAt: newRecord.resetAt };
    }

    if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
        return { allowed: false, remaining: 0, resetAt: record.resetAt };
    }

    record.count++;
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - record.count, resetAt: record.resetAt };
}

// Clean up old rate limit entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimitStore.entries()) {
        if (now > record.resetAt) {
            rateLimitStore.delete(ip);
        }
    }
}, 60_000); // Clean every minute

function validateEndpoint(provider: 'openai' | 'gemini', endpoint: string): boolean {
    const config = ALLOWED_ENDPOINTS[provider];
    if (!config) return false;
    return config.endpoints.some(allowed => endpoint === allowed || endpoint.startsWith(allowed.split(':')[0]));
}

function buildTargetUrl(provider: 'openai' | 'gemini', endpoint: string, apiKey?: string): string {
    const config = ALLOWED_ENDPOINTS[provider];

    if (provider === 'openai') {
        return `${config.baseUrl}/${endpoint}`;
    } else {
        // Gemini uses query param for API key
        return `${config.baseUrl}/${endpoint}${apiKey ? `?key=${apiKey}` : ''}`;
    }
}

export async function POST(request: NextRequest) {
    // Rate limiting
    const clientIP = getClientIP(request);
    const rateLimit = checkRateLimit(clientIP);

    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: 'Rate limit exceeded. Please try again later.' },
            {
                status: 429,
                headers: {
                    'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': Math.ceil(rateLimit.resetAt / 1000).toString(),
                    'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
                }
            }
        );
    }

    // Check request size
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
        return NextResponse.json(
            { error: 'Request too large. Maximum size is 100KB.' },
            { status: 413 }
        );
    }

    try {
        const body = await request.json() as AIProxyRequest;

        // Validate required fields
        if (!body.provider || !body.endpoint || !body.body) {
            return NextResponse.json(
                { error: 'Missing required fields: provider, endpoint, body' },
                { status: 400 }
            );
        }

        // Validate provider
        if (body.provider !== 'openai' && body.provider !== 'gemini') {
            return NextResponse.json(
                { error: 'Invalid provider. Must be "openai" or "gemini".' },
                { status: 400 }
            );
        }

        // Validate endpoint (prevent SSRF/abuse)
        if (!validateEndpoint(body.provider, body.endpoint)) {
            return NextResponse.json(
                { error: `Endpoint "${body.endpoint}" is not allowed for provider "${body.provider}".` },
                { status: 403 }
            );
        }

        // Determine API key (server > user-provided header)
        let apiKey: string | undefined;
        const userApiKey = request.headers.get('x-api-key');

        if (body.provider === 'openai') {
            // Priority: Server env key > User-provided header
            apiKey = (!body.useServerKey && userApiKey) ? userApiKey : process.env.OPENAI_API_KEY;
        } else {
            apiKey = (!body.useServerKey && userApiKey) ? userApiKey : process.env.GEMINI_API_KEY;
        }

        if (!apiKey) {
            return NextResponse.json(
                { error: `No API key available for ${body.provider}. Configure server key or provide via x-api-key header.` },
                { status: 401 }
            );
        }

        // Build target URL
        const targetUrl = buildTargetUrl(body.provider, body.endpoint, body.provider === 'gemini' ? apiKey : undefined);

        // Build headers
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (body.provider === 'openai') {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        // Make the proxied request
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body.body),
        });

        // Get response data
        const responseData = await response.json();

        // Return response with rate limit headers
        return NextResponse.json(responseData, {
            status: response.ok ? 200 : response.status,
            headers: {
                'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
                'X-RateLimit-Remaining': rateLimit.remaining.toString(),
                'X-RateLimit-Reset': Math.ceil(rateLimit.resetAt / 1000).toString(),
            },
        });

    } catch (error) {
        console.error('AI Proxy Error:', error);

        if (error instanceof SyntaxError) {
            return NextResponse.json(
                { error: 'Invalid JSON in request body' },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Also support OPTIONS for CORS preflight
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
            'Access-Control-Max-Age': '86400',
        },
    });
}
