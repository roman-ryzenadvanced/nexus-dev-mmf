/**
 * Nexus-Dev MMFE — Design Skill Search Engine
 *
 * BM25-based search engine ported from UI/UX Pro Max Skill
 * (https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
 *
 * Searches the design knowledge base (CSV data) for:
 * - Product type patterns
 * - Style recommendations
 * - Color palettes
 * - Typography pairings
 * - Landing page patterns
 * - UX guidelines
 * - Chart recommendations
 * - Stack-specific guidelines
 *
 * Uses BM25 ranking algorithm for relevance scoring.
 */

import * as fs from 'fs';
import * as path from 'path';

// ============ CONFIGURATION ============
const DATA_DIR = path.resolve(__dirname, 'data');
const MAX_RESULTS = 3;

interface CSVColumnConfig {
  file: string;
  search_cols: string[];
  output_cols: string[];
}

const CSV_CONFIG: Record<string, CSVColumnConfig> = {
  style: {
    file: 'styles.csv',
    search_cols: ['Style Category', 'Keywords', 'Best For', 'Type', 'AI Prompt Keywords'],
    output_cols: ['Style Category', 'Type', 'Keywords', 'Primary Colors', 'Effects & Animation', 'Best For', 'Light Mode ✓', 'Dark Mode ✓', 'Performance', 'Accessibility', 'Framework Compatibility', 'Complexity', 'AI Prompt Keywords', 'CSS/Technical Keywords', 'Implementation Checklist', 'Design System Variables'],
  },
  color: {
    file: 'colors.csv',
    search_cols: ['Product Type', 'Notes'],
    output_cols: ['Product Type', 'Primary', 'On Primary', 'Secondary', 'On Secondary', 'Accent', 'On Accent', 'Background', 'Foreground', 'Card', 'Card Foreground', 'Muted', 'Muted Foreground', 'Border', 'Destructive', 'On Destructive', 'Ring', 'Notes'],
  },
  chart: {
    file: 'charts.csv',
    search_cols: ['Data Type', 'Keywords', 'Best Chart Type', 'When to Use', 'When NOT to Use', 'Accessibility Notes'],
    output_cols: ['Data Type', 'Keywords', 'Best Chart Type', 'Secondary Options', 'When to Use', 'When NOT to Use', 'Data Volume Threshold', 'Color Guidance', 'Accessibility Grade', 'Accessibility Notes', 'A11y Fallback', 'Library Recommendation', 'Interactive Level'],
  },
  landing: {
    file: 'landing.csv',
    search_cols: ['Pattern Name', 'Keywords', 'Conversion Optimization', 'Section Order'],
    output_cols: ['Pattern Name', 'Keywords', 'Section Order', 'Primary CTA Placement', 'Color Strategy', 'Conversion Optimization'],
  },
  product: {
    file: 'products.csv',
    search_cols: ['Product Type', 'Keywords', 'Primary Style Recommendation', 'Key Considerations'],
    output_cols: ['Product Type', 'Keywords', 'Primary Style Recommendation', 'Secondary Styles', 'Landing Page Pattern', 'Dashboard Style (if applicable)', 'Color Palette Focus', 'Key Considerations'],
  },
  ux: {
    file: 'ux-guidelines.csv',
    search_cols: ['Category', 'Issue', 'Description', 'Platform'],
    output_cols: ['Category', 'Issue', 'Platform', 'Description', 'Do', "Don't", 'Code Example Good', 'Code Example Bad', 'Severity'],
  },
  typography: {
    file: 'typography.csv',
    search_cols: ['Font Pairing Name', 'Category', 'Mood/Style Keywords', 'Best For', 'Heading Font', 'Body Font'],
    output_cols: ['Font Pairing Name', 'Category', 'Heading Font', 'Body Font', 'Mood/Style Keywords', 'Best For', 'Google Fonts URL', 'CSS Import', 'Tailwind Config', 'Notes'],
  },
  'google-fonts': {
    file: 'google-fonts.csv',
    search_cols: ['Family', 'Category', 'Stroke', 'Classifications', 'Keywords', 'Subsets', 'Designers'],
    output_cols: ['Family', 'Category', 'Stroke', 'Classifications', 'Styles', 'Variable Axes', 'Subsets', 'Designers', 'Popularity Rank', 'Google Fonts URL'],
  },
};

const STACK_CONFIG: Record<string, { file: string }> = {
  react:           { file: 'stacks/react.csv' },
  nextjs:          { file: 'stacks/nextjs.csv' },
  vue:             { file: 'stacks/vue.csv' },
  svelte:          { file: 'stacks/svelte.csv' },
  swiftui:         { file: 'stacks/swiftui.csv' },
  'react-native':  { file: 'stacks/react-native.csv' },
  flutter:         { file: 'stacks/flutter.csv' },
  'html-tailwind': { file: 'stacks/html-tailwind.csv' },
  shadcn:          { file: 'stacks/shadcn.csv' },
  threejs:         { file: 'stacks/threejs.csv' },
};

const STACK_COLS = {
  search_cols: ['Category', 'Guideline', 'Description', 'Do', "Don't"],
  output_cols: ['Category', 'Guideline', 'Description', 'Do', "Don't", 'Code Good', 'Code Bad', 'Severity', 'Docs URL'],
};

const AVAILABLE_STACKS = Object.keys(STACK_CONFIG);

// ============ BM25 IMPLEMENTATION ============
class BM25 {
  private k1: number;
  private b: number;
  private corpus: string[][] = [];
  private docLengths: number[] = [];
  private avgdl = 0;
  private idf: Record<string, number> = {};
  private docFreqs: Record<string, number> = {};
  private N = 0;

  constructor(k1 = 1.5, b = 0.75) {
    this.k1 = k1;
    this.b = b;
  }

  private tokenize(text: string): string[] {
    const cleaned = text.toLowerCase().replace(/[^\w\s]/g, ' ');
    return cleaned.split(/\s+/).filter(w => w.length > 2);
  }

  fit(documents: string[]): void {
    this.corpus = documents.map(doc => this.tokenize(doc));
    this.N = this.corpus.length;
    if (this.N === 0) return;

    this.docLengths = this.corpus.map(doc => doc.length);
    this.avgdl = this.docLengths.reduce((a, b) => a + b, 0) / this.N;

    this.docFreqs = {};
    for (const doc of this.corpus) {
      const seen = new Set<string>();
      for (const word of doc) {
        if (!seen.has(word)) {
          this.docFreqs[word] = (this.docFreqs[word] ?? 0) + 1;
          seen.add(word);
        }
      }
    }

    this.idf = {};
    for (const [word, freq] of Object.entries(this.docFreqs)) {
      this.idf[word] = Math.log((this.N - freq + 0.5) / (freq + 0.5) + 1);
    }
  }

  score(query: string): Array<[number, number]> {
    const queryTokens = this.tokenize(query);
    const scores: Array<[number, number]> = [];

    for (let idx = 0; idx < this.corpus.length; idx++) {
      const doc = this.corpus[idx];
      let score = 0;
      const docLen = this.docLengths[idx];
      const termFreqs: Record<string, number> = {};
      for (const word of doc) {
        termFreqs[word] = (termFreqs[word] ?? 0) + 1;
      }

      for (const token of queryTokens) {
        if (token in this.idf) {
          const tf = termFreqs[token] ?? 0;
          const idf = this.idf[token];
          const numerator = tf * (this.k1 + 1);
          const denominator = tf + this.k1 * (1 - this.b + this.b * docLen / this.avgdl);
          score += idf * numerator / denominator;
        }
      }

      scores.push([idx, score]);
    }

    return scores.sort((a, b) => b[1] - a[1]);
  }
}

// ============ SEARCH FUNCTIONS ============
function loadCSV(filepath: string): Record<string, string>[] {
  if (!fs.existsSync(filepath)) return [];
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.trim()] = (values[i] ?? '').trim(); });
    return row;
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += char; }
  }
  result.push(current);
  return result;
}

function searchCSV(
  filepath: string,
  searchCols: string[],
  outputCols: string[],
  query: string,
  maxResults: number
): Record<string, string>[] {
  if (!fs.existsSync(filepath)) return [];

  const data = loadCSV(filepath);
  const documents = data.map(row =>
    searchCols.map(col => row[col] ?? '').join(' ')
  );

  const bm25 = new BM25();
  bm25.fit(documents);
  const ranked = bm25.score(query);

  const results: Record<string, string>[] = [];
  for (const [idx, score] of ranked) {
    if (score > 0 && results.length < maxResults) {
      const row = data[idx];
      const result: Record<string, string> = {};
      for (const col of outputCols) {
        if (col in row) {
          result[col] = row[col];
        }
      }
      results.push(result);
    }
  }

  return results;
}

/**
 * Auto-detect the most relevant search domain from a query.
 */
export function detectDomain(query: string): string {
  const queryLower = query.toLowerCase();

  const domainKeywords: Record<string, string[]> = {
    color: ['color', 'palette', 'hex', '#', 'rgb', 'token', 'semantic', 'accent', 'destructive', 'muted', 'foreground'],
    chart: ['chart', 'graph', 'visualization', 'trend', 'bar', 'pie', 'scatter', 'heatmap', 'funnel'],
    landing: ['landing', 'page', 'cta', 'conversion', 'hero', 'testimonial', 'pricing', 'section'],
    product: ['saas', 'ecommerce', 'e-commerce', 'fintech', 'healthcare', 'gaming', 'portfolio', 'crypto', 'dashboard', 'fitness', 'restaurant', 'hotel', 'travel', 'music', 'education', 'beauty', 'pharmacy', 'pet', 'dating', 'wedding', 'delivery', 'marketplace', 'freelancer', 'airline', 'museum', 'real estate', 'logistics', 'agriculture'],
    style: ['style', 'design', 'ui', 'minimalism', 'glassmorphism', 'neumorphism', 'brutalism', 'dark mode', 'flat', 'aurora', 'prompt', 'css', 'implementation', 'variable', 'checklist', 'tailwind'],
    ux: ['ux', 'usability', 'accessibility', 'wcag', 'touch', 'scroll', 'animation', 'keyboard', 'navigation', 'mobile'],
    typography: ['font pairing', 'typography pairing', 'heading font', 'body font'],
    'google-fonts': ['google font', 'font family', 'font weight', 'font style', 'variable font', 'noto', 'monospace font', 'serif font', 'sans serif font', 'display font'],
  };

  let bestDomain = 'style';
  let bestScore = 0;

  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    const score = keywords.filter(kw => queryLower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestDomain = domain;
    }
  }

  return bestDomain;
}

/**
 * Search a specific domain in the design knowledge base.
 */
export function searchDomain(
  query: string,
  domain?: string,
  maxResults = MAX_RESULTS
): { domain: string; query: string; file: string; count: number; results: Record<string, string>[] } {
  if (!domain) {
    domain = detectDomain(query);
  }

  const config = CSV_CONFIG[domain] ?? CSV_CONFIG['style'];
  const filepath = path.join(DATA_DIR, config.file);

  if (!fs.existsSync(filepath)) {
    return { domain, query, file: config.file, count: 0, results: [] };
  }

  const results = searchCSV(filepath, config.search_cols, config.output_cols, query, maxResults);

  return {
    domain,
    query,
    file: config.file,
    count: results.length,
    results,
  };
}

/**
 * Search stack-specific design guidelines.
 */
export function searchStack(
  query: string,
  stack: string,
  maxResults = MAX_RESULTS
): { stack: string; query: string; file: string; count: number; results: Record<string, string>[] } {
  const config = STACK_CONFIG[stack];
  if (!config) {
    return { stack, query, file: '', count: 0, results: [] };
  }

  const filepath = path.join(DATA_DIR, config.file);
  const results = searchCSV(filepath, STACK_COLS.search_cols, STACK_COLS.output_cols, query, maxResults);

  return {
    stack,
    query,
    file: config.file,
    count: results.length,
    results,
  };
}

/**
 * Multi-domain search across all design dimensions.
 * Returns the best results from each domain for design system generation.
 */
export function multiDomainSearch(
  query: string,
  maxResultsPerDomain = 2
): Record<string, Record<string, string>[]> {
  const domains = ['product', 'style', 'color', 'landing', 'typography'];
  const results: Record<string, Record<string, string>[]> = {};

  for (const domain of domains) {
    const searchResult = searchDomain(query, domain, maxResultsPerDomain);
    if (searchResult.count > 0) {
      results[domain] = searchResult.results;
    }
  }

  return results;
}

/**
 * Get available search domains.
 */
export function getAvailableDomains(): string[] {
  return Object.keys(CSV_CONFIG);
}

/**
 * Get available tech stacks.
 */
export function getAvailableStacks(): string[] {
  return AVAILABLE_STACKS;
}
