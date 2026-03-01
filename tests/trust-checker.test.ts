// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

import { describe, it, expect } from 'vitest';
import { TrustChecker } from '../src/trust-checker.js';
import { TrustLevel } from '@aumos/types';
import { createConfig } from '../src/config.js';

function makeChecker(
  defaultLevel: TrustLevel,
  requirements: Record<string, TrustLevel> = {},
): TrustChecker {
  const config = createConfig({ defaultTrustLevel: defaultLevel, toolTrustRequirements: requirements });
  return new TrustChecker(config);
}

describe('TrustChecker', () => {
  describe('getLevel', () => {
    it('returns the default trust level after construction', () => {
      const checker = makeChecker(TrustLevel.L2_SUGGEST);
      expect(checker.getLevel()).toBe(TrustLevel.L2_SUGGEST);
    });

    it('returns the updated level after setLevel is called', () => {
      const checker = makeChecker(TrustLevel.L0_OBSERVER);
      checker.setLevel(TrustLevel.L4_ACT_REPORT);
      expect(checker.getLevel()).toBe(TrustLevel.L4_ACT_REPORT);
    });
  });

  describe('setLevel', () => {
    it('allows manually assigning any valid trust level', () => {
      const checker = makeChecker(TrustLevel.L0_OBSERVER);
      checker.setLevel(TrustLevel.L5_AUTONOMOUS);
      expect(checker.getLevel()).toBe(TrustLevel.L5_AUTONOMOUS);
    });

    it('allows downgrading trust level', () => {
      const checker = makeChecker(TrustLevel.L5_AUTONOMOUS);
      checker.setLevel(TrustLevel.L1_MONITOR);
      expect(checker.getLevel()).toBe(TrustLevel.L1_MONITOR);
    });
  });

  describe('check — tool with explicit requirement', () => {
    it('permits the call when agent level meets the requirement exactly', () => {
      const checker = makeChecker(TrustLevel.L3_ACT_APPROVE, {
        'send-email': TrustLevel.L3_ACT_APPROVE,
      });
      const decision = checker.check('send-email');
      expect(decision.permitted).toBe(true);
      expect(decision.toolName).toBe('send-email');
    });

    it('permits the call when agent level exceeds the requirement', () => {
      const checker = makeChecker(TrustLevel.L5_AUTONOMOUS, {
        'send-email': TrustLevel.L2_SUGGEST,
      });
      const decision = checker.check('send-email');
      expect(decision.permitted).toBe(true);
    });

    it('denies the call when agent level is below requirement', () => {
      const checker = makeChecker(TrustLevel.L1_MONITOR, {
        'delete-data': TrustLevel.L4_ACT_REPORT,
      });
      const decision = checker.check('delete-data');
      expect(decision.permitted).toBe(false);
      expect(decision.trustLevel).toBe(TrustLevel.L1_MONITOR);
      expect(decision.requiredLevel).toBe(TrustLevel.L4_ACT_REPORT);
    });

    it('includes a human-readable reason in denied decisions', () => {
      const checker = makeChecker(TrustLevel.L0_OBSERVER, {
        'act-tool': TrustLevel.L3_ACT_APPROVE,
      });
      const decision = checker.check('act-tool');
      expect(decision.permitted).toBe(false);
      expect(typeof decision.reason).toBe('string');
      expect(decision.reason.length).toBeGreaterThan(0);
    });
  });

  describe('check — tool without explicit requirement', () => {
    it('defaults to L0_OBSERVER requirement for unlisted tools', () => {
      const checker = makeChecker(TrustLevel.L0_OBSERVER);
      const decision = checker.check('unknown-tool');
      expect(decision.permitted).toBe(true);
      expect(decision.requiredLevel).toBe(TrustLevel.L0_OBSERVER);
    });
  });

  describe('setRequirement', () => {
    it('adds a new tool requirement that is respected by subsequent checks', () => {
      const checker = makeChecker(TrustLevel.L1_MONITOR);
      checker.setRequirement('new-tool', TrustLevel.L3_ACT_APPROVE);
      const decision = checker.check('new-tool');
      expect(decision.permitted).toBe(false);
      expect(decision.requiredLevel).toBe(TrustLevel.L3_ACT_APPROVE);
    });

    it('updates an existing tool requirement', () => {
      const checker = makeChecker(TrustLevel.L2_SUGGEST, {
        'read-email': TrustLevel.L4_ACT_REPORT,
      });
      checker.setRequirement('read-email', TrustLevel.L1_MONITOR);
      const decision = checker.check('read-email');
      expect(decision.permitted).toBe(true);
    });
  });

  describe('decision shape', () => {
    it('always includes toolName, permitted, reason, trustLevel, requiredLevel, and timestamp', () => {
      const checker = makeChecker(TrustLevel.L2_SUGGEST, {
        'some-tool': TrustLevel.L2_SUGGEST,
      });
      const decision = checker.check('some-tool');
      expect(decision).toHaveProperty('toolName', 'some-tool');
      expect(decision).toHaveProperty('permitted');
      expect(decision).toHaveProperty('reason');
      expect(decision).toHaveProperty('trustLevel');
      expect(decision).toHaveProperty('requiredLevel');
      expect(decision).toHaveProperty('timestamp');
    });

    it('timestamp is a valid ISO 8601 string', () => {
      const checker = makeChecker(TrustLevel.L2_SUGGEST);
      const decision = checker.check('any-tool');
      expect(() => new Date(decision.timestamp)).not.toThrow();
      expect(new Date(decision.timestamp).toISOString()).toBe(decision.timestamp);
    });
  });
});
