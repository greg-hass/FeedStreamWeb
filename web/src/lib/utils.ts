
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function decodeHTMLEntities(text: string): string {
    if (typeof window === 'undefined') {
        // Basic server-side decoding if needed, or rely on parser
        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'");
    }
    const txt = document.createElement("textarea");
    txt.innerHTML = text;
    return txt.value;
}

export async function md5(message: string): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        try {
            const msgUint8 = new TextEncoder().encode(message);
            const hashBuffer = await crypto.subtle.digest('MD5', msgUint8);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
            console.warn("Crypto API failed, falling back to simple hash");
        }
    }
    return simpleHash(message);
}

export async function sha256(message: string): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        try {
            const msgUint8 = new TextEncoder().encode(message);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
            console.warn("Crypto API failed, falling back to simple hash");
        }
    }
    return simpleHash(message);
}

// Simple FNV-1a hash for non-secure contexts
function simpleHash(str: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = (hash * 0x01000193) >>> 0;
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}
