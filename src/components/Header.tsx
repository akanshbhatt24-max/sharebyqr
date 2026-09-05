import React from 'react';
import { ShieldCheck, QrCode, Scan, History, Lock, Info } from 'lucide-react';

interface HeaderProps {
  activeTab: 'scan' | 'generate' | 'vault';
  setActiveTab: (tab: 'scan' | 'generate' | 'vault') => void;
  onOpenAuditModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenAuditModal,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-cyan-500 to-emerald-400 p-0.5 shadow-lg shadow-cyan-500/20">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-950">
              <QrCode className="h-5 w-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">
                shareby<span className="text-cyan-400">QR</span>
              </h1>
              <span className="hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 sm:inline-flex items-center gap-1.5 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                AES-256-GCM
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Zero-Knowledge End-to-End Encrypted QR File & Data Sharing
            </p>
          </div>
        </div>

        {/* Navigation Tabs - Bento Pill Box */}
        <nav className="flex items-center gap-1 rounded-2xl border border-slate-800/90 bg-slate-900/90 p-1.5 shadow-inner backdrop-blur-md">
          <button
            type="button"
            onClick={() => setActiveTab('generate')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all duration-200 ${
              activeTab === 'generate'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <QrCode className="h-4 w-4" />
            <span>Create & Share</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scan')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all duration-200 ${
              activeTab === 'scan'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm shadow-indigo-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Scan className="h-4 w-4" />
            <span>Scan QR</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vault')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all duration-200 ${
              activeTab === 'vault'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Vault & History</span>
            <span className="sm:hidden">Vault</span>
          </button>
        </nav>

        {/* Security Audit Badge Button */}
        <button
          onClick={onOpenAuditModal}
          title="Security & Crypto Specs"
          className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-700 hover:bg-slate-800 transition duration-200 shadow-sm"
        >
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span className="hidden md:inline">Security Specs</span>
          <Info className="h-3.5 w-3.5 text-slate-400 md:hidden" />
        </button>
      </div>
    </header>
  );
};
