// ============================================================
// Status bar — bottom of the TUI, shows active config + live metrics
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';
import { getTheme } from '../tui/theme.js';
import type { AppConfig, ChatMessage } from '../types.js';

/** Live, in-flight streaming metrics pushed from App on each delta. */
export interface StreamMetrics {
  /** Wall-clock ms since streaming began. */
  elapsedMs: number;
  /** Output tokens seen so far (approx: chars / 4). 0 during MMFE fusion. */
  tokens: number;
  /** Tokens/second over the elapsed window. */
  tps: number;
  /** MMFE pipeline progress (only set during fusion). When present, the bar
   *  shows stage + subtask throughput instead of zeroed token counts. */
  progress?: {
    stage: string;
    subtasksDone: number;
    subtasksTotal: number;
    modelsActive: string[];
  };
}

interface Props {
  config: AppConfig;
  streaming: boolean;
  lastMessage?: ChatMessage;
  /** When set + streaming, shows live tok/s + elapsed. */
  metrics?: StreamMetrics;
}

export function StatusBar({ config, streaming, lastMessage, metrics }: Props) {
  const t = getTheme();
  const mmfeLabel = config.useMMFE ? 'mmfe:on' : 'mmfe:off';
  const modeLabel = `mode:${config.mode}`;
  const providerLabel = `provider:${config.activeProviderId}`;
  const modelLabel = `model:${config.activeModelId}`;

  // Live metrics take priority during streaming.
  // During MMFE fusion there is no token stream, so we show REAL pipeline
  // progress (stage + subtask throughput) instead of misleading zeros.
  const hasProgress = streaming && !!metrics?.progress;
  const liveTps = streaming && metrics && !hasProgress ? `${metrics.tps.toFixed(1)} tok/s` : '';
  const liveTokens = streaming && metrics && !hasProgress ? `${metrics.tokens} tok` : '';
  const liveElapsed = streaming && metrics ? fmtElapsed(metrics.elapsedMs) : '';
  const progressLabel =
    hasProgress && metrics?.progress ? `${metrics.progress.stage} ${metrics.progress.subtasksDone}/${metrics.progress.subtasksTotal || '?'}` : '';

  // Final metrics from the last completed message.
  const latency = !streaming && lastMessage?.elapsedMs != null ? `${Math.round(lastMessage.elapsedMs)}ms` : '';
  const quality = lastMessage?.qualityScore ? `Q:${lastMessage.qualityScore}/100` : '';
  const models = lastMessage?.model ? `via ${lastMessage.model}` : '';
  const tokens = !streaming && lastMessage?.tokens ? `${lastMessage.tokens.input}↑ ${lastMessage.tokens.output}↓` : '';

  return (
    <Box flexDirection="row" justifyContent="space-between" paddingX={1}>
      <Box gap={1}>
        <Text color={config.useMMFE ? t.accent : t.primaryMute}>{mmfeLabel}</Text>
        <Text color={t.primaryMute}>|</Text>
        <Text color={t.accent2}>{modeLabel}</Text>
        <Text color={t.primaryMute}>|</Text>
        <Text color={t.primaryDim}>{providerLabel}</Text>
        <Text color={t.primaryMute}>|</Text>
        <Text color={t.primaryDim}>{modelLabel}</Text>
      </Box>
      <Box gap={1}>
        {streaming && <Text color={t.warn}>● streaming</Text>}
        {progressLabel && <Text color={t.accent2}>{progressLabel}</Text>}
        {liveTps && <Text color={t.accent}>{liveTps}</Text>}
        {liveTokens && <Text color={t.primaryDim}>{liveTokens}</Text>}
        {liveElapsed && <Text color={t.primaryDim}>{liveElapsed}</Text>}
        {models && <Text color={t.primaryDim}>{models}</Text>}
        {latency && <Text color={t.primaryDim}>{latency}</Text>}
        {tokens && <Text color={t.primaryMute}>{tokens}</Text>}
        {quality && <Text color={t.success}>{quality}</Text>}
      </Box>
    </Box>
  );
}

function fmtElapsed(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m${rem}s`;
}
