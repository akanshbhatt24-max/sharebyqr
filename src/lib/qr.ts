import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { QRDesignOptions } from '../types';

export const DEFAULT_QR_OPTIONS: QRDesignOptions = {
  fgColor: '#000000',
  bgColor: '#FFFFFF',
  logo: 'none',
  errorCorrectionLevel: 'Q',
  margin: 4,
  size: 360,
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
    // Keep badge at 14% of size so it stays strictly inside the center without touching finder patterns
    const logoSize = Math.floor(mergedOptions.size * 0.14);
    const center = mergedOptions.size / 2;
    const badgeRadius = Math.floor(logoSize / 2) + 1;

    ctx.save();
    // Background circle for badge
    ctx.fillStyle = mergedOptions.bgColor;
    ctx.beginPath();
    ctx.arc(center, center, badgeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Subtle border
    ctx.strokeStyle = mergedOptions.fgColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw symbol inside center
    ctx.fillStyle = mergedOptions.fgColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.floor(logoSize * 0.54)}px sans-serif`;

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
  try {
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });

    if (code && code.data && code.data.trim().length > 0) {
      return { data: code.data, location: code.location };
    }
  } catch (err) {
    console.warn('jsQR scan error:', err);
  }
  return null;
}

/**
 * High-speed BarcodeDetector check if supported in browser (Chrome/Edge/Android/Safari 17+)
 */
let cachedBarcodeDetector: any = null;
let barcodeDetectorChecked = false;

export function getNativeBarcodeDetector(): any {
  if (!barcodeDetectorChecked) {
    barcodeDetectorChecked = true;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        cachedBarcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) {
        cachedBarcodeDetector = null;
      }
    }
  }
  return cachedBarcodeDetector;
}

/**
 * Scan QR code from an HTML Video element using native BarcodeDetector or downscaled jsQR
 */
export async function scanQRCodeFromVideo(
  video: HTMLVideoElement,
  workCanvas: HTMLCanvasElement
): Promise<string | null> {
  if (!video || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
    return null;
  }

  // 1. Try Hardware-Accelerated Native BarcodeDetector (1-2ms execution time)
  const nativeDetector = getNativeBarcodeDetector();
  if (nativeDetector) {
    try {
      const barcodes = await nativeDetector.detect(video);
      if (barcodes && barcodes.length > 0 && barcodes[0]?.rawValue) {
        return barcodes[0].rawValue.trim();
      }
    } catch {
      // Continue to canvas fallback
    }
  }

  // 2. Optimized jsQR fallback with downscaled resolution
  // Full 1080p is too slow for CPU jsQR; downscaling to max 640px makes jsQR 15x faster and 99% accurate
  const ctx = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const maxDim = 640;
  let targetW = vw;
  let targetH = vh;

  if (vw > maxDim || vh > maxDim) {
    if (vw > vh) {
      targetW = maxDim;
      targetH = Math.round((vh * maxDim) / vw);
    } else {
      targetH = maxDim;
      targetW = Math.round((vw * maxDim) / vh);
    }
  }

  if (workCanvas.width !== targetW || workCanvas.height !== targetH) {
    workCanvas.width = targetW;
    workCanvas.height = targetH;
  }

  ctx.drawImage(video, 0, 0, targetW, targetH);
  const imageData = ctx.getImageData(0, 0, targetW, targetH);
  const code = scanQRCodeFromImageData(imageData);
  if (code) {
    return code.data;
  }

  // If full image didn't match, also try center square crop (focus on the viewfinder frame)
  const cropSize = Math.floor(Math.min(targetW, targetH) * 0.7);
  const startX = Math.floor((targetW - cropSize) / 2);
  const startY = Math.floor((targetH - cropSize) / 2);
  const centerImageData = ctx.getImageData(startX, startY, cropSize, cropSize);
  const centerCode = scanQRCodeFromImageData(centerImageData);
  if (centerCode) {
    return centerCode.data;
  }

  return null;
}

/**
 * Scan QR code from File / Image Element with multi-scale resampling and BarcodeDetector
 */
export async function scanQRCodeFromImageFile(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const img = new Image();
      img.onload = async () => {
        // 1. Try Native BarcodeDetector directly on the loaded Image element
        const nativeDetector = getNativeBarcodeDetector();
        if (nativeDetector) {
          try {
            const barcodes = await nativeDetector.detect(img);
            if (barcodes && barcodes.length > 0 && barcodes[0]?.rawValue) {
              resolve(barcodes[0].rawValue.trim());
              return;
            }
          } catch {
            // Fallback to jsQR
          }
        }

        // 2. jsQR with Multi-scale Resampling
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }

        // Try at normalized resolution first (800px max)
        const scales = [800, 1200, Math.max(img.width, img.height)];
        for (const maxDim of scales) {
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              w = maxDim;
              h = Math.round((img.height * maxDim) / img.width);
            } else {
              h = maxDim;
              w = Math.round((img.width * maxDim) / img.height);
            }
          }

          canvas.width = w;
          canvas.height = h;
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);

          const imgData = ctx.getImageData(0, 0, w, h);
          const result = scanQRCodeFromImageData(imgData);
          if (result && result.data) {
            resolve(result.data.trim());
            return;
          }
        }

        resolve(null);
      };
      img.onerror = () => resolve(null);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
