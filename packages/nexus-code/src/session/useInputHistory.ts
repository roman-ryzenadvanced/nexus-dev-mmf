// ============================================================
// useInputHistory hook — loads persisted history into App-level state
// so other components (like tab autocomplete) can read it without
// going through InputBox.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { loadHistory, appendHistory, type HistoryEntry } from '../session/history.js';

export function useInputHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    (async () => {
      const loaded = await loadHistory();
      setHistory(loaded);
    })();
  }, []);

  const append = useCallback((entry: HistoryEntry) => {
    setHistory(h => [...h, entry].slice(-500));
    void appendHistory(entry);
  }, []);

  return { history, append };
}
