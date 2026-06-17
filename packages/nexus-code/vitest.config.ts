import { defineConfig, type Plugin } from 'vitest/config';
import { existsSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

// Vite plugin that rewrites TS-style `.js` imports (used for Node ESM
// compatibility) to the actual `.ts` source so Vite can transform them.
// Vite's default resolver doesn't strip the explicit `.js` extension,
// so we do it here and return an absolute path to the `.ts` file.
const stripJsExtPlugin: Plugin = {
  name: 'strip-js-ext',
  enforce: 'pre',
  resolveId(source, importer) {
    if (!source.endsWith('.js') || !importer) return null;
    // Compute the absolute path of the import without the `.js` extension.
    const importerPath = importer.replace(/^file:\/\//, '');
    const importerDir = dirname(importerPath);
    const stripped = source.slice(0, -3); // remove `.js`
    const candidateBase = normalize(join(importerDir, stripped));
    // Try `.ts`, `.tsx`, `.jsx`, `.json` — in that order.
    for (const ext of ['.ts', '.tsx', '.jsx', '.json']) {
      const candidate = candidateBase + ext;
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    // Also handle `./foo/index.js` → `./foo/index.ts`
    for (const ext of ['.ts', '.tsx']) {
      const candidate = join(candidateBase, 'index' + ext);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  },
};

export default defineConfig({
  plugins: [stripJsExtPlugin],
  test: {
    globals: false,
    environment: 'node',
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/__tests__/**',
        'src/**/*.d.ts',
        'src/index.tsx',
        'src/bin/**',
        // TUI components — rendered through Ink, hard to unit-test.
        // Coverage tracked separately via integration tests.
        'src/App.tsx',
        'src/components/**',
        'src/tui/**',
      ],
      thresholds: {
        // Enforced minimums — fail CI if coverage drops below these.
        // Raised incrementally as tests are added. TUI components (App.tsx,
        // ChatView, etc.) are hard to test without a full Ink testing rig,
        // so they're excluded from the threshold check.
        lines: 40,
        functions: 40,
        branches: 35,
        statements: 40,
      },
    },
  },
});
