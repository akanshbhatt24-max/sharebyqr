export type ContentType = 'file' | 'photo' | 'video' | 'text' | 'link' | 'contact' | 'wifi';

export interface FileData {
  name: string;
  type: string;
  size: number;
  dataUrl: string; // Base64 data URL
}

export interface ContactData {
  name: string;
  phone?: string;
  email?: string;
  organization?: string;
  note?: string;
}

export interface WifiData {
  ssid: string;
  password?: string;
  encryption: 'WPA' | 'WEP' | 'nopass';
  hidden?: boolean;
}

export interface ShareContent {
  type: ContentType;
  text?: string;
  url?: string;
  file?: FileData;
  files?: FileData[];
  contact?: ContactData;
  wifi?: WifiData;
  title?: string;
}

export interface EncryptionMeta {
  algorithm: 'AES-256-GCM';
  pbkdf2Iterations?: number;
  hasPassphrase: boolean;
  iv: string; // Base64 or Hex IV
  salt?: string; // Base64 or Hex salt if passphrase used
  fingerprint: string; // Key SHA-256 digest preview
}

export interface SharePayload {
  id: string;
  content: ShareContent;
  encryption: EncryptionMeta;
  createdAt: number;
  expiresAt?: number | null; // Timestamp or null
  burnAfterReading?: boolean;
  maxAccessCount?: number;
  accessCount?: number;
}

// Stored in backend or URL
export interface EncryptedShareBlob {
  id: string;
  ciphertext: string; // Base64 encoded AES-GCM payload
  encryptionMeta: EncryptionMeta;
  createdAt: number;
  expiresAt?: number | null;
  burnAfterReading?: boolean;
  maxAccessCount?: number;
  accessCount: number;
}

export interface HistoryItem {
  id: string;
  direction: 'sent' | 'received';
  type: ContentType;
  title: string;
  timestamp: number;
  expiresAt?: number | null;
  encrypted: boolean;
  shareUrl: string;
  previewSnippet?: string;
}

export interface QRDesignOptions {
  fgColor: string;
  bgColor: string;
  logo: 'none' | 'lock' | 'shield' | 'file' | 'photo' | 'video' | 'link' | 'wifi';
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  margin: number;
  size: number;
}
