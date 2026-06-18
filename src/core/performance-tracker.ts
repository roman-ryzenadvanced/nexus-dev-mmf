/**
 * Nexus-Dev MMFE — Model Performance Tracker
 * Tracks model execution stats for performance-based routing improvements.
 */

export interface ModelPerformanceRecord {
  modelId: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgExecutionTimeMs: number;
  avgQualityScore: number;
  totalTokensUsed: number;
  lastUsedAt: number;
  capabilityScores: Record<string, number>; // capability -> avg quality when used for that
}

export class PerformanceTracker {
  private readonly records: Map<string, ModelPerformanceRecord> = new Map();
  private readonly maxHistory: number;

  constructor(maxHistory = 1000) {
    this.maxHistory = maxHistory;
  }

  /**
   * Record a successful model execution.
   */
  recordSuccess(modelId: string, executionTimeMs: number, qualityScore?: number, tokensUsed?: number, capabilities?: string[]): void {
    const record = this.getOrCreate(modelId);
    record.totalCalls++;
    record.successfulCalls++;
    record.avgExecutionTimeMs = this.runningAvg(record.avgExecutionTimeMs, executionTimeMs, record.successfulCalls);
    record.totalTokensUsed += tokensUsed ?? 0;
    record.lastUsedAt = Date.now();

    if (qualityScore !== undefined) {
      record.avgQualityScore = this.runningAvg(record.avgQualityScore, qualityScore, record.successfulCalls);
    }

    if (capabilities) {
      for (const cap of capabilities) {
        const capScore = qualityScore ?? 50;
        record.capabilityScores[cap] = record.capabilityScores[cap]
          ? this.runningAvg(record.capabilityScores[cap], capScore, record.successfulCalls)
          : capScore;
      }
    }
  }

  /**
   * Record a failed model execution.
   */
  recordFailure(modelId: string, executionTimeMs: number): void {
    const record = this.getOrCreate(modelId);
    record.totalCalls++;
    record.failedCalls++;
    record.lastUsedAt = Date.now();
  }

  /**
   * Get the performance record for a model.
   */
  getRecord(modelId: string): ModelPerformanceRecord | undefined {
    return this.records.get(modelId);
  }

  /**
   * Get all performance records.
   */
  getAllRecords(): ModelPerformanceRecord[] {
    return Array.from(this.records.values());
  }

  /**
   * Get the best-performing model for a specific capability.
   */
  getBestModelForCapability(capability: string): string | null {
    let bestModel: string | null = null;
    let bestScore = -1;

    for (const [modelId, record] of this.records) {
      const capScore = record.capabilityScores[capability];
      if (capScore !== undefined && capScore > bestScore && record.successfulCalls >= 2) {
        bestScore = capScore;
        bestModel = modelId;
      }
    }

    return bestModel;
  }

  /**
   * Get reliability score (0-1) for a model.
   */
  getReliability(modelId: string): number {
    const record = this.records.get(modelId);
    if (!record || record.totalCalls === 0) return 0.5;
    return record.successfulCalls / record.totalCalls;
  }

  /**
   * Reset all tracking data.
   */
  reset(): void {
    this.records.clear();
  }

  /**
   * Export performance data as JSON.
   */
  exportJSON(): string {
    return JSON.stringify(Object.fromEntries(this.records), null, 2);
  }

  /**
   * Import performance data from JSON.
   */
  importJSON(json: string): void {
    try {
      const data = JSON.parse(json);
      for (const [modelId, record] of Object.entries(data)) {
        this.records.set(modelId, record as ModelPerformanceRecord);
      }
    } catch {
      throw new Error('Invalid performance data JSON');
    }
  }

  private getOrCreate(modelId: string): ModelPerformanceRecord {
    if (!this.records.has(modelId)) {
      this.records.set(modelId, {
        modelId,
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        avgExecutionTimeMs: 0,
        avgQualityScore: 0,
        totalTokensUsed: 0,
        lastUsedAt: 0,
        capabilityScores: {},
      });
    }
    return this.records.get(modelId)!;
  }

  private runningAvg(current: number, newValue: number, count: number): number {
    return current + (newValue - current) / count;
  }
}
