// ============================================================
// Input box — user prompt entry with slash command support
// Loads + persists history via ~/.nexus/history.json
// ============================================================

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { loadHistory, appendHistory, type HistoryEntry } from '../session/history.js';

interface Props {
  onSubmit: (text: string) => void;
  onSlash: (input: string) => Promise<string | void>;
  onAbort: () => void;
  busy: boolean;
  promptLabel?: string;
  /** Active provider id — stamped onto each history entry. */
  providerId?: string;
  /** Called on Tab — returns matching completion candidates. */
  onTab?: (currentInput: string) => string[];
  /** If provided, uses this history instead of loading its own. */
  history?: HistoryEntry[];
  onHistoryAppend?: (entry: HistoryEntry) => void;
}

const HISTORY_MAX = 500;

export function InputBox({
  onSubmit,
  onSlash,
  onAbort,
  busy,
  promptLabel,
  providerId,
  onTab,
  history: externalHistory,
  onHistoryAppend,
}: Props) {
  const [value, setValue] = useState('');
  const [localHistory, setLocalHistory] = useState<HistoryEntry[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [slashResult, setSlashResult] = useState<string | null>(null);
  const [tabCandidates, setTabCandidates] = useState<string[] | null>(null);
  const [tabIdx, setTabIdx] = useState(0);

  // Use external history if provided, else load our own.
  const history = externalHistory ?? localHistory;

  // Load persisted history on mount only if no external history provided.
  useEffect(() => {
    if (externalHistory) return;
    (async () => {
      const loaded = await loadHistory();
      setLocalHistory(loaded);
    })();
  }, [externalHistory]);

  useInput((input, key) => {
    if (busy) {
      if (key.ctrl && input === 'c') onAbort();
      return;
    }
    // Shift+Enter → insert newline (multi-line input)
    // Ink reports shift+return as key.return with key.shift=true.
    if (key.return && key.shift) {
      setValue((v) => v + '\n');
      setSlashResult(null);
      setTabCandidates(null);
      return;
    }
    if (key.return) {
      const text = value.trim();
      if (!text) return;
      if (text.startsWith('/')) {
        onSlash(text).then((res) => {
          if (res) setSlashResult(res);
          setValue('');
        });
        return;
      }
      onSubmit(text);
      // Append to in-memory + persisted history.
      const entry: HistoryEntry = { text, ts: Date.now(), providerId };
      if (onHistoryAppend) {
        onHistoryAppend(entry);
      } else {
        setLocalHistory((h) => [...h, entry].slice(-HISTORY_MAX));
        void appendHistory(entry);
      }
      setHistIdx(-1);
      setValue('');
      setSlashResult(null);
      setTabCandidates(null);
      return;
    }
    if (key.tab) {
      if (onTab) {
        if (tabCandidates && tabCandidates.length > 1) {
          // Cycle through existing candidates
          const next = (tabIdx + 1) % tabCandidates.length;
          setTabIdx(next);
          setValue(tabCandidates[next]);
        } else {
          // Fresh tab completion
          const candidates = onTab(value);
          if (candidates.length === 1) {
            setValue(candidates[0]);
            setTabCandidates(null);
          } else if (candidates.length > 1) {
            setTabCandidates(candidates);
            setTabIdx(0);
            setValue(candidates[0]);
          }
        }
      }
      return;
    }
    if (key.upArrow) {
      const next = Math.min(histIdx + 1, history.length - 1);
      if (history[history.length - 1 - next]) {
        setHistIdx(next);
        setValue(history[history.length - 1 - next].text);
      }
      return;
    }
    if (key.downArrow) {
      const next = histIdx - 1;
      if (next < 0) {
        setHistIdx(-1);
        setValue('');
      } else {
        setHistIdx(next);
        setValue(history[history.length - 1 - next]?.text || '');
      }
      return;
    }
    if (key.backspace || key.delete) {
      setValue((v) => v.slice(0, -1));
      setTabCandidates(null);
      return;
    }
    if (key.ctrl && input === 'c') {
      onAbort();
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      setValue((v) => v + input);
      setSlashResult(null);
      setTabCandidates(null);
    }
  });

  const lineCount = value.split('\n').length;
  const isMultiLine = lineCount > 1;

  return (
    <Box flexDirection="column" paddingX={1}>
      {slashResult && (
        <Box marginBottom={1}>
          <Text color={THEME.primaryDim}>{slashResult}</Text>
        </Box>
      )}
      <Box gap={1}>
        <Text color={busy ? THEME.primaryMute : THEME.accent} bold>
          {busy ? '…' : '❯'}
        </Text>
        <Text color={THEME.primary}>
          {value}
          <Text color={THEME.accent}>▋</Text>
        </Text>
      </Box>
      <Box>
        <Text color={THEME.primaryMute} dimColor>
          {isMultiLine
            ? `${lineCount} lines · Shift+Enter for newline · Enter to submit · Ctrl+P palette · Ctrl+C quit`
            : promptLabel || 'Enter a prompt, /help for commands, Ctrl+P for palette, Ctrl+C to quit'}
        </Text>
      </Box>
    </Box>
  );
}

const THEME = {
  primary: '#E2E8F0',
  primaryDim: '#94A3B8',
  primaryMute: '#475569',
  accent: '#06B6D4',
};
