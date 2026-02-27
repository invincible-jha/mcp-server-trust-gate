// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

import { z } from 'zod';

export const RateLimitConfig = z.object({
  maxTokensPerMinute: z.number().positive(),
  maxRequestsPerMinute: z.number().positive(),
  maxCostPerHour: z.number().positive().optional(),
});
export type RateLimitConfig = z.infer<typeof RateLimitConfig>;

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly retryAfterMs?: number;
  readonly remainingTokens: number;
  readonly remainingRequests: number;
}

/**
 * Token bucket rate limiter for MCP tool invocations.
 *
 * @remarks
 * Limits both the total estimated token consumption and the raw request count
 * within a rolling one-minute window. Buckets refill completely once per minute.
 *
 * @example
 * ```typescript
 * const limiter = new TokenBucketRateLimiter({
 *   maxTokensPerMinute: 10000,
 *   maxRequestsPerMinute: 60,
 * });
 *
 * const result = limiter.check(500);
 * if (!result.allowed) {
 *   throw new Error(result.reason);
 * }
 * ```
 */
export class TokenBucketRateLimiter {
  private tokens: number;
  private requests: number;
  private lastRefill: number;
  private readonly config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.tokens = config.maxTokensPerMinute;
    this.requests = config.maxRequestsPerMinute;
    this.lastRefill = Date.now();
  }

  /**
   * Check whether a request with the given estimated token cost can proceed.
   *
   * @param estimatedTokens - Estimated tokens consumed by this request. Defaults to 1.
   * @returns A {@link RateLimitResult} indicating whether the request is allowed.
   */
  check(estimatedTokens: number = 1): RateLimitResult {
    this.refill();

    if (this.requests <= 0) {
      const retryAfterMs = 60_000 - (Date.now() - this.lastRefill);
      return {
        allowed: false,
        reason: 'Request rate limit exceeded',
        retryAfterMs: Math.max(0, retryAfterMs),
        remainingTokens: this.tokens,
        remainingRequests: 0,
      };
    }

    if (this.tokens < estimatedTokens) {
      const retryAfterMs = 60_000 - (Date.now() - this.lastRefill);
      return {
        allowed: false,
        reason: 'Token rate limit exceeded',
        retryAfterMs: Math.max(0, retryAfterMs),
        remainingTokens: this.tokens,
        remainingRequests: this.requests,
      };
    }

    this.tokens -= estimatedTokens;
    this.requests -= 1;

    return {
      allowed: true,
      remainingTokens: this.tokens,
      remainingRequests: this.requests,
    };
  }

  /**
   * Return a snapshot of current bucket state without consuming any capacity.
   */
  peek(): RateLimitResult {
    this.refill();
    return {
      allowed: this.requests > 0 && this.tokens > 0,
      remainingTokens: this.tokens,
      remainingRequests: this.requests,
    };
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed >= 60_000) {
      this.tokens = this.config.maxTokensPerMinute;
      this.requests = this.config.maxRequestsPerMinute;
      this.lastRefill = now;
    }
  }
}
