// ============================================================
// OptionPicker — reusable scrollable picker (mimo/koda style).
//
// Used by /provider, /model, /mode, /theme, and any other command that
// presents a list to choose from. Renders a fixed window that follows
// the selection (no off-screen highlight), with ↑/↓ + Enter + Esc,
// optional per-option metadata, and a live query filter.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

export interface PickerOption {
  /** Stable id returned on pick. */
  id: string;
  /** Primary label shown left-aligned. */
  label: string;
  /** Optional secondary detail (e.g. "[mmfe]", "87 tok/s"). */
  detail?: string;
  /** Optional right-aligned meta (e.g. context window, fetchedAt). */
  meta?: string;
}

interface Props {
  title: string;
  options: PickerOption[];
  onPick: (id: string) => void;
  onClose: () => void;
  /** Currently-selected id (gets the ● marker + initial highlight). */
  currentId?: string;
  /** Max visible rows before scrolling kicks in. */
  maxVisible?: number;
  /** Show a free-text filter line. Default true. */
  filterable?: boolean;
  /** Hint line shown under the list. */
  hint?: string;
}

const DEFAULT_MAX = 7;

function clampStart(idx: number, start: number, vis: number, total: number): number {
  if (total <= vis) return 0;
  let s = start;
  if (idx < s) s = idx;
  if (idx >= s + vis) s = idx - vis + 1;
  return Math.max(0, Math.min(s, total - vis));
}

export function OptionPicker({ title, options, onPick, onClose, currentId, maxVisible = DEFAULT_MAX, filterable = true, hint }: Props) {
  const [query, setQuery] = useState('');
  const [idx, setIdx] = useState(0);
  const [start, setStart] = useState(0);

  const filtered = useMemo(() => {
    if (!filterable || !query) return options;
    const q = query.toLowerCase();
    return options.filter(o => o.id.toLowerCase().includes(q) || o.label.toLowerCase().includes(q) || (o.detail || '').toLowerCase().includes(q));
  }, [options, query, filterable]);

  // Keep highlight in range when the filter changes.
  useEffect(() => {
    setIdx(0);
    setStart(0);
  }, [query]);

  // Start on the currently-active option so the picker feels contextual.
  useEffect(() => {
    if (!currentId || query) return;
    const i = filtered.findIndex(o => o.id === currentId);
    if (i >= 0) {
      setIdx(i);
      setStart(clampStart(i, 0, maxVisible, filtered.length));
    }
  }, [currentId, filtered, maxVisible, query]);

  const total = filtered.length;
  const vis = Math.min(maxVisible, total || 1);
  const safeIdx = total ? Math.min(idx, total - 1) : 0;
  const winStart = clampStart(safeIdx, start, vis, total);
  const window = filtered.slice(winStart, winStart + vis);
  const hasUp = winStart > 0;
  const hasDown = winStart + vis < total;

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    if (key.upArrow) {
      const n = (safeIdx - 1 + total) % total;
      setIdx(n);
      setStart(s => clampStart(n, s, vis, total));
      return;
    }
    if (key.downArrow) {
      const n = total ? (safeIdx + 1) % total : 0;
      setIdx(n);
      setStart(s => clampStart(n, s, vis, total));
      return;
    }
    if (key.return) {
      const pick = filtered[safeIdx];
      if (pick) onPick(pick.id);
      return;
    }
    if (key.backspace || key.delete) {
      setQuery(q => q.slice(0, -1));
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      setQuery(q => q + input);
    }
  });

  return (
    <Box flexDirection="column" marginY={1} paddingX={1} flexShrink={0}>
      <Box marginBottom={0}>
        <Text color="#8B5CF6" bold>
          ✦ {title}
        </Text>
        {filterable && (
          <Text color="#475569">
            {' · '}
            {query ? <Text color="#06B6D4">filter: {query}</Text> : 'type to filter'}
          </Text>
        )}
        <Text color="#475569"> · {total ? `${safeIdx + 1}/${total}` : '0'}</Text>
      </Box>

      {total === 0 ? (
        <Text color="#94A3B8"> No options match “{query}”.</Text>
      ) : (
        <>
          {hasUp && <Text color="#06B6D4"> ↑ {winStart} more</Text>}
          {window.map((o, i) => {
            const abs = winStart + i;
            const selected = abs === safeIdx;
            const isCurrent = o.id === currentId;
            return (
              <Box key={o.id} gap={1} flexShrink={0}>
                <Text color={selected ? '#06B6D4' : '#475569'}>{selected ? '▸' : ' '}</Text>
                <Text color={isCurrent ? '#10B981' : '#475569'}>{isCurrent ? '●' : ' '}</Text>
                <Text color={selected ? '#E2E8F0' : '#94A3B8'} bold={selected}>
                  {o.label}
                </Text>
                {o.detail && <Text color={selected ? '#94A3B8' : '#475569'}>{o.detail}</Text>}
                {o.meta && <Text color="#475569"> {o.meta}</Text>}
              </Box>
            );
          })}
          {hasDown && <Text color="#06B6D4"> ↓ {total - winStart - vis} more</Text>}
        </>
      )}

      <Text color="#475569" dimColor>
        {hint || '↑↓ move · ↵ select · type to filter · esc cancel'}
      </Text>
    </Box>
  );
}
