/**
 * Client-Side Web Crypto API Zero-Knowledge E2E Encryption Module
 * Standard: AES-256-GCM
 * Key Derivation: PBKDF2 (100,000 iterations, SHA-256) for passphrases
 */

// Helper: ArrayBuffer to Base64
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper: Base64 to ArrayBuffer
export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Helper: ArrayBuffer to Hex
export function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Hex to ArrayBuffer
export function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

// Generate random 256-bit key
export async function generateRandomKey(): Promise<{ rawKeyHex: string; cryptoKey: CryptoKey }> {
  const cryptoKey = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const rawKey = await window.crypto.subtle.exportKey('raw', cryptoKey);
  const rawKeyHex = bufferToHex(rawKey);
  return { rawKeyHex, cryptoKey };
}

// Import raw hex key
export async function importHexKey(rawKeyHex: string): Promise<CryptoKey> {
  const rawKeyBuffer = hexToBuffer(rawKeyHex);
  return await window.crypto.subtle.importKey(
    'raw',
    rawKeyBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

// Derive AES-256 key from passphrase using PBKDF2
export async function deriveKeyFromPassphrase(
  passphrase: string,
  saltBuffer: ArrayBuffer
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passphraseBytes = encoder.encode(passphrase);

  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passphraseBytes,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Get SHA-256 key fingerprint (first 8 hex characters for visual audit)
export async function getKeyFingerprint(keyInput: string | CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  let buffer: ArrayBuffer;

  if (typeof keyInput === 'string') {
    buffer = encoder.encode(keyInput);
  } else {
    buffer = await window.crypto.subtle.exportKey('raw', keyInput);
  }

  const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
  const fullHex = bufferToHex(hashBuffer);
  return fullHex.substring(0, 10).toUpperCase();
}

export interface EncryptionResult {
  ciphertextBase64: string;
  ivBase64: string;
  saltBase64?: string;
  rawKeyHex: string;
  fingerprint: string;
  hasPassphrase: boolean;
}

/**
 * Encrypt arbitrary object / text payload
 */
export async function encryptData(
  plainData: Record<string, unknown> | string,
  passphrase?: string
): Promise<EncryptionResult> {
  const textToEncrypt = typeof plainData === 'string' ? plainData : JSON.stringify(plainData);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(textToEncrypt);

  // Generate 12-byte IV for AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  let aesKey: CryptoKey;
  let rawKeyHex = '';
  let saltBase64: string | undefined = undefined;
  const hasPassphrase = Boolean(passphrase && passphrase.trim().length > 0);

  if (hasPassphrase) {
    // Generate 16-byte salt for PBKDF2
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    saltBase64 = bufferToBase64(salt.buffer);
    aesKey = await deriveKeyFromPassphrase(passphrase!.trim(), salt.buffer);
    rawKeyHex = ''; // Key derived on-the-fly with passphrase
  } else {
    const keyObj = await generateRandomKey();
    aesKey = keyObj.cryptoKey;
    rawKeyHex = keyObj.rawKeyHex;
  }

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    dataBuffer
  );

  const fingerprint = await getKeyFingerprint(hasPassphrase ? passphrase!.trim() : rawKeyHex);

  return {
    ciphertextBase64: bufferToBase64(encryptedBuffer),
    ivBase64: bufferToBase64(iv.buffer),
    saltBase64,
    rawKeyHex,
    fingerprint,
    hasPassphrase,
  };
}

/**
 * Decrypt ciphertext
 */
export async function decryptData<T = Record<string, unknown>>(
  ciphertextBase64: string,
  ivBase64: string,
  keyOrPassphrase: string,
  saltBase64?: string
): Promise<T> {
  const cipherBuffer = base64ToBuffer(ciphertextBase64);
  const ivBuffer = base64ToBuffer(ivBase64);

  let aesKey: CryptoKey;

  if (saltBase64) {
    // Passphrase mode
    const saltBuffer = base64ToBuffer(saltBase64);
    aesKey = await deriveKeyFromPassphrase(keyOrPassphrase.trim(), saltBuffer);
  } else {
    // Direct raw hex key mode
    aesKey = await importHexKey(keyOrPassphrase.trim());
  }

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
    aesKey,
    cipherBuffer
  );

  const decoder = new TextDecoder();
  const jsonString = decoder.decode(decryptedBuffer);

  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return jsonString as unknown as T;
  }
}
