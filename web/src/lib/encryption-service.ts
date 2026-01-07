/**
 * AES-256-GCM Encryption Service
 *
 * Provides secure encryption using Web Crypto API with:
 * - PBKDF2 key derivation (100,000 iterations)
 * - AES-256-GCM authenticated encryption
 * - Random salt and IV for each encryption
 *
 * Output format: base64(salt):base64(iv):base64(ciphertext+authTag)
 */

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16; // 128 bits
const IV_LENGTH = 12;   // 96 bits for GCM
const KEY_LENGTH = 256; // AES-256

/**
 * Check if Web Crypto API is available
 */
export function isEncryptionSupported(): boolean {
  return typeof window !== 'undefined' &&
         window.crypto &&
         window.crypto.subtle !== undefined;
}

/**
 * Generate a random salt for key derivation
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Generate a random initialization vector for AES-GCM
 */
export function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

/**
 * Derive an AES-256 key from a password using PBKDF2
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  // Import the password as a key
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive the AES key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: KEY_LENGTH,
    },
    false, // not extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt plaintext using AES-256-GCM
 *
 * @param plaintext - The text to encrypt
 * @param password - The password to derive the encryption key from
 * @returns Encrypted string in format: base64(salt):base64(iv):base64(ciphertext)
 */
export async function encrypt(
  plaintext: string,
  password: string
): Promise<string> {
  if (!isEncryptionSupported()) {
    throw new Error('Web Crypto API is not supported in this environment');
  }

  const salt = generateSalt();
  const iv = generateIV();
  const key = await deriveKey(password, salt);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    new TextEncoder().encode(plaintext)
  );

  // Combine salt, iv, and ciphertext into a single string
  const saltBase64 = arrayBufferToBase64(salt);
  const ivBase64 = arrayBufferToBase64(iv);
  const ciphertextBase64 = arrayBufferToBase64(ciphertext);

  return `${saltBase64}:${ivBase64}:${ciphertextBase64}`;
}

/**
 * Decrypt ciphertext using AES-256-GCM
 *
 * @param encryptedData - The encrypted string in format: base64(salt):base64(iv):base64(ciphertext)
 * @param password - The password to derive the decryption key from
 * @returns Decrypted plaintext
 */
export async function decrypt(
  encryptedData: string,
  password: string
): Promise<string> {
  if (!isEncryptionSupported()) {
    throw new Error('Web Crypto API is not supported in this environment');
  }

  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const [saltBase64, ivBase64, ciphertextBase64] = parts;

  const salt = base64ToArrayBuffer(saltBase64);
  const iv = base64ToArrayBuffer(ivBase64);
  const ciphertext = base64ToArrayBuffer(ciphertextBase64);

  const key = await deriveKey(password, new Uint8Array(salt));

  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(iv),
      },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    throw new Error('Decryption failed - incorrect password or corrupted data');
  }
}

/**
 * Hash a password for verification purposes (not for encryption)
 * Uses SHA-256 with salt
 */
export async function hashPassword(
  password: string,
  salt?: Uint8Array
): Promise<{ hash: string; salt: string }> {
  const useSalt = salt || generateSalt();
  const combined = new Uint8Array([
    ...useSalt,
    ...new TextEncoder().encode(password),
  ]);

  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);

  return {
    hash: arrayBufferToBase64(hashBuffer),
    salt: arrayBufferToBase64(useSalt),
  };
}

/**
 * Verify a password against a stored hash
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string
): Promise<boolean> {
  const salt = new Uint8Array(base64ToArrayBuffer(storedSalt));
  const { hash } = await hashPassword(password, salt);
  return hash === storedHash;
}

/**
 * Generate a secure random string for use as a token or identifier
 */
export function generateSecureToken(length: number = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return arrayBufferToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Convert ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Check if a string appears to be encrypted with this service
 * (has the salt:iv:ciphertext format)
 */
export function isEncryptedFormat(data: string): boolean {
  const parts = data.split(':');
  if (parts.length !== 3) return false;

  // Check if each part is valid base64
  try {
    for (const part of parts) {
      atob(part);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a string appears to be Base64 encoded (legacy format)
 */
export function isBase64Only(data: string): boolean {
  // Not in encrypted format but is valid base64
  if (isEncryptedFormat(data)) return false;

  try {
    const decoded = atob(data);
    // Check if it decodes to valid UTF-8 looking content
    return decoded.length > 0 && /^[\x00-\x7F]*$/.test(decoded);
  } catch {
    return false;
  }
}

export const EncryptionService = {
  isSupported: isEncryptionSupported,
  generateSalt,
  generateIV,
  deriveKey,
  encrypt,
  decrypt,
  hashPassword,
  verifyPassword,
  generateSecureToken,
  isEncryptedFormat,
  isBase64Only,
};
