// ============================================================
// Status bar — bottom of the TUI, shows active config + metrics
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';
import { color } from '../tui/theme.js';
import type { AppConfig, ChatMessage } from '../types.js';

interface Props {
  config: AppConfig;
  streaming: boolean;
  lastMessage?: ChatMessage;
}

export function StatusBar({ config, streaming, lastMessage }: Props) {
  const mmfeLabel = config.useMMFE ? 'mmfe:on' : 'mmfe:off';
  const modeLabel = `mode:${config.mode}`;
  const providerLabel = `provider:${config.activeProviderId}`;
  const modelLabel = `model:${config.activeModelId}`;
  const latency = lastMessage?.elapsedMs ? `${Math.round(lastMessage.elapsedMs)}ms` : '';
  const quality = lastMessage?.qualityScore ? `Q:${lastMessage.qualityScore}/100` : '';
  const models = lastMessage?.model ? `via ${lastMessage.model}` : '';
  const tokens = lastMessage?.tokens
    ? `${lastMessage.tokens.input}↑ ${lastMessage.tokens.output}↓`
    : '';

  return (
    <Box flexDirection="row" justifyContent="space-between" paddingX={1}>
      <Box gap={1}>
        <Text color={config.useMMFE ? THEME.accent : THEME.primaryMute}>{mmfeLabel}</Text>
        <Text color={THEME.primaryMute}>|</Text>
        <Text color={THEME.accent2}>{modeLabel}</Text>
        <Text color={THEME.primaryMute}>|</Text>
        <Text color={THEME.primaryDim}>{providerLabel}</Text>
        <Text color={THEME.primaryMute}>|</Text>
        <Text color={THEME.primaryDim}>{modelLabel}</Text>
      </Box>
      <Box gap={1}>
        {streaming && <Text color={THEME.warn}>● streaming</Text>}
        {models && <Text color={THEME.primaryDim}>{models}</Text>}
        {latency && <Text color={THEME.primaryDim}>{latency}</Text>}
        {tokens && <Text color={THEME.primaryMute}>{tokens}</Text>}
        {quality && <Text color={THEME.success}>{quality}</Text>}
      </Box>
    </Box>
  );
}

// Local copy of theme tokens for JSX
const THEME = {
  bg: '#0A0E1A',
  primary: '#E2E8F0',
  primaryDim: '#94A3B8',
  primaryMute: '#475569',
  accent: '#06B6D4',
  accent2: '#8B5CF6',
  success: '#10B981',
  warn: '#F59E0B',
};

// Suppress unused import for color (kept for non-JSX usages)
void color;
