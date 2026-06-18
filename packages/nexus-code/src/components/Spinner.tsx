// ============================================================
// Spinner — self-ticking braille spinner (grok-build inspired).
//
// A tiny reusable animation: renders one frame of a braille roller,
// advancing on a ~70ms interval. The interval is unref'd so it never
// keeps the event loop alive on quit. Pure Ink + React, no deps.
//
// Use anywhere a transient "working…" feel is wanted (status bar,
// boot steps, inline progress). Keep the frame set small — each tick
// is a re-render.
// ============================================================

import React, { useEffect, useState } from 'react';
import { Text } from 'ink';

export const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;
const DEFAULT_INTERVAL_MS = 80;

export interface SpinnerProps {
  /** Hex color for the spinner glyph. */
  color?: string;
  /** Optional label rendered after the glyph. */
  label?: string;
  /** Label color (defaults to a muted slate). */
  labelColor?: string;
  /** Frame advance interval. Defaults to 80ms. */
  intervalMs?: number;
  /** Pause the animation — renders the first frame statically. */
  paused?: boolean;
}

export function Spinner({ color = '#06B6D4', label, labelColor = '#94A3B8', intervalMs = DEFAULT_INTERVAL_MS, paused = false }: SpinnerProps) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setFrame(n => (n + 1) % SPINNER_FRAMES.length), intervalMs);
    // unref so the ticker never blocks process exit
    id.unref?.();
    return () => clearInterval(id);
  }, [paused, intervalMs]);

  return (
    <Text>
      <Text color={color}>{SPINNER_FRAMES[frame]}</Text>
      {label ? <Text color={labelColor}> {label}</Text> : null}
    </Text>
  );
}
