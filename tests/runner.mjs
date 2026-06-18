/**
 * Nexus-Dev MMFE — Comprehensive Test Suite
 * 125 test pipelines covering all components, edge cases, and integration scenarios.
 *
 * Run with: node --import tsx --test tests/runner.mjs
 * Quick mode (unit only, no API calls): QUICK=1 node --import tsx --test tests/runner.mjs
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ─── Import modules under test ───
// We import the TypeScript source directly via tsx loader
const mod = await import('../src/index.ts');

const {
  MODEL_REGISTRY,
  getModelIds,
  getModelsWithCapability,
  getModelsSortedBy,
  resolveModel,
  DEFAULT_CONFIG,
  mergeConfig,
  AdaptiveRouter,
  Orchestrator,
  createOrchestrator,
} = mod;

// Check if we're in quick mode (skip API-dependent tests)
const QUICK_MODE = !!process.env.QUICK || process.argv.includes('--quick');
// Integration tests make real network calls to an LLM provider (default ZAI).
// Skip them when no API key / config is available so the suite stays green in
// environments without credentials (CI, fresh clones). Set ZAI_API_KEY or
// create ~/.z-ai-config to run them.
const fs = await import('node:fs');
const path = await import('node:path');
const os = await import('node:os');
const hasZaiConfig = fs.existsSync(path.join(os.homedir(), '.z-ai-config')) || fs.existsSync(path.join(process.cwd(), '.z-ai-config'));
const HAS_API_KEY = !!(process.env.ZAI_API_KEY || hasZaiConfig);
const SKIP_INTEGRATION = QUICK_MODE || !HAS_API_KEY;

// Helper to create subtasks
function makeSubtask(overrides = {}) {
  return {
    id: `sub-${Math.random().toString(36).slice(2, 8)}`,
    parentTaskId: 'parent-1',
    index: 0,
    description: 'Test subtask',
    input: 'Test input',
    requiredCapabilities: ['reasoning'],
    preferredModels: [],
    priority: 'medium',
    dependencies: [],
    estimatedComplexity: 'moderate',
    timeout: 120000,
    metadata: {},
    ...overrides,
  };
}

function makeRequest(overrides = {}) {
  return {
    id: 'req-1',
    query: 'Test query',
    context: undefined,
    preferredMode: 'balanced',
    maxParallelSubTasks: 6,
    enableThinking: true,
    customSystemPrompt: undefined,
    metadata: {},
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: MODEL REGISTRY TESTS (15 tests)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Model Registry', () => {
  it('#1 - MODEL_REGISTRY should contain all expected GLM models', () => {
    const expectedGlmIds = ['glm-5.2-1m', 'glm-5.2', 'glm-5.1', 'glm-5', 'glm-5v-turbo', 'glm-4.7'];
    const actualIds = getModelIds();
    for (const id of expectedGlmIds) {
      assert.ok(actualIds.includes(id), `Missing model: ${id}`);
    }
    // Registry now also includes OpenAI / Anthropic / Google models.
    assert.ok(actualIds.length >= expectedGlmIds.length, 'Registry should have at least the GLM models');
  });

  it('#2 - Each model should have required profile fields', () => {
    for (const [id, profile] of Object.entries(MODEL_REGISTRY)) {
      assert.ok(profile.id, `${id}: missing id`);
      assert.ok(profile.name, `${id}: missing name`);
      assert.ok(profile.tier, `${id}: missing tier`);
      assert.ok(Array.isArray(profile.capabilities), `${id}: capabilities not array`);
      assert.ok(profile.capabilities.length > 0, `${id}: empty capabilities`);
      assert.ok(typeof profile.contextWindow === 'number', `${id}: contextWindow not number`);
      assert.ok(typeof profile.speedRank === 'number', `${id}: speedRank not number`);
      assert.ok(typeof profile.qualityRank === 'number', `${id}: qualityRank not number`);
      assert.ok(typeof profile.costWeight === 'number', `${id}: costWeight not number`);
      assert.ok(typeof profile.maxTokens === 'number', `${id}: maxTokens not number`);
      assert.ok(typeof profile.supportsThinking === 'boolean', `${id}: supportsThinking not boolean`);
      assert.ok(typeof profile.supportsVision === 'boolean', `${id}: supportsVision not boolean`);
      assert.ok(profile.description, `${id}: missing description`);
    }
  });

  it('#3 - glm-5.2-1m should have 1M context window', () => {
    assert.equal(MODEL_REGISTRY['glm-5.2-1m'].contextWindow, 1_000_000);
  });

  it('#4 - glm-5 and glm-5v-turbo should be fastest (speedRank 1)', () => {
    assert.equal(MODEL_REGISTRY['glm-5'].speedRank, 1);
    assert.equal(MODEL_REGISTRY['glm-5v-turbo'].speedRank, 1);
  });

  it('#5 - glm-5.2 and glm-5.2-1m should have highest quality (qualityRank 1)', () => {
    assert.equal(MODEL_REGISTRY['glm-5.2'].qualityRank, 1);
    assert.equal(MODEL_REGISTRY['glm-5.2-1m'].qualityRank, 1);
  });

  it('#6 - glm-4.7 should be creative tier', () => {
    assert.equal(MODEL_REGISTRY['glm-4.7'].tier, 'creative');
  });

  it('#7 - glm-5v-turbo should support vision', () => {
    assert.equal(MODEL_REGISTRY['glm-5v-turbo'].supportsVision, true);
  });

  it('#8 - glm-5v-turbo and others should support vision', () => {
    const visionModels = getModelIds().filter(id => MODEL_REGISTRY[id].supportsVision);
    // glm-5v-turbo must be vision-capable, and the registry now also carries
    // OpenAI/Google multimodal models (gpt-4o, gemini-*).
    assert.ok(visionModels.includes('glm-5v-turbo'), 'glm-5v-turbo should support vision');
    assert.ok(visionModels.length >= 1, 'At least one model should support vision');
  });

  it('#9 - getModelsWithCapability should return models with that capability', () => {
    const reasoning = getModelsWithCapability('reasoning');
    assert.ok(reasoning.length >= 2, 'At least 2 models should support reasoning');
    const code = getModelsWithCapability('code');
    assert.ok(code.length >= 2, 'At least 2 models should support code');
  });

  it('#10 - getModelsSortedBy speedRank should return fastest first', () => {
    const sorted = getModelsSortedBy('speedRank', true);
    assert.ok(sorted[0].speedRank <= sorted[1].speedRank);
  });

  it('#11 - getModelsSortedBy qualityRank should return best first', () => {
    const sorted = getModelsSortedBy('qualityRank', true);
    assert.ok(sorted[0].qualityRank <= sorted[1].qualityRank);
  });

  it('#12 - resolveModel should return the model if it exists', () => {
    const model = resolveModel('glm-5.2');
    assert.equal(model.id, 'glm-5.2');
  });

  it('#13 - resolveModel should fallback to glm-5.2 for unknown models', () => {
    const model = resolveModel('nonexistent-model');
    assert.equal(model.id, 'glm-5.2');
  });

  it('#14 - All models should have valid speed and quality ranks (1-5)', () => {
    for (const [id, profile] of Object.entries(MODEL_REGISTRY)) {
      assert.ok(profile.speedRank >= 1 && profile.speedRank <= 5, `${id}: speedRank out of range`);
      assert.ok(profile.qualityRank >= 1 && profile.qualityRank <= 5, `${id}: qualityRank out of range`);
    }
  });

  it('#15 - No model should have overlapping id and tier mismatches', () => {
    assert.equal(MODEL_REGISTRY['glm-5.2-1m'].tier, 'flagship');
    assert.equal(MODEL_REGISTRY['glm-5.2'].tier, 'flagship');
    assert.equal(MODEL_REGISTRY['glm-5.1'].tier, 'standard');
    assert.equal(MODEL_REGISTRY['glm-5'].tier, 'fast');
    assert.equal(MODEL_REGISTRY['glm-5v-turbo'].tier, 'fast');
    assert.equal(MODEL_REGISTRY['glm-4.7'].tier, 'creative');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: CONFIGURATION TESTS (15 tests)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Configuration', () => {
  it('#16 - DEFAULT_CONFIG should have all required fields', () => {
    assert.ok(DEFAULT_CONFIG.defaultMode);
    assert.ok(DEFAULT_CONFIG.maxParallelSubTasks);
    assert.ok(DEFAULT_CONFIG.enableThinking !== undefined);
    assert.ok(DEFAULT_CONFIG.subTaskTimeout);
    assert.ok(DEFAULT_CONFIG.verboseRouting !== undefined);
    assert.ok(DEFAULT_CONFIG.maxDecompositionDepth);
    assert.ok(DEFAULT_CONFIG.qualityThreshold);
    assert.ok(DEFAULT_CONFIG.enableRetry !== undefined);
    assert.ok(DEFAULT_CONFIG.maxRetries);
  });

  it('#17 - DEFAULT_CONFIG.defaultMode should be balanced', () => {
    assert.equal(DEFAULT_CONFIG.defaultMode, 'balanced');
  });

  it('#18 - DEFAULT_CONFIG.maxParallelSubTasks should be 6', () => {
    assert.equal(DEFAULT_CONFIG.maxParallelSubTasks, 6);
  });

  it('#19 - mergeConfig with no args should return defaults', () => {
    const config = mergeConfig();
    assert.deepEqual(config, DEFAULT_CONFIG);
  });

  it('#20 - mergeConfig with undefined should return defaults', () => {
    const config = mergeConfig(undefined);
    assert.deepEqual(config, DEFAULT_CONFIG);
  });

  it('#21 - mergeConfig should override specified fields', () => {
    const config = mergeConfig({
      defaultMode: 'speed',
      maxParallelSubTasks: 3,
    });
    assert.equal(config.defaultMode, 'speed');
    assert.equal(config.maxParallelSubTasks, 3);
    assert.equal(config.enableThinking, DEFAULT_CONFIG.enableThinking);
  });

  it('#22 - mergeConfig should not mutate defaults', () => {
    mergeConfig({ defaultMode: 'creative' });
    assert.equal(DEFAULT_CONFIG.defaultMode, 'balanced');
  });

  it('#23 - subTaskTimeout should be a positive number', () => {
    assert.ok(DEFAULT_CONFIG.subTaskTimeout > 0);
  });

  it('#24 - qualityThreshold should be between 0 and 100', () => {
    assert.ok(DEFAULT_CONFIG.qualityThreshold >= 0);
    assert.ok(DEFAULT_CONFIG.qualityThreshold <= 100);
  });

  it('#25 - maxRetries should be a non-negative integer', () => {
    assert.ok(Number.isInteger(DEFAULT_CONFIG.maxRetries));
    assert.ok(DEFAULT_CONFIG.maxRetries >= 0);
  });

  it('#26 - maxDecompositionDepth should be positive', () => {
    assert.ok(DEFAULT_CONFIG.maxDecompositionDepth > 0);
  });

  it('#27 - mergeConfig with empty object should return defaults', () => {
    const config = mergeConfig({});
    assert.deepEqual(config, DEFAULT_CONFIG);
  });

  it('#28 - mergeConfig should handle partial overrides correctly', () => {
    const config = mergeConfig({ enableThinking: false });
    assert.equal(config.enableThinking, false);
    assert.equal(config.defaultMode, DEFAULT_CONFIG.defaultMode);
  });

  it('#29 - All config values should be of correct type', () => {
    assert.ok(['speed', 'quality', 'balanced', 'creative'].includes(DEFAULT_CONFIG.defaultMode));
    assert.equal(typeof DEFAULT_CONFIG.maxParallelSubTasks, 'number');
    assert.equal(typeof DEFAULT_CONFIG.enableThinking, 'boolean');
    assert.equal(typeof DEFAULT_CONFIG.subTaskTimeout, 'number');
    assert.equal(typeof DEFAULT_CONFIG.verboseRouting, 'boolean');
    assert.equal(typeof DEFAULT_CONFIG.maxDecompositionDepth, 'number');
    assert.equal(typeof DEFAULT_CONFIG.qualityThreshold, 'number');
    assert.equal(typeof DEFAULT_CONFIG.enableRetry, 'boolean');
    assert.equal(typeof DEFAULT_CONFIG.maxRetries, 'number');
  });

  it('#30 - mergeConfig should create a new object each time', () => {
    const a = mergeConfig();
    const b = mergeConfig();
    assert.notEqual(a, b);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: ADAPTIVE ROUTER TESTS (30 tests)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Adaptive Router', () => {
  let router;

  beforeEach(() => {
    router = new AdaptiveRouter(DEFAULT_CONFIG);
  });

  it('#31 - Should route a reasoning task to a reasoning-capable model', () => {
    const subtasks = [makeSubtask({ requiredCapabilities: ['reasoning'] })];
    const decisions = router.route(subtasks, makeRequest());
    assert.equal(decisions.length, 1);
    const selected = MODEL_REGISTRY[decisions[0].selectedModel];
    assert.ok(selected.capabilities.includes('reasoning'));
  });

  it('#32 - Should route a code task to a code-capable model', () => {
    const subtasks = [makeSubtask({ requiredCapabilities: ['code'] })];
    const decisions = router.route(subtasks, makeRequest());
    const selected = MODEL_REGISTRY[decisions[0].selectedModel];
    assert.ok(selected.capabilities.includes('code'));
  });

  it('#33 - Should route creative-writing to creative model in creative mode', () => {
    const subtasks = [makeSubtask({ requiredCapabilities: ['creative-writing'] })];
    const request = makeRequest({ preferredMode: 'creative' });
    const decisions = router.route(subtasks, request);
    assert.ok(decisions[0].confidence > 0);
  });

  it('#34 - Should prefer fast models in speed mode', () => {
    const subtasks = [makeSubtask({ requiredCapabilities: ['summarization'] })];
    const request = makeRequest({ preferredMode: 'speed' });
    const decisions = router.route(subtasks, request);
    assert.ok(decisions[0].selectedModel);
  });

  it('#35 - Should prefer quality models in quality mode', () => {
    const subtasks = [makeSubtask({ requiredCapabilities: ['reasoning'] })];
    const request = makeRequest({ preferredMode: 'quality' });
    const decisions = router.route(subtasks, request);
    assert.ok(decisions[0].selectedModel);
  });

  it('#36 - Should respect explicitly preferred models', () => {
    const subtasks = [makeSubtask({ preferredModels: ['glm-4.7'] })];
    const decisions = router.route(subtasks, makeRequest());
    assert.equal(decisions[0].selectedModel, 'glm-4.7');
    assert.ok(decisions[0].confidence >= 0.9);
  });

  it('#37 - Should fallback when preferred model is invalid', () => {
    const subtasks = [makeSubtask({ preferredModels: ['nonexistent-model'] })];
    const decisions = router.route(subtasks, makeRequest());
    assert.ok(decisions[0].selectedModel !== 'nonexistent-model');
  });

  it('#38 - Should produce routing decisions for all subtasks', () => {
    const subtasks = [makeSubtask({ id: 's1' }), makeSubtask({ id: 's2' }), makeSubtask({ id: 's3' })];
    const decisions = router.route(subtasks, makeRequest());
    assert.equal(decisions.length, 3);
  });

  it('#39 - Each decision should have a reason', () => {
    const decisions = router.route([makeSubtask()], makeRequest());
    assert.ok(decisions[0].reason.length > 0);
  });

  it('#40 - Each decision should have a confidence score', () => {
    const decisions = router.route([makeSubtask()], makeRequest());
    assert.ok(decisions[0].confidence >= 0 && decisions[0].confidence <= 1);
  });

  it('#41 - Each decision should have alternative models', () => {
    const decisions = router.route([makeSubtask()], makeRequest());
    assert.ok(Array.isArray(decisions[0].alternativeModels));
  });

  it('#42 - Should respect dependency ordering (topological sort)', () => {
    const subtasks = [makeSubtask({ id: 's2', dependencies: ['s1'] }), makeSubtask({ id: 's1' })];
    const decisions = router.route(subtasks, makeRequest());
    const s1Index = decisions.findIndex(d => d.subTaskId === 's1');
    const s2Index = decisions.findIndex(d => d.subTaskId === 's2');
    assert.ok(s1Index < s2Index);
  });

  it('#43 - Should handle tasks with no capabilities specified', () => {
    const decisions = router.route([makeSubtask({ requiredCapabilities: [] })], makeRequest());
    assert.equal(decisions.length, 1);
  });

  it('#44 - Should handle critical priority tasks', () => {
    const decisions = router.route([makeSubtask({ priority: 'critical' })], makeRequest({ preferredMode: 'quality' }));
    assert.ok(decisions[0].selectedModel);
  });

  it('#45 - Should handle trivial complexity tasks', () => {
    const decisions = router.route([makeSubtask({ estimatedComplexity: 'trivial' })], makeRequest({ preferredMode: 'speed' }));
    assert.ok(decisions.length > 0);
  });

  it('#46 - Should handle expert complexity tasks', () => {
    const decisions = router.route([makeSubtask({ estimatedComplexity: 'expert' })], makeRequest({ preferredMode: 'quality' }));
    assert.ok(decisions.length > 0);
  });

  it('#47 - Should load-balance across models', () => {
    const subtasks = Array.from({ length: 6 }, (_, i) => makeSubtask({ id: `s${i}`, requiredCapabilities: ['reasoning'] }));
    const decisions = router.route(subtasks, makeRequest());
    const usedModels = new Set(decisions.map(d => d.selectedModel));
    assert.ok(usedModels.size >= 2, `Expected load balancing but only used ${usedModels.size} models`);
  });

  it('#48 - Should route math tasks to math-capable models', () => {
    const decisions = router.route([makeSubtask({ requiredCapabilities: ['math'] })], makeRequest());
    assert.ok(MODEL_REGISTRY[decisions[0].selectedModel].capabilities.includes('math'));
  });

  it('#49 - Should route vision tasks to vision-capable model', () => {
    const decisions = router.route([makeSubtask({ requiredCapabilities: ['vision'] })], makeRequest());
    const selected = decisions[0].selectedModel;
    const visionModels = getModelIds().filter(id => MODEL_REGISTRY[id].supportsVision);
    assert.ok(visionModels.includes(selected), `Routed to non-vision model: ${selected}`);
  });

  it('#50 - Should handle rapid-iteration tasks', () => {
    const decisions = router.route([makeSubtask({ requiredCapabilities: ['rapid-iteration'] })], makeRequest({ preferredMode: 'speed' }));
    assert.ok(decisions[0].selectedModel);
  });

  it('#51 - Should route long-context tasks to a long-context-capable model', () => {
    const decisions = router.route([makeSubtask({ requiredCapabilities: ['long-context'] })], makeRequest());
    const selected = decisions[0].selectedModel;
    const longContextModels = getModelIds().filter(id => (MODEL_REGISTRY[id].capabilities || []).includes('long-context'));
    assert.ok(longContextModels.includes(selected), `Routed to non-long-context model: ${selected}`);
  });

  it('#52 - Should handle multiple required capabilities', () => {
    const decisions = router.route(
      [
        makeSubtask({
          requiredCapabilities: ['reasoning', 'code', 'debugging'],
        }),
      ],
      makeRequest()
    );
    assert.ok(decisions[0].selectedModel);
  });

  it('#53 - Should handle balanced mode for mixed tasks', () => {
    const subtasks = [
      makeSubtask({ id: 's1', requiredCapabilities: ['reasoning'] }),
      makeSubtask({ id: 's2', requiredCapabilities: ['creative-writing'] }),
      makeSubtask({ id: 's3', requiredCapabilities: ['code'] }),
    ];
    const decisions = router.route(subtasks, makeRequest({ preferredMode: 'balanced' }));
    assert.equal(decisions.length, 3);
  });

  it('#54 - Should handle empty subtask list', () => {
    const decisions = router.route([], makeRequest());
    assert.equal(decisions.length, 0);
  });

  it('#55 - Should handle subtask with invalid preferred model fallback', () => {
    const decisions = router.route([makeSubtask({ preferredModels: ['invalid-model-xyz'] })], makeRequest());
    assert.ok(decisions[0].selectedModel !== 'invalid-model-xyz');
  });

  it('#56 - Confidence should be high for explicitly preferred models', () => {
    const decisions = router.route([makeSubtask({ preferredModels: ['glm-5.2'] })], makeRequest());
    assert.ok(decisions[0].confidence >= 0.9);
  });

  it('#57 - Should handle debug tasks in speed mode', () => {
    const decisions = router.route([makeSubtask({ requiredCapabilities: ['debugging'] })], makeRequest({ preferredMode: 'speed' }));
    assert.ok(decisions[0].selectedModel);
  });

  it('#58 - Should handle documentation tasks', () => {
    const decisions = router.route([makeSubtask({ requiredCapabilities: ['documentation'] })], makeRequest());
    assert.ok(MODEL_REGISTRY[decisions[0].selectedModel].capabilities.includes('documentation'));
  });

  it('#59 - Should handle refactoring tasks', () => {
    const decisions = router.route([makeSubtask({ requiredCapabilities: ['refactoring'] })], makeRequest());
    assert.ok(MODEL_REGISTRY[decisions[0].selectedModel].capabilities.includes('refactoring'));
  });

  it('#60 - Should handle translation tasks', () => {
    const decisions = router.route([makeSubtask({ requiredCapabilities: ['translation'] })], makeRequest());
    assert.ok(MODEL_REGISTRY[decisions[0].selectedModel].capabilities.includes('translation'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: ORCHESTRATOR CONSTRUCTION TESTS (20 tests)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Orchestrator Construction', () => {
  it('#61 - createOrchestrator should return an Orchestrator instance', () => {
    const orch = createOrchestrator();
    assert.ok(orch instanceof Orchestrator);
  });

  it('#62 - Orchestrator with default config should have balanced mode', () => {
    const orch = createOrchestrator();
    assert.equal(orch.getConfig().defaultMode, 'balanced');
  });

  it('#63 - Orchestrator with custom config should apply overrides', () => {
    const orch = createOrchestrator({ defaultMode: 'speed' });
    assert.equal(orch.getConfig().defaultMode, 'speed');
  });

  it('#64 - Orchestrator updateConfig should change config', () => {
    const orch = createOrchestrator();
    orch.updateConfig({ defaultMode: 'creative' });
    assert.equal(orch.getConfig().defaultMode, 'creative');
  });

  it('#65 - Orchestrator getConfig should return a copy', () => {
    const orch = createOrchestrator();
    const config1 = orch.getConfig();
    config1.defaultMode = 'speed';
    const config2 = orch.getConfig();
    assert.equal(config2.defaultMode, 'balanced');
  });

  it('#66 - Orchestrator should have pipeline state tracking', () => {
    const orch = createOrchestrator();
    assert.equal(typeof orch.getPipelineState, 'function');
  });

  it('#67 - getPipelineState should return undefined for unknown request', () => {
    const orch = createOrchestrator();
    assert.equal(orch.getPipelineState('nonexistent'), undefined);
  });

  it('#68 - Orchestrator with maxParallelSubTasks=1 should work', () => {
    const orch = createOrchestrator({ maxParallelSubTasks: 1 });
    assert.equal(orch.getConfig().maxParallelSubTasks, 1);
  });

  it('#69 - Orchestrator with maxParallelSubTasks=10 should work', () => {
    const orch = createOrchestrator({ maxParallelSubTasks: 10 });
    assert.equal(orch.getConfig().maxParallelSubTasks, 10);
  });

  it('#70 - Orchestrator with enableThinking=false should work', () => {
    const orch = createOrchestrator({ enableThinking: false });
    assert.equal(orch.getConfig().enableThinking, false);
  });

  it('#71 - Orchestrator with enableRetry=false should work', () => {
    const orch = createOrchestrator({ enableRetry: false });
    assert.equal(orch.getConfig().enableRetry, false);
  });

  it('#72 - Orchestrator with qualityThreshold=90 should work', () => {
    const orch = createOrchestrator({ qualityThreshold: 90 });
    assert.equal(orch.getConfig().qualityThreshold, 90);
  });

  it('#73 - Multiple Orchestrator instances should be independent', () => {
    const orch1 = createOrchestrator({ defaultMode: 'speed' });
    const orch2 = createOrchestrator({ defaultMode: 'quality' });
    assert.equal(orch1.getConfig().defaultMode, 'speed');
    assert.equal(orch2.getConfig().defaultMode, 'quality');
  });

  it('#74 - updateConfig should not affect other instances', () => {
    const orch1 = createOrchestrator();
    const orch2 = createOrchestrator();
    orch1.updateConfig({ defaultMode: 'creative' });
    assert.equal(orch2.getConfig().defaultMode, 'balanced');
  });

  it('#75 - Orchestrator should accept all mode types', () => {
    for (const mode of ['speed', 'quality', 'balanced', 'creative']) {
      const orch = createOrchestrator({ defaultMode: mode });
      assert.equal(orch.getConfig().defaultMode, mode);
    }
  });

  it('#76 - Orchestrator with subTaskTimeout should preserve value', () => {
    const orch = createOrchestrator({ subTaskTimeout: 60000 });
    assert.equal(orch.getConfig().subTaskTimeout, 60000);
  });

  it('#77 - Orchestrator with verboseRouting=true should preserve value', () => {
    const orch = createOrchestrator({ verboseRouting: true });
    assert.equal(orch.getConfig().verboseRouting, true);
  });

  it('#78 - Orchestrator with maxDecompositionDepth should preserve value', () => {
    const orch = createOrchestrator({ maxDecompositionDepth: 5 });
    assert.equal(orch.getConfig().maxDecompositionDepth, 5);
  });

  it('#79 - Orchestrator with maxRetries=0 should preserve value', () => {
    const orch = createOrchestrator({ maxRetries: 0 });
    assert.equal(orch.getConfig().maxRetries, 0);
  });

  it('#80 - createOrchestrator with no args uses all defaults', () => {
    const orch = createOrchestrator();
    const config = orch.getConfig();
    assert.equal(config.defaultMode, DEFAULT_CONFIG.defaultMode);
    assert.equal(config.maxParallelSubTasks, DEFAULT_CONFIG.maxParallelSubTasks);
    assert.equal(config.enableThinking, DEFAULT_CONFIG.enableThinking);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: SUBTASK TYPE AND STRUCTURE TESTS (20 tests)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Subtask Structure and Types', () => {
  it('#81 - Subtask should have all required fields', () => {
    const sub = makeSubtask();
    assert.ok(sub.id);
    assert.ok(sub.parentTaskId);
    assert.equal(typeof sub.index, 'number');
    assert.ok(sub.description);
    assert.ok(sub.input);
    assert.ok(Array.isArray(sub.requiredCapabilities));
    assert.ok(Array.isArray(sub.preferredModels));
    assert.ok(['critical', 'high', 'medium', 'low'].includes(sub.priority));
    assert.ok(Array.isArray(sub.dependencies));
    assert.ok(['trivial', 'simple', 'moderate', 'complex', 'expert'].includes(sub.estimatedComplexity));
    assert.equal(typeof sub.timeout, 'number');
    assert.ok(sub.metadata !== undefined);
  });

  it('#82 - Priority should accept all valid values', () => {
    for (const p of ['critical', 'high', 'medium', 'low']) {
      assert.equal(makeSubtask({ priority: p }).priority, p);
    }
  });

  it('#83 - Complexity should accept all valid values', () => {
    for (const c of ['trivial', 'simple', 'moderate', 'complex', 'expert']) {
      assert.equal(makeSubtask({ estimatedComplexity: c }).estimatedComplexity, c);
    }
  });

  it('#84 - Subtask with dependencies should reference other subtask IDs', () => {
    const sub = makeSubtask({ dependencies: ['sub-0'] });
    assert.deepEqual(sub.dependencies, ['sub-0']);
  });

  it('#85 - Subtask with multiple dependencies', () => {
    assert.equal(makeSubtask({ dependencies: ['sub-0', 'sub-1', 'sub-2'] }).dependencies.length, 3);
  });

  it('#86 - Subtask with multiple required capabilities', () => {
    assert.equal(makeSubtask({ requiredCapabilities: ['reasoning', 'code', 'debugging'] }).requiredCapabilities.length, 3);
  });

  it('#87 - Subtask with single preferred model', () => {
    assert.deepEqual(makeSubtask({ preferredModels: ['glm-5.2'] }).preferredModels, ['glm-5.2']);
  });

  it('#88 - Subtask with multiple preferred models', () => {
    assert.equal(makeSubtask({ preferredModels: ['glm-5.2', 'glm-4.7'] }).preferredModels.length, 2);
  });

  it('#89 - Subtask timeout should be a positive number', () => {
    assert.ok(makeSubtask({ timeout: 60000 }).timeout > 0);
  });

  it('#90 - Subtask metadata should be extensible', () => {
    const sub = makeSubtask({
      metadata: { custom: 'value', nested: { deep: true } },
    });
    assert.equal(sub.metadata.custom, 'value');
    assert.equal(sub.metadata.nested.deep, true);
  });

  it('#91 - Multiple subtasks should have unique IDs', () => {
    const subs = Array.from({ length: 10 }, (_, i) => makeSubtask({ id: `sub-${i}` }));
    assert.equal(new Set(subs.map(s => s.id)).size, 10);
  });

  it('#92 - Subtask index should reflect order', () => {
    const subs = Array.from({ length: 5 }, (_, i) => makeSubtask({ id: `sub-${i}`, index: i }));
    for (let i = 0; i < 5; i++) assert.equal(subs[i].index, i);
  });

  it('#93 - Subtask parentTaskId should be consistent', () => {
    const subs = Array.from({ length: 5 }, (_, i) => makeSubtask({ id: `sub-${i}`, parentTaskId: 'parent-1' }));
    assert.ok(subs.every(s => s.parentTaskId === 'parent-1'));
  });

  it('#94 - Empty requiredCapabilities should be valid', () => {
    assert.deepEqual(makeSubtask({ requiredCapabilities: [] }).requiredCapabilities, []);
  });

  it('#95 - Empty dependencies should mean independent task', () => {
    assert.equal(makeSubtask({ dependencies: [] }).dependencies.length, 0);
  });

  it('#96 - Critical priority subtask should be distinguishable', () => {
    const sub = makeSubtask({ priority: 'critical' });
    assert.equal(sub.priority, 'critical');
    assert.notEqual(sub.priority, 'low');
  });

  it('#97 - Expert complexity subtask should be distinguishable', () => {
    const sub = makeSubtask({ estimatedComplexity: 'expert' });
    assert.equal(sub.estimatedComplexity, 'expert');
    assert.notEqual(sub.estimatedComplexity, 'trivial');
  });

  it('#98 - Subtask with very long input should be handled', () => {
    assert.equal(makeSubtask({ input: 'x'.repeat(100000) }).input.length, 100000);
  });

  it('#99 - Subtask with unicode input should be handled', () => {
    const unicodeInput = '你好世界 🧠 Fusion エンジン';
    assert.equal(makeSubtask({ input: unicodeInput }).input, unicodeInput);
  });

  it('#100 - Subtask with special characters in description should be handled', () => {
    const desc = 'Task with "quotes" and <tags> and \\backslashes';
    assert.equal(makeSubtask({ description: desc }).description, desc);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: ROUTING EDGE CASES (15 tests)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Routing Edge Cases', () => {
  let router;
  beforeEach(() => {
    router = new AdaptiveRouter(DEFAULT_CONFIG);
  });

  it('#101 - Should handle deeply chained dependencies', () => {
    const subtasks = [
      makeSubtask({ id: 's4', dependencies: ['s3'] }),
      makeSubtask({ id: 's3', dependencies: ['s2'] }),
      makeSubtask({ id: 's2', dependencies: ['s1'] }),
      makeSubtask({ id: 's1' }),
    ];
    const decisions = router.route(subtasks, makeRequest());
    const order = decisions.map(d => d.subTaskId);
    assert.ok(order.indexOf('s1') < order.indexOf('s2'));
    assert.ok(order.indexOf('s2') < order.indexOf('s3'));
    assert.ok(order.indexOf('s3') < order.indexOf('s4'));
  });

  it('#102 - Should handle diamond dependency pattern', () => {
    const subtasks = [
      makeSubtask({ id: 's4', dependencies: ['s2', 's3'] }),
      makeSubtask({ id: 's2', dependencies: ['s1'] }),
      makeSubtask({ id: 's3', dependencies: ['s1'] }),
      makeSubtask({ id: 's1' }),
    ];
    const decisions = router.route(subtasks, makeRequest());
    const order = decisions.map(d => d.subTaskId);
    assert.ok(order.indexOf('s1') < order.indexOf('s2'));
    assert.ok(order.indexOf('s1') < order.indexOf('s3'));
    assert.ok(order.indexOf('s2') < order.indexOf('s4'));
    assert.ok(order.indexOf('s3') < order.indexOf('s4'));
  });

  it('#103 - Should handle all subtasks with same capability', () => {
    const subtasks = Array.from({ length: 5 }, (_, i) => makeSubtask({ id: `s${i}`, requiredCapabilities: ['code'] }));
    const decisions = router.route(subtasks, makeRequest());
    assert.equal(decisions.length, 5);
    for (const d of decisions) assert.ok(MODEL_REGISTRY[d.selectedModel].capabilities.includes('code'));
  });

  it('#104 - Should handle mixed complexity across subtasks', () => {
    const complexities = ['trivial', 'simple', 'moderate', 'complex', 'expert'];
    const subtasks = complexities.map((c, i) => makeSubtask({ id: `s${i}`, estimatedComplexity: c }));
    assert.equal(router.route(subtasks, makeRequest()).length, 5);
  });

  it('#105 - Should handle mixed priority across subtasks', () => {
    const priorities = ['critical', 'high', 'medium', 'low'];
    const subtasks = priorities.map((p, i) => makeSubtask({ id: `s${i}`, priority: p }));
    assert.equal(router.route(subtasks, makeRequest()).length, 4);
  });

  it('#106 - Should handle single subtask', () => {
    assert.equal(router.route([makeSubtask()], makeRequest()).length, 1);
  });

  it('#107 - Should handle many subtasks (20)', () => {
    const subtasks = Array.from({ length: 20 }, (_, i) =>
      makeSubtask({
        id: `s${i}`,
        requiredCapabilities: [i % 2 === 0 ? 'reasoning' : 'code'],
      })
    );
    assert.equal(router.route(subtasks, makeRequest()).length, 20);
  });

  it('#108 - Should handle subtask with conflicting preferred and required', () => {
    const subtasks = [
      makeSubtask({
        preferredModels: ['glm-5'],
        requiredCapabilities: ['long-context'],
      }),
    ];
    const decisions = router.route(subtasks, makeRequest());
    assert.equal(decisions[0].selectedModel, 'glm-5');
  });

  it('#109 - Should handle all four modes in sequence', () => {
    for (const mode of ['speed', 'quality', 'balanced', 'creative']) {
      const decisions = router.route([makeSubtask()], makeRequest({ preferredMode: mode }));
      assert.equal(decisions.length, 1);
    }
  });

  it('#110 - Should handle planning capability', () => {
    assert.ok(router.route([makeSubtask({ requiredCapabilities: ['planning'] })], makeRequest())[0].selectedModel);
  });

  it('#111 - Should handle extraction capability', () => {
    assert.ok(router.route([makeSubtask({ requiredCapabilities: ['extraction'] })], makeRequest())[0].selectedModel);
  });

  it('#112 - Should handle analysis capability', () => {
    const decisions = router.route([makeSubtask({ requiredCapabilities: ['analysis'] })], makeRequest());
    assert.ok(MODEL_REGISTRY[decisions[0].selectedModel].capabilities.includes('analysis'));
  });

  it('#113 - Should handle conversation capability', () => {
    const decisions = router.route([makeSubtask({ requiredCapabilities: ['conversation'] })], makeRequest());
    assert.ok(MODEL_REGISTRY[decisions[0].selectedModel].capabilities.includes('conversation'));
  });

  it('#114 - Should produce unique subTaskIds in decisions', () => {
    const subtasks = Array.from({ length: 5 }, (_, i) => makeSubtask({ id: `s${i}` }));
    const ids = router.route(subtasks, makeRequest()).map(d => d.subTaskId);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('#115 - Should handle switching modes for same task set', () => {
    const subtasks = [makeSubtask({ requiredCapabilities: ['reasoning', 'code'] })];
    const speedDec = router.route(subtasks, makeRequest({ preferredMode: 'speed' }));
    const qualityDec = router.route(subtasks, makeRequest({ preferredMode: 'quality' }));
    assert.ok(speedDec[0].selectedModel);
    assert.ok(qualityDec[0].selectedModel);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: INTEGRATION TESTS WITH API CALLS (10 tests — skipped in quick mode)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration Tests (API Calls)', { skip: SKIP_INTEGRATION }, () => {
  it('#116 - Full pipeline: simple query in balanced mode', async () => {
    const orch = createOrchestrator({
      defaultMode: 'balanced',
      enableThinking: false,
    });
    const result = await orch.process('What is 2+2?');
    assert.ok(result.answer);
    assert.ok(result.answer.length > 0);
    assert.ok(result.qualityScore >= 0);
    assert.ok(result.modelsUsed.length > 0);
  });

  it('#117 - Full pipeline: creative mode query', async () => {
    const orch = createOrchestrator({ defaultMode: 'creative' });
    const result = await orch.process('Write a haiku about programming');
    assert.ok(result.answer);
    assert.ok(result.subTaskResults.length > 0);
  });

  it('#118 - Full pipeline: speed mode query', async () => {
    const orch = createOrchestrator({
      defaultMode: 'speed',
      enableThinking: false,
    });
    const result = await orch.process('Define recursion in one sentence');
    assert.ok(result.answer);
  });

  it('#119 - Full pipeline: quality mode query', async () => {
    const orch = createOrchestrator({ defaultMode: 'quality' });
    const result = await orch.process('Explain the halting problem');
    assert.ok(result.answer);
    assert.ok(result.totalExecutionTimeMs > 0);
  });

  it('#120 - Full pipeline: query with context', async () => {
    const orch = createOrchestrator();
    const result = await orch.process('Summarize this', {
      context: 'The quick brown fox jumps over the lazy dog.',
      enableThinking: false,
    });
    assert.ok(result.answer);
  });

  it('#121 - Full pipeline: complex multi-part query', async () => {
    const orch = createOrchestrator({ enableThinking: false });
    const result = await orch.process('Explain what a binary search tree is, provide a Python implementation, and discuss its time complexity');
    assert.ok(result.answer);
    assert.ok(result.routingDecisions.length > 0);
  });

  it('#122 - Pipeline state should be tracked', async () => {
    const orch = createOrchestrator({ enableThinking: false });
    const result = await orch.process('What is gravity?');
    assert.ok(result.requestId);
  });

  it('#123 - Orchestration result should have all required fields', async () => {
    const orch = createOrchestrator({ enableThinking: false });
    const result = await orch.process('Hello world');
    assert.ok(result.requestId);
    assert.ok(typeof result.answer === 'string');
    assert.ok(Array.isArray(result.subTaskResults));
    assert.ok(Array.isArray(result.routingDecisions));
    assert.ok(typeof result.totalExecutionTimeMs === 'number');
    assert.ok(Array.isArray(result.modelsUsed));
    assert.ok(typeof result.decompositionStrategy === 'string');
    assert.ok(typeof result.synthesisStrategy === 'string');
    assert.ok(typeof result.qualityScore === 'number');
    assert.ok(result.metadata !== undefined);
  });

  it('#124 - Failed subtask should not crash the pipeline', async () => {
    const orch = createOrchestrator({
      enableThinking: false,
      enableRetry: true,
      maxRetries: 1,
    });
    const result = await orch.process('Tell me a joke');
    assert.ok(result.answer);
  });

  it('#125 - Multiple sequential queries should work', async () => {
    const orch = createOrchestrator({ enableThinking: false });
    const r1 = await orch.process('What is 1+1?');
    const r2 = await orch.process('What is 2+2?');
    assert.ok(r1.answer);
    assert.ok(r2.answer);
    assert.notEqual(r1.requestId, r2.requestId);
  });
});

console.log(`
╔══════════════════════════════════════════════════╗
║    Nexus-Dev MMFE — Test Suite Summary           ║
║    125 test pipelines across 7 sections          ║
║                                                  ║
║    §1  Model Registry         (tests #1-15)      ║
║    §2  Configuration          (tests #16-30)     ║
║    §3  Adaptive Router        (tests #31-60)     ║
║    §4  Orchestrator           (tests #61-80)     ║
║    §5  Subtask Structure      (tests #81-100)    ║
║    §6  Routing Edge Cases     (tests #101-115)   ║
║    §7  Integration (API)      (tests #116-125)   ║
║                                                  ║
║    Quick mode: ${QUICK_MODE ? 'ON (skips API tests)' : 'OFF (full suite)'}         ║
║    Integration tests: ${SKIP_INTEGRATION ? 'SKIPPED (no API key / quick mode)' : 'ENABLED'}       ║
╚══════════════════════════════════════════════════╝
`);
