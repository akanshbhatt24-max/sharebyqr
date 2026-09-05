import React, { useState, useEffect } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Video,
  KeyRound,
  Link2,
  Wifi,
  User,
  ShieldAlert,
  Flame,
  Clock,
  Download,
  Copy,
  Check,
  Printer,
  Sparkles,
  QrCode,
  Upload,
  Eye,
  EyeOff,
  Lock,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { ContentType, FileData, ShareContent, SharePayload, QRDesignOptions } from '../types';
import { encryptData } from '../lib/crypto';
import { generateQRCodeDataUrl, generateQRCodeSVG, DEFAULT_QR_OPTIONS } from '../lib/qr';
import { saveHistoryItem } from '../lib/storage';
import { QRCustomizer } from './QRCustomizer';

interface ShareFormProps {
  onCreatedShare?: (shareUrl: string) => void;
}

export const ShareForm: React.FC<ShareFormProps> = ({ onCreatedShare }) => {
  const [contentType, setContentType] = useState<ContentType>('file');

  // Form states
  const [title, setTitle] = useState<string>('');
  const [textData, setTextData] = useState<string>('');
  const [urlData, setUrlData] = useState<string>('');
  const [filesList, setFilesList] = useState<FileData[]>([]);

  // Contact form state
  const [contactName, setContactName] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');
  const [contactOrg, setContactOrg] = useState<string>('');
  const [contactNote, setContactNote] = useState<string>('');

  // Wi-Fi form state
  const [wifiSsid, setWifiSsid] = useState<string>('');
  const [wifiPassword, setWifiPassword] = useState<string>('');
  const [wifiEncryption, setWifiEncryption] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
  const [showWifiPass, setShowWifiPass] = useState<boolean>(false);

  // Security options
  const [usePassphrase, setUsePassphrase] = useState<boolean>(false);
  const [passphrase, setPassphrase] = useState<string>('');
  const [burnAfterReading, setBurnAfterReading] = useState<boolean>(false);
  const [expiration, setExpiration] = useState<string>('86400'); // Default 24 hours in seconds
  const [maxAccessLimit, setMaxAccessLimit] = useState<string>('unlimited');

  // QR Customization options
  const [qrOptions, setQrOptions] = useState<QRDesignOptions>({
    ...DEFAULT_QR_OPTIONS,
    logo: 'shield',
  });

  // Processing state
  const [isEncrypting, setIsEncrypting] = useState<boolean>(false);
  const [generatedShareUrl, setGeneratedShareUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [fileReadError, setFileReadError] = useState<string | null>(null);

  // Auto update logo when content type changes
  useEffect(() => {
    let logo: QRDesignOptions['logo'] = 'shield';
    if (contentType === 'file') logo = 'file';
    if (contentType === 'photo') logo = 'photo';
    if (contentType === 'video') logo = 'video';
    if (contentType === 'link') logo = 'link';
    if (contentType === 'wifi') logo = 'wifi';
    setQrOptions((prev) => ({ ...prev, logo }));
  }, [contentType]);

  // Handle file picker read
  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setFileReadError(null);
    const newFilesList: FileData[] = [];
    let count = 0;

    Array.from(selectedFiles).forEach((f: File) => {
      // Check file size (cap single file to 50MB for smooth browser crypto)
      if (f.size > 50 * 1024 * 1024) {
        setFileReadError(`File "${f.name}" exceeds 50MB browser limit.`);
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

  // Generate Encrypted Share & QR Code
  const handleGenerateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEncrypting(true);
    setFileReadError(null);

    try {
      // 1. Construct payload object
      let shareContent: ShareContent;

      if (contentType === 'file' || contentType === 'photo' || contentType === 'video') {
        if (filesList.length === 0) {
          throw new Error('Please select at least one file or photo/video to share.');
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
            note: contactNote,
          },
        };
      }

      // 2. Perform AES-256-GCM Web Crypto Encryption
      const secretPass = usePassphrase && passphrase.trim() ? passphrase.trim() : undefined;
      const payloadToEncrypt = {
        ...shareContent,
        content: shareContent,
      };
      const encryptedRes = await encryptData(payloadToEncrypt as unknown as Record<string, unknown>, secretPass);

      // 3. Calculate expiration timestamp
      let expiresAt: number | null = null;
      if (expiration !== 'never') {
        expiresAt = Date.now() + Number(expiration) * 1000;
      }

      const maxAccess = maxAccessLimit !== 'unlimited' ? Number(maxAccessLimit) : undefined;

      // 4. Send encrypted ciphertext blob to Express backend
      const response = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save encrypted share payload to server.');
      }

      const serverRes = await response.json();
      const shareId = serverRes.id;

      // 5. Construct client Zero-Knowledge link
      // Format: https://{host}/share/{shareId}#key={rawKeyHex}
      const baseUrl = window.location.origin;
      let fullShareUrl = `${baseUrl}/share/${shareId}`;

      // Append decryption key in hash fragment if no custom passphrase was set
      if (!encryptedRes.hasPassphrase && encryptedRes.rawKeyHex) {
        fullShareUrl += `#key=${encryptedRes.rawKeyHex}`;
      }

      // 6. Generate QR Code image data URL
      const qrImage = await generateQRCodeDataUrl(fullShareUrl, qrOptions);

      setGeneratedShareUrl(fullShareUrl);
      setQrDataUrl(qrImage);

      // Save to local vault history
      saveHistoryItem({
        id: shareId,
        direction: 'sent',
        type: contentType,
        title: shareContent.title || 'Encrypted Share',
        timestamp: Date.now(),
        expiresAt,
        encrypted: true,
        shareUrl: fullShareUrl,
      });

      if (onCreatedShare) {
        onCreatedShare(fullShareUrl);
      }
    } catch (err: unknown) {
      console.error('Share generation error:', err);
      setFileReadError(err instanceof Error ? err.message : 'Error creating share.');
    } finally {
      setIsEncrypting(false);
    }
  };

  // Re-generate QR image when customizer options change
  useEffect(() => {
    if (generatedShareUrl) {
      generateQRCodeDataUrl(generatedShareUrl, qrOptions).then(setQrDataUrl);
    }
  }, [qrOptions, generatedShareUrl]);

  // Copy share URL
  const handleCopyShareLink = () => {
    if (!generatedShareUrl) return;
    navigator.clipboard.writeText(generatedShareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Download SVG version
  const handleDownloadSVG = async () => {
    if (!generatedShareUrl) return;
    const svgStr = await generateQRCodeSVG(generatedShareUrl, qrOptions);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sharebyQR_${contentType}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      {/* Bento Content Selector Box */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-xl p-4 shadow-2xl">
        <p className="text-xs font-bold text-slate-400 mb-3 px-1 uppercase tracking-wider">Select Content Type</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 md:grid-cols-7">
          {[
            { id: 'file', label: 'Files', icon: FileText },
            { id: 'photo', label: 'Photos', icon: ImageIcon },
            { id: 'video', label: 'Videos', icon: Video },
            { id: 'text', label: 'Secret Text', icon: KeyRound },
            { id: 'link', label: 'Link', icon: Link2 },
            { id: 'wifi', label: 'Wi-Fi', icon: Wifi },
            { id: 'contact', label: 'Contact', icon: User },
          ].map((tab) => {
            const IconComp = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setContentType(tab.id as ContentType);
                  setGeneratedShareUrl(null);
                }}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-3.5 text-center transition-all duration-200 ${
                  contentType === tab.id
                    ? 'border-indigo-500/80 bg-indigo-500/20 text-indigo-300 font-bold shadow-lg shadow-indigo-500/15 ring-1 ring-indigo-500/30'
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
        {/* Left Column: Input Form & Security Config */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleGenerateShare} className="space-y-6 rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-6 shadow-2xl">
            {/* Share Title */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Share Title / Label (Optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Confidential Project Assets, Home Wi-Fi"
                className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-white outline-none focus:border-indigo-500 transition font-medium"
              />
            </div>

            {/* TAB: FILES / PHOTOS / VIDEOS */}
            {(contentType === 'file' || contentType === 'photo' || contentType === 'video') && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-300">
                  Select {contentType === 'photo' ? 'Photos' : contentType === 'video' ? 'Video File' : 'Files'}
                </label>

                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-800/90 bg-slate-950/60 p-6 text-center hover:border-slate-700 transition">
                  <Upload className="mb-2 h-8 w-8 text-indigo-400" />
                  <p className="mb-1 text-xs font-semibold text-slate-200">
                    Click or drag files to upload & encrypt
                  </p>
                  <p className="mb-4 text-[11px] text-slate-400">
                    Supports PDFs, Docs, ZIPs, Photos, MP4 Videos (Up to 50MB per share)
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
                    className="cursor-pointer rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-indigo-500 transition shadow-md shadow-indigo-600/20"
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
                            <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
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

            {/* TAB: SECRET TEXT */}
            {contentType === 'text' && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Secret Note / Encrypted Content
                </label>
                <textarea
                  value={textData}
                  onChange={(e) => setTextData(e.target.value)}
                  placeholder="Type or paste confidential note, password, or recovery keys..."
                  rows={5}
                  required
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs text-white font-mono outline-none focus:border-indigo-500 transition"
                />
              </div>
            )}

            {/* TAB: LINK */}
            {contentType === 'link' && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">Target Web Link URL</label>
                <input
                  type="url"
                  value={urlData}
                  onChange={(e) => setUrlData(e.target.value)}
                  placeholder="https://example.com/secret-document"
                  required
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-white font-mono outline-none focus:border-indigo-500 transition"
                />
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
                    onChange={(e) => setWifiSsid(e.target.value)}
                    placeholder="e.g. Home_5G_Network"
                    required
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-white outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300">Encryption</label>
                    <select
                      value={wifiEncryption}
                      onChange={(e) =>
                        setWifiEncryption(e.target.value as 'WPA' | 'WEP' | 'nopass')
                      }
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3.5 py-3 text-xs text-white outline-none focus:border-indigo-500 transition"
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
                        onChange={(e) => setWifiPassword(e.target.value)}
                        placeholder="Network password"
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-white outline-none focus:border-indigo-500 pr-10 transition"
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
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Jane Doe"
                      required
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-white outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300">Phone</label>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+1 (555) 019-2834"
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-white outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300">Email</label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="jane@example.com"
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-white outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300">Company</label>
                    <input
                      type="text"
                      value={contactOrg}
                      onChange={(e) => setContactOrg(e.target.value)}
                      placeholder="Acme Corp"
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-white outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SECURITY CONTROLS PANEL - Bento Sub-Card */}
            <div className="rounded-2xl border border-slate-800/90 bg-slate-950/80 p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                <Lock className="h-4 w-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-white">Security & Access Rules</h4>
              </div>

              {/* Passphrase protection toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-slate-200">Passphrase Protection</label>
                  <p className="text-[10px] text-slate-400">
                    Require extra secret key for decryption
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={usePassphrase}
                  onChange={(e) => setUsePassphrase(e.target.checked)}
                  className="h-4 w-4 rounded accent-indigo-500 cursor-pointer"
                />
              </div>

              {usePassphrase && (
                <div>
                  <input
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Enter secret passphrase (PBKDF2 100k rounds)..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs text-white outline-none focus:border-indigo-500 transition"
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
                    Auto-destruct share payload immediately after first scan
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
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500 transition"
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
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500 transition"
                  >
                    <option value="unlimited">Unlimited Views</option>
                    <option value="1">1 Download Only</option>
                    <option value="3">3 Downloads</option>
                    <option value="5">5 Downloads</option>
                  </select>
                </div>
              </div>
            </div>

            {fileReadError && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
                {fileReadError}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isEncrypting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 py-4 text-xs font-extrabold text-slate-950 shadow-xl shadow-indigo-500/25 hover:opacity-90 disabled:opacity-50 transition transform hover:-translate-y-0.5"
            >
              {isEncrypting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Encrypting AES-256 & Generating QR...</span>
                </>
              ) : (
                <>
                  <QrCode className="h-4 w-4" />
                  <span>Generate Encrypted QR Code</span>
                </>
              )}
            </button>
          </form>

          {/* QR Customizer Accordion Panel */}
          <QRCustomizer options={qrOptions} onChange={setQrOptions} />
        </div>

        {/* Right Column: Real-time QR Code Display & Share Card */}
        <div className="lg:col-span-5 space-y-6">
          <div className="sticky top-20 rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-6 shadow-2xl text-center space-y-5">
            <h3 className="text-sm font-bold text-white flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              Generated Encrypted QR Code
            </h3>

            {/* QR Image Box */}
            <div className="mx-auto flex aspect-square max-w-[280px] items-center justify-center rounded-2xl bg-white p-4 shadow-2xl border border-slate-800">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Generated QR Code" className="h-full w-full object-contain" />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 p-4">
                  <QrCode className="mb-2 h-12 w-12 text-slate-300 opacity-40 animate-pulse" />
                  <p className="text-xs font-medium text-slate-500">Fill details and click generate</p>
                </div>
              )}
            </div>

            {generatedShareUrl ? (
              <div className="space-y-4">
                {/* Security Tag */}
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs text-emerald-400 font-medium">
                  <Lock className="h-3.5 w-3.5 text-emerald-400" />
                  Zero-Knowledge AES-256-GCM Encrypted
                </div>

                {/* Direct Link Output */}
                <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-2.5">
                  <input
                    type="text"
                    readOnly
                    value={generatedShareUrl}
                    className="w-full bg-transparent text-[11px] text-cyan-300 font-mono outline-none truncate px-1"
                  />
                  <button
                    onClick={handleCopyShareLink}
                    className="rounded-xl bg-cyan-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition shrink-0 flex items-center gap-1 shadow-md shadow-cyan-500/20"
                  >
                    {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedLink ? 'Copied' : 'Copy'}
                  </button>
                </div>

                {/* Action Downloads */}
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={qrDataUrl}
                    download={`sharebyQR_${contentType}.png`}
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-800 bg-slate-950 py-3 text-xs font-semibold text-slate-200 hover:bg-slate-900 transition"
                  >
                    <Download className="h-4 w-4 text-cyan-400" />
                    Download PNG
                  </a>

                  <button
                    onClick={handleDownloadSVG}
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-800 bg-slate-950 py-3 text-xs font-semibold text-slate-200 hover:bg-slate-900 transition"
                  >
                    <Download className="h-4 w-4 text-indigo-400" />
                    Download SVG
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed">
                Generate a share to obtain live download, copy, and print options.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
