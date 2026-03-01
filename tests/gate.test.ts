// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

import { describe, it, expect, vi } from 'vitest';
import { TrustGate } from '../src/gate.js';
import type { TrustGateMiddleware } from '../src/gate.js';
import type { GateDecision } from '../src/types.js';
import { TrustLevel } from '@aumos/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGate(
  defaultLevel: TrustLevel = TrustLevel.L2_SUGGEST,
  requirements: Record<string, TrustLevel> = {},
  onDeny?: (d: GateDecision) => void,
  middleware?: TrustGateMiddleware,
): TrustGate {
  return new TrustGate(
    {
      defaultTrustLevel: defaultLevel,
      toolTrustRequirements: requirements,
      auditEnabled: true,
    },
    onDeny,
    middleware,
  );
}

// ── Trust gate — basic evaluate ───────────────────────────────────────────────

describe('TrustGate.evaluate — trust checks', () => {
  it('permits a tool call when agent level meets the requirement', () => {
    const gate = makeGate(TrustLevel.L3_ACT_APPROVE, {
      'send-email': TrustLevel.L3_ACT_APPROVE,
    });
    const decision = gate.evaluate('send-email');
    expect(decision.permitted).toBe(true);
  });

  it('denies a tool call when agent level is below the requirement', () => {
    const gate = makeGate(TrustLevel.L1_MONITOR, {
      'delete-data': TrustLevel.L4_ACT_REPORT,
    });
    const decision = gate.evaluate('delete-data');
    expect(decision.permitted).toBe(false);
    expect(decision.reason).toBeTruthy();
  });

  it('permits any call for unlisted tools (defaults to L0_OBSERVER)', () => {
    const gate = makeGate(TrustLevel.L0_OBSERVER);
    const decision = gate.evaluate('unknown-tool');
    expect(decision.permitted).toBe(true);
  });

  it('reflects the updated level after setTrustLevel', () => {
    const gate = makeGate(TrustLevel.L0_OBSERVER, {
      'act-tool': TrustLevel.L4_ACT_REPORT,
    });
    gate.setTrustLevel(TrustLevel.L4_ACT_REPORT);
    const decision = gate.evaluate('act-tool');
    expect(decision.permitted).toBe(true);
  });
});

// ── Trust gate — audit log integration ───────────────────────────────────────

describe('TrustGate.evaluate — audit log', () => {
  it('logs every permitted decision when auditEnabled is true', () => {
    const gate = makeGate(TrustLevel.L2_SUGGEST);
    gate.evaluate('tool-a');
    gate.evaluate('tool-b');
    expect(gate.getAuditLog()).toHaveLength(2);
  });

  it('logs denied decisions when auditEnabled is true', () => {
    const gate = makeGate(TrustLevel.L0_OBSERVER, {
      'restricted-tool': TrustLevel.L5_AUTONOMOUS,
    });
    gate.evaluate('restricted-tool');
    expect(gate.getAuditLog()).toHaveLength(1);
    expect(gate.getAuditLog()[0]!.decision.permitted).toBe(false);
  });

  it('does not log any decisions when auditEnabled is false', () => {
    const gate = new TrustGate({ auditEnabled: false });
    gate.evaluate('some-tool');
    expect(gate.getAuditLog()).toHaveLength(0);
  });

  it('verifyAuditChain returns true for a fresh log', () => {
    const gate = makeGate(TrustLevel.L2_SUGGEST);
    expect(gate.verifyAuditChain()).toBe(true);
  });

  it('verifyAuditChain returns true after multiple evaluations', () => {
    const gate = makeGate(TrustLevel.L3_ACT_APPROVE, {
      'send-email': TrustLevel.L2_SUGGEST,
    });
    for (let index = 0; index < 5; index++) {
      gate.evaluate('send-email');
    }
    expect(gate.verifyAuditChain()).toBe(true);
  });
});

// ── Trust gate — budget integration ──────────────────────────────────────────

describe('TrustGate.evaluate — budget checks', () => {
  it('permits calls within budget and attaches budgetRemaining', () => {
    const gate = new TrustGate({
      defaultTrustLevel: TrustLevel.L2_SUGGEST,
      budgetConfig: { limitAmount: 100, currency: 'USD', period: 'daily' },
      auditEnabled: false,
    });
    const decision = gate.evaluate('tool', 30);
    expect(decision.permitted).toBe(true);
    expect(decision.budgetRemaining).toBe(70);
  });

  it('denies calls that exceed the configured budget', () => {
    const gate = new TrustGate({
      defaultTrustLevel: TrustLevel.L2_SUGGEST,
      budgetConfig: { limitAmount: 10, currency: 'USD', period: 'daily' },
      auditEnabled: false,
    });
    gate.evaluate('tool', 9);
    const decision = gate.evaluate('tool', 5);
    expect(decision.permitted).toBe(false);
    expect(decision.reason).toContain('Budget');
  });

  it('does not check budget when no estimatedCost is provided', () => {
    const gate = new TrustGate({
      defaultTrustLevel: TrustLevel.L2_SUGGEST,
      budgetConfig: { limitAmount: 0.01, currency: 'USD', period: 'daily' },
      auditEnabled: false,
    });
    // No cost means budget check is skipped entirely
    const decision = gate.evaluate('tool');
    expect(decision.permitted).toBe(true);
    expect(decision.budgetRemaining).toBeUndefined();
  });

  it('getBudgetSummary returns null when no budget is configured', () => {
    const gate = makeGate();
    expect(gate.getBudgetSummary()).toBeNull();
  });

  it('getBudgetSummary returns a snapshot when budget is configured', () => {
    const gate = new TrustGate({
      defaultTrustLevel: TrustLevel.L2_SUGGEST,
      budgetConfig: { limitAmount: 100, currency: 'USD', period: 'daily' },
      auditEnabled: false,
    });
    gate.evaluate('tool', 25);
    const summary = gate.getBudgetSummary();
    expect(summary).not.toBeNull();
    expect(summary!.spent).toBe(25);
    expect(summary!.remaining).toBe(75);
  });
});

// ── Trust gate — onDeny callback ──────────────────────────────────────────────

describe('TrustGate.evaluate — onDeny callback', () => {
  it('invokes onDeny when a tool call is denied due to insufficient level', () => {
    const onDeny = vi.fn();
    const gate = makeGate(TrustLevel.L0_OBSERVER, { 'guarded': TrustLevel.L5_AUTONOMOUS }, onDeny);
    gate.evaluate('guarded');
    expect(onDeny).toHaveBeenCalledOnce();
    expect(onDeny.mock.calls[0]![0].permitted).toBe(false);
  });

  it('does not invoke onDeny for permitted calls', () => {
    const onDeny = vi.fn();
    const gate = makeGate(TrustLevel.L5_AUTONOMOUS, {}, onDeny);
    gate.evaluate('any-tool');
    expect(onDeny).not.toHaveBeenCalled();
  });

  it('invokes onDeny when budget is exceeded', () => {
    const onDeny = vi.fn();
    const gate = new TrustGate(
      {
        defaultTrustLevel: TrustLevel.L2_SUGGEST,
        budgetConfig: { limitAmount: 5, currency: 'USD', period: 'daily' },
        auditEnabled: false,
      },
      onDeny,
    );
    gate.evaluate('tool', 4);
    gate.evaluate('tool', 4);
    expect(onDeny).toHaveBeenCalledOnce();
  });
});

// ── Trust gate — rate limiter middleware ──────────────────────────────────────

describe('TrustGate.evaluate — rate limiter middleware', () => {
  it('permits calls within the request rate limit', () => {
    const gate = makeGate(TrustLevel.L2_SUGGEST, {}, undefined, {
      rateLimiter: { maxTokensPerMinute: 10_000, maxRequestsPerMinute: 60 },
    });
    const decision = gate.evaluate('tool', 1);
    expect(decision.permitted).toBe(true);
  });

  it('denies calls when request rate limit is exceeded', () => {
    const gate = makeGate(TrustLevel.L2_SUGGEST, {}, undefined, {
      rateLimiter: { maxTokensPerMinute: 10_000, maxRequestsPerMinute: 1 },
    });
    gate.evaluate('tool', 1);
    const decision = gate.evaluate('tool', 1);
    expect(decision.permitted).toBe(false);
    expect(decision.reason).toContain('Rate limit');
  });

  it('getRateLimitStatus returns null when no rate limiter is configured', () => {
    const gate = makeGate();
    expect(gate.getRateLimitStatus()).toBeNull();
  });

  it('getRateLimitStatus returns status when rate limiter is configured', () => {
    const gate = makeGate(TrustLevel.L2_SUGGEST, {}, undefined, {
      rateLimiter: { maxTokensPerMinute: 10_000, maxRequestsPerMinute: 60 },
    });
    const status = gate.getRateLimitStatus();
    expect(status).not.toBeNull();
    expect(status!.remainingRequests).toBeGreaterThan(0);
  });
});

// ── Trust gate — circuit breaker middleware ───────────────────────────────────

describe('TrustGate.evaluate — circuit breaker middleware', () => {
  it('permits calls when circuit is CLOSED', () => {
    const gate = makeGate(TrustLevel.L2_SUGGEST, {}, undefined, {
      circuitBreaker: { failureThreshold: 5, resetTimeoutMs: 60_000, halfOpenMaxAttempts: 3 },
    });
    const decision = gate.evaluate('tool');
    expect(decision.permitted).toBe(true);
  });

  it('opens the circuit after enough failures and blocks subsequent calls', () => {
    const gate = makeGate(TrustLevel.L5_AUTONOMOUS, {}, undefined, {
      circuitBreaker: { failureThreshold: 2, resetTimeoutMs: 60_000, halfOpenMaxAttempts: 1 },
    });
    gate.recordFailure();
    gate.recordFailure();
    const decision = gate.evaluate('tool');
    expect(decision.permitted).toBe(false);
    expect(decision.reason).toContain('Circuit breaker');
  });

  it('getCircuitBreakerStatus returns null when no circuit breaker is configured', () => {
    const gate = makeGate();
    expect(gate.getCircuitBreakerStatus()).toBeNull();
  });

  it('getCircuitBreakerStatus returns CLOSED state on a fresh gate', () => {
    const gate = makeGate(TrustLevel.L2_SUGGEST, {}, undefined, {
      circuitBreaker: { failureThreshold: 5, resetTimeoutMs: 60_000, halfOpenMaxAttempts: 3 },
    });
    const status = gate.getCircuitBreakerStatus();
    expect(status).not.toBeNull();
    expect(status!.state).toBe('CLOSED');
  });

  it('recordSuccess is a no-op when no circuit breaker is configured', () => {
    const gate = makeGate();
    expect(() => gate.recordSuccess()).not.toThrow();
  });
});

// ── Trust gate — tool policy middleware ───────────────────────────────────────

describe('TrustGate.evaluate — tool policy middleware', () => {
  it('permits a tool explicitly in the allowlist for the agent level', () => {
    const gate = makeGate(TrustLevel.L2_SUGGEST, {}, undefined, {
      toolPolicy: {
        policies: [{ trustLevel: 2, allowedTools: ['read-data'], wildcardAllow: false }],
        defaultDeny: true,
      },
    });
    const decision = gate.evaluate('read-data');
    expect(decision.permitted).toBe(true);
  });

  it('denies a tool in the denylist even though trust level is sufficient', () => {
    const gate = makeGate(TrustLevel.L4_ACT_REPORT, {}, undefined, {
      toolPolicy: {
        policies: [{ trustLevel: 4, deniedTools: ['danger-tool'], wildcardAllow: true }],
        defaultDeny: false,
      },
    });
    const decision = gate.evaluate('danger-tool');
    expect(decision.permitted).toBe(false);
  });

  it('uses defaultDeny when no matching policy covers the tool', () => {
    const gate = makeGate(TrustLevel.L2_SUGGEST, {}, undefined, {
      toolPolicy: {
        policies: [{ trustLevel: 2, allowedTools: ['safe-tool'], wildcardAllow: false }],
        defaultDeny: true,
      },
    });
    const decision = gate.evaluate('unconfigured-tool');
    expect(decision.permitted).toBe(false);
  });
});

// ── Trust gate — accessor methods ─────────────────────────────────────────────

describe('TrustGate accessors', () => {
  it('getTrustLevel returns the initial level from config', () => {
    const gate = makeGate(TrustLevel.L3_ACT_APPROVE);
    expect(gate.getTrustLevel()).toBe(TrustLevel.L3_ACT_APPROVE);
  });

  it('getTrustLevel reflects updates from setTrustLevel', () => {
    const gate = makeGate(TrustLevel.L1_MONITOR);
    gate.setTrustLevel(TrustLevel.L5_AUTONOMOUS);
    expect(gate.getTrustLevel()).toBe(TrustLevel.L5_AUTONOMOUS);
  });

  it('setToolRequirement affects subsequent evaluate calls', () => {
    const gate = makeGate(TrustLevel.L2_SUGGEST);
    gate.setToolRequirement('new-guarded-tool', TrustLevel.L5_AUTONOMOUS);
    const decision = gate.evaluate('new-guarded-tool');
    expect(decision.permitted).toBe(false);
  });
});
