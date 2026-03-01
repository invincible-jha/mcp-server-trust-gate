// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

import { describe, it, expect } from 'vitest';
import { evaluateToolPolicy } from '../src/tool-policy.js';
import type { ToolPolicyConfig } from '../src/tool-policy.js';

describe('evaluateToolPolicy', () => {
  describe('allowlist behaviour', () => {
    it('permits a tool explicitly listed in allowedTools', () => {
      const config: ToolPolicyConfig = {
        policies: [{ trustLevel: 2, allowedTools: ['read-data'], wildcardAllow: false }],
        defaultDeny: true,
      };
      const result = evaluateToolPolicy('read-data', 2, config);
      expect(result.allowed).toBe(true);
    });

    it('permits a tool via wildcard allow', () => {
      const config: ToolPolicyConfig = {
        policies: [{ trustLevel: 1, wildcardAllow: true }],
        defaultDeny: true,
      };
      const result = evaluateToolPolicy('any-tool', 1, config);
      expect(result.allowed).toBe(true);
    });

    it('uses the most specific (highest-level) policy first', () => {
      const config: ToolPolicyConfig = {
        policies: [
          { trustLevel: 2, allowedTools: ['tool-a'], wildcardAllow: false },
          { trustLevel: 4, allowedTools: ['tool-b'], wildcardAllow: false },
        ],
        defaultDeny: true,
      };
      // Agent at level 4 — policy for level 4 should be checked first
      const result = evaluateToolPolicy('tool-b', 4, config);
      expect(result.allowed).toBe(true);
    });

    it('falls through to lower-level policies when higher one has no match', () => {
      const config: ToolPolicyConfig = {
        policies: [
          { trustLevel: 1, allowedTools: ['shared-tool'], wildcardAllow: false },
          { trustLevel: 3, allowedTools: ['elevated-tool'], wildcardAllow: false },
        ],
        defaultDeny: true,
      };
      // Agent at level 3 — neither level-3 nor level-1 allows 'shared-tool'
      // But level-1 policy allows 'shared-tool' and is applicable (1 <= 3)
      const result = evaluateToolPolicy('shared-tool', 3, config);
      expect(result.allowed).toBe(true);
    });
  });

  describe('denylist behaviour', () => {
    it('denies a tool explicitly listed in deniedTools', () => {
      const config: ToolPolicyConfig = {
        policies: [{ trustLevel: 4, deniedTools: ['danger-tool'], wildcardAllow: true }],
        defaultDeny: false,
      };
      const result = evaluateToolPolicy('danger-tool', 4, config);
      expect(result.allowed).toBe(false);
    });

    it('denylist takes precedence over allowlist in the same policy', () => {
      const config: ToolPolicyConfig = {
        policies: [
          {
            trustLevel: 3,
            allowedTools: ['contested-tool'],
            deniedTools: ['contested-tool'],
            wildcardAllow: false,
          },
        ],
        defaultDeny: false,
      };
      const result = evaluateToolPolicy('contested-tool', 3, config);
      expect(result.allowed).toBe(false);
    });
  });

  describe('defaultDeny behaviour', () => {
    it('denies an unmatched tool when defaultDeny is true', () => {
      const config: ToolPolicyConfig = {
        policies: [{ trustLevel: 2, allowedTools: ['allowed-tool'], wildcardAllow: false }],
        defaultDeny: true,
      };
      const result = evaluateToolPolicy('unknown-tool', 2, config);
      expect(result.allowed).toBe(false);
    });

    it('permits an unmatched tool when defaultDeny is false', () => {
      const config: ToolPolicyConfig = {
        policies: [{ trustLevel: 2, allowedTools: ['specific-tool'], wildcardAllow: false }],
        defaultDeny: false,
      };
      const result = evaluateToolPolicy('unspecified-tool', 2, config);
      expect(result.allowed).toBe(true);
    });

    it('denies when no applicable policy exists and defaultDeny is true', () => {
      const config: ToolPolicyConfig = {
        policies: [{ trustLevel: 5, allowedTools: ['admin-tool'], wildcardAllow: false }],
        defaultDeny: true,
      };
      // Agent at level 1 — no policy applies (only level 5 policy exists)
      const result = evaluateToolPolicy('admin-tool', 1, config);
      expect(result.allowed).toBe(false);
    });

    it('permits when no applicable policy exists and defaultDeny is false', () => {
      const config: ToolPolicyConfig = {
        policies: [{ trustLevel: 5, allowedTools: ['admin-tool'], wildcardAllow: false }],
        defaultDeny: false,
      };
      // Agent at level 1 — no policy applies
      const result = evaluateToolPolicy('admin-tool', 1, config);
      expect(result.allowed).toBe(true);
    });
  });

  describe('result shape', () => {
    it('always returns a non-empty reason string', () => {
      const config: ToolPolicyConfig = {
        policies: [{ trustLevel: 2, allowedTools: ['tool'], wildcardAllow: false }],
        defaultDeny: true,
      };
      const permitted = evaluateToolPolicy('tool', 2, config);
      const denied = evaluateToolPolicy('other', 2, config);
      expect(typeof permitted.reason).toBe('string');
      expect(permitted.reason.length).toBeGreaterThan(0);
      expect(typeof denied.reason).toBe('string');
      expect(denied.reason.length).toBeGreaterThan(0);
    });
  });
});
