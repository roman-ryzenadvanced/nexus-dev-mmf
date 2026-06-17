import { describe, it, expect } from 'vitest';
import { REGISTRY } from '../commands/builtin.js';

// Replicate the handleTab logic from App.tsx for pure-function testing.
// (The actual handler in App.tsx depends on React state — we test the
// pure filtering logic here, which is the bulk of the implementation.)
function tabComplete(input: string, history: string[]): string[] {
  if (input.startsWith('/')) {
    const q = input.slice(1).toLowerCase();
    return REGISTRY
      .filter((c) => c.name.startsWith(q) || c.aliases?.some((a) => a.startsWith(q)))
      .flatMap((c) => [`/${c.name}`, ...(c.aliases?.map((a) => `/${a}`) || [])])
      // Match case-insensitively against the user's input
      .filter((s) => s.toLowerCase().startsWith(input.toLowerCase()))
      .slice(0, 8);
  }
  const q = input.toLowerCase();
  const seen = new Set<string>();
  const matches: string[] = [];
  for (let i = history.length - 1; i >= 0 && matches.length < 8; i--) {
    const t = history[i];
    if (t.toLowerCase().startsWith(q) && !seen.has(t)) {
      seen.add(t);
      matches.push(t);
    }
  }
  return matches;
}

describe('tab autocomplete', () => {
  describe('slash command completion', () => {
    it('completes /mo to /mode and /model', () => {
      const results = tabComplete('/mo', []);
      expect(results).toContain('/mode');
      expect(results).toContain('/model');
    });

    it('completes /h to /help, /history', () => {
      const results = tabComplete('/h', []);
      expect(results).toContain('/help');
      expect(results).toContain('/history');
    });

    it('returns single match when input is unique', () => {
      const results = tabComplete('/status', []);
      expect(results).toEqual(['/status']);
    });

    it('returns empty for unknown command prefix', () => {
      const results = tabComplete('/xyz', []);
      expect(results).toEqual([]);
    });

    it('completes aliases', () => {
      const results = tabComplete('/?', []);
      expect(results).toContain('/?');
    });

    it('returns at most 8 candidates', () => {
      // Empty slash — all commands match
      const results = tabComplete('/', []);
      expect(results.length).toBeLessThanOrEqual(8);
    });

    it('is case-insensitive on the command name', () => {
      const results = tabComplete('/MODE', []);
      expect(results).toContain('/mode');
    });

    it('matches /m to mode, model, mmfe, mcp', () => {
      const results = tabComplete('/m', []);
      const names = results;
      expect(names).toContain('/mode');
      expect(names).toContain('/model');
      expect(names).toContain('/mmfe');
      expect(names).toContain('/mcp');
    });
  });

  describe('history-based completion', () => {
    it('returns matching history entries (most recent first)', () => {
      const history = ['deploy v1', 'deploy v2', 'rollback', 'deploy v3'];
      const results = tabComplete('deploy', history);
      expect(results).toEqual(['deploy v3', 'deploy v2', 'deploy v1']);
    });

    it('dedupes identical entries', () => {
      const history = ['hello', 'hello', 'hello'];
      const results = tabComplete('hello', history);
      expect(results).toEqual(['hello']);
    });

    it('is case-insensitive', () => {
      const history = ['Deploy v1', 'deploy v2'];
      const results = tabComplete('DEP', history);
      expect(results).toEqual(['deploy v2', 'Deploy v1']);
    });

    it('returns empty when no history matches', () => {
      const history = ['alpha', 'beta'];
      const results = tabComplete('gamma', history);
      expect(results).toEqual([]);
    });

    it('returns empty when history is empty', () => {
      const results = tabComplete('anything', []);
      expect(results).toEqual([]);
    });

    it('caps at 8 matches', () => {
      const history = Array.from({ length: 20 }, (_, i) => `test-${i}`);
      const results = tabComplete('test-', history);
      expect(results.length).toBe(8);
      // Most recent first
      expect(results[0]).toBe('test-19');
    });

    it('matches prefix only, not substring', () => {
      const history = ['deploy server', 'server deploy'];
      const results = tabComplete('deploy', history);
      expect(results).toEqual(['deploy server']);
    });
  });

  describe('empty input', () => {
    it('returns empty for empty input (no slash, no history)', () => {
      const results = tabComplete('', []);
      expect(results).toEqual([]);
    });

    it('returns all history for empty input', () => {
      const history = ['a', 'b', 'c'];
      const results = tabComplete('', history);
      expect(results).toEqual(['c', 'b', 'a']);
    });
  });
});
