import React from 'react';
import { Palette, Shield, QrCode, Sliders, Image as ImageIcon } from 'lucide-react';
import { QRDesignOptions } from '../types';

interface QRCustomizerProps {
  options: QRDesignOptions;
  onChange: (updatedOptions: QRDesignOptions) => void;
}

const COLOR_PALETTE = [
  { name: 'Slate Dark', fg: '#0F172A', bg: '#FFFFFF' },
  { name: 'Cyan Tech', fg: '#0284C7', bg: '#FFFFFF' },
  { name: 'Emerald Vault', fg: '#059669', bg: '#FFFFFF' },
  { name: 'Sunset Violet', fg: '#7C3AED', bg: '#FFFFFF' },
  { name: 'Crimson Shield', fg: '#E11D48', bg: '#FFFFFF' },
  { name: 'Midnight High Contrast', fg: '#38BDF8', bg: '#020617' },
];

export const QRCustomizer: React.FC<QRCustomizerProps> = ({ options, onChange }) => {
  return (
    <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-6 space-y-5 shadow-2xl">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <Sliders className="h-4 w-4 text-cyan-400" />
        <h3 className="text-sm font-bold text-white">QR Code Customizer & Brand Styling</h3>
      </div>

      {/* Preset Color Themes & Custom Colors */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5 text-cyan-400" />
            Color Theme & Custom Brand Palette
          </label>
          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-white transition">
              <span className="text-[10px]">Foreground:</span>
              <input
                type="color"
                value={options.fgColor}
                onChange={(e) => onChange({ ...options, fgColor: e.target.value })}
                className="h-5 w-5 rounded-full border border-slate-700 bg-transparent cursor-pointer"
              />
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-white transition">
              <span className="text-[10px]">Background:</span>
              <input
                type="color"
                value={options.bgColor}
                onChange={(e) => onChange({ ...options, bgColor: e.target.value })}
                className="h-5 w-5 rounded-full border border-slate-700 bg-transparent cursor-pointer"
              />
            </label>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {COLOR_PALETTE.map((theme) => (
            <button
              key={theme.name}
              type="button"
              onClick={() => onChange({ ...options, fgColor: theme.fg, bgColor: theme.bg })}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 text-center transition-all duration-200 ${
                options.fgColor.toUpperCase() === theme.fg.toUpperCase() && options.bgColor.toUpperCase() === theme.bg.toUpperCase()
                  ? 'border-cyan-400/80 bg-cyan-500/15 shadow-md shadow-cyan-500/10'
                  : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
              }`}
            >
              <div
                className="h-6 w-6 rounded-full border border-slate-700/80 shadow-inner flex items-center justify-center text-[10px]"
                style={{ backgroundColor: theme.bg, color: theme.fg }}
              >
                ■
              </div>
              <span className="text-[10px] font-semibold text-slate-300 truncate w-full">
                {theme.name.split(' ')[0]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Center Logo Overlay Picker */}
      <div>
        <label className="mb-2.5 block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-cyan-400" />
          Center Badge Logo
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'none', label: '🚫 None (Recommended for 100% fast scan)' },
            { id: 'shield', label: '🛡️ Shield' },
            { id: 'lock', label: '🔒 Lock' },
            { id: 'file', label: '📄 File' },
            { id: 'photo', label: '🖼️ Photo' },
            { id: 'video', label: '🎥 Video' },
            { id: 'wifi', label: '📶 Wi-Fi' },
            { id: 'link', label: '🔗 Link' },
          ].map((logo) => (
            <button
              key={logo.id}
              type="button"
              onClick={() => {
                const nextLogo = logo.id as QRDesignOptions['logo'];
                // When logo is chosen, ensure error correction is H so center badge doesn't break reading
                const nextEC = nextLogo !== 'none' ? 'H' : options.errorCorrectionLevel;
                onChange({ ...options, logo: nextLogo, errorCorrectionLevel: nextEC });
              }}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                options.logo === logo.id
                  ? 'border-cyan-400/80 bg-cyan-500/20 text-cyan-300 shadow-sm'
                  : 'border-slate-800 bg-slate-950/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              {logo.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Correction & Margin Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-300">
            Error Correction Level
          </label>
          <div className="grid grid-cols-4 gap-1 rounded-2xl border border-slate-800 bg-slate-950 p-1">
            {[
              { level: 'L', name: '7%' },
              { level: 'M', name: '15%' },
              { level: 'Q', name: '25%' },
              { level: 'H', name: '30%' },
            ].map((ec) => (
              <button
                key={ec.level}
                type="button"
                onClick={() =>
                  onChange({ ...options, errorCorrectionLevel: ec.level as QRDesignOptions['errorCorrectionLevel'] })
                }
                className={`rounded-xl py-1.5 text-xs font-extrabold transition ${
                  options.errorCorrectionLevel === ec.level
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {ec.level} ({ec.name})
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-slate-500">
            Higher levels (H = 30%) allow scanning even if partially damaged.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-300">
            Quiet Zone Margin: {options.margin}
          </label>
          <input
            type="range"
            min={0}
            max={6}
            step={1}
            value={options.margin}
            onChange={(e) => onChange({ ...options, margin: Number(e.target.value) })}
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
