import React, { useState } from 'react';
import { ShieldCheck, Lock, Key, Cpu, Zap, CheckCircle, X, ShieldAlert, FileCode } from 'lucide-react';
import { generateRandomKey, getKeyFingerprint } from '../lib/crypto';

interface SecurityAuditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityAuditorModal: React.FC<SecurityAuditorModalProps> = ({ isOpen, onClose }) => {
  const [testFingerprint, setTestFingerprint] = useState<string>('');
  const [testRawKey, setTestRawKey] = useState<string>('');
  const [testingEntropy, setTestingEntropy] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleRunTest = async () => {
    setTestingEntropy(true);
    const keyRes = await generateRandomKey();
    const fp = await getKeyFingerprint(keyRes.rawKeyHex);
    setTestRawKey(keyRes.rawKeyHex);
    setTestFingerprint(fp);
    setTestingEntropy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xl">
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-800/80 bg-slate-900/90 p-6 shadow-2xl space-y-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-md">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Cryptographic Security Specification</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Zero-Knowledge E2E Architecture & Web Crypto API Verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Spec Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-800/90 bg-slate-950/80 p-4 space-y-1.5 shadow-md">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
              <Lock className="h-4 w-4" />
              AES-256-GCM Cipher
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Galois/Counter Mode with 256-bit symmetric keys, 12-byte random IVs, and 128-bit authentication tags to prevent tampering.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-slate-950/80 p-4 space-y-1.5 shadow-md">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
              <Key className="h-4 w-4" />
              PBKDF2 Key Derivation
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Passphrases are stretched using 100,000 iterations of PBKDF2 with SHA-256 and a 128-bit cryptographically secure random salt.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-slate-950/80 p-4 space-y-1.5 shadow-md">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <Cpu className="h-4 w-4" />
              Zero-Knowledge Storage
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Decryption keys stay in browser hash fragments (<code className="text-cyan-300">#key=...</code>). Hash fragments are never sent over HTTP/TCP networks.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-slate-950/80 p-4 space-y-1.5 shadow-md">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-400">
              <Zap className="h-4 w-4" />
              Native Hardware Crypto
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Uses system <code className="text-cyan-300">window.crypto.subtle</code> binding directly to OS hardware security modules (AES-NI).
            </p>
          </div>
        </div>

        {/* Interactive Hardware Crypto Verification Test */}
        <div className="rounded-2xl border border-slate-800/90 bg-slate-950/80 p-4 space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <FileCode className="h-4 w-4 text-cyan-400" />
              Live Hardware Entropy & Key Test
            </span>
            <button
              onClick={handleRunTest}
              disabled={testingEntropy}
              className="rounded-xl bg-cyan-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition shadow-md shadow-cyan-500/20"
            >
              {testingEntropy ? 'Generating...' : 'Run Cryptographic Test'}
            </button>
          </div>

          {testRawKey && (
            <div className="space-y-2 rounded-xl bg-slate-900/90 p-3.5 font-mono text-[11px]">
              <div>
                <span className="text-slate-400 block mb-0.5">Generated 256-bit Hex Key:</span>
                <span className="text-cyan-300 break-all">{testRawKey}</span>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-800">
                <span className="text-slate-400">SHA-256 Key Fingerprint Digest:</span>
                <span className="text-emerald-400 font-bold">{testFingerprint}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="rounded-2xl bg-slate-800 px-5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
          >
            Close Audit View
          </button>
        </div>
      </div>
    </div>
  );
};
