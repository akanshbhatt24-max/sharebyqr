import React from 'react';
import { GraduationCap, ShieldCheck, User, Sparkles, QrCode, Lock, Code2, Globe } from 'lucide-react';

export const AboutView: React.FC = () => {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      {/* Hero Header Card */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-900/50 to-slate-950 p-8 sm:p-12 shadow-2xl backdrop-blur-xl mb-8">
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 via-cyan-500 to-emerald-400 p-1 shadow-xl shadow-cyan-500/20">
            <div className="flex h-full w-full items-center justify-center rounded-[22px] bg-slate-950">
              <GraduationCap className="h-10 w-10 text-cyan-400" />
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-semibold text-cyan-300 mb-4 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Developer & Project Profile</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
            Akansh Bhatt
          </h2>

          <p className="text-base sm:text-lg font-medium text-cyan-400 mb-6">
            2nd Year B.Tech Student • Central University of Haryana
          </p>

          <p className="max-w-xl text-sm sm:text-base text-slate-300 leading-relaxed">
            Creator and lead developer of <strong className="text-white">sharebyQR</strong> — a secure, zero-knowledge, end-to-end encrypted platform for sharing sensitive files, credentials, and messages directly through QR codes without server-side storage risks.
          </p>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Creator Details Card */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 backdrop-blur-xl flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <User className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Student Creator</h3>
                <p className="text-xs text-slate-400">Academic & Professional Background</p>
              </div>
            </div>

            <ul className="space-y-3 text-sm text-slate-300">
              <li className="flex items-center justify-between rounded-xl bg-slate-950/60 border border-slate-800/80 p-3.5">
                <span className="text-slate-400 font-medium">Name:</span>
                <span className="font-bold text-white">Akansh Bhatt</span>
              </li>
              <li className="flex items-center justify-between rounded-xl bg-slate-950/60 border border-slate-800/80 p-3.5">
                <span className="text-slate-400 font-medium">Institution:</span>
                <span className="font-bold text-cyan-300 text-right">Central University of Haryana</span>
              </li>
              <li className="flex items-center justify-between rounded-xl bg-slate-950/60 border border-slate-800/80 p-3.5">
                <span className="text-slate-400 font-medium">Program / Year:</span>
                <span className="font-bold text-emerald-400">2nd Year B.Tech Student</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
            <span className="text-xs text-slate-500 font-mono">CUH Engineering & Computer Science Department</span>
          </div>
        </div>

        {/* Project Architecture Card */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 backdrop-blur-xl flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">About sharebyQR</h3>
                <p className="text-xs text-slate-400">Zero-Knowledge Cryptographic Sharing</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
              sharebyQR is engineered to provide absolute data privacy. Using client-side AES-256-GCM encryption, decryption keys are embedded directly inside the secure URL fragment hash (`#key=...`), ensuring that encrypted payloads passing through QR codes or intermediate networks can never be intercepted or read by servers.
            </p>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1 text-xs text-cyan-300 font-mono">AES-256-GCM</span>
              <span className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1 text-xs text-indigo-300 font-mono">Zero-Knowledge</span>
              <span className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1 text-xs text-emerald-300 font-mono">Client-Side Crypto</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Version 2.4.0 (Production)</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Secure & Operational
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
