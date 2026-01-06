
import { describe, it, expect } from 'vitest';
import { validateUrl, isPrivateIP } from '../lib/server-network';

describe('Server Network Security', () => {
    
    describe('isPrivateIP', () => {
        it('should identify loopback addresses', () => {
            expect(isPrivateIP('127.0.0.1')).toBe(true);
            expect(isPrivateIP('::1')).toBe(true);
        });

        it('should identify private network ranges', () => {
            expect(isPrivateIP('10.0.0.5')).toBe(true);
            expect(isPrivateIP('192.168.1.1')).toBe(true);
            expect(isPrivateIP('172.16.0.1')).toBe(true); // Lower bound
            expect(isPrivateIP('172.31.255.255')).toBe(true); // Upper bound
        });

        it('should identify link-local addresses', () => {
            expect(isPrivateIP('169.254.0.1')).toBe(true);
        });

        it('should allow public IPs', () => {
            expect(isPrivateIP('8.8.8.8')).toBe(false);
            expect(isPrivateIP('1.1.1.1')).toBe(false);
            expect(isPrivateIP('142.250.0.0')).toBe(false); // Google
        });
    });

    describe('validateUrl', () => {
        it('should accept valid public HTTPS URLs', async () => {
            const result = await validateUrl('https://www.google.com');
            expect(result.valid).toBe(true);
        });

        it('should accept valid public HTTP URLs', async () => {
            const result = await validateUrl('http://example.com');
            expect(result.valid).toBe(true);
        });

        it('should reject non-http protocols', async () => {
            const result = await validateUrl('file:///etc/passwd');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('protocol');

            const resultFtp = await validateUrl('ftp://example.com');
            expect(resultFtp.valid).toBe(false);
        });

        it('should reject localhost', async () => {
            const result = await validateUrl('http://localhost:3000');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('private resources');
        });

        it('should reject local IP addresses', async () => {
            const result = await validateUrl('http://127.0.0.1/admin');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('private resources');

            const resultLan = await validateUrl('http://192.168.1.50/config');
            expect(resultLan.valid).toBe(false);
        });

        // Note: We can't easily test "real" DNS rebinding without a controlled DNS server,
        // but checking localhost/127.0.0.1 covers the basic SSRF vector.
    });
});
