
import { NextRequest, NextResponse } from 'next/server';
import { validateUrl } from '@/lib/server-network';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'Missing URL parameter' }, { status: 400 });
    }

    try {
        // Initial Validation
        const validation = await validateUrl(url);
        if (!validation.valid) {
            return NextResponse.json({ error: validation.error }, { status: 403 });
        }

        // Fetch with manual redirect handling to prevent SSRF via redirects
        let currentUrl = url;
        let response: Response | null = null;
        let redirects = 5;

        // Build headers - include conditional headers for smart caching
        const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        };

        // Pass through conditional headers for smart feed refresh
        const ifNoneMatch = request.headers.get('if-none-match');
        const ifModifiedSince = request.headers.get('if-modified-since');
        if (ifNoneMatch) headers['If-None-Match'] = ifNoneMatch;
        if (ifModifiedSince) headers['If-Modified-Since'] = ifModifiedSince;

        while (redirects > 0) {
            response = await fetch(currentUrl, {
                headers,
                redirect: 'manual', // CRITICAL: Stop auto-following
            });

            // Check for redirect status codes
            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get('location');
                if (!location) break;

                // Resolve relative redirects
                const resolvedUrl = new URL(location, currentUrl).toString();

                // CRITICAL: Validate the redirect destination
                const redirectValidation = await validateUrl(resolvedUrl);
                if (!redirectValidation.valid) {
                    return NextResponse.json({ error: 'Redirect to private resource blocked' }, { status: 403 });
                }

                currentUrl = resolvedUrl;
                redirects--;
                continue;
            }

            // Not a redirect, break loop
            break;
        }

        if (!response || redirects === 0) {
            return NextResponse.json({ error: 'Too many redirects or fetch failed' }, { status: 502 });
        }

        // Handle 304 Not Modified - pass through for smart caching
        if (response.status === 304) {
            const responseHeaders = new Headers();
            responseHeaders.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
            return new NextResponse(null, { status: 304, headers: responseHeaders });
        }

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch: ${response.status} ${response.statusText}` },
                { status: response.status }
            );
        }

        const contentType = response.headers.get('content-type') || 'text/html';
        const text = await response.text();

        const responseHeaders = new Headers();
        responseHeaders.set('Content-Type', contentType);
        responseHeaders.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

        // Preserve caching headers for smart feed refresh
        const etag = response.headers.get('etag');
        const lastModified = response.headers.get('last-modified');
        if (etag) responseHeaders.set('ETag', etag);
        if (lastModified) responseHeaders.set('Last-Modified', lastModified);

        return new NextResponse(text, { headers: responseHeaders });

    } catch (error) {
        console.error('Proxy fetch error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
