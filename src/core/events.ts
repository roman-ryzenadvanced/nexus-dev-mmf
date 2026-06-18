/**
 * Nexus-Dev MMFE — Pipeline Event Emitter
 * Provides real-time event streaming for pipeline progress monitoring.
 */

import { EventEmitter } from 'events';

import { PipelineStage, RoutingDecision, SubTaskResult } from './types.js';

export type NexusEventType =
  | 'pipeline:started'
  | 'pipeline:stage'
  | 'pipeline:completed'
  | 'pipeline:failed'
  | 'subtask:routed'
  | 'subtask:started'
  | 'subtask:completed'
  | 'subtask:failed'
  | 'subtask:retrying'
  | 'synthesis:started'
  | 'synthesis:completed'
  | 'synthesis:refining'
  | 'quality:scored';

export interface NexusEvent {
  type: NexusEventType;
  requestId: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export class NexusEventEmitter extends EventEmitter {
  private eventLog: NexusEvent[] = [];
  private readonly maxLogSize: number;

  constructor(maxLogSize = 1000) {
    super();
    this.maxLogSize = maxLogSize;
  }

  /**
   * Emit a Nexus-Dev pipeline event.
   */
  emitNexusEvent(type: NexusEventType, requestId: string, data: Record<string, unknown> = {}): void {
    const event: NexusEvent = {
      type,
      requestId,
      timestamp: Date.now(),
      data,
    };

    this.eventLog.push(event);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift();
    }

    this.emit(type, event);
    this.emit('*', event); // Wildcard listener
  }

  /**
   * Get the full event log.
   */
  getEventLog(): NexusEvent[] {
    return [...this.eventLog];
  }

  /**
   * Get events for a specific request.
   */
  getEventsForRequest(requestId: string): NexusEvent[] {
    return this.eventLog.filter(e => e.requestId === requestId);
  }

  /**
   * Get events of a specific type.
   */
  getEventsByType(type: NexusEventType): NexusEvent[] {
    return this.eventLog.filter(e => e.type === type);
  }

  /**
   * Clear the event log.
   */
  clearLog(): void {
    this.eventLog = [];
  }

  /**
   * Subscribe to all events.
   */
  onAny(listener: (event: NexusEvent) => void): () => void {
    this.on('*', listener);
    return () => this.off('*', listener);
  }

  /**
   * Subscribe to a specific event type.
   */
  onType(type: NexusEventType, listener: (event: NexusEvent) => void): () => void {
    this.on(type, listener);
    return () => this.off(type, listener);
  }
}
