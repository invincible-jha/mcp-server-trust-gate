// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

import { z } from 'zod';

export const CircuitBreakerConfig = z.object({
  failureThreshold: z.number().int().positive().default(5),
  resetTimeoutMs: z.number().positive().default(60_000),
  halfOpenMaxAttempts: z.number().int().positive().default(3),
});
export type CircuitBreakerConfig = z.infer<typeof CircuitBreakerConfig>;

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerStatus {
  readonly state: CircuitState;
  readonly failureCount: number;
  readonly lastFailureTime: number | null;
  readonly nextAttemptTime: number | null;
}

/**
 * Circuit breaker pattern for MCP server connections.
 *
 * @remarks
 * Transitions through three states:
 * - **CLOSED** — Normal operation. Failures are counted.
 * - **OPEN** — Failures exceeded threshold. All requests are blocked until
 *   `resetTimeoutMs` elapses.
 * - **HALF_OPEN** — Probe state. A limited number of attempts are allowed.
 *   A success resets to CLOSED; a failure returns to OPEN.
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 5,
 *   resetTimeoutMs: 30_000,
 *   halfOpenMaxAttempts: 2,
 * });
 *
 * if (!breaker.canExecute()) {
 *   throw new Error('Circuit open — downstream service unavailable');
 * }
 * try {
 *   await callDownstream();
 *   breaker.recordSuccess();
 * } catch {
 *   breaker.recordFailure();
 * }
 * ```
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount: number = 0;
  private lastFailureTime: number | null = null;
  private halfOpenAttempts: number = 0;
  private readonly config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  /**
   * Check whether a request may proceed given the current circuit state.
   *
   * @returns `true` if the request should be allowed; `false` if the circuit
   *   is open and the reset timeout has not yet elapsed.
   */
  canExecute(): boolean {
    switch (this.state) {
      case 'CLOSED':
        return true;
      case 'OPEN': {
        const now = Date.now();
        if (this.lastFailureTime && now - this.lastFailureTime >= this.config.resetTimeoutMs) {
          this.state = 'HALF_OPEN';
          this.halfOpenAttempts = 0;
          return true;
        }
        return false;
      }
      case 'HALF_OPEN':
        return this.halfOpenAttempts < this.config.halfOpenMaxAttempts;
    }
  }

  /**
   * Record a successful request.
   *
   * @remarks
   * When the circuit is in HALF_OPEN state, a success transitions it back to
   * CLOSED and resets the failure count.
   */
  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failureCount = 0;
      this.halfOpenAttempts = 0;
    }
  }

  /**
   * Record a failed request.
   *
   * @remarks
   * Increments the failure counter. When the counter reaches
   * {@link CircuitBreakerConfig.failureThreshold}, the circuit opens.
   */
  recordFailure(): void {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      return;
    }

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  /**
   * Return a snapshot of the circuit breaker's current status.
   */
  getStatus(): CircuitBreakerStatus {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime:
        this.state === 'OPEN' && this.lastFailureTime
          ? this.lastFailureTime + this.config.resetTimeoutMs
          : null,
    };
  }

  /**
   * Force the circuit back to CLOSED state and reset all counters.
   *
   * @remarks
   * Intended for operator use (e.g., after a known upstream fix is deployed).
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.halfOpenAttempts = 0;
  }
}
