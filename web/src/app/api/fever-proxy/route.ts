
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const url_param = req.nextUrl.searchParams.get('url');

        if (!url_param) {
            return NextResponse.json({ error: 'Missing target URL' }, { status: 400 });
        }

        // Parse the body
        const formData = await req.formData();

        // Forward the request to the actual Fever API
        const response = await fetch(url_param, {
            method: 'POST',
            body: formData,
            // We do NOT forward Origin/Referer to avoid CORS issues at the target
        });

        const data = await response.json();

        return NextResponse.json(data);
    } catch (e: any) {
        console.error('[FeverProxy] Error:', e);
        return NextResponse.json({ error: e.message || 'Proxy Error' }, { status: 500 });
    }
}
