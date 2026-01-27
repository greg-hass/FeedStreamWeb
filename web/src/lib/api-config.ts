/**
 * Runtime API Configuration
 * 
 * This allows the API URL to be configured at runtime via environment variables
 * passed to the Docker container, rather than being baked in at build time.
 */

// Default API URL (fallback)
const DEFAULT_API_URL = 'http://localhost:3001/api';

// Get API URL from runtime environment (for Docker) or build-time env
export function getApiUrl(): string {
  // Check if we're in the browser
  if (typeof window !== 'undefined') {
    // Try to get from window.__ENV__ (injected by Docker)
    const runtimeUrl = (window as any).__ENV__?.NEXT_PUBLIC_API_URL;
    if (runtimeUrl) {
      return runtimeUrl;
    }
    
    // Fallback to build-time env
    return process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
  }
  
  // Server-side: use build-time env
  return process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
}
