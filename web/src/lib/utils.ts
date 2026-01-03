
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
