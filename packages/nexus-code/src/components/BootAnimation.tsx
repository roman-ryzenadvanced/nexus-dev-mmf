// ============================================================
// Boot animation — branded startup splash (grok-build inspired)
//
// Shows the nexus-code ASCII banner plus an animated checklist of
// init steps (each steps through a roller then resolves to a ✓).
// Auto-dismisses when all steps resolve; any key skips to the end.
// Pure Ink + React state, no external deps.
// ============================================================

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { getTheme } from '../tui/theme.js';

const BANNER = [
  ' ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗',
  ' ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝',
  ' ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗',
  ' ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║',
  ' ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║',
  ' ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝',
];

const STEPS = ['Loading configuration', 'Initializing providers', 'Fetching models', 'Loading plugins', 'Registering tools', 'Connecting MCP servers', 'Ready'];

const ROLLER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const STEP_MS = 180; // time to resolve each step
const FRAME_MS = 70; // spinner frame speed

interface Props {
  onDone: () => void;
}

export function BootAnimation({ onDone }: Props) {
  const t = getTheme();
  const { exit } = useApp();
  void exit;
  const [resolved, setResolved] = useState(0); // how many steps are ✓
  const [frame, setFrame] = useState(0);

  // Spinner ticker
  useEffect(() => {
    const id = setInterval(() => setFrame((n: number) => n + 1), FRAME_MS);
    return () => clearInterval(id);
  }, []);

  // Resolve steps one-by-one; finish when all are done.
  useEffect(() => {
    if (resolved >= STEPS.length) {
      const done = setTimeout(onDone, 220);
      return () => clearTimeout(done);
    }
    const id = setTimeout(() => setResolved((n: number) => n + 1), STEP_MS);
    return () => clearTimeout(id);
  }, [resolved, onDone]);

  // Any key → jump straight to the end.
  useInput(() => {
    setResolved(STEPS.length);
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box flexDirection="column" marginBottom={1}>
        {BANNER.map((line, i) => (
          <Text key={i} color={t.accent}>
            {line}
          </Text>
        ))}
        <Text color={t.accent2} bold>
          {' '}
          C O D E
        </Text>
        <Text color={t.primaryDim}> multi-model fusion · terminal native</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {STEPS.map((label, i) => {
          const isDone = i < resolved;
          const isActive = i === resolved;
          if (isDone) {
            return (
              <Box key={i} gap={1}>
                <Text color={t.success}>✓</Text>
                <Text color={t.primaryDim}>{label}</Text>
              </Box>
            );
          }
          if (isActive) {
            return (
              <Box key={i} gap={1}>
                <Text color={t.accent2}>{ROLLER[frame % ROLLER.length]}</Text>
                <Text color={t.primary}>{label}…</Text>
              </Box>
            );
          }
          return (
            <Box key={i} gap={1}>
              <Text color={t.primaryMute}>·</Text>
              <Text color={t.primaryMute}>{label}</Text>
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text color={t.primaryMute}>press any key to skip</Text>
      </Box>
    </Box>
  );
}
