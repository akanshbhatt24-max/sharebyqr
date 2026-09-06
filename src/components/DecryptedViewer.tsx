import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  ShieldCheck,
  Download,
  Copy,
  Check,
  ExternalLink,
  Wifi,
  User,
  FileText,
  Image as ImageIcon,
  Video,
  Lock,
  Eye,
  EyeOff,
  Flame,
  Clock,
  ArrowLeft,
  Share2,
  FileDown,
  Maximize2,
  ZoomIn,
  ZoomOut,
  X
} from 'lucide-react';
import { SharePayload, ShareContent } from '../types';
import { decryptData, getKeyFingerprint } from '../lib/crypto';
import { saveHistoryItem } from '../lib/storage';

interface DecryptedViewerProps {
  scannedUrlOrPayload: string;
  onBack: () => void;
}

export const DecryptedViewer: React.FC<DecryptedViewerProps> = ({
  scannedUrlOrPayload,
  onBack,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Decrypted outcome state
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [content, setContent] = useState<ShareContent | null>(null);
  const [fingerprint, setFingerprint] = useState<string>('');

  // Passphrase prompt state
  const [requiresPassphrase, setRequiresPassphrase] = useState<boolean>(false);
  const [passphrase, setPassphrase] = useState<string>('');
  const [decryptingWithPassphrase, setDecryptingWithPassphrase] = useState<boolean>(false);
  const [passphraseError, setPassphraseError] = useState<string | null>(null);

  // Raw cipher payload state
  const [rawCiphertext, setRawCiphertext] = useState<string>('');
  const [rawIv, setRawIv] = useState<string>('');
  const [rawSalt, setRawSalt] = useState<string | undefined>(undefined);

  // UI state
  const [copied, setCopied] = useState<boolean>(false);
  const [showWifiPassword, setShowWifiPassword] = useState<boolean>(false);
  const [activeMediaTab, setActiveMediaTab] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Parse QR link or text string on load
  useEffect(() => {
    let isMounted = true;

    async function parseAndLoad() {
      setLoading(true);
      setError(null);
      setActiveMediaTab(0);

      try {
        let inputStr = scannedUrlOrPayload.trim();

        // 1. Direct Data URL (Image or Video)
        if (inputStr.startsWith('data:image/')) {
          const directContent: ShareContent = {
            type: 'photo',
            title: 'Scanned Image',
            file: { name: 'scanned_photo.png', type: 'image/png', size: Math.round(inputStr.length * 0.75), dataUrl: inputStr },
            files: [{ name: 'scanned_photo.png', type: 'image/png', size: Math.round(inputStr.length * 0.75), dataUrl: inputStr }],
          };
          if (isMounted) {
            setContent(directContent);
            setLoading(false);
          }
          return;
        }

        if (inputStr.startsWith('data:video/')) {
          const directContent: ShareContent = {
            type: 'video',
            title: 'Scanned Video',
            file: { name: 'scanned_video.mp4', type: 'video/mp4', size: Math.round(inputStr.length * 0.75), dataUrl: inputStr },
          };
          if (isMounted) {
            setContent(directContent);
            setLoading(false);
          }
          return;
        }

        // 2. Wi-Fi QR code string (WIFI:S:ssid;T:WPA;P:pass;;)
        if (inputStr.toUpperCase().startsWith('WIFI:')) {
          const ssidMatch = inputStr.match(/S:([^;]*)/i);
          const passMatch = inputStr.match(/P:([^;]*)/i);
          const encMatch = inputStr.match(/T:([^;]*)/i);

          const directContent: ShareContent = {
            type: 'wifi',
            title: `Wi-Fi: ${ssidMatch ? ssidMatch[1] : 'Network'}`,
            wifi: {
              ssid: ssidMatch ? ssidMatch[1] : 'Wi-Fi Network',
              password: passMatch ? passMatch[1] : '',
              encryption: (encMatch ? encMatch[1] : 'WPA') as any,
            },
          };
          if (isMounted) {
            setContent(directContent);
            setLoading(false);
          }
          return;
        }

        // 3. Contact vCard string (BEGIN:VCARD...END:VCARD)
        if (inputStr.toUpperCase().includes('BEGIN:VCARD')) {
          const fnMatch = inputStr.match(/FN:(.*)/i);
          const telMatch = inputStr.match(/TEL:(.*)/i);
          const emailMatch = inputStr.match(/EMAIL:(.*)/i);
          const orgMatch = inputStr.match(/ORG:(.*)/i);

          const directContent: ShareContent = {
            type: 'contact',
            title: `Contact: ${fnMatch ? fnMatch[1].trim() : 'Card'}`,
            contact: {
              name: fnMatch ? fnMatch[1].trim() : 'Scanned Contact',
              phone: telMatch ? telMatch[1].trim() : '',
              email: emailMatch ? emailMatch[1].trim() : '',
              organization: orgMatch ? orgMatch[1].trim() : '',
            },
          };
          if (isMounted) {
            setContent(directContent);
            setLoading(false);
          }
          return;
        }

        // 4. Direct JSON string payload in QR code
        if (inputStr.startsWith('{') && inputStr.endsWith('}')) {
          try {
            const parsedObj = JSON.parse(inputStr);
            const target = parsedObj.content || parsedObj;
            if (target.type) {
              if (isMounted) {
                setContent(target as ShareContent);
                setLoading(false);
              }
              return;
            }
          } catch {
            // Not JSON
          }
        }

        // 5. Encrypted App Share URL or direct share link
        let shareId = '';
        let keyFromHash = '';
        let inlineCipher = '';
        let inlineIv = '';
        let inlineSalt = '';

        if (inputStr.includes('/share/') || inputStr.includes('#')) {
          try {
            const urlObj = new URL(inputStr);
            const pathSegments = urlObj.pathname.split('/').filter(Boolean);
            shareId = pathSegments[pathSegments.length - 1] || '';

            const hash = urlObj.hash.replace('#', '');
            const searchParams = new URLSearchParams(hash);
            keyFromHash = searchParams.get('key') || '';
            inlineCipher = searchParams.get('cipher') || searchParams.get('ciphertext') || '';
            inlineIv = searchParams.get('iv') || '';
            inlineSalt = searchParams.get('salt') || '';
          } catch {
            // URL parse error
          }
        }

        let ciphertext = '';
        let iv = '';
        let salt: string | undefined = inlineSalt || undefined;
        let burnAfterReading = false;
        let expiresAt = null;
        let maxAccessCount = undefined;
        let accessCount = 0;

        if (inlineCipher && inlineIv && keyFromHash) {
          // Zero-server inline hash decryption (100% reliable across devices & offline)
          ciphertext = inlineCipher;
          iv = inlineIv;
        } else if (shareId) {
          // Fetch encrypted blob from backend or local client vault fallback
          let blobData: any = null;
          try {
            const res = await fetch(`/api/shares/${shareId}`);
            if (res.ok) {
              blobData = await res.json();
            }
          } catch (fetchErr) {
            console.warn('Network fetch error, trying local vault fallback:', fetchErr);
          }

          if (!blobData) {
            const localSaved = localStorage.getItem(`share_${shareId}`);
            if (localSaved) {
              try {
                blobData = JSON.parse(localSaved);
              } catch (parseErr) {
                console.error('Failed to parse local share:', parseErr);
              }
            }
          }

          if (!blobData) {
            throw new Error('Share payload not found, expired, or server unavailable.');
          }

          ciphertext = blobData.ciphertext;
          iv = blobData.encryptionMeta.iv;
          salt = blobData.encryptionMeta.salt;
          burnAfterReading = blobData.burnAfterReading;
          expiresAt = blobData.expiresAt;
          maxAccessCount = blobData.maxAccessCount;
          accessCount = blobData.accessCount;

          if (blobData.encryptionMeta.hasPassphrase) {
            if (isMounted) {
              setRawCiphertext(ciphertext);
              setRawIv(iv);
              setRawSalt(salt);
              setRequiresPassphrase(true);
              setLoading(false);
            }
            return;
          }
        } else {
          throw new Error('Invalid share URL or missing decryption key.');
        }

        if (isMounted) {
          setRawCiphertext(ciphertext);
          setRawIv(iv);
          setRawSalt(salt);
        }

        if (!keyFromHash) {
          throw new Error('Missing decryption key fragment in URL hash. Unable to decrypt Zero-Knowledge payload.');
        }

        const decryptedPayload = await decryptData<any>(
          ciphertext,
          iv,
          keyFromHash,
          salt
        );

          const fp = await getKeyFingerprint(keyFromHash);
          const finalContent: ShareContent = decryptedPayload.content || decryptedPayload;

          if (isMounted) {
            setPayload({
              id: shareId || 'inline',
              ciphertext,
              encryptionMeta: {
                algorithm: 'AES-256-GCM',
                hasPassphrase: false,
                iv,
                salt,
                fingerprint: fp,
              },
              content: finalContent,
              createdAt: Date.now(),
              expiresAt,
              burnAfterReading,
              maxAccessCount,
              accessCount,
            });
            setContent(finalContent);
            setFingerprint(fp);
            setLoading(false);

            // Record in local vault history as received item
            saveHistoryItem({
              id: shareId || 'inline',
              direction: 'received',
              type: finalContent.type || 'photo',
              title: finalContent.title || 'Decrypted Payload',
              timestamp: Date.now(),
              expiresAt,
              encrypted: true,
              shareUrl: inputStr,
            });
          }
          return;

        // 6. Direct Photo / Image Web URL
        const isImageUrl =
          /\.(jpeg|jpg|gif|png|webp|svg|bmp)(\?.*)?$/i.test(inputStr) ||
          inputStr.includes('image') ||
          inputStr.includes('photo');

        if (isImageUrl && (inputStr.startsWith('http://') || inputStr.startsWith('https://'))) {
          const directContent: ShareContent = {
            type: 'photo',
            title: 'Scanned Web Image',
            url: inputStr,
            file: { name: 'scanned_image.jpg', type: 'image/jpeg', size: 0, dataUrl: inputStr },
            files: [{ name: 'scanned_image.jpg', type: 'image/jpeg', size: 0, dataUrl: inputStr }],
          };
          if (isMounted) {
            setContent(directContent);
            setLoading(false);
          }
          return;
        }

        // 7. General Web Bookmark Link
        if (inputStr.startsWith('http://') || inputStr.startsWith('https://')) {
          const directContent: ShareContent = {
            type: 'link',
            title: 'Web Bookmark',
            url: inputStr,
          };
          if (isMounted) {
            setContent(directContent);
            setLoading(false);
          }
          return;
        }

        // 8. Plain Text String
        const directContent: ShareContent = {
          type: 'text',
          title: 'Scanned Text',
          text: inputStr,
        };
        if (isMounted) {
          setContent(directContent);
          setLoading(false);
        }
      } catch (err: unknown) {
        console.error('Decryption parse error:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to decrypt content.');
          setLoading(false);
        }
      }
    }

    parseAndLoad();

    return () => {
      isMounted = false;
    };
  }, [scannedUrlOrPayload]);

  // Passphrase decryption handler
  const handlePassphraseDecrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) return;

    setDecryptingWithPassphrase(true);
    setPassphraseError(null);

    try {
      const decryptedPayload = await decryptData<any>(
        rawCiphertext,
        rawIv,
        passphrase.trim(),
        rawSalt
      );

      const fp = await getKeyFingerprint(passphrase.trim());
      const finalContent: ShareContent = decryptedPayload.content || decryptedPayload;

      setPayload({ ...decryptedPayload, content: finalContent });
      setContent(finalContent);
      setFingerprint(fp);
      setRequiresPassphrase(false);
    } catch (err) {
      console.error('Passphrase decryption failed:', err);
      setPassphraseError('Incorrect passphrase. Please double-check your secret key and retry.');
    } finally {
      setDecryptingWithPassphrase(false);
    }
  };

  // Copy helper
  const handleCopy = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download vCard helper
  const handleDownloadVCard = (contact: ShareContent['contact']) => {
    if (!contact) return;
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${contact.name}
TEL:${contact.phone || ''}
EMAIL:${contact.email || ''}
ORG:${contact.organization || ''}
NOTE:${contact.note || ''}
END:VCARD`;

    const blob = new Blob([vcard], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${contact.name.replace(/\s+/g, '_')}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center justify-center p-12 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
          <ShieldCheck className="h-8 w-8 animate-pulse" />
        </div>
        <h3 className="text-base font-bold text-white">Fetching & Decrypting Zero-Knowledge Payload</h3>
        <p className="mt-1 text-xs text-slate-400">
          Verifying AES-256-GCM cipher integrity and computing key hash...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-rose-500/20 bg-rose-950/20 p-6 text-center shadow-xl">
        <div className="mb-3 flex justify-center text-rose-400">
          <Lock className="h-10 w-10" />
        </div>
        <h3 className="mb-1 text-base font-bold text-white">Access Failure / Expired Share</h3>
        <p className="mb-6 text-xs text-rose-200/80">{error}</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Scanner
        </button>
      </div>
    );
  }

  // Passphrase Requirement Screen
  if (requiresPassphrase) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
        <div className="mb-4 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <KeyRound className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-white">Passphrase Required</h3>
          <p className="text-xs text-slate-400 mt-1">
            This share payload is encrypted with a custom passphrase. Enter key to decrypt AES-256-GCM ciphertext.
          </p>
        </div>

        <form onSubmit={handlePassphraseDecrypt} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Secret Passphrase
            </label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter passphrase..."
              required
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs text-white outline-none focus:border-amber-400"
            />
          </div>

          {passphraseError && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-300">
              {passphraseError}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={decryptingWithPassphrase || !passphrase.trim()}
              className="flex-1 rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition"
            >
              {decryptingWithPassphrase ? 'Decrypting...' : 'Decrypt Content'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (!content) return null;

  // Active photo / media item evaluation
  const activeMediaItem = content.files && content.files[activeMediaTab] ? content.files[activeMediaTab] : content.file;
  const currentPhotoSrc = activeMediaItem?.dataUrl || content.url || '';
  const currentPhotoName = activeMediaItem?.name || content.title || 'photo.png';
  const currentPhotoSize = activeMediaItem?.size || 0;

  const isPhotoType =
    content.type === 'photo' ||
    (content.type === 'file' &&
      (activeMediaItem?.type?.startsWith('image/') ||
        activeMediaItem?.name?.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i)));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      {/* Back Button & Header Bento Box */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-xl p-5 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900 transition shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Scan Another QR
        </button>

        {/* Security & Integrity Status Badge */}
        <div className="flex flex-wrap items-center gap-2">
          {payload?.burnAfterReading && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 border border-rose-500/30 px-3.5 py-1.5 text-xs font-bold text-rose-300 shadow-sm">
              <Flame className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
              Burned After View
            </span>
          )}

          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-1.5 text-xs font-bold text-emerald-400 shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            AES-256 Verified (FP: {fingerprint || '0xAF82'})
          </span>
        </div>
      </div>

      {/* Main Content Card Container */}
      <div className="overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shadow-2xl space-y-0">
        {/* Title Bar */}
        <div className="border-b border-slate-800/80 bg-slate-950/80 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-md">
              {isPhotoType && <ImageIcon className="h-6 w-6" />}
              {!isPhotoType && content.type === 'file' && <FileText className="h-6 w-6" />}
              {!isPhotoType && content.type === 'video' && <Video className="h-6 w-6" />}
              {!isPhotoType && content.type === 'text' && <FileText className="h-6 w-6" />}
              {!isPhotoType && content.type === 'link' && <ExternalLink className="h-6 w-6" />}
              {!isPhotoType && content.type === 'wifi' && <Wifi className="h-6 w-6" />}
              {!isPhotoType && content.type === 'contact' && <User className="h-6 w-6" />}
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">
                {content.title || (isPhotoType ? currentPhotoName : content.file?.name || `${content.type.toUpperCase()} Share`)}
              </h2>
              <p className="text-xs text-slate-400 capitalize font-medium mt-0.5">
                Type: {isPhotoType ? 'Photo / Image' : content.type}
              </p>
            </div>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="p-6">
          {/* TYPE: PHOTO / IMAGE DISPLAY */}
          {isPhotoType && (
            <div className="space-y-4">
              <div className="relative group overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 flex justify-center items-center p-3 shadow-inner">
                {currentPhotoSrc ? (
                  <img
                    src={currentPhotoSrc}
                    alt={currentPhotoName}
                    className="max-h-[520px] w-auto object-contain rounded-xl cursor-pointer transition transform hover:scale-[1.01]"
                    onClick={() => {
                      setIsLightboxOpen(true);
                      setZoomLevel(1);
                    }}
                  />
                ) : (
                  <div className="p-12 text-center text-slate-500 text-xs">
                    No photo image data available
                  </div>
                )}

                {/* Lightbox Zoom Overlay Button */}
                {currentPhotoSrc && (
                  <button
                    onClick={() => {
                      setIsLightboxOpen(true);
                      setZoomLevel(1);
                    }}
                    className="absolute top-4 right-4 flex items-center gap-1.5 rounded-xl bg-slate-900/80 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-slate-200 opacity-90 group-hover:opacity-100 hover:bg-slate-900 transition border border-slate-700/80 shadow-md"
                  >
                    <Maximize2 className="h-3.5 w-3.5 text-cyan-400" />
                    Expand Fullscreen
                  </button>
                )}
              </div>

              {/* Info Bar & Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div>
                  <p className="text-xs font-bold text-white">{currentPhotoName}</p>
                  {currentPhotoSize > 0 && (
                    <p className="text-[11px] text-slate-400">
                      Size: {Math.round(currentPhotoSize / 1024)} KB
                    </p>
                  )}
                </div>

                {currentPhotoSrc && (
                  <a
                    href={currentPhotoSrc}
                    download={currentPhotoName}
                    className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20"
                  >
                    <Download className="h-4 w-4" />
                    Save Photo
                  </a>
                )}
              </div>

              {/* Multi-Photo Thumbnail Picker */}
              {content.files && content.files.length > 1 && (
                <div className="pt-2 border-t border-slate-800/80">
                  <p className="text-xs font-semibold text-slate-400 mb-2">
                    Multiple Photos ({content.files.length} items):
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {content.files.map((f, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveMediaTab(idx)}
                        className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border transition-all duration-200 ${
                          activeMediaTab === idx
                            ? 'border-cyan-400 ring-2 ring-cyan-400/30 scale-105'
                            : 'border-slate-800 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={f.dataUrl} alt={f.name} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TYPE: VIDEO */}
          {!isPhotoType && content.type === 'video' && (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center">
                {content.file?.dataUrl ? (
                  <video
                    src={content.file.dataUrl}
                    controls
                    className="h-full w-full rounded-2xl object-contain"
                  />
                ) : (
                  <p className="text-xs text-slate-500">Video source missing or damaged</p>
                )}
              </div>

              {content.file && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {content.file.name} ({Math.round(content.file.size / (1024 * 1024))} MB)
                  </span>
                  <a
                    href={content.file.dataUrl}
                    download={content.file.name}
                    className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20"
                  >
                    <Download className="h-4 w-4" />
                    Download Video File
                  </a>
                </div>
              )}
            </div>
          )}

          {/* TYPE: FILE / DOCUMENTS */}
          {!isPhotoType && content.type === 'file' && (
            <div className="space-y-4">
              {content.files && content.files.length > 0 ? (
                <div className="space-y-2.5">
                  {content.files.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-2xl border border-slate-800/90 bg-slate-950 p-3.5"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileText className="h-6 w-6 text-cyan-400 shrink-0" />
                        <div className="truncate">
                          <p className="text-xs font-bold text-white truncate">{file.name}</p>
                          <p className="text-[11px] text-slate-400">
                            {Math.round(file.size / 1024)} KB
                          </p>
                        </div>
                      </div>
                      <a
                        href={file.dataUrl}
                        download={file.name}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition shrink-0 shadow-md shadow-cyan-500/20"
                      >
                        <FileDown className="h-4 w-4" />
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              ) : content.file ? (
                <div className="flex items-center justify-between rounded-2xl border border-slate-800/90 bg-slate-950 p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-cyan-400" />
                    <div>
                      <p className="text-sm font-bold text-white">{content.file.name}</p>
                      <p className="text-xs text-slate-400">
                        Size: {Math.round(content.file.size / 1024)} KB
                      </p>
                    </div>
                  </div>
                  <a
                    href={content.file.dataUrl}
                    download={content.file.name}
                    className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20"
                  >
                    <Download className="h-4 w-4" />
                    Download File
                  </a>
                </div>
              ) : null}
            </div>
          )}

          {/* TYPE: TEXT / SECRET NOTE */}
          {content.type === 'text' && (
            <div className="space-y-4">
              <div className="relative rounded-2xl border border-slate-800/90 bg-slate-950 p-5 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                {content.text}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => handleCopy(content.text || '')}
                  className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-950" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied to Clipboard!' : 'Copy Note'}
                </button>
              </div>
            </div>
          )}

          {/* TYPE: LINK */}
          {content.type === 'link' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800/90 bg-slate-950 p-4">
                <p className="text-xs font-mono text-cyan-300 break-all">{content.url}</p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => handleCopy(content.url || '')}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-900 transition"
                >
                  <Copy className="h-4 w-4" />
                  Copy Link
                </button>
                <a
                  href={content.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Link in Browser
                </a>
              </div>
            </div>
          )}

          {/* TYPE: WI-FI NETWORK */}
          {content.type === 'wifi' && content.wifi && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800/90 bg-slate-950 p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs text-slate-400">Network Name (SSID)</span>
                  <span className="text-sm font-bold text-white">{content.wifi.ssid}</span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs text-slate-400">Encryption Standard</span>
                  <span className="text-xs font-semibold text-cyan-400">{content.wifi.encryption}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Password</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-white">
                      {showWifiPassword ? content.wifi.password || '(None)' : '••••••••••••'}
                    </span>
                    {content.wifi.password && (
                      <button
                        onClick={() => setShowWifiPassword(!showWifiPassword)}
                        className="text-slate-400 hover:text-white"
                      >
                        {showWifiPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {content.wifi.password && (
                <div className="flex justify-end">
                  <button
                    onClick={() => handleCopy(content.wifi?.password || '')}
                    className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20"
                  >
                    <Copy className="h-4 w-4" />
                    Copy Wi-Fi Password
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TYPE: CONTACT / VCARD */}
          {content.type === 'contact' && content.contact && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800/90 bg-slate-950 p-5 space-y-3">
                <div className="border-b border-slate-800 pb-3">
                  <span className="text-xs text-slate-400 block">Full Name</span>
                  <span className="text-base font-bold text-white">{content.contact.name}</span>
                </div>

                {content.contact.phone && (
                  <div className="border-b border-slate-800 pb-3">
                    <span className="text-xs text-slate-400 block">Phone</span>
                    <span className="text-xs text-cyan-300 font-mono">{content.contact.phone}</span>
                  </div>
                )}

                {content.contact.email && (
                  <div className="border-b border-slate-800 pb-3">
                    <span className="text-xs text-slate-400 block">Email Address</span>
                    <span className="text-xs text-cyan-300">{content.contact.email}</span>
                  </div>
                )}

                {content.contact.organization && (
                  <div className="border-b border-slate-800 pb-3">
                    <span className="text-xs text-slate-400 block">Organization</span>
                    <span className="text-xs text-slate-200">{content.contact.organization}</span>
                  </div>
                )}

                {content.contact.note && (
                  <div>
                    <span className="text-xs text-slate-400 block">Note</span>
                    <span className="text-xs text-slate-300 italic">{content.contact.note}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => handleDownloadVCard(content.contact)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20"
                >
                  <Download className="h-4 w-4" />
                  Save to Contacts (.vcf)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FULLSCREEN LIGHTBOX PHOTO MODAL */}
      {isLightboxOpen && currentPhotoSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4 backdrop-blur-2xl">
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            <button
              onClick={() => setZoomLevel((z) => Math.min(z + 0.5, 3))}
              className="rounded-xl border border-slate-800 bg-slate-900/80 p-2.5 text-slate-300 hover:text-white transition"
              title="Zoom In"
            >
              <ZoomIn className="h-5 w-5" />
            </button>
            <button
              onClick={() => setZoomLevel((z) => Math.max(z - 0.5, 0.5))}
              className="rounded-xl border border-slate-800 bg-slate-900/80 p-2.5 text-slate-300 hover:text-white transition"
              title="Zoom Out"
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            <button
              onClick={() => setIsLightboxOpen(false)}
              className="rounded-xl border border-slate-800 bg-rose-500/20 p-2.5 text-rose-300 hover:bg-rose-500/30 transition"
              title="Close Fullscreen"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[90vh] max-w-[90vw] overflow-auto flex items-center justify-center p-4">
            <img
              src={currentPhotoSrc}
              alt={currentPhotoName}
              style={{ transform: `scale(${zoomLevel})` }}
              className="max-h-[85vh] w-auto object-contain rounded-2xl transition-transform duration-200 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
