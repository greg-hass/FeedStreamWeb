
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const url_param = req.nextUrl.searchParams.get('url');

        if (!url_param) {
            return NextResponse.json({ error: 'Missing target URL' }, { status: 400 });
        }

        // Parse the body
        const formData = await req.formData();

        // Convert back to URLSearchParams to force application/x-www-form-urlencoded
        // This is crucial for PHP backends like FreshRSS which may not handle multipart well from proxies
        const forwardBody = new URLSearchParams();
        formData.forEach((value, key) => {
            forwardBody.append(key, value as string);
        });

        // Forward the request to the actual Fever API
        const response = await fetch(url_param, {
            method: 'POST',
            body: forwardBody,
        });

        const data = await response.json();

        return NextResponse.json(data);
    } catch (e: any) {
        console.error('[FeverProxy] Error:', e);
        return NextResponse.json({ error: e.message || 'Proxy Error' }, { status: 500 });
    }
}
