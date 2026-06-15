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

export type {
  DesignSkillRequest,
  DesignSkillResult,
  DesignSystemRecommendation,
  DesignSystemColors,
  DesignSystemTypography,
  DesignRoutingDecision,
  DesignSubDomain,
  AISlopeReport,
  AISlopeIssue,
  AISlopeCategory,
  DesignSkillConfig,
} from './types.js';

export {
  AI_SLOPE_PATTERNS,
  DEFAULT_DESIGN_SKILL_CONFIG,
} from './types.js';

export {
  DesignSkillEngine,
  createDesignSkillEngine,
} from './design-engine.js';

export {
  searchDomain,
  searchStack,
  multiDomainSearch,
  detectDomain,
  getAvailableDomains,
  getAvailableStacks,
} from './search-engine.js';
