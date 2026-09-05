import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Scanner } from './components/Scanner';
import { ShareForm } from './components/ShareForm';
import { DecryptedViewer } from './components/DecryptedViewer';
import { VaultHistory } from './components/VaultHistory';
import { SecurityAuditorModal } from './components/SecurityAuditorModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'scan' | 'generate' | 'vault'>('scan');
  const [scannedUrl, setScannedUrl] = useState<string | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);

  // Check if opened via direct share URL on load
  useEffect(() => {
    const currentUrl = window.location.href;
    const pathname = window.location.pathname;

    if (pathname.includes('/share/') || window.location.hash.includes('key=')) {
      setScannedUrl(currentUrl);
    }
  }, []);

  const handleScanResult = (qrString: string) => {
    setScannedUrl(qrString);
  };

  const handleBackToScanner = () => {
    setScannedUrl(null);
    // Clean URL bar if needed
    if (window.location.pathname.includes('/share/')) {
      window.history.pushState({}, '', '/');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-950 relative overflow-x-hidden">
      {/* Ambient Backdrop Lights for Bento Atmosphere */}
      <div className="pointer-events-none fixed top-0 left-1/4 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
      <div className="pointer-events-none fixed bottom-0 right-1/4 h-[500px] w-[500px] translate-y-1/2 rounded-full bg-indigo-500/10 blur-[120px]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-30" />

      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setScannedUrl(null);
        }}
        onOpenAuditModal={() => setIsAuditModalOpen(true)}
      />

      {/* Main Container */}
      <main className="relative z-10 pb-16">
        {scannedUrl ? (
          /* Decrypted Content View */
          <DecryptedViewer
            scannedUrlOrPayload={scannedUrl}
            onBack={handleBackToScanner}
          />
        ) : (
          <>
            {/* Active Tab View */}
            {activeTab === 'scan' && (
              <Scanner onScanResult={handleScanResult} />
            )}

            {activeTab === 'generate' && (
              <ShareForm
                onCreatedShare={(shareUrl) => {
                  // Optional callback
                }}
              />
            )}

            {activeTab === 'vault' && (
              <VaultHistory
                onSelectHistoryItem={(shareUrl) => {
                  setScannedUrl(shareUrl);
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Cryptographic Security Specs Modal */}
      <SecurityAuditorModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
      />
    </div>
  );
}
