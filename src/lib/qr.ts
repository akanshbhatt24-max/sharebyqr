import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { QRDesignOptions } from '../types';

export const DEFAULT_QR_OPTIONS: QRDesignOptions = {
  fgColor: '#0F172A',
  bgColor: '#FFFFFF',
  logo: 'shield',
  errorCorrectionLevel: 'H',
  margin: 2,
  size: 320,
};

/**
 * Generate QR Code Data URL with optional center logo
 */
export async function generateQRCodeDataUrl(
  text: string,
  options: Partial<QRDesignOptions> = {}
): Promise<string> {
  const mergedOptions = { ...DEFAULT_QR_OPTIONS, ...options };

  // Generate canvas element
  const canvas = document.createElement('canvas');
  canvas.width = mergedOptions.size;
  canvas.height = mergedOptions.size;

  await QRCode.toCanvas(canvas, text, {
    errorCorrectionLevel: mergedOptions.errorCorrectionLevel,
    margin: mergedOptions.margin,
    width: mergedOptions.size,
    color: {
      dark: mergedOptions.fgColor,
      light: mergedOptions.bgColor,
    },
  });

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');

  // If a logo is specified, draw a rounded badge in center
  if (mergedOptions.logo && mergedOptions.logo !== 'none') {
    const logoSize = Math.floor(mergedOptions.size * 0.22);
    const center = mergedOptions.size / 2;
    const x = center - logoSize / 2;
    const y = center - logoSize / 2;

    // Background circle/box for logo
    ctx.save();
    ctx.fillStyle = mergedOptions.bgColor;
    ctx.beginPath();
    ctx.arc(center, center, logoSize / 2 + 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = mergedOptions.fgColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw symbol inside center
    ctx.fillStyle = mergedOptions.fgColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.floor(logoSize * 0.5)}px sans-serif`;

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
  const mergedOptions = { ...DEFAULT_QR_OPTIONS, ...options };
  return await QRCode.toString(text, {
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
    inversionAttempts: 'dontInvert',
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
