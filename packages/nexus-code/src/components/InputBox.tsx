// ============================================================
// Input box — user prompt entry with slash command support.
// Loads + persists history via ~/.nexus/history.json.
//
// Slash menu (koda / claude-code / mimo style):
//   Typing `/` as the first char auto-opens a filtered command list
//   inline. Further typing filters it; ↑/↓ navigate; Enter/Tab picks;
//   Esc closes the menu. Picking runs the command via onSlash.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { loadHistory, appendHistory, type HistoryEntry } from '../session/history.js';
import { PALETTE_ENTRIES, filterEntries } from './CommandPalette.js';

interface Props {
  onSubmit: (text: string) => void;
  onSlash: (input: string) => Promise<string | void>;
  onAbort: () => void;
  busy: boolean;
  /** Number of prompts queued while busy (shown as a hint). */
  pendingCount?: number;
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
const MENU_MAX_VISIBLE = 6;

/**
 * Keep the selected index inside the visible window: if it scrolls past the
 * top or bottom edge, shift the window so it stays on screen (sticky scroll).
 * Pure + exported so the behaviour can be unit-tested.
 */
export function clampWindowStart(
  idx: number,
  winStart: number,
  visibleCount: number,
  totalCount: number
): number {
  if (totalCount <= visibleCount) return 0;
  let start = winStart;
  if (idx < start) start = idx;
  if (idx >= start + visibleCount) start = idx - visibleCount + 1;
  // Clamp into the valid range [0, totalCount - visibleCount].
  start = Math.max(0, Math.min(start, totalCount - visibleCount));
  return start;
}

export function InputBox({
  onSubmit,
  onSlash,
  onAbort,
  busy,
  pendingCount = 0,
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
  // Slash menu state — `menuActive` lets Esc dismiss it even if `/` is typed.
  const [menuActive, setMenuActive] = useState(false);
  const [menuIdx, setMenuIdx] = useState(0);
  // Top index of the visible window. Scrolls to follow `menuIdx` so the
  // highlighted item is always rendered (no off-screen selection).
  const [menuWinStart, setMenuWinStart] = useState(0);

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

  const query = value.startsWith('/') ? value.slice(1) : '';
  const menuOpen = menuActive && value.startsWith('/');
  // Reset selection + window to the top whenever the filter query changes.
  useEffect(() => {
    setMenuIdx(0);
    setMenuWinStart(0);
  }, [query]);
  const filtered = useMemo(
    () => (menuOpen ? filterEntries(PALETTE_ENTRIES, query) : []),
    [menuOpen, query]
  );
  // Clamp the selection into range whenever the filtered set changes.
  const safeIdx = filtered.length ? Math.min(menuIdx, filtered.length - 1) : 0;

  function runSlash(cmd: string) {
    onSlash(cmd).then((res) => {
      if (res) setSlashResult(res);
      setValue('');
      setMenuActive(false);
      setMenuIdx(0);
      setMenuWinStart(0);
    });
  }

  useInput((input, key) => {
    // ── Slash menu navigation (highest priority when open) ──
    if (menuOpen) {
      if (key.escape) {
        setMenuActive(false);
        return;
      }
      if (key.upArrow) {
        const newIdx = Math.max(0, safeIdx - 1);
        setMenuIdx(newIdx);
        setMenuWinStart((w) => clampWindowStart(newIdx, w, MENU_MAX_VISIBLE, filtered.length));
        return;
      }
      if (key.downArrow) {
        const newIdx = Math.min(filtered.length - 1, safeIdx + 1);
        setMenuIdx(newIdx);
        setMenuWinStart((w) => clampWindowStart(newIdx, w, MENU_MAX_VISIBLE, filtered.length));
        return;
      }
      if (key.return || key.tab) {
        const entry = filtered[safeIdx];
        if (entry) {
          if (busy) {
            // Queue the chosen command while streaming.
            onSubmit(`/${entry.name}`);
            setValue('');
            setMenuActive(false);
            setMenuIdx(0);
            setMenuWinStart(0);
            setSlashResult(`⏳ queued — will send when the current response finishes`);
          } else {
            runSlash(`/${entry.name}`);
          }
        }
        return;
      }
      // Esc/backspace/return/tab handled above; everything else falls through
      // to normal editing so the query keeps filtering as the user types.
    }

    // While busy, the user can still type + queue follow-ups (koda-style
    // pending messages). Ctrl+C aborts; Enter queues; other keys edit normally.
    if (busy) {
      if (key.ctrl && input === 'c') {
        onAbort();
        return;
      }
      if (key.return) {
        const text = value.trim();
        if (text) {
          onSubmit(text);
          setValue('');
          setMenuActive(false);
          setSlashResult(`⏳ queued — will send when the current response finishes`);
        }
        return;
      }
      // Fall through to normal editing below so the user can keep typing.
    }

    // Shift+Enter → insert newline (multi-line input).
    if (key.return && key.shift) {
      setValue((v) => v + '\n');
      setSlashResult(null);
      setTabCandidates(null);
      setMenuActive(false);
      return;
    }
    if (key.return) {
      const text = value.trim();
      if (!text) return;
      if (text.startsWith('/')) {
        runSlash(text);
        return;
      }
      onSubmit(text);
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
      setMenuActive(false);
      return;
    }
    // Tab completion (only when NOT in the slash menu — handled above).
    if (key.tab && !menuOpen) {
      if (onTab) {
        if (tabCandidates && tabCandidates.length > 1) {
          const next = (tabIdx + 1) % tabCandidates.length;
          setTabIdx(next);
          setValue(tabCandidates[next]);
        } else {
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
    if (key.upArrow && !menuOpen) {
      const next = Math.min(histIdx + 1, history.length - 1);
      if (history[history.length - 1 - next]) {
        setHistIdx(next);
        setValue(history[history.length - 1 - next].text);
      }
      return;
    }
    if (key.downArrow && !menuOpen) {
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
      // If backspace removes the leading `/`, dismiss the menu.
      const after = value.slice(0, -1);
      if (!after.startsWith('/')) setMenuActive(false);
      return;
    }
    if (key.ctrl && input === 'c') {
      onAbort();
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      const next = value + input;
      setValue(next);
      setSlashResult(null);
      setTabCandidates(null);
      // Typing `/` as the first char opens the menu; any `/`-prefixed edit
      // keeps it open.
      setMenuActive(next.startsWith('/'));
    }
  });

  const lineCount = value.split('\n').length;
  const isMultiLine = lineCount > 1;
  const winStart = clampWindowStart(safeIdx, menuWinStart, MENU_MAX_VISIBLE, filtered.length);
  const visible = filtered.slice(winStart, winStart + MENU_MAX_VISIBLE);
  const hasUp = winStart > 0;
  const hasDown = winStart + MENU_MAX_VISIBLE < filtered.length;
  const posLabel = filtered.length ? ` ${safeIdx + 1}/${filtered.length}` : '';

  return (
    <Box flexDirection="column" paddingX={1}>
      {slashResult && (
        <Box marginBottom={1}>
          <Text color={THEME.primaryDim}>{slashResult}</Text>
        </Box>
      )}
      {/* Inline slash-command menu — appears whenever the input starts with `/`. */}
      {menuOpen && filtered.length > 0 && (
        <Box flexDirection="column" marginBottom={1} flexShrink={0}>
          <Box>
            <Text color={THEME.accent2} bold>⌘ commands{posLabel}</Text>
            <Text color={THEME.primaryMute}> · ↑↓ select · ↵ run · esc cancel</Text>
          </Box>
          {hasUp && (
            <Text color={THEME.accent}>  ↑ {winStart} more above</Text>
          )}
          {visible.map((entry, i) => {
            const absIdx = winStart + i;
            const selected = absIdx === safeIdx;
            return (
              <Box key={entry.name} gap={1} flexShrink={0}>
                <Text color={selected ? THEME.accent : THEME.primaryMute}>
                  {selected ? '▸' : ' '}
                </Text>
                <Text color={selected ? THEME.primary : THEME.primaryDim} bold={selected}>
                  /{entry.name.padEnd(12)}
                </Text>
                <Text color={selected ? THEME.primaryDim : THEME.primaryMute}>
                  {entry.description.slice(0, 48)}
                </Text>
              </Box>
            );
          })}
          {hasDown && (
            <Text color={THEME.accent}>  ↓ {filtered.length - winStart - MENU_MAX_VISIBLE} more below</Text>
          )}
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
        {pendingCount > 0 && (
          <Text color={THEME.accent2}> [{pendingCount} queued]</Text>
        )}
      </Box>
      <Box>
        <Text color={THEME.primaryMute} dimColor>
          {menuOpen
            ? 'Slash menu — ↵ run highlighted · ↑↓ move · esc close'
            : busy
            ? 'Streaming — type to queue follow-ups · Enter queues · Ctrl+C abort'
            : isMultiLine
            ? `${lineCount} lines · Shift+Enter for newline · Enter to submit · Ctrl+P palette · Ctrl+C quit`
            : promptLabel || 'Enter a prompt, type / for commands · Ctrl+P palette · Ctrl+C quit'}
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
  accent2: '#8B5CF6',
};
