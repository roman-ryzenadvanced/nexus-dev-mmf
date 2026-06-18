/**
 * Nexus-Dev MMFE — Design Skill Module
 *
 * Integrates the UI/UX Pro Max Skill into the Nexus multi-model fusion pipeline
 * with AI SLOPE elimination technology.
 *
 * Adapted from: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
 *
 * AI SLOPE = AI-generated Sameness, Lack of Originality, Over-reliance on Patterns, Emptiness
 */

export { createDesignSkillEngine, DesignSkillEngine } from './design-engine.js';
export { detectDomain, getAvailableDomains, getAvailableStacks, multiDomainSearch, searchDomain, searchStack } from './search-engine.js';
export type {
  AISlopeCategory,
  AISlopeIssue,
  AISlopeReport,
  DesignRoutingDecision,
  DesignSkillConfig,
  DesignSkillRequest,
  DesignSkillResult,
  DesignSubDomain,
  DesignSystemColors,
  DesignSystemRecommendation,
  DesignSystemTypography,
} from './types.js';
export { AI_SLOPE_PATTERNS, DEFAULT_DESIGN_SKILL_CONFIG } from './types.js';
