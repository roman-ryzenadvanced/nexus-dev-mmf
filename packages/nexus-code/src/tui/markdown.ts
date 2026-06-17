// ============================================================
// Markdown renderer — minimal, terminal-friendly
// ============================================================

import chalk from 'chalk';
import { color } from './theme.js';

export function renderMarkdown(src: string): string {
  const lines = src.split('\n');
  const out: string[] = [];
  let inCode = false;
  let inList = false;

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');

    // Fenced code blocks
    if (line.trim().startsWith('```')) {
      inCode = !inCode;
      out.push(color.dim(line));
      continue;
    }
    if (inCode) {
      out.push(chalk.hex('#06B6D4')(line));
      continue;
    }

    // Headings
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const [, hashes, text] = heading;
      const size = hashes.length;
      const styled = size <= 2 ? color.bold.hex('#06B6D4')(text) : color.bold(text);
      out.push(styled);
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      out.push(color.dim(`  │ ${line.slice(2)}`));
      continue;
    }

    // Bulleted list
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      inList = true;
      out.push(`  ${color.accent('•')} ${inlineFormat(bullet[1])}`);
      continue;
    }
    if (inList && line.trim() === '') {
      inList = false;
      out.push('');
      continue;
    }

    // Tables (very rough)
    if (line.startsWith('|') && line.endsWith('|')) {
      out.push(color.dim(line));
      continue;
    }

    // Plain paragraph
    if (line.trim()) {
      out.push(`  ${inlineFormat(line)}`);
    } else {
      out.push('');
    }
  }

  return out.join('\n');
}

function inlineFormat(text: string): string {
  let t = text;
  // Inline code
  t = t.replace(/`([^`]+)`/g, (_, c) => chalk.hex('#06B6D4')(`\`${c}\``));
  // Bold
  t = t.replace(/\*\*([^*]+)\*\*/g, (_, c) => color.bold(c));
  // Italic
  t = t.replace(/(^|[^*])\*([^*]+)\*/g, (_, pre, c) => `${pre}${chalk.italic(c)}`);
  // Links
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) =>
    `${chalk.hex('#06B6D4').underline(label)} ${color.dim(`(${url})`)}`
  );
  return t;
}
