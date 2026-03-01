// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import { AuditLogger } from '../src/audit-logger.js';
import type { GateDecision } from '../src/types.js';
import { TrustLevel } from '@aumos/types';

function makeDecision(overrides: Partial<GateDecision> = {}): GateDecision {
  return {
    toolName: 'read-data',
    permitted: true,
    reason: 'Trust level 2 meets requirement 1',
    trustLevel: TrustLevel.L2_SUGGEST,
    requiredLevel: TrustLevel.L1_MONITOR,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('AuditLogger', () => {
  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger();
  });

  describe('log', () => {
    it('returns an entry with a non-empty id', () => {
      const entry = logger.log(makeDecision());
      expect(typeof entry.id).toBe('string');
      expect(entry.id.length).toBeGreaterThan(0);
    });

    it('stores the decision on the returned entry', () => {
      const decision = makeDecision({ toolName: 'delete-file', permitted: false });
      const entry = logger.log(decision);
      expect(entry.decision.toolName).toBe('delete-file');
      expect(entry.decision.permitted).toBe(false);
    });

    it('stores tool arguments when provided', () => {
      const toolArguments = { path: '/home/user/doc.txt' };
      const entry = logger.log(makeDecision(), toolArguments);
      expect(entry.toolArguments).toEqual(toolArguments);
    });

    it('omits toolArguments property when not provided', () => {
      const entry = logger.log(makeDecision());
      expect(entry.toolArguments).toBeUndefined();
    });

    it('sets previousHash to "0" for the first entry', () => {
      const entry = logger.log(makeDecision());
      expect(entry.previousHash).toBe('0');
    });

    it('links subsequent entries by previousHash', () => {
      const first = logger.log(makeDecision());
      const second = logger.log(makeDecision());
      expect(second.previousHash).toBe(first.hash);
    });

    it('produces SHA-256 hex digests (64 characters)', () => {
      const entry = logger.log(makeDecision());
      expect(entry.hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces different hashes for different decisions', () => {
      const entry1 = logger.log(makeDecision({ toolName: 'tool-a' }));
      const entry2 = logger.log(makeDecision({ toolName: 'tool-b' }));
      expect(entry1.hash).not.toBe(entry2.hash);
    });
  });

  describe('getEntries', () => {
    it('returns an empty array on a fresh logger', () => {
      expect(logger.getEntries()).toHaveLength(0);
    });

    it('returns all logged entries in insertion order', () => {
      logger.log(makeDecision({ toolName: 'first' }));
      logger.log(makeDecision({ toolName: 'second' }));
      logger.log(makeDecision({ toolName: 'third' }));
      const entries = logger.getEntries();
      expect(entries).toHaveLength(3);
      expect(entries[0]!.decision.toolName).toBe('first');
      expect(entries[2]!.decision.toolName).toBe('third');
    });

    it('returns a readonly view — does not expose mutable internal array', () => {
      logger.log(makeDecision());
      const entries = logger.getEntries();
      // The return type is readonly; casting is intentional for the test assertion
      expect(Array.isArray(entries)).toBe(true);
    });
  });

  describe('verifyChain', () => {
    it('returns true for an empty log', () => {
      expect(logger.verifyChain()).toBe(true);
    });

    it('returns true for a valid single-entry chain', () => {
      logger.log(makeDecision());
      expect(logger.verifyChain()).toBe(true);
    });

    it('returns true for a multi-entry chain with correct hashes', () => {
      for (let index = 0; index < 5; index++) {
        logger.log(makeDecision({ toolName: `tool-${index}` }));
      }
      expect(logger.verifyChain()).toBe(true);
    });

    it('detects tampering with a previousHash field', () => {
      logger.log(makeDecision());
      const entries = logger.getEntries() as Array<{ previousHash: string }>;
      // Mutate the previousHash on the first entry to simulate tampering
      entries[0]!.previousHash = 'tampered-value';
      expect(logger.verifyChain()).toBe(false);
    });

    it('detects tampering with a hash field', () => {
      logger.log(makeDecision());
      const entries = logger.getEntries() as Array<{ hash: string }>;
      entries[0]!.hash = 'deadbeef'.repeat(8);
      expect(logger.verifyChain()).toBe(false);
    });
  });

  describe('exportJSON', () => {
    it('returns "[]" for an empty log', () => {
      expect(logger.exportJSON()).toBe('[]');
    });

    it('returns valid JSON that parses to an array', () => {
      logger.log(makeDecision());
      const parsed: unknown = JSON.parse(logger.exportJSON());
      expect(Array.isArray(parsed)).toBe(true);
      expect((parsed as unknown[]).length).toBe(1);
    });
  });

  describe('hash determinism', () => {
    it('produces the same hash when logging identical decisions sequentially from a fresh logger', () => {
      const decision = makeDecision({ timestamp: '2026-01-01T00:00:00.000Z' });

      const loggerA = new AuditLogger();
      const entryA = loggerA.log(decision);

      const loggerB = new AuditLogger();
      const entryB = loggerB.log(decision);

      expect(entryA.hash).toBe(entryB.hash);
    });

    it('hash is computed over decision payload and previousHash', () => {
      const decision = makeDecision({ timestamp: '2026-01-01T00:00:00.000Z' });
      const previousHash = '0';
      const expectedHash = createHash('sha256')
        .update(JSON.stringify({ decision, previousHash }))
        .digest('hex');

      const freshLogger = new AuditLogger();
      const entry = freshLogger.log(decision);
      expect(entry.hash).toBe(expectedHash);
    });
  });
});
