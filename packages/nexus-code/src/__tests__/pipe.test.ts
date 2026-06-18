import { describe, it, expect } from 'vitest';
import { PipeOptions } from '../pipe.js';

// Type-only import to verify the interface is exported correctly.
// Actual pipe-mode execution would require real provider APIs — those
// are covered by smoke-real.test.ts.
describe('pipe mode interface', () => {
  it('PipeOptions is a valid interface', () => {
    const opts: PipeOptions = {
      prompt: 'hello',
      provider: 'openai',
      model: 'gpt-4o',
      mode: 'balanced',
      noMMFE: false,
      stream: true,
    };
    expect(opts.prompt).toBe('hello');
    expect(opts.provider).toBe('openai');
  });

  it('PipeOptions allows undefined for all optional fields', () => {
    const opts: PipeOptions = {};
    expect(opts.prompt).toBeUndefined();
    expect(opts.stream).toBeUndefined();
  });

  it('PipeOptions.mode accepts all 4 modes', () => {
    const modes: Array<NonNullable<PipeOptions['mode']>> = ['speed', 'balanced', 'quality', 'creative'];
    for (const m of modes) {
      const opts: PipeOptions = { mode: m };
      expect(opts.mode).toBe(m);
    }
  });
});
