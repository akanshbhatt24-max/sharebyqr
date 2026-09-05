import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { QRDesignOptions } from '../types';

export const DEFAULT_QR_OPTIONS: QRDesignOptions = {
  fgColor: '#0F172A',
  bgColor: '#FFFFFF',
  logo: 'none',
  errorCorrectionLevel: 'M',
  margin: 2,
  size: 320,
};

/**
 * Format standard Wi-Fi QR Code string compatible with iOS and Android camera
 */
export function formatWifiQR(
  ssid: string,
  password: string = '',
  encryption: 'WPA' | 'WEP' | 'nopass' = 'WPA',
  hidden: boolean = false
): string {
  const cleanSsid = ssid.trim().replace(/([\\;,:"])/g, '\\$1');
  const cleanPass = password.replace(/([\\;,:"])/g, '\\$1');
  const enc = encryption === 'nopass' ? 'nopass' : encryption;
  return `WIFI:S:${cleanSsid};T:${enc};P:${cleanPass};H:${hidden ? 'true' : 'false'};;`;
}

/**
 * Format standard vCard 3.0 string for contacts
 */
export function formatVCardQR(
  name: string,
  phone: string = '',
  email: string = '',
  organization: string = ''
): string {
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${name.trim()}`,
    phone.trim() ? `TEL;TYPE=CELL:${phone.trim()}` : '',
    email.trim() ? `EMAIL:${email.trim()}` : '',
    organization.trim() ? `ORG:${organization.trim()}` : '',
    'END:VCARD',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Generate QR Code Data URL with optional center logo
 */
export async function generateQRCodeDataUrl(
  text: string,
  options: Partial<QRDesignOptions> = {}
): Promise<string> {
  const safeText = (text && text.trim()) ? text.trim() : 'https://sharebyqr.app';
  const mergedOptions = { ...DEFAULT_QR_OPTIONS, ...options };

  // If a logo is specified, error correction level MUST be high enough to tolerate the center badge
  let errorCorrectionLevel = mergedOptions.errorCorrectionLevel;
  if (mergedOptions.logo && mergedOptions.logo !== 'none') {
    if (errorCorrectionLevel === 'L' || errorCorrectionLevel === 'M') {
      errorCorrectionLevel = 'H';
    }
  }

  // Generate canvas element
  const canvas = document.createElement('canvas');
  canvas.width = mergedOptions.size;
  canvas.height = mergedOptions.size;

  await QRCode.toCanvas(canvas, safeText, {
    errorCorrectionLevel,
    margin: mergedOptions.margin,
    width: mergedOptions.size,
    color: {
      dark: mergedOptions.fgColor,
      light: mergedOptions.bgColor,
    },
  });

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');

  // If a logo is specified, draw a calibrated rounded badge in center
  if (mergedOptions.logo && mergedOptions.logo !== 'none') {
    const logoSize = Math.floor(mergedOptions.size * 0.18);
    const center = mergedOptions.size / 2;
    const badgeRadius = Math.floor(logoSize / 2) + 2;

    ctx.save();
    // Background circle for badge
    ctx.fillStyle = mergedOptions.bgColor;
    ctx.beginPath();
    ctx.arc(center, center, badgeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Subtle border
    ctx.strokeStyle = mergedOptions.fgColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw symbol inside center
    ctx.fillStyle = mergedOptions.fgColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.floor(logoSize * 0.52)}px sans-serif`;

    let symbol = '🔒';
    if (mergedOptions.logo === 'shield') symbol = '🛡️';
    if (mergedOptions.logo === 'file') symbol = '📄';
    if (mergedOptions.logo === 'photo') symbol = '🖼️';
    if (mergedOptions.logo === 'video') symbol = '🎥';
    if (mergedOptions.logo === 'link') symbol = '🔗';
    if (mergedOptions.logo === 'wifi') symbol = '📶';

    ctx.fillText(symbol, center, center + 1);
    ctx.restore();
  }

  return canvas.toDataURL('image/png');
}

/**
 * Generate QR Code as SVG String
 */
export async function generateQRCodeSVG(
  text: string,
  options: Partial<QRDesignOptions> = {}
): Promise<string> {
  const safeText = (text && text.trim()) ? text.trim() : 'https://sharebyqr.app';
  const mergedOptions = { ...DEFAULT_QR_OPTIONS, ...options };
  return await QRCode.toString(safeText, {
    type: 'svg',
    errorCorrectionLevel: mergedOptions.errorCorrectionLevel,
    margin: mergedOptions.margin,
    color: {
      dark: mergedOptions.fgColor,
      light: mergedOptions.bgColor,
    },
  });
}

/**
 * Scan QR code from ImageData using jsQR
 */
export function scanQRCodeFromImageData(
  imageData: ImageData
): { data: string; location: unknown } | null {
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  });

  if (code) {
    return { data: code.data, location: code.location };
  }
  return null;
}

/**
 * Scan QR code from File / Image Element
 */
export async function scanQRCodeFromImageFile(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = scanQRCodeFromImageData(imageData);
        resolve(code ? code.data : null);
      };
      img.onerror = () => resolve(null);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
