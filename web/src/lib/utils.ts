import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import md5Lib from 'blueimp-md5';
import { sha256 as commonSha256, uuidv4 as commonUuidv4 } from '@feedstream/common';

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

export async function md5(message: string): Promise<string> {
    return md5Lib(message);
}

export const sha256 = commonSha256;
export const uuidv4 = commonUuidv4;
