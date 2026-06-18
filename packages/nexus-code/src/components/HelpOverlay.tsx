// ============================================================
// Help overlay — rendered when /help is invoked
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';
import { getTheme } from '../tui/theme.js';
import { REGISTRY } from '../commands/builtin.js';

export function HelpOverlay() {
  const t = getTheme();
  return (
    <Box flexDirection="column" paddingX={1} borderStyle="round" borderColor={t.accent}>
      <Box marginBottom={1}>
        <Text color={t.accent} bold>
          nexus-code — slash commands
        </Text>
      </Box>
      {REGISTRY.map(cmd => (
        <Box key={cmd.name} gap={1}>
          <Text color={t.accent2}>{`/${cmd.name}`.padEnd(14)}</Text>
          <Text color={t.primaryDim}>{cmd.description}</Text>
        </Box>
      ))}
    </Box>
  );
}
