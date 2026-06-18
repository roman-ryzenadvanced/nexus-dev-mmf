// ============================================================
// Command palette — quick slash-command launcher (Ctrl+P)
// ============================================================

import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { REGISTRY } from '../commands/builtin.js';

interface Props {
  onPick: (command: string) => void;
  onClose: () => void;
}

export interface PaletteEntry {
  name: string;
  description: string;
  preview: string;
}

export const PALETTE_ENTRIES: PaletteEntry[] = REGISTRY.map(c => ({
  name: c.name,
  description: c.description,
  preview: c.usage,
}));

/** Pure function — filter entries by query. Exported for testing. */
export function filterEntries(entries: PaletteEntry[], query: string): PaletteEntry[] {
  if (!query) return entries;
  const q = query.toLowerCase();
  return entries.filter(e => e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q));
}

export function CommandPalette({ onPick, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const { exit } = useApp();
  void exit;

  const filtered = filterEntries(PALETTE_ENTRIES, query);
  const safeSelected = Math.min(selected, Math.max(0, filtered.length - 1));

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    if (key.return) {
      const entry = filtered[safeSelected];
      if (entry) onPick(`/${entry.name}`);
      return;
    }
    if (key.upArrow) {
      setSelected(s => Math.max(0, s - 1));
      return;
    }
    if (key.downArrow) {
      setSelected(s => Math.min(filtered.length - 1, s + 1));
      return;
    }
    if (key.backspace || key.delete) {
      setQuery(q => q.slice(0, -1));
      setSelected(0);
      return;
    }
    if (input && !key.ctrl && !key.meta && input !== 'p') {
      setQuery(q => q + input);
      setSelected(0);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="#06B6D4" paddingX={1} paddingY={0}>
      <Box>
        <Text color="#06B6D4" bold>
          ❯{' '}
        </Text>
        <Text color="#E2E8F0">{query}</Text>
        <Text color="#06B6D4">▋</Text>
      </Box>
      <Box marginTop={0}>
        <Text color="#475569" dimColor>
          {filtered.length} match{filtered.length === 1 ? '' : 'es'} · ↑↓ navigate · ↵ pick · esc cancel
        </Text>
      </Box>
      {filtered.length === 0 ? (
        <Box paddingX={1}>
          <Text color="#94A3B8">No commands match "{query}"</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={0}>
          {filtered.slice(0, 8).map((entry, idx) => (
            <Box key={entry.name} flexDirection="column">
              <Box gap={1}>
                <Text color={idx === safeSelected ? '#06B6D4' : '#475569'}>{idx === safeSelected ? '▸' : ' '}</Text>
                <Text color={idx === safeSelected ? '#E2E8F0' : '#94A3B8'} bold={idx === safeSelected}>
                  /{entry.name.padEnd(12)}
                </Text>
                <Text color={idx === safeSelected ? '#94A3B8' : '#475569'}>{entry.description.slice(0, 50)}</Text>
              </Box>
              {idx === safeSelected && (
                <Box marginLeft={2}>
                  <Text color="#475569" dimColor>
                    {entry.preview}
                  </Text>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
