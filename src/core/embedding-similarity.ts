/**
 * Nexus-Dev MMFE — Embedding-Based Task Similarity
 * Uses vector embeddings to match new subtasks to historically successful
 * model assignments. Stores (embedding, modelId, qualityScore) tuples
 * and retrieves the best model via cosine similarity.
 */

export interface EmbeddingRecord {
  id: string;
  embedding: number[];
  modelId: string;
  qualityScore: number;
  taskDescription: string;
  capabilities: string[];
  timestamp: number;
  executionTimeMs: number;
}

export interface SimilarityResult {
  recordId: string;
  modelId: string;
  similarity: number;
  qualityScore: number;
  taskDescription: string;
}

export class EmbeddingSimilarity {
  private records: EmbeddingRecord[] = [];
  private maxRecords: number;
  private similarityThreshold: number;

  constructor(maxRecords = 5000, similarityThreshold = 0.7) {
    this.maxRecords = maxRecords;
    this.similarityThreshold = similarityThreshold;
  }

  /**
   * Store a new embedding record after a successful subtask execution.
   * If an embedding is not available, a simple hash-based pseudo-embedding
   * is generated from the task description.
   */
  addRecord(
    taskDescription: string,
    modelId: string,
    qualityScore: number,
    capabilities: string[],
    executionTimeMs: number,
    embedding?: number[]
  ): void {
    const record: EmbeddingRecord = {
      id: `emb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      embedding: embedding ?? this.generatePseudoEmbedding(taskDescription),
      modelId,
      qualityScore,
      taskDescription,
      capabilities,
      timestamp: Date.now(),
      executionTimeMs,
    };

    this.records.push(record);

    // Enforce max records
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }
  }

  /**
   * Find the most similar historical records for a new task description.
   * Returns results sorted by similarity (highest first).
   */
  findSimilar(
    taskDescription: string,
    topK = 5,
    embedding?: number[]
  ): SimilarityResult[] {
    const queryEmbedding = embedding ?? this.generatePseudoEmbedding(taskDescription);

    const results: SimilarityResult[] = this.records
      .map(record => ({
        recordId: record.id,
        modelId: record.modelId,
        similarity: this.cosineSimilarity(queryEmbedding, record.embedding),
        qualityScore: record.qualityScore,
        taskDescription: record.taskDescription,
      }))
      .filter(r => r.similarity >= this.similarityThreshold)
      .sort((a, b) => {
        // Sort by combined score: similarity * quality weight
        const scoreA = a.similarity * 0.6 + (a.qualityScore / 100) * 0.4;
        const scoreB = b.similarity * 0.6 + (b.qualityScore / 100) * 0.4;
        return scoreB - scoreA;
      })
      .slice(0, topK);

    return results;
  }

  /**
   * Get the recommended model for a new task based on historical similarity.
   * Returns the model ID with the best combined similarity + quality score,
   * or null if no similar tasks found above threshold.
   */
  getRecommendedModel(
    taskDescription: string,
    embedding?: number[]
  ): string | null {
    const similar = this.findSimilar(taskDescription, 10, embedding);
    if (similar.length === 0) return null;

    // Aggregate scores per model
    const modelScores: Record<string, { totalScore: number; count: number }> = {};
    for (const result of similar) {
      if (!modelScores[result.modelId]) {
        modelScores[result.modelId] = { totalScore: 0, count: 0 };
      }
      const combinedScore = result.similarity * 0.6 + (result.qualityScore / 100) * 0.4;
      modelScores[result.modelId].totalScore += combinedScore;
      modelScores[result.modelId].count++;
    }

    // Find the model with the highest average combined score
    let bestModel: string | null = null;
    let bestAvg = -1;
    for (const [modelId, scores] of Object.entries(modelScores)) {
      const avg = scores.totalScore / scores.count;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestModel = modelId;
      }
    }

    return bestModel;
  }

  /**
   * Get all stored records.
   */
  getRecords(): EmbeddingRecord[] {
    return [...this.records];
  }

  /**
   * Get record count.
   */
  getRecordCount(): number {
    return this.records.length;
  }

  /**
   * Clear all records.
   */
  clear(): void {
    this.records = [];
  }

  /**
   * Export records as JSON.
   */
  exportJSON(): string {
    return JSON.stringify(this.records, null, 2);
  }

  /**
   * Import records from JSON.
   */
  importJSON(json: string): void {
    try {
      const data = JSON.parse(json);
      if (Array.isArray(data)) {
        this.records = data;
      }
    } catch {
      throw new Error('Invalid embedding records JSON');
    }
  }

  /**
   * Generate a pseudo-embedding from text using a deterministic hash-based approach.
   * This creates a 128-dimensional vector that captures lexical similarity.
   * For production use, replace with real embeddings from an embedding API.
   */
  private generatePseudoEmbedding(text: string): number[] {
    const dimensions = 128;
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const words = normalized.split(/\s+/).filter(w => w.length > 0);

    const embedding = new Array(dimensions).fill(0);

    // Hash each word and distribute across dimensions
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      let hash = 0;
      for (let j = 0; j < word.length; j++) {
        hash = ((hash << 5) - hash + word.charCodeAt(j)) | 0;
      }

      // Position in embedding based on word index and hash
      for (let d = 0; d < dimensions; d++) {
        const seed = hash + d * 31 + i * 7;
        const value = Math.sin(seed) * 0.5;
        embedding[d] += value / (1 + i * 0.1); // Diminishing weight for later words
      }
    }

    // Add bigram features for better similarity
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = words[i] + ' ' + words[i + 1];
      let hash = 0;
      for (let j = 0; j < bigram.length; j++) {
        hash = ((hash << 5) - hash + bigram.charCodeAt(j)) | 0;
      }
      for (let d = 0; d < dimensions; d++) {
        const seed = hash + d * 17;
        embedding[d] += Math.sin(seed) * 0.3;
      }
    }

    // Normalize to unit vector
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      for (let d = 0; d < dimensions; d++) {
        embedding[d] /= magnitude;
      }
    }

    return embedding;
  }

  /**
   * Compute cosine similarity between two vectors.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}
