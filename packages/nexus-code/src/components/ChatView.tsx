// ============================================================
// Chat view — renders the message transcript
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';
import { color, SIGILS } from '../tui/theme.js';
import { renderMarkdown } from '../tui/markdown.js';
import type { ChatMessage } from '../types.js';

interface Props {
  messages: ChatMessage[];
  streaming: boolean;
  streamBuffer: string;
  showRouting: boolean;
  showTokens: boolean;
}

export function ChatView({ messages, streaming, streamBuffer, showRouting, showTokens }: Props) {
  return (
    <Box flexDirection="column" paddingX={1}>
      {messages.map((m) => (
        <MessageBlock
          key={m.id}
          message={m}
          showRouting={showRouting}
          showTokens={showTokens}
        />
      ))}
      {streaming && (
        <Box flexDirection="column">
          <Text color={THEME.accent}>
            {SIGILS.assistant} assistant{' '}
            <Text color={THEME.primaryDim}>(streaming…)</Text>
          </Text>
          <Text>{renderMarkdown(streamBuffer)}</Text>
        </Box>
      )}
    </Box>
  );
}

function MessageBlock({
  message: m,
  showRouting,
  showTokens,
}: {
  message: ChatMessage;
  showRouting: boolean;
  showTokens: boolean;
}) {
  const roleColor =
    m.role === 'user' ? THEME.accent
    : m.role === 'assistant' ? THEME.primary
    : m.role === 'system' ? THEME.primaryDim
    : THEME.warn;
  const sigil =
    m.role === 'user' ? SIGILS.user
    : m.role === 'assistant' ? SIGILS.assistant
    : m.role === 'system' ? SIGILS.system
    : SIGILS.tool;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box gap={1}>
        <Text color={roleColor}>{sigil}</Text>
        <Text color={roleColor} bold>{m.role}</Text>
        {m.model && <Text color={THEME.primaryDim}>· {m.model}</Text>}
        {m.elapsedMs != null && <Text color={THEME.primaryMute}>{Math.round(m.elapsedMs)}ms</Text>}
        {showTokens && m.tokens && (
          <Text color={THEME.primaryMute}>
            {m.tokens.input}↑ {m.tokens.output}↓
          </Text>
        )}
      </Box>
      <Box marginLeft={2}>
        <Text>{renderMarkdown(m.content)}</Text>
      </Box>
      {showRouting && m.routing && m.routing.length > 0 && (
        <Box marginLeft={2} marginTop={1} flexDirection="column">
          {m.routing.map((r) => (
            <Box key={r.subTaskId} gap={1}>
              <Text color={THEME.primaryMute}>{SIGILS.routing}</Text>
              <Text color={THEME.primaryDim}>{r.subtaskLabel}</Text>
              <Text color={THEME.accent2}>→ {r.selectedModel}</Text>
              <Text color={THEME.primaryMute}>{(r.confidence * 100).toFixed(0)}%</Text>
            </Box>
          ))}
          {m.qualityScore != null && (
            <Box gap={1}>
              <Text color={THEME.primaryMute}>{SIGILS.routing}</Text>
              <Text color={THEME.success}>quality {m.qualityScore}/100</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

const THEME = {
  primary: '#E2E8F0',
  primaryDim: '#94A3B8',
  primaryMute: '#475569',
  accent: '#06B6D4',
  accent2: '#8B5CF6',
  success: '#10B981',
  warn: '#F59E0B',
};

void color;
