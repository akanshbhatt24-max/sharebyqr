import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Upload, Flashlight, RefreshCw, AlertCircle, CheckCircle2, ShieldCheck, Link2, Sparkles } from 'lucide-react';
import { scanQRCodeFromImageData, scanQRCodeFromImageFile } from '../lib/qr';

interface ScannerProps {
  onScanResult: (qrResultString: string) => void;
}

export const Scanner: React.FC<ScannerProps> = ({ onScanResult }) => {
  const [scanMode, setScanMode] = useState<'camera' | 'upload' | 'manual'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [torchEnabled, setTorchEnabled] = useState<boolean>(false);
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [isScanningFile, setIsScanningFile] = useState<boolean>(false);
  const [fileScanError, setFileScanError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const [dragActive, setDragActive] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isComponentMounted = useRef<boolean>(true);
  const activeStartRequestRef = useRef<number>(0);

  const scanModeRef = useRef(scanMode);
  scanModeRef.current = scanMode;

  const onScanResultRef = useRef(onScanResult);
  onScanResultRef.current = onScanResult;

  // Stop camera media stream
  const stopCamera = useCallback(() => {
    activeStartRequestRef.current++;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {
        // ignore
      }
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setTorchEnabled(false);
  }, []);

  // Frame processing loop for QR detection
  const tick = useCallback(() => {
    if (!isComponentMounted.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = scanQRCodeFromImageData(imageData);

        if (code && code.data && code.data.trim().length > 0) {
          // Play subtle audio indicator
          try {
            const ctxAudio = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            const osc = ctxAudio.createOscillator();
            const gain = ctxAudio.createGain();
            osc.type = 'sine';
            osc.frequency.value = 880; // A5
            gain.gain.setValueAtTime(0.1, ctxAudio.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctxAudio.currentTime + 0.15);
            osc.connect(gain);
            gain.connect(ctxAudio.destination);
            osc.start();
            osc.stop(ctxAudio.currentTime + 0.15);
          } catch {
            // Audio context optional
          }

          stopCamera();
          onScanResultRef.current(code.data.trim());
          return;
        }
      }
    }

    if (isComponentMounted.current && scanModeRef.current === 'camera') {
      animFrameRef.current = requestAnimationFrame(tick);
    }
  }, [stopCamera]);

  // Start camera stream
  const startCamera = useCallback(
    async (deviceId?: string) => {
      stopCamera();
      setCameraError(null);
      const requestId = activeStartRequestRef.current;

      try {
        const constraints: MediaStreamConstraints = {
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (requestId !== activeStartRequestRef.current || !isComponentMounted.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');

          try {
            await videoRef.current.play();
          } catch (playErr: any) {
            if (requestId !== activeStartRequestRef.current || !isComponentMounted.current) {
              stream.getTracks().forEach((track) => track.stop());
              if (streamRef.current === stream) streamRef.current = null;
              return;
            }
            if (
              playErr?.name === 'AbortError' ||
              playErr?.message?.includes('interrupted') ||
              playErr?.message?.includes('removed')
            ) {
              console.warn('Camera video play request was interrupted (non-fatal):', playErr?.message);
              return;
            }
            throw playErr;
          }

          if (requestId !== activeStartRequestRef.current || !isComponentMounted.current) {
            stream.getTracks().forEach((track) => track.stop());
            if (streamRef.current === stream) streamRef.current = null;
            return;
          }

          setIsCameraActive(true);

          // Check torch capability
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            const capabilities = videoTrack.getCapabilities() as unknown as { torch?: boolean };
            setTorchSupported(Boolean(capabilities?.torch));
          }

          // Enumerate cameras
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            if (requestId === activeStartRequestRef.current && isComponentMounted.current) {
              const videoDevs = devices.filter((d) => d.kind === 'videoinput');
              setVideoDevices(videoDevs);
              if (videoTrack) {
                setSelectedDeviceId(videoTrack.getSettings().deviceId || '');
              }
            }
          } catch {
            // Optional
          }

          animFrameRef.current = requestAnimationFrame(tick);
        }
      } catch (err: any) {
        if (requestId !== activeStartRequestRef.current || !isComponentMounted.current) {
          return;
        }
        if (
          err?.name === 'AbortError' ||
          err?.message?.includes('interrupted') ||
          err?.message?.includes('removed')
        ) {
          console.warn('Camera initialization interrupted (non-fatal):', err?.message);
          return;
        }
        console.error('Camera access error:', err);
        setCameraError(
          'Unable to access camera. Please grant camera permission or select a photo with a QR code.'
        );
      }
    },
    [stopCamera, tick]
  );

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !torchEnabled;
        await track.applyConstraints({
          advanced: [{ torch: nextState } as unknown as MediaTrackConstraintSet],
        });
        setTorchEnabled(nextState);
      } catch (e) {
        console.warn('Torch constraint error:', e);
      }
    }
  };

  // Lifecycle
  useEffect(() => {
    isComponentMounted.current = true;
    if (scanMode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      isComponentMounted.current = false;
      stopCamera();
    };
  }, [scanMode, startCamera, stopCamera]);

  // File scan handler
  const handleFileUpload = async (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      setFileScanError('Please select a valid image file containing a QR code.');
      return;
    }

    setIsScanningFile(true);
    setFileScanError(null);

    try {
      const qrData = await scanQRCodeFromImageFile(file);
      if (qrData) {
        onScanResult(qrData.trim());
      } else {
        setFileScanError('No valid QR code detected in this image. Try another photo with clearer lighting.');
      }
    } catch (e) {
      console.error('File scan error:', e);
      setFileScanError('Failed to read QR code from file.');
    } finally {
      setIsScanningFile(false);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      {/* Bento Top Header Banner */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-xl p-6 shadow-2xl relative overflow-hidden">
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-500/10 blur-2xl" />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400 mb-2">
              <Sparkles className="h-3.5 w-3.5" />
              Optical QR Matrix Reader
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">Scan & Decrypt QR Code</h2>
            <p className="text-xs text-slate-400 mt-1">
              Supports live camera capture, uploaded images, or direct payload URLs with zero-knowledge AES-256 decryption.
            </p>
          </div>

          {/* Scanner Mode Tabs - Bento Box Pill */}
          <div className="inline-flex rounded-2xl border border-slate-800/90 bg-slate-950 p-1.5 shadow-inner shrink-0">
            <button
              onClick={() => setScanMode('camera')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                scanMode === 'camera'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <Camera className="h-4 w-4" />
              Live Camera
            </button>
            <button
              onClick={() => setScanMode('upload')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                scanMode === 'upload'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <Upload className="h-4 w-4" />
              Image Drop
            </button>
            <button
              onClick={() => setScanMode('manual')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                scanMode === 'manual'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <Link2 className="h-4 w-4" />
              Paste URL / Code
            </button>
          </div>
        </div>
      </div>

      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Bento Grid Layout Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Interactive Scanner Bento Card (Spans 8 columns) */}
        <div className="lg:col-span-8">
          {/* Mode 1: Live Camera Scanner */}
          {scanMode === 'camera' && (
            <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-5 shadow-2xl h-full flex flex-col justify-between">
              {/* Controls Bar */}
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-xs font-semibold text-slate-300">Live Viewfinder Active</span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Torch Button */}
                  {torchSupported && (
                    <button
                      onClick={toggleTorch}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                        torchEnabled
                          ? 'border-yellow-400/50 bg-yellow-400/20 text-yellow-300 shadow-sm shadow-yellow-500/20'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                      }`}
                      title="Toggle Flashlight"
                    >
                      <Flashlight className="h-4 w-4" />
                    </button>
                  )}

                  {/* Camera Switcher Dropdown */}
                  {videoDevices.length > 1 && (
                    <select
                      value={selectedDeviceId}
                      onChange={(e) => startCamera(e.target.value)}
                      className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-200 outline-none focus:border-cyan-500"
                    >
                      {videoDevices.map((dev, idx) => (
                        <option key={dev.deviceId || idx} value={dev.deviceId}>
                          {dev.label || `Camera ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Restart Camera */}
                  <button
                    onClick={() => startCamera(selectedDeviceId)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-slate-400 hover:text-white transition"
                    title="Restart Viewfinder"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Camera Viewfinder Viewport */}
              <div className="relative aspect-square w-full max-w-md mx-auto overflow-hidden rounded-2xl bg-slate-950 border border-slate-800/80 shadow-inner">
                {cameraError ? (
                  <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                    <AlertCircle className="mb-3 h-12 w-12 text-rose-400" />
                    <p className="mb-4 text-xs text-slate-300 leading-relaxed">{cameraError}</p>
                    <button
                      onClick={() => startCamera()}
                      className="rounded-xl bg-cyan-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20"
                    >
                      Grant Camera Access
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      className="h-full w-full object-cover"
                      playsInline
                      muted
                    />

                    {/* Laser Overlay Guide Frame */}
                    <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
                      <div className="relative aspect-square w-64 rounded-2xl border-2 border-cyan-400/80 shadow-[0_0_30px_rgba(34,211,238,0.25)]">
                        {/* Corner Accents */}
                        <div className="absolute -top-1 -left-1 h-6 w-6 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg" />
                        <div className="absolute -top-1 -right-1 h-6 w-6 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg" />
                        <div className="absolute -bottom-1 -left-1 h-6 w-6 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg" />
                        <div className="absolute -bottom-1 -right-1 h-6 w-6 border-b-4 border-r-4 border-cyan-400 rounded-br-lg" />

                        {/* Animated Scanning Laser Line */}
                        {isCameraActive && (
                          <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee] animate-[scan_2s_infinite_ease-in-out]" />
                        )}
                      </div>
                    </div>

                    {/* Scanner Overlay Hint */}
                    <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-950/85 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-slate-200 border border-slate-700/60 shadow-lg">
                        <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
                        Align QR code within target frame
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Mode 2: Drag and Drop Image File Scanner */}
          {scanMode === 'upload' && (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`relative flex min-h-[380px] flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
                dragActive
                  ? 'border-cyan-400 bg-cyan-500/10 shadow-2xl shadow-cyan-500/10'
                  : 'border-slate-800/80 bg-slate-900/60 hover:border-slate-700/80 backdrop-blur-xl'
              }`}
            >
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-lg">
                <Upload className="h-10 w-10" />
              </div>

              <h3 className="mb-1 text-lg font-bold text-white">Scan QR Image File</h3>
              <p className="mb-6 max-w-sm text-xs text-slate-400 leading-relaxed">
                Drag & drop any QR screenshot, photo, or saved image file, or browse files from your device.
              </p>

              <label className="cursor-pointer rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-6 py-3 text-xs font-extrabold text-slate-950 shadow-xl shadow-cyan-500/20 hover:opacity-90 transition transform hover:-translate-y-0.5">
                <span>Choose Image File</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
              </label>

              {isScanningFile && (
                <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-cyan-400">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Analyzing QR matrix array...
                </div>
              )}

              {fileScanError && (
                <div className="mt-6 flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-xs text-rose-300">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                  {fileScanError}
                </div>
              )}
            </div>
          )}

          {/* Mode 3: Manual Input / Link / Code */}
          {scanMode === 'manual' && (
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-6 shadow-2xl space-y-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  Paste Share URL or QR Raw Payload
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Paste encrypted URLs (e.g. <code className="text-cyan-300">https://.../share/XYZ#key=...</code>) or direct payload code strings.
                </p>
              </div>

              <textarea
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Paste URL or QR raw payload string here..."
                rows={5}
                className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-200 outline-none focus:border-cyan-500 font-mono transition"
              />

              <button
                onClick={() => {
                  if (manualInput.trim()) {
                    onScanResult(manualInput.trim());
                  }
                }}
                disabled={!manualInput.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 py-3.5 text-xs font-extrabold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition shadow-lg shadow-cyan-500/20"
              >
                <CheckCircle2 className="h-4 w-4" />
                Open & Decrypt Share
              </button>
            </div>
          )}
        </div>

        {/* Bento Side Cards (Spans 4 columns) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Card 1: Zero-Knowledge Security Box */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              Zero-Knowledge Safeguard
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Decryption keys are embedded in URL hash fragments (<code className="text-cyan-300 font-mono">#key=...</code>). Hash fragments are processed purely on your device and are never sent to any server.
            </p>
          </div>

          {/* Card 2: Supported Formats Bento Cell */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-xl p-5 space-y-3">
            <div className="text-xs font-bold text-cyan-400 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Supported Content Payload Types
            </div>
            <ul className="text-xs text-slate-300 space-y-2">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Files & Documents (PDFs, Docs, ZIPs)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                Photos, Images & Video Clips
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Encrypted Notes & Credentials
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                Wi-Fi Network Auto-Connect & Contacts
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
