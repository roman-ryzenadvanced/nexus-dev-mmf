/**
 * Nexus-Dev MMFE — Custom Model Registration
 * Allows registering new models into the registry at runtime.
 */

import type { ModelProfile } from './models.js';
import { MODEL_REGISTRY, ModelCapability } from './models.js';

/**
 * Register a new model into the global model registry.
 * If a model with the same ID already exists, it will be overwritten.
 */
export function registerModel(profile: ModelProfile): void {
  validateModelProfile(profile);
  MODEL_REGISTRY[profile.id] = profile;
}

/**
 * Register multiple models at once.
 */
export function registerModels(profiles: ModelProfile[]): void {
  for (const profile of profiles) {
    registerModel(profile);
  }
}

/**
 * Unregister a model from the registry.
 * Returns true if the model was found and removed.
 */
export function unregisterModel(modelId: string): boolean {
  if (MODEL_REGISTRY[modelId]) {
    delete MODEL_REGISTRY[modelId];
    return true;
  }
  return false;
}

/**
 * Validate a model profile before registration.
 */
function validateModelProfile(profile: ModelProfile): void {
  if (!profile.id || typeof profile.id !== 'string') {
    throw new Error('Model profile must have a valid string id');
  }
  if (!profile.name || typeof profile.name !== 'string') {
    throw new Error(`Model "${profile.id}" must have a valid string name`);
  }
  const validTiers = ['flagship', 'standard', 'fast', 'creative', 'vision'];
  if (!validTiers.includes(profile.tier)) {
    throw new Error(`Model "${profile.id}" tier must be one of: ${validTiers.join(', ')}`);
  }
  if (!Array.isArray(profile.capabilities) || profile.capabilities.length === 0) {
    throw new Error(`Model "${profile.id}" must have at least one capability`);
  }
  if (typeof profile.contextWindow !== 'number' || profile.contextWindow <= 0) {
    throw new Error(`Model "${profile.id}" must have a positive contextWindow`);
  }
  if (typeof profile.speedRank !== 'number' || profile.speedRank < 1 || profile.speedRank > 5) {
    throw new Error(`Model "${profile.id}" speedRank must be 1-5`);
  }
  if (typeof profile.qualityRank !== 'number' || profile.qualityRank < 1 || profile.qualityRank > 5) {
    throw new Error(`Model "${profile.id}" qualityRank must be 1-5`);
  }
  if (typeof profile.costWeight !== 'number' || profile.costWeight < 0) {
    throw new Error(`Model "${profile.id}" costWeight must be >= 0`);
  }
  if (typeof profile.maxTokens !== 'number' || profile.maxTokens <= 0) {
    throw new Error(`Model "${profile.id}" maxTokens must be positive`);
  }
  if (!profile.description || typeof profile.description !== 'string') {
    throw new Error(`Model "${profile.id}" must have a description`);
  }
}

/**
 * Get a snapshot of the current registry (for inspection).
 */
export function getRegistrySnapshot(): Record<string, ModelProfile> {
  return { ...MODEL_REGISTRY };
}
