import React, { useState, useEffect, useMemo } from 'react';
import {
  Upload,
  Link2,
  FileText,
  KeyRound,
  Wifi,
  User,
  Image as ImageIcon,
  Video,
  Download,
  Copy,
  Check,
  Lock,
  Eye,
  EyeOff,
  Flame,
  Clock,
  Sparkles,
  RefreshCw,
  Printer,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Scan,
} from 'lucide-react';
import { ContentType, FileData, ShareContent, QRDesignOptions } from '../types';
import { encryptData } from '../lib/crypto';
import {
  generateQRCodeDataUrl,
  generateQRCodeSVG,
  formatWifiQR,
  formatVCardQR,
  DEFAULT_QR_OPTIONS,
} from '../lib/qr';
import { saveHistoryItem } from '../lib/storage';
import { QRCustomizer } from './QRCustomizer';

interface ShareFormProps {
  onCreatedShare?: (shareUrl: string) => void;
}

function generateLocalId(): string {
  const chars = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHGHJKLMNPQRSTUVWXYZ';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export const ShareForm: React.FC<ShareFormProps> = ({ onCreatedShare }) => {
  // Default to 'link' for instant user delight
  const [contentType, setContentType] = useState<ContentType>('link');

  // Mode: 'direct' for universal native camera scan, 'encrypted' for AES-256 vault
  const [shareMode, setShareMode] = useState<'direct' | 'encrypted'>('direct');

  // Common metadata
  const [title, setTitle] = useState<string>('');

  // Form states
  const [urlData, setUrlData] = useState<string>('https://google.com');
  const [textData, setTextData] = useState<string>('');
  const [filesList, setFilesList] = useState<FileData[]>([]);

  // Contact form state
  const [contactName, setContactName] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');
  const [contactOrg, setContactOrg] = useState<string>('');

  // Wi-Fi form state
  const [wifiSsid, setWifiSsid] = useState<string>('');
  const [wifiPassword, setWifiPassword] = useState<string>('');
  const [wifiEncryption, setWifiEncryption] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
  const [showWifiPass, setShowWifiPass] = useState<boolean>(false);

  // Security options (for Encrypted Vault mode)
  const [usePassphrase, setUsePassphrase] = useState<boolean>(false);
  const [passphrase, setPassphrase] = useState<string>('');
  const [burnAfterReading, setBurnAfterReading] = useState<boolean>(false);
  const [expiration, setExpiration] = useState<string>('86400'); // 24 hours
  const [maxAccessLimit, setMaxAccessLimit] = useState<string>('unlimited');

  // QR Customization options
  const [qrOptions, setQrOptions] = useState<QRDesignOptions>({
    ...DEFAULT_QR_OPTIONS,
    logo: 'none',
  });

  // Processing state
  const [isEncrypting, setIsEncrypting] = useState<boolean>(false);
  const [generatedShareUrl, setGeneratedShareUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isVaultOnly = contentType === 'file' || contentType === 'photo' || contentType === 'video';

  // Compute the raw QR string for direct scanning
  const directQRContent = useMemo(() => {
    if (contentType === 'link') {
      const clean = urlData.trim();
      if (!clean) return 'https://google.com';
      return clean.startsWith('http://') || clean.startsWith('https://') ? clean : `https://${clean}`;
    }
    if (contentType === 'wifi') {
      return formatWifiQR(wifiSsid.trim() || 'MyWiFi', wifiPassword, wifiEncryption);
    }
    if (contentType === 'contact') {
      return formatVCardQR(contactName.trim() || 'John Doe', contactPhone.trim(), contactEmail.trim(), contactOrg.trim());
    }
    if (contentType === 'text') {
      return textData.trim() || 'Hello from sharebyQR!';
    }
    return '';
  }, [contentType, urlData, textData, wifiSsid, wifiPassword, wifiEncryption, contactName, contactPhone, contactEmail, contactOrg]);

  // Determine what string to encode in QR
  const activeQRText = useMemo(() => {
    if (isVaultOnly) {
      return generatedShareUrl || `${window.location.origin}/#vault-pending`;
    }
    if (shareMode === 'direct') {
      return directQRContent;
    }
    return generatedShareUrl || directQRContent;
  }, [isVaultOnly, shareMode, directQRContent, generatedShareUrl]);

  // Real-time live QR code generation
  useEffect(() => {
    let isCancelled = false;

    async function updateQR() {
      try {
        const textToEncode = activeQRText || 'https://google.com';
        const dataUrl = await generateQRCodeDataUrl(textToEncode, qrOptions);
        if (!isCancelled) {
          setQrDataUrl(dataUrl);
          setStatusMessage(null);
        }
      } catch (err: any) {
        console.warn('Real-time QR generation error:', err);
        if (!isCancelled && err?.message?.includes('too big')) {
          setStatusMessage({
            type: 'error',
            text: 'The text or data is too large to fit in a single QR code. Please shorten your text or use Encrypted Vault share mode.'
          });
        }
      }
    }

    updateQR();

    return () => {
      isCancelled = true;
    };
  }, [activeQRText, qrOptions]);

  // Handle file picker selection
  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setStatusMessage(null);
    const newFilesList: FileData[] = [];
    let count = 0;

    Array.from(selectedFiles).forEach((f: File) => {
      // 15MB limit per file to safely fit inside container payload limits
      if (f.size > 15 * 1024 * 1024) {
        setStatusMessage({
          type: 'error',
          text: `File "${f.name}" exceeds 15MB limit. Please choose a smaller file.`
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataUrl = evt.target?.result as string;
        newFilesList.push({
          name: f.name,
          type: f.type,
          size: f.size,
          dataUrl,
        });

        count += 1;
        if (count === selectedFiles.length) {
          setFilesList((prev) => [...prev, ...newFilesList]);
        }
      };
      reader.readAsDataURL(f);
    });
  };

  // Action for Direct Mode: Validate and focus/scroll to QR
  const handleGenerateDirectQR = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (contentType === 'link' && !urlData.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a website link URL.' });
      return;
    }
    if (contentType === 'wifi' && !wifiSsid.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter Wi-Fi network name (SSID).' });
      return;
    }
    if (contentType === 'contact' && !contactName.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a contact name.' });
      return;
    }
    if (contentType === 'text' && !textData.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter text content.' });
      return;
    }

    setStatusMessage({
      type: 'success',
      text: 'Universal QR Code generated! You can download PNG/SVG or print it below.'
    });

    // Smooth scroll to QR box on mobile
    const qrBox = document.getElementById('qr-preview-card');
    if (qrBox && window.innerWidth < 1024) {
      qrBox.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Generate Encrypted Share in Zero-Knowledge Vault
  const handleGenerateEncryptedShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEncrypting(true);
    setStatusMessage(null);

    try {
      let shareContent: ShareContent;

      if (contentType === 'file' || contentType === 'photo' || contentType === 'video') {
        if (filesList.length === 0) {
          throw new Error('Please select at least one file or photo/video first.');
        }
        shareContent = {
          type: contentType,
          title: title || filesList[0].name,
          file: filesList[0],
          files: filesList,
        };
      } else if (contentType === 'text') {
        if (!textData.trim()) throw new Error('Please enter text content.');
        shareContent = {
          type: 'text',
          title: title || 'Secret Note',
          text: textData,
        };
      } else if (contentType === 'link') {
        if (!urlData.trim()) throw new Error('Please enter a valid URL link.');
        shareContent = {
          type: 'link',
          title: title || 'Web Bookmark',
          url: urlData.startsWith('http') ? urlData : `https://${urlData}`,
        };
      } else if (contentType === 'wifi') {
        if (!wifiSsid.trim()) throw new Error('Please enter Wi-Fi network SSID name.');
        shareContent = {
          type: 'wifi',
          title: title || `Wi-Fi: ${wifiSsid}`,
          wifi: {
            ssid: wifiSsid,
            password: wifiPassword,
            encryption: wifiEncryption,
          },
        };
      } else {
        if (!contactName.trim()) throw new Error('Please enter contact full name.');
        shareContent = {
          type: 'contact',
          title: title || `Contact: ${contactName}`,
          contact: {
            name: contactName,
            phone: contactPhone,
            email: contactEmail,
            organization: contactOrg,
          },
        };
      }

      // AES-256-GCM Web Crypto Encryption
      const secretPass = usePassphrase && passphrase.trim() ? passphrase.trim() : undefined;
      const payloadToEncrypt = {
        ...shareContent,
        content: shareContent,
      };
      const encryptedRes = await encryptData(payloadToEncrypt as unknown as Record<string, unknown>, secretPass);

      // Expiration timestamp
      let expiresAt: number | null = null;
      if (expiration !== 'never') {
        expiresAt = Date.now() + Number(expiration) * 1000;
      }

      const maxAccess = maxAccessLimit !== 'unlimited' ? Number(maxAccessLimit) : undefined;
      const payloadBody = {
        ciphertext: encryptedRes.ciphertextBase64,
        encryptionMeta: {
          algorithm: 'AES-256-GCM',
          hasPassphrase: encryptedRes.hasPassphrase,
          iv: encryptedRes.ivBase64,
          salt: encryptedRes.saltBase64,
          fingerprint: encryptedRes.fingerprint,
        },
        expiresAt,
        burnAfterReading,
        maxAccessCount: maxAccess,
      };

      let shareId = '';

      // Send ciphertext to server vault
      try {
        const response = await fetch('/api/shares', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadBody),
        });

        if (response.ok) {
          const serverRes = await response.json();
          shareId = serverRes.id;
        } else {
          console.warn('Server vault returned non-OK, using local vault fallback');
        }
      } catch (fetchErr) {
        console.warn('Network error reaching server vault, using local fallback:', fetchErr);
      }

      // If server was unreachable, generate fallback client ID
      if (!shareId) {
        shareId = generateLocalId();
      }

      // Save a local copy in browser storage so viewer can decrypt even if server is offline
      try {
        localStorage.setItem(`share_${shareId}`, JSON.stringify({
          id: shareId,
          ...payloadBody,
          createdAt: Date.now(),
          accessCount: 0,
        }));
      } catch (storageErr) {
        console.warn('Local storage write warning:', storageErr);
      }

      // Construct Zero-Knowledge link (inline hash for short notes/links, or server vault key for larger files)
      const baseUrl = window.location.origin;
      let fullShareUrl = `${baseUrl}/share/${shareId}`;

      if (!encryptedRes.hasPassphrase && encryptedRes.rawKeyHex) {
        if (encryptedRes.ciphertextBase64.length < 1500) {
          const cipherEnc = encodeURIComponent(encryptedRes.ciphertextBase64);
          const ivEnc = encodeURIComponent(encryptedRes.ivBase64);
          const saltEnc = encryptedRes.saltBase64 ? `&salt=${encodeURIComponent(encryptedRes.saltBase64)}` : '';
          fullShareUrl = `${baseUrl}/share/${shareId}#cipher=${cipherEnc}&iv=${ivEnc}${saltEnc}&key=${encryptedRes.rawKeyHex}`;
        } else {
          fullShareUrl += `#key=${encryptedRes.rawKeyHex}`;
        }
      }

      setGeneratedShareUrl(fullShareUrl);

      // Save to local vault history
      saveHistoryItem({
        id: shareId,
        direction: 'sent',
        type: contentType,
        title: shareContent.title || 'Encrypted Vault Share',
        timestamp: Date.now(),
        expiresAt,
        encrypted: true,
        shareUrl: fullShareUrl,
      });

      setStatusMessage({
        type: 'success',
        text: 'Encrypted Vault QR Code created with AES-256-GCM! Ready to share.'
      });

      if (onCreatedShare) {
        onCreatedShare(fullShareUrl);
      }

      // Scroll to QR on mobile
      const qrBox = document.getElementById('qr-preview-card');
      if (qrBox && window.innerWidth < 1024) {
        qrBox.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err: unknown) {
      console.error('Share generation error:', err);
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error creating encrypted share.'
      });
    } finally {
      setIsEncrypting(false);
    }
  };

  // Copy share link or text
  const handleCopy = async () => {
    const textToCopy = generatedShareUrl || directQRContent;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = textToCopy;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Download SVG
  const handleDownloadSVG = async () => {
    const textToEncode = activeQRText || 'https://google.com';
    const svgStr = await generateQRCodeSVG(textToEncode, qrOptions);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sharebyQR_${contentType}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print QR Code
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR Code - sharebyQR</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: #fff;
              color: #1e293b;
              text-align: center;
              padding: 24px;
            }
            .card {
              border: 2px solid #e2e8f0;
              border-radius: 24px;
              padding: 32px;
              max-width: 360px;
              box-shadow: 0 10px 25px rgba(0,0,0,0.05);
            }
            img { width: 280px; height: 280px; display: block; margin: 0 auto; }
            h2 { margin: 16px 0 8px; font-size: 20px; }
            p { margin: 4px 0; font-size: 13px; color: #64748b; }
            .badge { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 600; margin-bottom: 16px; }
          </style>
        </head>
        <body>
          <div class="card">
            <span class="badge">sharebyQR</span>
            <img src="${qrDataUrl}" alt="QR Code" />
            <h2>${title || (contentType.charAt(0).toUpperCase() + contentType.slice(1) + ' QR')}</h2>
            <p>${shareMode === 'direct' ? 'Scan with any smartphone camera' : 'Encrypted with AES-256-GCM'}</p>
          </div>
          <script>
            window.onload = () => { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      {/* Content Selector Bento Pills */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-xl p-4 shadow-2xl">
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Content Type</p>
          <div className="flex items-center gap-1.5 text-xs text-cyan-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="font-semibold text-[11px]">Instant QR Generator</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 md:grid-cols-7">
          {[
            { id: 'link', label: 'Link', icon: Link2 },
            { id: 'text', label: 'Text Note', icon: KeyRound },
            { id: 'wifi', label: 'Wi-Fi', icon: Wifi },
            { id: 'contact', label: 'Contact', icon: User },
            { id: 'file', label: 'Files', icon: FileText },
            { id: 'photo', label: 'Photos', icon: ImageIcon },
            { id: 'video', label: 'Videos', icon: Video },
          ].map((tab) => {
            const IconComp = tab.icon;
            const isSelected = contentType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setContentType(tab.id as ContentType);
                  setGeneratedShareUrl(null);
                  setStatusMessage(null);
                  if (tab.id === 'file' || tab.id === 'photo' || tab.id === 'video') {
                    setShareMode('encrypted');
                  }
                }}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-3.5 text-center transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'border-cyan-400/80 bg-cyan-500/20 text-cyan-300 font-bold shadow-lg shadow-cyan-500/15 ring-1 ring-cyan-500/30'
                    : 'border-slate-800/90 bg-slate-950/80 text-slate-400 hover:text-slate-200 hover:border-slate-700/80'
                }`}
              >
                <IconComp className="h-5 w-5" />
                <span className="text-xs">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Input Form & Security Options */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-6 shadow-2xl space-y-5">
            {/* Mode Selector for text, link, wifi, contact */}
            {!isVaultOnly && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-1.5 flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setShareMode('direct');
                    setStatusMessage(null);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                    shareMode === 'direct'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Zap className="h-3.5 w-3.5" />
                  Universal Direct QR (Any Camera)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShareMode('encrypted');
                    setStatusMessage(null);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                    shareMode === 'encrypted'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Lock className="h-3.5 w-3.5" />
                  Encrypted Vault (Zero-Knowledge)
                </button>
              </div>
            )}

            {/* Share Title */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Title / Label (Optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. My Website, Office Guest Wi-Fi, Secret Note"
                className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-white outline-none focus:border-cyan-400 transition font-medium"
              />
            </div>

            {/* TAB: LINK */}
            {contentType === 'link' && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Target Website URL
                </label>
                <input
                  type="text"
                  value={urlData}
                  onChange={(e) => {
                    setUrlData(e.target.value);
                    setGeneratedShareUrl(null);
                    setStatusMessage(null);
                  }}
                  placeholder="https://example.com"
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-white font-mono outline-none focus:border-cyan-400 transition"
                />
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Updates instantly as you type. Scans with iPhone Camera, Android Camera, or Google Lens.
                </p>
              </div>
            )}

            {/* TAB: SECRET TEXT */}
            {contentType === 'text' && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Text Content / Secret Note
                </label>
                <textarea
                  value={textData}
                  onChange={(e) => {
                    setTextData(e.target.value);
                    setGeneratedShareUrl(null);
                    setStatusMessage(null);
                  }}
                  placeholder="Type or paste any note, message, or recovery keys..."
                  rows={4}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs text-white font-mono outline-none focus:border-cyan-400 transition"
                />
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Instant live QR generation. Characters update in real-time.
                </p>
              </div>
            )}

            {/* TAB: WI-FI */}
            {contentType === 'wifi' && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                    Network Name (SSID)
                  </label>
                  <input
                    type="text"
                    value={wifiSsid}
                    onChange={(e) => {
                      setWifiSsid(e.target.value);
                      setGeneratedShareUrl(null);
                      setStatusMessage(null);
                    }}
                    placeholder="e.g. Home_5G_Fiber"
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-white outline-none focus:border-cyan-400 transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300">Security Type</label>
                    <select
                      value={wifiEncryption}
                      onChange={(e) => {
                        setWifiEncryption(e.target.value as 'WPA' | 'WEP' | 'nopass');
                        setGeneratedShareUrl(null);
                      }}
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3.5 py-3 text-xs text-white outline-none focus:border-cyan-400 transition"
                    >
                      <option value="WPA">WPA / WPA2 / WPA3</option>
                      <option value="WEP">WEP</option>
                      <option value="nopass">None (Open)</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                      Wi-Fi Password
                    </label>
                    <div className="relative">
                      <input
                        type={showWifiPass ? 'text' : 'password'}
                        value={wifiPassword}
                        onChange={(e) => {
                          setWifiPassword(e.target.value);
                          setGeneratedShareUrl(null);
                        }}
                        placeholder="Password"
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-white outline-none focus:border-cyan-400 pr-10 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowWifiPass(!showWifiPass)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-white"
                      >
                        {showWifiPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Standard Wi-Fi format. Any phone camera can scan this to auto-join the Wi-Fi network immediately.
                </p>
              </div>
            )}

            {/* TAB: CONTACT */}
            {contentType === 'contact' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300">Full Name</label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => {
                        setContactName(e.target.value);
                        setGeneratedShareUrl(null);
                        setStatusMessage(null);
                      }}
                      placeholder="Jane Doe"
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-white outline-none focus:border-cyan-400 transition"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300">Phone Number</label>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => {
                        setContactPhone(e.target.value);
                        setGeneratedShareUrl(null);
                      }}
                      placeholder="+1 (555) 019-2834"
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-white outline-none focus:border-cyan-400 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300">Email Address</label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => {
                        setContactEmail(e.target.value);
                        setGeneratedShareUrl(null);
                      }}
                      placeholder="jane@example.com"
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-white outline-none focus:border-cyan-400 transition"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300">Organization / Company</label>
                    <input
                      type="text"
                      value={contactOrg}
                      onChange={(e) => {
                        setContactOrg(e.target.value);
                        setGeneratedShareUrl(null);
                      }}
                      placeholder="Acme Corp"
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-white outline-none focus:border-cyan-400 transition"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Standard vCard format. Phone cameras will prompt to "Add to Contacts" instantly.
                </p>
              </div>
            )}

            {/* TAB: FILES / PHOTOS / VIDEOS */}
            {isVaultOnly && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-300">
                  Select {contentType === 'photo' ? 'Photos' : contentType === 'video' ? 'Video File' : 'Files'}
                </label>

                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-800/90 bg-slate-950/60 p-6 text-center hover:border-slate-700 transition">
                  <Upload className="mb-2 h-8 w-8 text-cyan-400" />
                  <p className="mb-1 text-xs font-semibold text-slate-200">
                    Click or drag files to encrypt & create share QR
                  </p>
                  <p className="mb-4 text-[11px] text-slate-400">
                    Supports PDFs, Docs, ZIPs, Photos, MP4 Videos (Up to 15MB per file)
                  </p>

                  <input
                    type="file"
                    multiple={contentType !== 'video'}
                    accept={
                      contentType === 'photo'
                        ? 'image/*'
                        : contentType === 'video'
                        ? 'video/*'
                        : '*/*'
                    }
                    onChange={handleFilesSelect}
                    className="hidden"
                    id="file-input-share"
                  />
                  <label
                    htmlFor="file-input-share"
                    className="cursor-pointer rounded-xl bg-cyan-500 px-5 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-cyan-400 transition shadow-md shadow-cyan-500/20"
                  >
                    Browse Files
                  </label>
                </div>

                {/* File list preview */}
                {filesList.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-300">Selected Files ({filesList.length}):</p>
                    <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                      {filesList.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileText className="h-4 w-4 text-cyan-400 shrink-0" />
                            <span className="text-slate-200 truncate">{file.name}</span>
                            <span className="text-[10px] text-slate-500">
                              ({Math.round(file.size / 1024)} KB)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setFilesList(filesList.filter((_, i) => i !== idx))}
                            className="text-rose-400 hover:text-rose-300 font-bold ml-2 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SECURITY CONTROLS PANEL (When Encrypted Vault mode or Files are chosen) */}
            {(shareMode === 'encrypted' || isVaultOnly) && (
              <div className="rounded-2xl border border-slate-800/90 bg-slate-950/80 p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                  <Lock className="h-4 w-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-white">Zero-Knowledge Vault & Security Rules</h4>
                </div>

                {/* Passphrase protection toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-slate-200">Passphrase Protection</label>
                    <p className="text-[10px] text-slate-400">
                      Require an extra secret key to decrypt
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={usePassphrase}
                    onChange={(e) => setUsePassphrase(e.target.checked)}
                    className="h-4 w-4 rounded accent-cyan-500 cursor-pointer"
                  />
                </div>

                {usePassphrase && (
                  <div>
                    <input
                      type="password"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder="Enter secret passphrase (PBKDF2 100k rounds)..."
                      className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-400 transition"
                    />
                  </div>
                )}

                {/* Burn After Reading */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-rose-300 flex items-center gap-1">
                      <Flame className="h-3.5 w-3.5 text-rose-400" />
                      Burn After Reading
                    </label>
                    <p className="text-[10px] text-slate-400">
                      Self-destruct payload immediately after first scan
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={burnAfterReading}
                    onChange={(e) => setBurnAfterReading(e.target.checked)}
                    className="h-4 w-4 rounded accent-rose-500 cursor-pointer"
                  />
                </div>

                {/* Expiration Rules */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-300 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-cyan-400" />
                      Expiration Time
                    </label>
                    <select
                      value={expiration}
                      onChange={(e) => setExpiration(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-400 transition"
                    >
                      <option value="600">10 Minutes</option>
                      <option value="3600">1 Hour</option>
                      <option value="86400">24 Hours</option>
                      <option value="604800">7 Days</option>
                      <option value="never">Never Expire</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-300">
                      Max Access Limit
                    </label>
                    <select
                      value={maxAccessLimit}
                      onChange={(e) => setMaxAccessLimit(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-400 transition"
                    >
                      <option value="unlimited">Unlimited Views</option>
                      <option value="1">1 Download Only</option>
                      <option value="3">3 Downloads</option>
                      <option value="5">5 Downloads</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Status Message Notification */}
            {statusMessage && (
              <div
                className={`rounded-xl border p-3 text-xs flex items-center gap-2 ${
                  statusMessage.type === 'success'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <Lock className="h-4 w-4 text-rose-400 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            {/* PRIMARY BUTTON: Mode-Dependent Action */}
            {shareMode === 'direct' && !isVaultOnly ? (
              <button
                type="button"
                onClick={handleGenerateDirectQR}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 py-4 text-xs font-extrabold text-slate-950 shadow-xl shadow-cyan-500/25 hover:opacity-95 transition transform hover:-translate-y-0.5 cursor-pointer"
              >
                <Zap className="h-4 w-4" />
                <span>Generate Universal QR Code</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGenerateEncryptedShare}
                disabled={isEncrypting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 py-4 text-xs font-extrabold text-slate-950 shadow-xl shadow-cyan-500/25 hover:opacity-95 disabled:opacity-50 transition transform hover:-translate-y-0.5 cursor-pointer"
              >
                {isEncrypting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Encrypting AES-256 & Generating Vault QR...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    <span>Encrypt AES-256 & Generate Vault QR</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* QR Customizer Panel */}
          <QRCustomizer options={qrOptions} onChange={setQrOptions} />
        </div>

        {/* Right Column: Real-time Live QR Code Display & Share Card */}
        <div className="lg:col-span-5 space-y-6">
          <div
            id="qr-preview-card"
            className="sticky top-20 rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-6 shadow-2xl text-center space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-400" />
                Generated QR Code
              </h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Ready
              </span>
            </div>

            {/* QR Image Box */}
            <div className="mx-auto flex aspect-square max-w-[280px] items-center justify-center rounded-2xl bg-white p-4 shadow-2xl border border-slate-800">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Generated QR Code"
                  className="h-full w-full object-contain select-none"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 p-4">
                  <RefreshCw className="mb-2 h-8 w-8 text-cyan-400 animate-spin" />
                  <p className="text-xs font-medium text-slate-500">Rendering QR code...</p>
                </div>
              )}
            </div>

            {/* Status & Encoding Format Tag */}
            <div>
              {shareMode === 'direct' && !isVaultOnly ? (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 text-xs text-cyan-300 font-medium">
                  <Zap className="h-3.5 w-3.5 text-cyan-400" />
                  Direct Universal QR (Scans with Any Camera)
                </div>
              ) : generatedShareUrl ? (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs text-emerald-400 font-medium">
                  <Lock className="h-3.5 w-3.5 text-emerald-400" />
                  Zero-Knowledge AES-256 Vault Link
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 text-xs text-indigo-300 font-medium">
                  <Lock className="h-3.5 w-3.5 text-indigo-400" />
                  Encrypted Vault Share
                </div>
              )}
            </div>

            {/* Content / Share URL box */}
            <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-2.5">
              <input
                type="text"
                readOnly
                value={generatedShareUrl || directQRContent}
                className="w-full bg-transparent text-[11px] text-cyan-300 font-mono outline-none truncate px-1"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-xl bg-cyan-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition shrink-0 flex items-center gap-1 shadow-md shadow-cyan-500/20 cursor-pointer"
              >
                {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedLink ? 'Copied' : 'Copy'}
              </button>
            </div>

            {/* Action Buttons: Download PNG, Download SVG, Print */}
            <div className="grid grid-cols-3 gap-2">
              <a
                href={qrDataUrl}
                download={`sharebyQR_${contentType}.png`}
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-800 bg-slate-950 py-3 text-xs font-semibold text-slate-200 hover:bg-slate-900 transition"
              >
                <Download className="h-3.5 w-3.5 text-cyan-400" />
                PNG
              </a>

              <button
                type="button"
                onClick={handleDownloadSVG}
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-800 bg-slate-950 py-3 text-xs font-semibold text-slate-200 hover:bg-slate-900 transition cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-indigo-400" />
                SVG
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-800 bg-slate-950 py-3 text-xs font-semibold text-slate-200 hover:bg-slate-900 transition cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5 text-emerald-400" />
                Print
              </button>
            </div>

            {/* Cross-Device Scanning Helper Tip */}
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-left text-xs text-amber-200 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <span>💡</span> Cross-Device Scanning Tip:
              </p>
              <p className="text-[11px] text-amber-300/90 leading-relaxed">
                Native phone camera apps attempt to open URLs in a web browser (which can trigger AI Studio preview login). To scan instantly on another phone without login prompts, simply open <strong className="text-white">sharebyQR</strong> on the second phone, go to the <strong className="text-white">Scan</strong> tab, and scan this QR code!
              </p>
            </div>

            {/* Test Scan Simulator */}
            {onCreatedShare && (
              <button
                type="button"
                onClick={() => {
                  const payloadToTest = generatedShareUrl || directQRContent;
                  if (payloadToTest) {
                    onCreatedShare(payloadToTest);
                  }
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 py-3 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20 transition cursor-pointer"
              >
                <Scan className="h-4 w-4 text-cyan-400" />
                <span>Test Scan & View Decryption</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
