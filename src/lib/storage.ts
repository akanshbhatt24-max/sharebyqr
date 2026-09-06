import { HistoryItem } from '../types';

const HISTORY_KEY = 'secure_qr_share_history_v1';

export function getHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveHistoryItem(item: HistoryItem): void {
  try {
    const history = getHistory();
    
    // Sanitize item shareUrl to remove massive inline ciphertexts if present, preventing localStorage quota overflow
    let sanitizedUrl = item.shareUrl;
    if (sanitizedUrl && sanitizedUrl.includes('#cipher=')) {
      const parts = sanitizedUrl.split('#');
      const baseUrl = parts[0];
      const hashParams = new URLSearchParams(parts[1] || '');
      const key = hashParams.get('key');
      if (key) {
        sanitizedUrl = `${baseUrl}#key=${key}`;
      } else {
        sanitizedUrl = baseUrl;
      }
    }

    const sanitizedItem = {
      ...item,
      shareUrl: sanitizedUrl,
    };

    // Prepend new item, keeping only last 20 items
    const updated = [sanitizedItem, ...history.filter((h) => h.id !== item.id)].slice(0, 20);
    
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch (quotaErr) {
      // If quota exceeded, try saving with fewer items (last 5 items)
      const minimal = updated.slice(0, 5);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(minimal));
    }
  } catch (err) {
    console.warn('Failed to save history item:', err);
  }
}

export function removeHistoryItem(id: string): void {
  try {
    const history = getHistory();
    const updated = history.filter((h) => h.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to remove history item:', err);
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (err) {
    console.error('Failed to clear history:', err);
  }
}
