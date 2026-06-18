/**
 * Nexus-Dev MMFE — Design Skill Engine
 *
 * Integrates the UI/UX Pro Max Skill into the Nexus multi-model fusion pipeline
 * with AI SLOPE elimination technology.
 *
 * Pipeline:
 * 1. ANALYZE — Detect design sub-domain, product type, style keywords
 * 2. SEARCH — BM25 search across design knowledge base
 * 3. GENERATE DESIGN SYSTEM — Aggregate search results with reasoning rules
 * 4. PROMPT ENGINEERING — Build slope-aware design prompts for models
 * 5. EXECUTE — Multi-model parallel design generation
 * 6. SLOPE DETECTION — Cross-model review for AI SLOPE patterns
 * 7. ELIMINATE — Re-generate with anti-slope instructions if threshold exceeded
 * 8. SYNTHESIZE — Merge best elements from all model outputs
 */

import { loadZAIClient } from '../providers/zai-loader.js';
import type { ZAIClient } from '../providers/zai-loader.js';
import * as fs from 'fs';
import * as path from 'path';
import { uuidv4 } from '../core/utils/uuid.js';
import { searchDomain, multiDomainSearch, searchStack, detectDomain } from './search-engine.js';
import {
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
  AI_SLOPE_PATTERNS,
  DesignSkillConfig,
  DEFAULT_DESIGN_SKILL_CONFIG,
} from './types.js';

// ============ SYSTEM PROMPTS ============

const DESIGN_ANALYSIS_PROMPT = `You are a design task analysis specialist. Analyze the user's design request and extract structured information.

OUTPUT FORMAT — Return a JSON object:
{
  "productType": "e.g., SaaS, E-commerce, Fintech, Healthcare",
  "industry": "e.g., tech, healthcare, finance, education",
  "styleKeywords": ["keyword1", "keyword2"],
  "subDomain": "brand|design-system|ui-styling|logo|cip|slides|banner|icon|social-photos|ux-audit",
  "platforms": ["web", "mobile", "desktop"],
  "complexity": "trivial|simple|moderate|complex|expert",
  "requiresDesignSystem": true/false,
  "requiresSlopeCheck": true/false
}

SUB-DOMAIN ROUTING:
- Brand identity, voice, assets → "brand"
- Tokens, specs, CSS variables → "design-system"
- Component implementation (shadcn/ui, Tailwind) → "ui-styling"
- Logo creation, AI generation → "logo"
- Corporate Identity Program deliverables → "cip"
- Presentations, pitch decks → "slides"
- Banners for social, ads, web, print → "banner"
- SVG icon generation → "icon"
- Social media images → "social-photos"
- UX review, accessibility audit → "ux-audit"

Return ONLY the JSON object. No markdown, no explanation.`;

const DESIGN_GENERATION_PROMPT = `You are an expert UI/UX designer. Generate a complete, production-ready design based on the following design system and requirements.

CRITICAL ANTI-AI-SLOPE RULES — You MUST follow these to avoid generic AI design:
1. DO NOT use default blue (#3B82F6), AI purple (#6366F1), or indigo-to-pink gradients
2. DO NOT create a centered hero + 3-column features + CTA template layout
3. DO NOT use "Empower your workflow", "Revolutionize", "Seamless experience" in copy
4. DO NOT apply backdrop-blur to everything or use excessive rounded corners uniformly
5. DO NOT create flat typography with no hierarchy — use dramatic weight/size contrast
6. DO NOT use stock imagery placeholders — use CSS-only decorative elements or product screenshots
7. DO NOT use the same padding/spacing everywhere — create visual rhythm through spacing variation
8. DO NOT use default Lucide icons without customization — add color fills, duotone effects
9. DO NOT add fade-in-up animation to everything — use varied animation directions and durations
10. DO create a SIGNATURE VISUAL ELEMENT that makes this design unique and recognizable

DESIGN SYSTEM CONTEXT:
{designSystemContext}

PRODUCT CONTEXT:
{productContext}

SLOPE WARNINGS (detected patterns to specifically avoid):
{slopeWarnings}

Generate the complete design now. Use semantic HTML with inline CSS or Tailwind classes.
Create a design that would be IMPOSSIBLE to confuse with a generic AI-generated template.`;

const SLOPE_DETECTION_PROMPT = `You are an AI SLOPE detection specialist. "AI SLOPE" is the sameness and lack of originality in AI-generated designs. Your job is to analyze the following design and identify AI SLOPE patterns.

AI SLOPE CATEGORIES TO CHECK:
1. GENERIC COLORS — Default blue (#3B82F6), AI purple (#6366F1), indigo-to-pink gradients
2. TEMPLATE LAYOUT — Centered hero + 3-column features + CTA (the "AI special")
3. STOCK IMAGERY — Generic hero images, no brand personality
4. FLAT TYPOGRAPHY — No hierarchy, same weight everywhere, Inter-only
5. OVERUSED EFFECTS — Backdrop-blur on everything, excessive rounded corners
6. MISSING BRAND IDENTITY — No signature visual element, no unique visual language
7. CLICHE MICROCOPY — "Empower your workflow", "Revolutionize your X"
8. UNIFORM SPACING — Same padding everywhere, no rhythm variation
9. DEFAULT ICON SETS — Lucide/Phosphor without customization
10. PREDICTABLE ANIMATIONS — Fade-in-up on everything, same duration

ANALYZE THE FOLLOWING DESIGN:
{designOutput}

OUTPUT FORMAT — Return a JSON object:
{
  "slopeScore": 0-100 (0 = fully original, 100 = completely generic AI),
  "issues": [
    {
      "category": "category-name",
      "description": "what was detected",
      "location": "where in the design",
      "severity": "high|medium|low",
      "suggestedFix": "specific fix to apply"
    }
  ],
  "originalityScore": 0-100,
  "brandAlignmentScore": 0-100,
  "recommendations": ["specific action to eliminate SLOPE"]
}

Return ONLY the JSON object. Be thorough and honest in your assessment.`;

const SLOPE_ELIMINATION_PROMPT = `You are an AI SLOPE elimination specialist. The following design has been flagged for AI SLOPE patterns. Your job is to revise the design to eliminate ALL detected SLOPE issues while preserving the design intent.

DETECTED SLOPE ISSUES:
{slopeIssues}

ORIGINAL DESIGN:
{originalDesign}

ELIMINATION RULES:
{slopeEliminationRules}

DESIGN SYSTEM CONTEXT:
{designSystemContext}

Revise the design to eliminate ALL detected SLOPE patterns. Apply the elimination rules strictly.
The revised design should feel HANDCRAFTED and BRAND-SPECIFIC, not AI-generated.

Generate the complete revised design now.`;

// ============ DESIGN SKILL ENGINE ============

export class DesignSkillEngine {
  private zai: Awaited<ReturnType<typeof loadZAIClient>> | null = null;
  private config: DesignSkillConfig;

  constructor(config?: Partial<DesignSkillConfig>) {
    this.config = { ...DEFAULT_DESIGN_SKILL_CONFIG, ...config };
  }

  private async getClient() {
    if (!this.zai) {
      this.zai = await loadZAIClient();
    }
    return this.zai;
  }

  /**
   * Main entry point: Process a design skill request through the full pipeline.
   */
  async process(request: DesignSkillRequest): Promise<DesignSkillResult> {
    const startTime = Date.now();
    const client = await this.getClient();
    const routingDecisions: DesignRoutingDecision[] = [];

    // Phase 1: ANALYZE — Detect sub-domain, product type, style keywords
    const analysis = await this.analyzeDesignRequest(client, request);
    const detectedSubDomain = request.subDomain ?? analysis.subDomain ?? 'ui-styling';
    const detectedProductType = request.productType ?? analysis.productType ?? 'SaaS (General)';

    // Phase 2: SEARCH — BM25 search across design knowledge base
    const searchResults = multiDomainSearch(
      `${detectedProductType} ${request.industry ?? ''} ${(request.styleKeywords ?? []).join(' ')} ${request.query}`,
      2
    );

    // Phase 3: GENERATE DESIGN SYSTEM — Aggregate search results with reasoning
    let designSystem: DesignSystemRecommendation | undefined;
    if (request.enableDesignSystem) {
      designSystem = this.generateDesignSystem(
        searchResults,
        request.brandName ?? 'Project',
        detectedProductType
      );
    }

    // Phase 4: PROMPT ENGINEERING — Build slope-aware prompts
    const slopeWarnings = this.buildSlopeWarnings(detectedSubDomain);
    const designSystemContext = designSystem
      ? this.designSystemToContext(designSystem)
      : 'No design system generated. Use best practices.';
    const productContext = `Product: ${detectedProductType}\nIndustry: ${request.industry ?? 'tech'}\nBrand: ${request.brandName ?? 'N/A'}`;

    // Phase 5: EXECUTE — Multi-model parallel design generation
    const models = this.selectModels(request.mode, detectedSubDomain);
    const designOutputs: Array<{ model: string; output: string; time: number }> = [];

    const generationPromises = models.map(async (modelId, index) => {
      if (index > 0) await new Promise(r => setTimeout(r, index * 300));
      const t0 = Date.now();
      try {
        const prompt = DESIGN_GENERATION_PROMPT
          .replace('{designSystemContext}', designSystemContext)
          .replace('{productContext}', productContext)
          .replace('{slopeWarnings}', slopeWarnings);

        const response = await client.chat.completions.create({
          model: modelId,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: request.query },
          ],
          temperature: request.mode === 'creative' ? 0.8 : 0.5,
        });

        const output = response.choices?.[0]?.message?.content ?? '';

        routingDecisions.push({
          subTaskId: `${request.id}-gen-${index}`,
          subDomain: detectedSubDomain,
          selectedModel: modelId,
          reason: `Design generation for ${detectedSubDomain}`,
          confidence: 0.8,
        });

        return { model: modelId, output, time: Date.now() - t0 };
      } catch (err: any) {
        return { model: modelId, output: '', time: Date.now() - t0 };
      }
    });

    const results = await Promise.all(generationPromises);
    const successful = results.filter(r => r.output.trim());

    if (successful.length === 0) {
      return {
        requestId: request.id,
        designOutput: 'Error: All model calls failed for design generation.',
        routingDecisions,
        modelsUsed: models,
        totalExecutionTimeMs: Date.now() - startTime,
        detectedSubDomain,
        detectedProductType,
        qualityScore: 0,
        metadata: { error: true },
      };
    }

    // Phase 6: SLOPE DETECTION — Cross-model review for AI SLOPE patterns
    let slopeReport: AISlopeReport | undefined;
    let bestDesign = successful[0].output;

    if (request.enableSlopeDetection && successful.length > 0) {
      slopeReport = await this.detectSlope(client, bestDesign);

      // Phase 7: ELIMINATE — Re-generate if SLOPE threshold exceeded
      if (slopeReport.slopeScore > this.config.slopeThreshold) {
        let retryCount = 0;
        while (retryCount < this.config.maxSlopeRetries && slopeReport.slopeScore > this.config.slopeThreshold) {
          const eliminated = await this.eliminateSlope(
            client,
            bestDesign,
            slopeReport.issues,
            designSystemContext
          );

          if (eliminated) {
            bestDesign = eliminated;
            // Re-check SLOPE score
            slopeReport = await this.detectSlope(client, bestDesign);
          }
          retryCount++;
        }
      }
    }

    // Phase 8: SYNTHESIZE — If multiple successful outputs, merge best elements
    if (successful.length > 1) {
      const synthesisInput = `ORIGINAL QUERY:\n${request.query}\n\nMODEL DESIGN OUTPUTS:\n${'='.repeat(50)}\n\n` +
        successful.map(r => `[${r.model} — ${r.time}ms]\n${r.output.substring(0, 3000)}\n${'─'.repeat(40)}\n`).join('\n') +
        `\nSYNTHESIZE the best elements from all designs into one polished, SLOPE-free design.`;

      try {
        const synthResponse = await client.chat.completions.create({
          model: 'glm-5.2',
          messages: [
            {
              role: 'system',
              content: `You are a design synthesis specialist. Combine the best elements from multiple design outputs into one coherent, production-ready design. Prioritize ORIGINALITY and BRAND SPECIFICITY. Eliminate any AI SLOPE patterns.`,
            },
            { role: 'user', content: synthesisInput },
          ],
          temperature: 0.5,
        });

        const synthesized = synthResponse.choices?.[0]?.message?.content;
        if (synthesized && synthesized.trim()) {
          bestDesign = synthesized;
        }
      } catch {
        // Use the best individual output
      }
    }

    // Final SLOPE check on synthesized output
    if (request.enableSlopeDetection && !slopeReport) {
      slopeReport = await this.detectSlope(client, bestDesign);
    }

    return {
      requestId: request.id,
      designOutput: bestDesign,
      designSystem,
      slopeReport,
      routingDecisions,
      modelsUsed: successful.map(r => r.model),
      totalExecutionTimeMs: Date.now() - startTime,
      detectedSubDomain,
      detectedProductType,
      qualityScore: slopeReport ? slopeReport.originalityScore : 75,
      metadata: {
        analysis,
        searchResultsKeys: Object.keys(searchResults),
        modelOutputs: successful.map(r => ({ model: r.model, time: r.time })),
        slopeDetected: slopeReport?.slopeScore ?? 0,
      },
    };
  }

  // ============ PHASE 1: ANALYZE ============

  private async analyzeDesignRequest(
    client: ZAIClient,
    request: DesignSkillRequest
  ): Promise<Record<string, any>> {
    try {
      const response = await client.chat.completions.create({
        model: 'glm-5',
        messages: [
          { role: 'system', content: DESIGN_ANALYSIS_PROMPT },
          { role: 'user', content: request.query },
        ],
        temperature: 0.2,
      });

      const content = response.choices?.[0]?.message?.content ?? '{}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Fallback
    }

    return {
      productType: request.productType ?? 'SaaS (General)',
      industry: request.industry ?? 'tech',
      styleKeywords: request.styleKeywords ?? ['modern'],
      subDomain: request.subDomain ?? 'ui-styling',
      platforms: request.platforms ?? ['web'],
      complexity: 'moderate',
      requiresDesignSystem: request.enableDesignSystem,
      requiresSlopeCheck: request.enableSlopeDetection,
    };
  }

  // ============ PHASE 3: GENERATE DESIGN SYSTEM ============

  private generateDesignSystem(
    searchResults: Record<string, Record<string, string>[]>,
    projectName: string,
    productType: string
  ): DesignSystemRecommendation {
    // Extract best results from each domain
    const productResults = searchResults['product']?.[0];
    const styleResults = searchResults['style']?.[0];
    const colorResults = searchResults['color']?.[0];
    const landingResults = searchResults['landing']?.[0];
    const typographyResults = searchResults['typography']?.[0];

    // Load reasoning rules from ui-reasoning.csv
    const reasoning = this.loadReasoningRules();
    const matchedReasoning = this.matchReasoning(reasoning, productType);

    // Build design system from aggregated results
    const pattern = landingResults?.['Pattern Name'] ??
      matchedReasoning?.['Recommended_Pattern'] ??
      'Hero + Features + CTA';

    const style = styleResults?.['Style Category'] ??
      productResults?.['Primary Style Recommendation'] ??
      matchedReasoning?.['Style_Priority'] ??
      'Minimalism + Swiss Style';

    const colors: DesignSystemColors = {
      primary: colorResults?.['Primary'] ?? '#1E3A5F',
      secondary: colorResults?.['Secondary'] ?? '#4A90D9',
      accent: colorResults?.['Accent'] ?? '#FFD700',
      background: colorResults?.['Background'] ?? '#FFFFFF',
      foreground: colorResults?.['Foreground'] ?? '#0A0A0A',
      muted: colorResults?.['Muted'] ?? '#F5F5F5',
      mutedForeground: colorResults?.['Muted Foreground'] ?? '#737373',
      card: colorResults?.['Card'] ?? '#FFFFFF',
      cardForeground: colorResults?.['Card Foreground'] ?? '#0A0A0A',
      border: colorResults?.['Border'] ?? '#E5E5E5',
      destructive: colorResults?.['Destructive'] ?? '#EF4444',
      notes: colorResults?.['Notes'] ?? 'Brand-specific palette',
    };

    const typography: DesignSystemTypography = {
      headingFont: typographyResults?.['Heading Font'] ?? 'Instrument Sans',
      bodyFont: typographyResults?.['Body Font'] ?? 'Inter',
      moodKeywords: typographyResults?.['Mood/Style Keywords']?.split(',').map(s => s.trim()) ?? ['modern', 'professional'],
      googleFontsUrl: typographyResults?.['Google Fonts URL'] ?? '',
      cssImport: typographyResults?.['CSS Import'] ?? '',
      tailwindConfig: typographyResults?.['Tailwind Config'] ?? '',
      notes: typographyResults?.['Notes'] ?? '',
    };

    const effects = styleResults?.['Effects & Animation']?.split(',').map(s => s.trim()) ??
      matchedReasoning?.['Key_Effects']?.split(',').map(s => s.trim()) ??
      ['Subtle hover (200-250ms)', 'Smooth transitions'];

    const antiPatterns = matchedReasoning?.['Anti_Patterns']?.split('+').map(s => s.trim()) ??
      ['Excessive animation', 'Dark mode by default'];

    // AI SLOPE-specific anti-patterns
    const slopeAntiPatterns = [
      'Avoid AI purple (#6366F1) as primary — use brand-specific color instead',
      'Do not use centered hero + 3-column features + CTA template layout',
      'No "Empower your workflow" or similar AI cliché microcopy',
      'No backdrop-blur on everything — use sparingly for overlays only',
      'No uniform spacing — create visual rhythm with varied spacing scale',
      'Add a signature visual element unique to this brand',
    ];

    const decisionRules: Record<string, string> = {};
    if (matchedReasoning?.['Decision_Rules']) {
      try {
        const parsed = JSON.parse(matchedReasoning['Decision_Rules']);
        Object.assign(decisionRules, parsed);
      } catch {
        decisionRules['default'] = matchedReasoning['Decision_Rules'];
      }
    }

    // Generate markdown representation
    const markdown = this.designSystemToMarkdown(projectName, pattern, style, colors, typography, effects, antiPatterns, slopeAntiPatterns, decisionRules);

    return {
      projectName,
      pattern,
      style,
      colors,
      typography,
      effects,
      antiPatterns,
      decisionRules,
      slopeAntiPatterns,
      markdown,
    };
  }

  // ============ PHASE 6: SLOPE DETECTION ============

  private async detectSlope(client: ZAIClient, designOutput: string): Promise<AISlopeReport> {
    try {
      const prompt = SLOPE_DETECTION_PROMPT.replace(
        '{designOutput}',
        designOutput.substring(0, 6000)
      );

      const response = await client.chat.completions.create({
        model: 'glm-5.2',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: 'Analyze this design for AI SLOPE patterns.' },
        ],
        temperature: 0.2,
      });

      const content = response.choices?.[0]?.message?.content ?? '{}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          slopeScore: Math.min(100, Math.max(0, parsed.slopeScore ?? 50)),
          issues: (parsed.issues ?? []).map((issue: any) => ({
            category: issue.category as AISlopeCategory,
            description: issue.description ?? '',
            location: issue.location ?? '',
            severity: issue.severity ?? 'medium',
            suggestedFix: issue.suggestedFix ?? '',
            detectedBy: 'glm-5.2',
          })),
          originalityScore: Math.min(100, Math.max(0, parsed.originalityScore ?? 50)),
          brandAlignmentScore: Math.min(100, Math.max(0, parsed.brandAlignmentScore ?? 50)),
          recommendations: parsed.recommendations ?? [],
          analyzedBy: 'glm-5.2',
        };
      }
    } catch {
      // Fallback: basic pattern matching
    }

    // Fallback: Simple pattern-based SLOPE detection
    return this.fallbackSlopeDetection(designOutput);
  }

  private fallbackSlopeDetection(designOutput: string): AISlopeReport {
    const issues: AISlopeIssue[] = [];
    const outputLower = designOutput.toLowerCase();

    // Check for generic colors
    if (outputLower.includes('#3b82f6') || outputLower.includes('#6366f1')) {
      issues.push({
        category: 'generic-colors',
        description: 'Uses default AI colors (blue #3B82F6 or purple #6366F1)',
        location: 'Color definitions',
        severity: 'high',
        suggestedFix: 'Replace with brand-specific primary color',
        detectedBy: 'pattern-matcher',
      });
    }

    // Check for cliché microcopy
    const cliches = ['empower your workflow', 'revolutionize', 'seamless experience', 'cutting-edge'];
    for (const cliche of cliches) {
      if (outputLower.includes(cliche)) {
        issues.push({
          category: 'cliche-microcopy',
          description: `Contains AI cliché: "${cliche}"`,
          location: 'Copy text',
          severity: 'low',
          suggestedFix: 'Replace with specific, brand-unique language',
          detectedBy: 'pattern-matcher',
        });
      }
    }

    // Check for template layout indicators
    if (outputLower.includes('grid-cols-3') && outputLower.includes('hero') && outputLower.includes('cta')) {
      issues.push({
        category: 'template-layout',
        description: 'Uses the classic AI template: hero + 3-column features + CTA',
        location: 'Page layout',
        severity: 'high',
        suggestedFix: 'Use bento grid or asymmetric layout instead',
        detectedBy: 'pattern-matcher',
      });
    }

    // Check for backdrop-blur overuse
    const blurCount = (designOutput.match(/backdrop-blur/gi) ?? []).length;
    if (blurCount > 3) {
      issues.push({
        category: 'overused-effects',
        description: `Excessive backdrop-blur usage (${blurCount} instances)`,
        location: 'Multiple elements',
        severity: 'medium',
        suggestedFix: 'Use backdrop-filter sparingly (only for overlays and modals)',
        detectedBy: 'pattern-matcher',
      });
    }

    const highSeverity = issues.filter(i => i.severity === 'high').length;
    const slopeScore = Math.min(100, highSeverity * 25 + issues.length * 10);

    return {
      slopeScore,
      issues,
      originalityScore: Math.max(0, 100 - slopeScore),
      brandAlignmentScore: Math.max(0, 80 - highSeverity * 20),
      recommendations: issues.map(i => i.suggestedFix),
      analyzedBy: 'pattern-matcher',
    };
  }

  // ============ PHASE 7: SLOPE ELIMINATION ============

  private async eliminateSlope(
    client: ZAIClient,
    designOutput: string,
    issues: AISlopeIssue[],
    designSystemContext: string
  ): Promise<string | null> {
    try {
      const slopeIssues = issues.map(i =>
        `[${i.severity.toUpperCase()}] ${i.category}: ${i.description}\n  Fix: ${i.suggestedFix}`
      ).join('\n');

      const eliminationRules = issues.map(i => {
        const patterns = AI_SLOPE_PATTERNS[i.category];
        return patterns ? patterns.eliminationRules.join('\n  - ') : i.suggestedFix;
      }).join('\n\n');

      const prompt = SLOPE_ELIMINATION_PROMPT
        .replace('{slopeIssues}', slopeIssues)
        .replace('{originalDesign}', designOutput.substring(0, 5000))
        .replace('{slopeEliminationRules}', eliminationRules)
        .replace('{designSystemContext}', designSystemContext);

      const response = await client.chat.completions.create({
        model: 'glm-5.2',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: 'Eliminate all AI SLOPE patterns from this design. Produce a revised, brand-specific design.' },
        ],
        temperature: 0.6,
      });

      return response.choices?.[0]?.message?.content ?? null;
    } catch {
      return null;
    }
  }

  // ============ HELPERS ============

  private selectModels(mode: string, subDomain: DesignSubDomain): string[] {
    // Select models based on mode and sub-domain
    const modelSets: Record<string, string[]> = {
      speed:    ['glm-5', 'glm-5v-turbo', 'glm-5.1'],
      quality:  ['glm-5.2', 'glm-5.2-1m', 'glm-4.7'],
      balanced: ['glm-5.2', 'glm-5.1', 'glm-4.7'],
      creative: ['glm-4.7', 'glm-5.1', 'glm-5.2'],
    };

    // For SLOPE detection, always include at least one quality model
    if (subDomain === 'ux-audit' || subDomain === 'brand') {
      return modelSets['quality'];
    }

    return modelSets[mode] ?? modelSets['balanced'];
  }

  private buildSlopeWarnings(subDomain: DesignSubDomain): string {
    const domainSpecificWarnings: Record<DesignSubDomain, string[]> = {
      brand: [
        'NO generic brand voice — must be specific to the product/industry',
        'NO "innovative", "cutting-edge", "next-generation" in brand messaging',
      ],
      'design-system': [
        'NO default blue (#3B82F6) as primary color',
        'NO AI purple (#6366F1) — this is the #1 indicator of AI-generated design',
        'MUST include a signature accent color unique to the brand',
      ],
      'ui-styling': [
        'NO backdrop-blur on every card — use sparingly',
        'NO uniform border-radius — vary between sharp and rounded',
        'MUST create a unique component variation, not just shadcn defaults',
      ],
      logo: [
        'NO generic geometric shapes (circles, triangles) as the only element',
        'NO default color gradients',
        'MUST have a unique visual concept specific to the brand name',
      ],
      cip: [
        'NO template-looking business cards or letterheads',
        'MUST incorporate brand-specific visual language in all deliverables',
      ],
      slides: [
        'NO centered text on every slide',
        'NO "Thank You" as the last slide — use a memorable closing statement',
        'MUST use varied layouts across slides',
      ],
      banner: [
        'NO generic gradient backgrounds',
        'NO stock photo placeholders',
        'MUST use brand-specific visual elements',
      ],
      icon: [
        'NO default Lucide style without customization',
        'MUST match brand personality in icon style (rounded vs sharp, filled vs outlined)',
      ],
      'social-photos': [
        'NO generic lifestyle stock images',
        'MUST incorporate brand colors and visual language',
      ],
      'ux-audit': [
        'Focus on identifying AI SLOPE in the existing design',
        'Check all 10 SLOPE categories',
      ],
    };

    const warnings = domainSpecificWarnings[subDomain] ?? [];
    const generalWarnings = [
      'CRITICAL: This design must NOT look like a typical AI-generated output',
      'CRITICAL: Include at least ONE signature visual element that is unique to this brand',
      'CRITICAL: Avoid the "AI special" layout (centered hero + 3-column + CTA)',
    ];

    return [...generalWarnings, ...warnings].join('\n');
  }

  private designSystemToContext(ds: DesignSystemRecommendation): string {
    return `PROJECT: ${ds.projectName}
PATTERN: ${ds.pattern}
STYLE: ${ds.style}
COLORS:
  Primary: ${ds.colors.primary}
  Secondary: ${ds.colors.secondary}
  Accent: ${ds.colors.accent}
  Background: ${ds.colors.background}
  Foreground: ${ds.colors.foreground}
  Muted: ${ds.colors.muted}
TYPOGRAPHY:
  Heading: ${ds.typography.headingFont}
  Body: ${ds.typography.bodyFont}
  Mood: ${ds.typography.moodKeywords.join(', ')}
EFFECTS: ${ds.effects.join(', ')}
ANTI-PATTERNS: ${ds.antiPatterns.join('; ')}
SLOPE ANTI-PATTERNS: ${ds.slopeAntiPatterns.join('; ')}
DECISION RULES: ${JSON.stringify(ds.decisionRules)}`;
  }

  private designSystemToMarkdown(
    projectName: string,
    pattern: string,
    style: string,
    colors: DesignSystemColors,
    typography: DesignSystemTypography,
    effects: string[],
    antiPatterns: string[],
    slopeAntiPatterns: string[],
    decisionRules: Record<string, string>
  ): string {
    return `# Design System — ${projectName}

## Pattern
${pattern}

## Style
${style}

## Colors
| Token | Value |
|-------|-------|
| Primary | ${colors.primary} |
| Secondary | ${colors.secondary} |
| Accent | ${colors.accent} |
| Background | ${colors.background} |
| Foreground | ${colors.foreground} |
| Muted | ${colors.muted} |
| Muted Foreground | ${colors.mutedForeground} |
| Card | ${colors.card} |
| Card Foreground | ${colors.cardForeground} |
| Border | ${colors.border} |
| Destructive | ${colors.destructive} |

## Typography
| Property | Value |
|----------|-------|
| Heading Font | ${typography.headingFont} |
| Body Font | ${typography.bodyFont} |
| Mood | ${typography.moodKeywords.join(', ')} |

## Effects
${effects.map(e => `- ${e}`).join('\n')}

## Anti-Patterns
${antiPatterns.map(a => `- ${a}`).join('\n')}

## AI SLOPE Anti-Patterns (MUST follow)
${slopeAntiPatterns.map(a => `- [CRITICAL] ${a}`).join('\n')}

## Decision Rules
${Object.entries(decisionRules).map(([k, v]) => `- **${k}**: ${v}`).join('\n')}
`;
  }

  private loadReasoningRules(): Record<string, string>[] {
    const filepath = path.join(__dirname, 'data', 'ui-reasoning.csv');
    if (!fs.existsSync(filepath)) return [];

    const content = fs.readFileSync(filepath, 'utf-8');
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
      return row;
    });
  }

  private matchReasoning(
    rules: Record<string, string>[],
    productType: string
  ): Record<string, string> | null {
    const productLower = productType.toLowerCase();
    for (const rule of rules) {
      const category = (rule['UI_Category'] ?? '').toLowerCase();
      if (productLower.includes(category) || category.includes(productLower)) {
        return rule;
      }
    }
    return rules[0] ?? null;  // Default to first rule
  }
}

/**
 * Create a new DesignSkillEngine with optional config.
 */
export function createDesignSkillEngine(config?: Partial<DesignSkillConfig>): DesignSkillEngine {
  return new DesignSkillEngine(config);
}
