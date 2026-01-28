// Universal Utils for Web and Backend

// HTML Entity Decoding (Safe for both Node and Browser)
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
    return text.replace(/&amp;|&lt;|&gt;|&quot;|&#039;|&apos;/g, (match) => commonEntities[match]);
}

// Hashing
export async function sha256(message: string): Promise<string> {
    // Browser / Modern Node
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        try {
            const msgUint8 = new TextEncoder().encode(message);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
            // Fallback
        }
    }

    // Node.js Legacy / fallback (if crypto.subtle is somehow missing but 'crypto' module exists?)
    // In a pure common package, we can't easily conditionally require('crypto').
    // So we fall back to simple hash if subtle is missing.
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

// UUID v4
export function uuidv4() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // Fallback for secure contexts
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        // @ts-ignore
        return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
            (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
        );
    }

    // Insecure Fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
