// ============================================================
// Session picker — shown on boot so the user can resume a saved
// conversation or start fresh. Mirrors the slash-menu look & feel.
// ============================================================

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

export interface PickerSession {
  name: string;
  updatedAt: number;
  /** True for the auto-saved __current__ slot — labelled "last session". */
  isCurrent?: boolean;
}

export interface PickerChoice {
  action: 'new' | 'resume';
  name?: string;
}

interface Props {
  sessions: PickerSession[];
  onPick: (choice: PickerChoice) => void;
}

/** Relative time label, e.g. "5m ago", "2h ago", "3d ago", or a date. */
function relTime(ts: number): string {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function SessionPicker({ sessions, onPick }: Props) {
  // Row 0 = "Start new"; rows 1..N = saved sessions.
  const total = sessions.length + 1;
  const [idx, setIdx] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setIdx(i => (i - 1 + total) % total);
      return;
    }
    if (key.downArrow) {
      setIdx(i => (i + 1) % total);
      return;
    }
    if (key.return) {
      if (idx === 0) onPick({ action: 'new' });
      else onPick({ action: 'resume', name: sessions[idx - 1].name });
      return;
    }
    if (input === 'n' || input === 'N') {
      onPick({ action: 'new' });
      return;
    }
    if (key.escape) {
      onPick({ action: 'new' });
      return;
    }
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text color="#8B5CF6" bold>
          ✦ Welcome back
        </Text>
        <Text color="#475569"> — resume a conversation or start fresh</Text>
      </Box>
      <Box flexDirection="column" marginBottom={1}>
        <Box gap={1}>
          <Text color={idx === 0 ? '#06B6D4' : '#475569'}>{idx === 0 ? '▸' : ' '}</Text>
          <Text color={idx === 0 ? '#E2E8F0' : '#94A3B8'} bold={idx === 0}>
            {'+ Start a new session'.padEnd(28)}
          </Text>
        </Box>
        {sessions.length === 0 && <Text color="#475569"> (no saved sessions yet)</Text>}
        {sessions.map((s, i) => {
          const rowIdx = i + 1;
          const selected = rowIdx === idx;
          const label = s.isCurrent ? `↻ ${s.name} (last session)` : `↻ ${s.name}`;
          return (
            <Box key={`${s.name}-${i}`} gap={1}>
              <Text color={selected ? '#06B6D4' : '#475569'}>{selected ? '▸' : ' '}</Text>
              <Text color={selected ? '#E2E8F0' : '#94A3B8'} bold={selected}>
                {label.slice(0, 28).padEnd(28)}
              </Text>
              <Text color={selected ? '#94A3B8' : '#475569'}>{relTime(s.updatedAt)}</Text>
            </Box>
          );
        })}
      </Box>
      <Box>
        <Text color="#475569" dimColor>
          ↑↓ move · ↵ select · [n] new · esc new · {idx}/{total}
        </Text>
      </Box>
    </Box>
  );
}
