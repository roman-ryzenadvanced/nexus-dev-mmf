// ============================================================
// Chat view — renders the message transcript.
//
// Rendering model (ported from koda's @openadapter/koda-tui):
//   koda's TUI never overlaps or clips because every component
//   renders to `string[]` lines and the TUI only paints the lines
//   that fit the viewport (tracked via a viewport-top + maxVisible
//   window). Ink's flexbox can't measure the height of bordered
//   multi-line children reliably, which is the root cause of our
//   overlap / cut-off / disappearing-input bugs.
//
//   So we adopt the same model here: flatten the whole transcript
//   (messages + streaming buffer) into a flat array of styled Lines,
//   each guaranteed to be exactly one terminal row. Then render only
//   the window `[scrollTop, scrollTop+viewport]`. Because the content
//   we hand Ink never exceeds the viewport height, there is nothing
//   for flex to squeeze — overlap and cut-off become impossible.
//
//   PageUp / PageDown / Ctrl+↑ / Ctrl+↓ scroll back through history;
//   the view auto-follows the latest line while streaming (koda-style
//   "pinned to bottom" until the user scrolls up).
// ============================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { SIGILS, getTheme } from '../tui/theme.js';
import { renderMarkdown } from '../tui/markdown.js';
import type { ChatMessage } from '../types.js';

interface Props {
  messages: ChatMessage[];
  streaming: boolean;
  streamBuffer: string;
  showRouting: boolean;
  showTokens: boolean;
  /** Rows outside the transcript (header+status+input+errors). Default 4. */
  reservedRows?: number;
}

// A Line is one terminal row. Segments allow per-token color (so a header
// row can mix role color + dim meta + accent), exactly like koda's Text
// component composing colored runs on a single physical line.
interface Seg { text: string; color?: string; bold?: boolean; dim?: boolean; }
interface Line { segs: Seg[]; }
const blank: Line = { segs: [{ text: ' ' }] };

function seg(text: string, color?: string, opts?: { bold?: boolean; dim?: boolean }): Seg {
  return { text, color, bold: opts?.bold, dim: opts?.dim };
}

// ---- formatters ----
function fmtTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m${rem}s`;
}
function fmtTps(outputTokens: number, elapsedMs: number): string {
  const secs = elapsedMs / 1000;
  if (secs <= 0) return '';
  return `${(outputTokens / secs).toFixed(1)} tok/s`;
}

// Word-wrap a single logical line to `width`, respecting existing newlines.
// Mirrors koda's Text word-wrap: never breaks mid-word, one row per chunk.
function wrapLine(text: string, width: number): string[] {
  if (!text) return [' '];
  const out: string[] = [];
  for (const piece of text.split('\n')) {
    if (piece.length <= width) { out.push(piece.length ? piece : ' '); continue; }
    const words = piece.split(' ');
    let cur = '';
    for (const w of words) {
      if ((cur + (cur ? ' ' : '') + w).length <= width) {
        cur += (cur ? ' ' : '') + w;
      } else {
        if (cur) out.push(cur);
        // Hard-break a single word longer than the width.
        let rest = w;
        while (rest.length > width) { out.push(rest.slice(0, width)); rest = rest.slice(width); }
        cur = rest;
      }
    }
    out.push(cur || ' ');
  }
  return out;
}

// All models that contributed to a message (primary field may be comma-joined
// for MMFE fusion; routing decisions name more).
function involvedModels(m: ChatMessage, showRouting: boolean): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of (m.model || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    if (!seen.has(name)) { seen.add(name); out.push(name); }
  }
  if (showRouting && m.routing) {
    for (const r of m.routing) {
      if (r.selectedModel && !seen.has(r.selectedModel)) { seen.add(r.selectedModel); out.push(r.selectedModel); }
    }
  }
  return out;
}

// Render one message to a list of styled Lines (no Ink borders — borders were
// only needed to fight flex overlap, which the window model eliminates).
function messageToLines(m: ChatMessage, showRouting: boolean, showTokens: boolean, width: number, t: ReturnType<typeof getTheme>): Line[] {
  const contentWidth = Math.max(8, width - 2);
  const isObserver = m.provider === 'observer';
  const roleColor =
    isObserver ? t.accent2
    : m.role === 'user' ? t.accent
    : m.role === 'assistant' ? t.primary
    : m.role === 'system' ? t.primaryDim
    : t.warn;
  const sigil =
    isObserver ? '👁'
    : m.role === 'user' ? SIGILS.user
    : m.role === 'assistant' ? SIGILS.assistant
    : m.role === 'system' ? SIGILS.system
    : SIGILS.tool;
  const roleLabel = isObserver ? 'observer' : m.role;

  const lines: Line[] = [];

  // Header line: sigil + role (colored) + dim meta segments.
  const header: Seg[] = [
    seg(`${sigil} ${roleLabel}`, roleColor, { bold: true }),
  ];
  if (m.elapsedMs != null) header.push(seg(` · ${fmtTime(m.elapsedMs)}`, t.primaryMute, { dim: true }));
  if (showTokens && m.tokens) header.push(seg(` · ${m.tokens.input}↑ ${m.tokens.output}↓`, t.primaryMute, { dim: true }));
  if (m.tokens?.output && m.elapsedMs) {
    const tps = fmtTps(m.tokens.output, m.elapsedMs);
    if (tps) header.push(seg(` · ${tps}`, t.accent, { dim: true }));
  }
  if (m.qualityScore != null) header.push(seg(` · Q:${m.qualityScore}/100`, t.success, { dim: true }));
  lines.push({ segs: header });

  // Involved-models line.
  const models = involvedModels(m, showRouting);
  if (models.length > 0) {
    const ms: Seg[] = [seg(models.length > 1 ? `${models.length} models: ` : 'model: ', t.primaryMute, { dim: true })];
    models.forEach((name, i) => {
      ms.push(seg(name, i === 0 ? t.accent2 : t.primaryDim));
      if (i < models.length - 1) ms.push(seg(', ', t.primaryMute, { dim: true }));
    });
    lines.push({ segs: ms });
  }

  // Content lines (markdown → wrapped, one row each).
  const md = renderMarkdown(m.content || '');
  for (const w of wrapLine(md, contentWidth)) lines.push({ segs: [seg(w, t.primary)] });

  // Routing lines.
  if (showRouting && m.routing && m.routing.length > 0) {
    for (const r of m.routing) {
      lines.push({
        segs: [
          seg(`${SIGILS.routing} `, t.primaryMute, { dim: true }),
          seg(`${r.subtaskLabel} `, t.primaryDim),
          seg(`→ ${r.selectedModel} `, t.accent2),
          seg(`${Math.round(r.confidence * 100)}%`, t.primaryMute, { dim: true }),
        ],
      });
    }
    if (m.qualityScore != null) {
      lines.push({
        segs: [
          seg(`${SIGILS.routing} `, t.primaryMute, { dim: true }),
          seg(`quality ${m.qualityScore}/100`, t.success),
        ],
      });
    }
  }

  // Blank separator between blocks.
  lines.push(blank);
  return lines;
}

// Animated streaming indicator frames.
const ROLLER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const DOT_FRAMES = ['   ', '.  ', '.. ', '...'];
const FRAME_MS = 80;

function streamingToLines(buffer: string, tick: number, width: number, t: ReturnType<typeof getTheme>): Line[] {
  const contentWidth = Math.max(8, width - 2);
  const roller = ROLLER_FRAMES[tick % ROLLER_FRAMES.length];
  const dots = DOT_FRAMES[tick % DOT_FRAMES.length];
  const lines: Line[] = [];
  lines.push({
    segs: [
      seg(`${SIGILS.assistant} assistant `, t.accent2, { bold: true }),
      seg(`${roller} `, t.accent2),
      seg(`streaming${dots}`, t.primaryDim, { dim: true }),
    ],
  });
  const md = renderMarkdown(buffer || '');
  for (const w of wrapLine(md, contentWidth)) lines.push({ segs: [seg(w, t.primary)] });
  lines.push(blank);
  return lines;
}

export function ChatView({ messages, streaming, streamBuffer, showRouting, showTokens, reservedRows = 4 }: Props) {
  const t = getTheme();
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 80;
  const rows = stdout?.rows ?? 40;
  // Reserve one row for our own scroll indicator.
  const viewport = Math.max(6, rows - reservedRows - 1);

  // Animation tick — only ticks while streaming, so idle transcripts don't redraw.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!streaming) return;
    const id = setInterval(() => setTick((n) => (n + 1) % 1000000), FRAME_MS);
    return () => clearInterval(id);
  }, [streaming]);

  // Flatten the whole transcript into styled lines (memoized).
  const allLines = useMemo<Line[]>(() => {
    const out: Line[] = [];
    for (const m of messages) out.push(...messageToLines(m, showRouting, showTokens, cols, t));
    if (streaming) out.push(...streamingToLines(streamBuffer, tick, cols, t));
    return out;
  }, [messages, streaming, streamBuffer, showRouting, showTokens, cols, t, tick]);

  const [scrollTop, setScrollTop] = useState(0);
  const autoFollowRef = useRef(true);
  const maxTop = Math.max(0, allLines.length - viewport);

  // Auto-follow the tail (koda "pinned to bottom") unless the user scrolled up.
  useEffect(() => {
    if (autoFollowRef.current) setScrollTop(maxTop);
  }, [maxTop]);

  const top = Math.min(scrollTop, maxTop);
  const atBottom = top >= maxTop;
  useEffect(() => {
    if (atBottom) autoFollowRef.current = true;
  }, [atBottom]);

  // Scrollback keys. PageUp/PageDown + Ctrl+↑/Ctrl+↓. These are non-character
  // keys so they never pollute the InputBox text or history (↑/↓ alone stay
  // owned by InputBox for history navigation).
  useInput((_input, key) => {
    const page = Math.max(1, viewport - 2);
    if (key.pageDown || (key.ctrl && key.downArrow)) {
      autoFollowRef.current = false;
      setScrollTop((s) => Math.min(maxTop, s + page));
    } else if (key.pageUp || (key.ctrl && key.upArrow)) {
      autoFollowRef.current = false;
      setScrollTop((s) => Math.max(0, s - page));
    } else if (key.ctrl && _input === 'end') {
      autoFollowRef.current = true;
      setScrollTop(maxTop);
    } else if (key.ctrl && _input === 'home') {
      autoFollowRef.current = false;
      setScrollTop(0);
    }
  });

  const above = top;
  const below = allLines.length - (top + viewport);
  const window = allLines.slice(top, top + viewport);

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box flexDirection="column" height={viewport}>
        {window.map((l, i) => (
          <Text key={top + i} wrap="truncate">
            {l.segs.map((s, j) => (
              <Text key={j} color={s.color} bold={s.bold} dimColor={s.dim}>{s.text}</Text>
            ))}
          </Text>
        ))}
      </Box>
      {/* Scroll indicator — koda-style scrollInfo. Only shown when scrollable. */}
      <Box>
        {allLines.length > viewport ? (
          <Text dimColor>
            {above > 0 ? `↑ ${above} above` : '── top ──'}
            {'  ·  '}
            {below > 0 ? `↓ ${below} below` : '── bottom ──'}
            {'  '}
            <Text color={t.primaryMute}>(PgUp/PgDn scroll)</Text>
          </Text>
        ) : (
          <Text> </Text>
        )}
      </Box>
    </Box>
  );
}
