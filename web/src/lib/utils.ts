
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Optimized HTML decoding (regex for speed, DOM as fallback)
let decodingTextArea: HTMLTextAreaElement | null = null;
const commonEntities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&apos;': "'"
};

export function decodeHTMLEntities(text: string): string {
    if (!text) return '';
    
    // Quick regex pass for common entities
    const quickDecode = text.replace(/&amp;|&lt;|&gt;|&quot;|&#039;|&apos;/g, (match) => commonEntities[match]);
    
    // If no other entities are left, return
    if (quickDecode.indexOf('&') === -1) {
        return quickDecode;
    }

    if (typeof window === 'undefined') {
        return quickDecode;
    }

    // Reuse textarea for complex entities
    if (!decodingTextArea) {
        decodingTextArea = document.createElement("textarea");
    }
    decodingTextArea.innerHTML = text;
    return decodingTextArea.value;
}

import md5Lib from 'blueimp-md5';

export async function md5(message: string): Promise<string> {
    return md5Lib(message);
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
// Simple UUID v4 fallback
export function uuidv4() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // Fallback for secure contexts (if randomUUID missing but crypto present)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
            (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
        );
    }

    // Insecure Fallback (Math.random) - for when crypto is totally missing
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
