
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const url_param = req.nextUrl.searchParams.get('url');

        if (!url_param) {
            return NextResponse.json({ error: 'Missing target URL' }, { status: 400 });
        }

        // Robustly handle the body
        // We expect application/x-www-form-urlencoded from our client
        const textBody = await req.text();
        const forwardBody = new URLSearchParams(textBody);

        console.log(`[FeverProxy] Proxying to: ${url_param}`);

        // Forward the request to the actual Fever API
        const response = await fetch(url_param, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'FeedStreamWeb/1.0',
                'Accept': 'application/json'
            },
            body: forwardBody,
        });

        if (!response.ok) {
            console.error(`[FeverProxy] Upstream Error: ${response.status} ${response.statusText}`);
            return NextResponse.json({ 
                error: `Upstream error: ${response.status}` 
            }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (e: any) {
        console.error('[FeverProxy] Error:', e);
        return NextResponse.json({ error: e.message || 'Proxy Error' }, { status: 500 });
    }
}
