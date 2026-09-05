import React, { useState, useEffect } from 'react';
import {
  History,
  Trash2,
  Lock,
  Copy,
  Check,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Video,
  KeyRound,
  Link2,
  Wifi,
  User,
  ShieldCheck,
  Flame,
  Clock
} from 'lucide-react';
import { HistoryItem } from '../types';
import { getHistory, removeHistoryItem, clearHistory } from '../lib/storage';

interface VaultHistoryProps {
  onSelectHistoryItem: (shareUrl: string) => void;
}

export const VaultHistory: React.FC<VaultHistoryProps> = ({ onSelectHistoryItem }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const handleRemove = (id: string) => {
    removeHistoryItem(id);
    setHistory(getHistory());
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear your local share history?')) {
      clearHistory();
      setHistory([]);
    }
  };

  const handleCopyLink = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      {/* Header Bento Box */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-xl p-6 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-md">
            <History className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white">Security Vault & Local History</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Track your encrypted sent and received QR share payloads locally in your browser
            </p>
          </div>
        </div>

        {history.length > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition shadow-sm"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Purge Vault History
          </button>
        )}
      </div>

      {/* History Items List */}
      {history.length === 0 ? (
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-xl p-12 text-center shadow-2xl">
          <ShieldCheck className="mx-auto mb-3 h-12 w-12 text-slate-600" />
          <h3 className="text-sm font-bold text-white">No Local Shares in Vault</h3>
          <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Scan a QR code or create a new encrypted file share to see records saved here locally.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => {
            const isExpired = item.expiresAt && Date.now() > item.expiresAt;

            return (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-4 gap-4 hover:border-slate-700/80 transition shadow-xl"
              >
                {/* Info */}
                <div className="flex items-center gap-3.5 overflow-hidden">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 border border-slate-800 text-cyan-400 shadow-inner">
                    {item.type === 'file' && <FileText className="h-5 w-5" />}
                    {item.type === 'photo' && <ImageIcon className="h-5 w-5" />}
                    {item.type === 'video' && <Video className="h-5 w-5" />}
                    {item.type === 'text' && <KeyRound className="h-5 w-5" />}
                    {item.type === 'link' && <Link2 className="h-5 w-5" />}
                    {item.type === 'wifi' && <Wifi className="h-5 w-5" />}
                    {item.type === 'contact' && <User className="h-5 w-5" />}
                  </div>

                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-white truncate">{item.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                          item.direction === 'sent'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {item.direction}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span>{new Date(item.timestamp).toLocaleString()}</span>
                      {isExpired ? (
                        <span className="text-rose-400 font-semibold">Expired</span>
                      ) : (
                        item.expiresAt && (
                          <span className="text-cyan-400 font-semibold flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Expires: {new Date(item.expiresAt).toLocaleTimeString()}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <button
                    onClick={() => handleCopyLink(item.id, item.shareUrl)}
                    className="flex items-center gap-1.5 rounded-2xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900 transition"
                  >
                    {copiedId === item.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedId === item.id ? 'Copied' : 'Copy Link'}
                  </button>

                  <button
                    onClick={() => onSelectHistoryItem(item.shareUrl)}
                    className="flex items-center gap-1.5 rounded-2xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition shadow-md shadow-cyan-500/20"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open
                  </button>

                  <button
                    onClick={() => handleRemove(item.id)}
                    className="text-slate-500 hover:text-rose-400 p-2 transition rounded-xl hover:bg-slate-950"
                    title="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
