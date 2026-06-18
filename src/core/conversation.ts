/**
 * Nexus-Dev MMFE — Multi-Turn Conversation Manager
 * Maintains conversation context across multiple orchestration requests.
 */

import type { OrchestrationResult } from './types.js';
import { SubTaskResult } from './types.js';

export interface ConversationTurn {
  requestId: string;
  query: string;
  answer: string;
  modelsUsed: string[];
  qualityScore: number;
  timestamp: number;
  subtaskSummary: string[];
}

export interface ConversationContext {
  id: string;
  turns: ConversationTurn[];
  createdAt: number;
  updatedAt: number;
  totalTokensEstimate: number;
}

export class ConversationManager {
  private readonly conversations: Map<string, ConversationContext> = new Map();
  private readonly maxTurnsPerConversation: number;
  private readonly maxContextTokens: number;

  constructor(maxTurns = 20, maxContextTokens = 50000) {
    this.maxTurnsPerConversation = maxTurns;
    this.maxContextTokens = maxContextTokens;
  }

  /**
   * Create a new conversation.
   */
  createConversation(): string {
    const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.conversations.set(id, {
      id,
      turns: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      totalTokensEstimate: 0,
    });
    return id;
  }

  /**
   * Add a turn to an existing conversation.
   */
  addTurn(conversationId: string, result: OrchestrationResult, query: string): void {
    const conv = this.conversations.get(conversationId);
    if (!conv) return;

    const turn: ConversationTurn = {
      requestId: result.requestId,
      query,
      answer: result.answer,
      modelsUsed: result.modelsUsed,
      qualityScore: result.qualityScore,
      timestamp: Date.now(),
      subtaskSummary: result.subTaskResults.filter(r => r.success).map(r => `[${r.modelId}] ${r.output.slice(0, 100)}...`),
    };

    conv.turns.push(turn);

    // Enforce max turns
    if (conv.turns.length > this.maxTurnsPerConversation) {
      conv.turns = conv.turns.slice(-this.maxTurnsPerConversation);
    }

    // Estimate tokens (rough: 1 token ≈ 4 chars)
    const turnTokens = Math.ceil((query.length + result.answer.length) / 4);
    conv.totalTokensEstimate += turnTokens;
    conv.updatedAt = Date.now();
  }

  /**
   * Build a context string from the conversation history.
   * This can be passed as the `context` parameter to orchestrator.process().
   */
  buildContext(conversationId: string): string {
    const conv = this.conversations.get(conversationId);
    if (!conv || conv.turns.length === 0) return '';

    let context = 'CONVERSATION HISTORY:\n\n';

    for (const turn of conv.turns) {
      context += `User: ${turn.query}\n`;
      context += `Assistant: ${turn.answer.slice(0, 500)}${turn.answer.length > 500 ? '...' : ''}\n\n`;
    }

    context += 'Continue the conversation, maintaining consistency with the above context.';

    return context;
  }

  /**
   * Get the conversation context object.
   */
  getConversation(conversationId: string): ConversationContext | undefined {
    return this.conversations.get(conversationId);
  }

  /**
   * Get all conversation IDs.
   */
  getConversationIds(): string[] {
    return Array.from(this.conversations.keys());
  }

  /**
   * Check if a conversation exists.
   */
  hasConversation(conversationId: string): boolean {
    return this.conversations.has(conversationId);
  }

  /**
   * Delete a conversation.
   */
  deleteConversation(conversationId: string): boolean {
    return this.conversations.delete(conversationId);
  }

  /**
   * Get the number of turns in a conversation.
   */
  getTurnCount(conversationId: string): number {
    return this.conversations.get(conversationId)?.turns.length ?? 0;
  }
}
