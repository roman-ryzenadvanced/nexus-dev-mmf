// ============================================================
// Help overlay — rendered when /help is invoked
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';
import { REGISTRY } from '../commands/builtin.js';

const THEME = {
  accent: '#06B6D4',
  accent2: '#8B5CF6',
  primary: '#E2E8F0',
  primaryDim: '#94A3B8',
  primaryMute: '#475569',
};

export function HelpOverlay() {
  return (
    <Box flexDirection="column" paddingX={1} borderStyle="round" borderColor={THEME.accent}>
      <Box marginBottom={1}>
        <Text color={THEME.accent} bold>nexus-code — slash commands</Text>
      </Box>
      {REGISTRY.map((cmd) => (
        <Box key={cmd.name} gap={1}>
          <Text color={THEME.accent2}>{`/${cmd.name}`.padEnd(14)}</Text>
          <Text color={THEME.primaryDim}>{cmd.description}</Text>
        </Box>
      ))}
    </Box>
  );
}
