import { describe, it, expect } from 'vitest';
import { PALETTE_ENTRIES, filterEntries, type PaletteEntry } from '../components/CommandPalette.js';

describe('CommandPalette — pure logic', () => {
  it('PALETTE_ENTRIES has 20 commands', () => {
    expect(PALETTE_ENTRIES).toHaveLength(20);
  });

  it('every entry has name + description + preview', () => {
    for (const e of PALETTE_ENTRIES) {
      expect(e.name).toBeTruthy();
      expect(e.description).toBeTruthy();
      expect(e.preview).toBeTruthy();
    }
  });

  it('entry names are unique', () => {
    const names = PALETTE_ENTRIES.map(e => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('filterEntries returns all entries when query is empty', () => {
    const filtered = filterEntries(PALETTE_ENTRIES, '');
    expect(filtered).toHaveLength(20);
  });

  it('filterEntries matches by name (case-insensitive)', () => {
    const filtered = filterEntries(PALETTE_ENTRIES, 'MODE');
    expect(filtered.length).toBeGreaterThanOrEqual(1);
    expect(filtered.some(e => e.name === 'mode')).toBe(true);
  });

  it('filterEntries matches by description', () => {
    const filtered = filterEntries(PALETTE_ENTRIES, 'save');
    // Both `save` (save current session) and `load` ("Load a saved session") match
    expect(filtered.length).toBeGreaterThanOrEqual(1);
    expect(filtered.some(e => e.name === 'save')).toBe(true);
  });

  it('filterEntries matches multiple commands', () => {
    const filtered = filterEntries(PALETTE_ENTRIES, 'm');
    // mode, model, mmfe
    expect(filtered.length).toBeGreaterThanOrEqual(3);
    const names = filtered.map(e => e.name);
    expect(names).toContain('mode');
    expect(names).toContain('model');
    expect(names).toContain('mmfe');
  });

  it('filterEntries returns empty array for no match', () => {
    const filtered = filterEntries(PALETTE_ENTRIES, 'xyzzy-nonexistent');
    expect(filtered).toHaveLength(0);
  });

  it('filterEntries matches partial strings', () => {
    const filtered = filterEntries(PALETTE_ENTRIES, 'pro');
    expect(filtered.some(e => e.name === 'provider')).toBe(true);
  });

  it('filterEntries handles a custom entry list', () => {
    const custom: PaletteEntry[] = [
      { name: 'foo', description: 'foo command', preview: '/foo' },
      { name: 'bar', description: 'bar command', preview: '/bar' },
    ];
    expect(filterEntries(custom, 'foo')).toHaveLength(1);
    expect(filterEntries(custom, 'foo')[0].name).toBe('foo');
  });
});
