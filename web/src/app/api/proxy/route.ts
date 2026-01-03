
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'Missing URL parameter' }, { status: 400 });
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'FeedStream/1.0 (Self-Hosted; +https://github.com/your/repo)',
            },
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch feed: ${response.status} ${response.statusText}` },
                { status: response.status }
            );
        }

        const contentType = response.headers.get('content-type') || 'application/xml';
        const blob = await response.blob();
        const headers = new Headers();
        headers.set('Content-Type', contentType);
        headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

        return new NextResponse(blob, { headers });
    } catch (error) {
        console.error('Proxy fetch error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
