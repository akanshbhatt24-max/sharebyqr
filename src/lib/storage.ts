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
    // Prepend new item
    const updated = [item, ...history.filter((h) => h.id !== item.id)].slice(0, 50); // Keep last 50 items
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save history item:', err);
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
