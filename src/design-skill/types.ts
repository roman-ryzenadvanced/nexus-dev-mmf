/**
 * Nexus-Dev MMFE — Design Skill Types
 *
 * Adapted from UI/UX Pro Max Skill (https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
 * Integrated into the Nexus multi-model fusion pipeline with AI SLOPE elimination.
 *
 * AI SLOPE = AI-generated Sameness, Lack of Originality, Over-reliance on Patterns, Emptiness
 * This module detects and eliminates AI SLOPE in designs by:
 * 1. Detecting generic AI patterns (purple gradients, centered hero + 3-column, etc.)
 * 2. Enforcing brand-specific design system overrides
 * 3. Injecting anti-slope rules into model prompts
 * 4. Cross-model review for originality scoring
 */

/**
 * AI SLOPE detection categories.
 * These represent the common patterns that make AI-generated designs look generic.
 */
export type AISlopeCategory =
  | 'generic-colors'           // AI purple/pink gradients, default blue (#3B82F6)
  | 'template-layout'          // Centered hero + 3-column features + CTA
  | 'stock-imagery'            // Generic hero images, no brand personality
  | 'flat-typography'          // No typographic hierarchy, same weight everywhere
  | 'overused-effects'         // Backdrop blur on everything, excessive rounded corners
  | 'missing-brand-identity'   // No unique visual language, no signature element
  | 'cliche-microcopy'         // "Empower your workflow", "Revolutionize your X"
  | 'uniform-spacing'          // Same padding everywhere, no rhythm variation
  | 'default-icon-sets'        // Lucide/Phosphor without customization
  | 'predictable-animations';  // Fade-in-up on everything, same duration

/**
 * A detected AI SLOPE issue in a design.
 */
export interface AISlopeIssue {
  /** The category of AI SLOPE detected */
  category: AISlopeCategory;
  /** Description of the issue */
  description: string;
  /** Where in the design this issue was found */
  location: string;
  /** Severity: high = instantly recognizable as AI, medium = subtly generic, low = minor */
  severity: 'high' | 'medium' | 'low';
  /** Suggested fix to eliminate the SLOPE */
  suggestedFix: string;
  /** The model that detected this issue */
  detectedBy: string;
}

/**
 * AI SLOPE elimination result.
 */
export interface AISlopeReport {
  /** Overall SLOPE score (0-100, where 0 = fully original, 100 = completely generic AI) */
  slopeScore: number;
  /** Individual SLOPE issues detected */
  issues: AISlopeIssue[];
  /** Originality score (100 - slopeScore, adjusted for positive attributes) */
  originalityScore: number;
  /** Brand alignment score (how well the design matches brand identity) */
  brandAlignmentScore: number;
  /** Recommendations for eliminating remaining SLOPE */
  recommendations: string[];
  /** The model that produced the primary analysis */
  analyzedBy: string;
}

/**
 * Design skill sub-domain routing (adapted from UI/UX Pro Max design-routing.md)
 */
export type DesignSubDomain =
  | 'brand'           // Brand identity, voice, assets
  | 'design-system'   // Token architecture, specs
  | 'ui-styling'      // Component implementation (shadcn/ui, Tailwind)
  | 'logo'            // AI logo generation
  | 'cip'             // Corporate Identity Program deliverables
  | 'slides'          // HTML presentations with Chart.js
  | 'banner'          // Banner design for social, ads, web, print
  | 'icon'            // SVG icon generation
  | 'social-photos'   // Social media images/photos
  | 'ux-audit';       // UX review, accessibility audit

/**
 * Input to the design skill engine.
 */
export interface DesignSkillRequest {
  /** Unique request ID */
  id: string;
  /** The design task description */
  query: string;
  /** Product type (e.g., "SaaS", "E-commerce", "Fintech") */
  productType?: string;
  /** Brand name */
  brandName?: string;
  /** Industry */
  industry?: string;
  /** Target platforms */
  platforms?: string[];
  /** Design sub-domain to focus on (auto-detected if not specified) */
  subDomain?: DesignSubDomain;
  /** Whether to enable AI SLOPE detection and elimination */
  enableSlopeDetection: boolean;
  /** Whether to enable design system generation */
  enableDesignSystem: boolean;
  /** Whether to persist the design system (Master + Overrides pattern) */
  persistDesignSystem: boolean;
  /** Page name for page-specific overrides */
  pageName?: string;
  /** Existing design context (for iterative refinement) */
  existingDesign?: string;
  /** Existing brand guidelines */
  brandGuidelines?: string;
  /** Execution mode */
  mode: 'speed' | 'quality' | 'balanced' | 'creative';
  /** Whether to use MTP hyperthreading */
  enableMTP: boolean;
  /** Custom style keywords */
  styleKeywords?: string[];
  /** Tech stack (e.g., "nextjs", "react", "vue") */
  techStack?: string;
  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * Result of the design skill engine.
 */
export interface DesignSkillResult {
  /** Request ID */
  requestId: string;
  /** The generated design output (HTML/CSS/code) */
  designOutput: string;
  /** Design system recommendation (if enabled) */
  designSystem?: DesignSystemRecommendation;
  /** AI SLOPE report (if detection enabled) */
  slopeReport?: AISlopeReport;
  /** Routing decisions for which models handled which sub-tasks */
  routingDecisions: DesignRoutingDecision[];
  /** Models used */
  modelsUsed: string[];
  /** Total execution time in ms */
  totalExecutionTimeMs: number;
  /** Sub-domain that was detected/used */
  detectedSubDomain: DesignSubDomain;
  /** Detected product type */
  detectedProductType?: string;
  /** Quality score */
  qualityScore: number;
  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * A routing decision within the design skill pipeline.
 */
export interface DesignRoutingDecision {
  /** Sub-task ID */
  subTaskId: string;
  /** Design sub-domain */
  subDomain: DesignSubDomain;
  /** Selected model for this sub-task */
  selectedModel: string;
  /** Reason for selection */
  reason: string;
  /** Confidence (0-1) */
  confidence: number;
}

/**
 * Design system recommendation.
 * Generated from the UI/UX Pro Max knowledge base with reasoning rules.
 */
export interface DesignSystemRecommendation {
  /** Project name */
  projectName: string;
  /** Recommended pattern (e.g., "Hero + Features + CTA") */
  pattern: string;
  /** Recommended style (e.g., "Glassmorphism + Flat Design") */
  style: string;
  /** Color palette */
  colors: DesignSystemColors;
  /** Typography recommendation */
  typography: DesignSystemTypography;
  /** Effects and animations */
  effects: string[];
  /** Anti-patterns to avoid */
  antiPatterns: string[];
  /** Decision rules for conditional design choices */
  decisionRules: Record<string, string>;
  /** AI SLOPE-specific anti-patterns */
  slopeAntiPatterns: string[];
  /** Full design system in Markdown format */
  markdown: string;
}

/**
 * Color palette in the design system.
 */
export interface DesignSystemColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  card: string;
  cardForeground: string;
  border: string;
  destructive: string;
  notes: string;
}

/**
 * Typography recommendation in the design system.
 */
export interface DesignSystemTypography {
  headingFont: string;
  bodyFont: string;
  moodKeywords: string[];
  googleFontsUrl: string;
  cssImport: string;
  tailwindConfig: string;
  notes: string;
}

/**
 * Design skill configuration.
 */
export interface DesignSkillConfig {
  /** Enable AI SLOPE detection and elimination */
  enableSlopeDetection: boolean;
  /** Enable design system generation */
  enableDesignSystem: boolean;
  /** SLOPE score threshold (re-generate if above this) */
  slopeThreshold: number;
  /** Maximum SLOPE re-generation attempts */
  maxSlopeRetries: number;
  /** Enable design system persistence */
  enablePersistence: boolean;
  /** Default execution mode */
  defaultMode: 'speed' | 'quality' | 'balanced' | 'creative';
  /** Enable MTP hyperthreading for design pipeline */
  enableMTP: boolean;
  /** Design review mode: single-model or multi-model cross-review */
  reviewMode: 'single' | 'cross-review';
}

/**
 * Default design skill configuration.
 */
export const DEFAULT_DESIGN_SKILL_CONFIG: DesignSkillConfig = {
  enableSlopeDetection: true,
  enableDesignSystem: true,
  slopeThreshold: 40,
  maxSlopeRetries: 2,
  enablePersistence: false,
  defaultMode: 'balanced',
  enableMTP: false,
  reviewMode: 'cross-review',
};

/**
 * AI SLOPE detection patterns.
 * These are the telltale signs of AI-generated design sameness.
 */
export const AI_SLOPE_PATTERNS: Record<AISlopeCategory, {
  detectionPatterns: string[];
  eliminationRules: string[];
  severity: 'high' | 'medium' | 'low';
}> = {
  'generic-colors': {
    detectionPatterns: [
      '#3B82F6',           // Tailwind default blue
      '#6366F1',           // AI purple / Indigo
      '#8B5CF6',           // Violet
      '#EC4899',           // Pink
      'purple-gradient',   // Generic purple gradient
      'indigo-to-pink',    // AI cliché gradient
      'blue-to-purple',    // Overused gradient
    ],
    eliminationRules: [
      'Replace default blue (#3B82F6) with brand-specific primary color',
      'Avoid AI purple (#6366F1) as primary unless brand requires it',
      'Use unexpected color pairings from the product-specific palette',
      'Add a signature accent color that is NOT purple/indigo/pink',
      'For dark mode: use deep navy (#0A0E27) instead of pure black + purple',
    ],
    severity: 'high',
  },
  'template-layout': {
    detectionPatterns: [
      'hero-centered-3col',
      'centered-hero-cta',
      'three-column-features',
      'testimonial-row',
      'pricing-three-tier',
      'faq-accordion',
    ],
    eliminationRules: [
      'Replace centered hero with asymmetric or split-layout hero',
      'Use bento grid instead of 3-column features',
      'Add storytelling sections between standard blocks',
      'Introduce unexpected layout variations (diagonal, overlapping, staggered)',
      'Use a unique navigation pattern instead of standard horizontal nav',
    ],
    severity: 'high',
  },
  'stock-imagery': {
    detectionPatterns: [
      'generic-hero-image',
      'diverse-team-photo',
      'handshake-stock',
      'cityscape-night',
      'abstract-gradient-bg',
    ],
    eliminationRules: [
      'Use brand-specific illustrations or screenshots instead of stock photos',
      'Generate custom illustrations using the brand color palette',
      'Use product screenshots with realistic data instead of stock imagery',
      'Create abstract geometric patterns from brand elements',
      'Use CSS-only decorative elements (gradients, shapes, patterns)',
    ],
    severity: 'medium',
  },
  'flat-typography': {
    detectionPatterns: [
      'single-font-weight',
      'no-typographic-hierarchy',
      'inter-only',
      'same-size-headings',
    ],
    eliminationRules: [
      'Use contrasting font weights (300 vs 700, or 400 vs 800)',
      'Introduce a display/identity font for key headings',
      'Create dramatic size contrast (hero: 72px, body: 16px)',
      'Use variable font axes for unique typography personality',
      'Add typographic details: letter-spacing, text-transform, font-feature-settings',
    ],
    severity: 'medium',
  },
  'overused-effects': {
    detectionPatterns: [
      'backdrop-blur-everywhere',
      'excessive-rounded-corners',
      'card-with-shadow-only',
      'gradient-border',
    ],
    eliminationRules: [
      'Use backdrop-filter sparingly (only for overlays and modals)',
      'Vary border-radius: sharp (0-4px) for some, rounded (12-16px) for others',
      'Add depth through elevation system, not just shadows',
      'Use CSS clip-path for unique shape masks',
      'Combine multiple visual effects strategically, not uniformly',
    ],
    severity: 'medium',
  },
  'missing-brand-identity': {
    detectionPatterns: [
      'no-signature-element',
      'no-brand-color-usage',
      'generic-icon-only',
      'no-visual-language',
    ],
    eliminationRules: [
      'Define a signature visual element (unique shape, pattern, or illustration style)',
      'Use brand color as the dominant visual anchor, not just accent',
      'Create custom icon variations that match the brand personality',
      'Establish a visual language system (e.g., always use rounded rectangles, or always use diagonal lines)',
      'Add brand-specific micro-interactions that feel unique',
    ],
    severity: 'high',
  },
  'cliche-microcopy': {
    detectionPatterns: [
      'empower-your-workflow',
      'revolutionize',
      'seamless-experience',
      'cutting-edge',
      'next-generation',
      'streamline',
      'elevate-your',
    ],
    eliminationRules: [
      'Write copy that describes specific value, not vague promises',
      'Use the brand voice framework for all copy decisions',
      'Replace generic CTAs with action-specific ones ("Start Free Trial" → "Build Your First Dashboard")',
      'Avoid superlatives and buzzwords; use concrete benefits',
      'Write from the user perspective, not the product perspective',
    ],
    severity: 'low',
  },
  'uniform-spacing': {
    detectionPatterns: [
      'same-padding-everywhere',
      'no-spacing-rhythm',
      '24px-gap-only',
    ],
    eliminationRules: [
      'Use a spacing scale with dramatic jumps (8, 16, 32, 64, 128px)',
      'Create visual hierarchy through spacing alone (tight for related, loose for sections)',
      'Use negative margins for overlapping elements',
      'Vary section padding (some sections 80px, others 160px)',
    ],
    severity: 'low',
  },
  'default-icon-sets': {
    detectionPatterns: [
      'lucide-only',
      'phosphor-default-style',
      'heroicons-outline-only',
    ],
    eliminationRules: [
      'Customize icon style to match brand (fill vs stroke, rounded vs sharp)',
      'Use duotone or custom-colored icons for key UI elements',
      'Create a few custom SVG icons for signature features',
      'Consistently use one icon style per hierarchy level',
    ],
    severity: 'low',
  },
  'predictable-animations': {
    detectionPatterns: [
      'fade-in-up-everywhere',
      'same-duration-all',
      'stagger-same-delay',
    ],
    eliminationRules: [
      'Use varied animation durations (200ms micro, 400ms transition, 800ms feature)',
      'Add spring physics or custom easing instead of default ease-out',
      'Use direction variety (slide-left, scale-up, clip-reveal)',
      'Make exit animations faster than entrance animations',
      'Add scroll-triggered animations only where they enhance understanding',
    ],
    severity: 'low',
  },
};
