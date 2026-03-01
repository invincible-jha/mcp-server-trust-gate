// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

import { describe, it, expect } from 'vitest';
import { TokenBucketRateLimiter } from '../src/rate-limiter.js';

describe('TokenBucketRateLimiter', () => {
  describe('check — within limits', () => {
    it('permits a request when buckets have capacity', () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokensPerMinute: 10_000,
        maxRequestsPerMinute: 60,
      });
      const result = limiter.check(100);
      expect(result.allowed).toBe(true);
    });

    it('decrements remaining tokens after a permitted request', () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokensPerMinute: 1_000,
        maxRequestsPerMinute: 100,
      });
      const result = limiter.check(200);
      expect(result.remainingTokens).toBe(800);
    });

    it('decrements remaining requests after a permitted request', () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokensPerMinute: 10_000,
        maxRequestsPerMinute: 5,
      });
      limiter.check(1);
      const result = limiter.check(1);
      expect(result.remainingRequests).toBe(3);
    });

    it('defaults to 1 token when estimatedTokens is omitted', () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokensPerMinute: 100,
        maxRequestsPerMinute: 60,
      });
      const result = limiter.check();
      expect(result.remainingTokens).toBe(99);
    });
  });

  describe('check — request rate limit exceeded', () => {
    it('denies the request when request count is exhausted', () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokensPerMinute: 100_000,
        maxRequestsPerMinute: 1,
      });
      limiter.check(1);
      const result = limiter.check(1);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Request rate limit');
    });

    it('includes retryAfterMs when requests are exhausted', () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokensPerMinute: 100_000,
        maxRequestsPerMinute: 1,
      });
      limiter.check(1);
      const result = limiter.check(1);
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('check — token rate limit exceeded', () => {
    it('denies the request when token cost exceeds available tokens', () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokensPerMinute: 10,
        maxRequestsPerMinute: 100,
      });
      const result = limiter.check(50);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Token rate limit');
    });

    it('includes retryAfterMs when tokens are insufficient', () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokensPerMinute: 5,
        maxRequestsPerMinute: 100,
      });
      const result = limiter.check(100);
      expect(result.retryAfterMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('peek', () => {
    it('returns current bucket state without consuming capacity', () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokensPerMinute: 1_000,
        maxRequestsPerMinute: 30,
      });
      const before = limiter.peek();
      const after = limiter.peek();
      expect(before.remainingTokens).toBe(after.remainingTokens);
      expect(before.remainingRequests).toBe(after.remainingRequests);
    });

    it('allowed is true on a fresh limiter', () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokensPerMinute: 100,
        maxRequestsPerMinute: 10,
      });
      expect(limiter.peek().allowed).toBe(true);
    });

    it('reflects consumed capacity from previous check calls', () => {
      const limiter = new TokenBucketRateLimiter({
        maxTokensPerMinute: 500,
        maxRequestsPerMinute: 10,
      });
      limiter.check(200);
      const status = limiter.peek();
      expect(status.remainingTokens).toBe(300);
    });
  });
});
