# MCP Trust Gate

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![npm](https://img.shields.io/npm/v/@aumos/mcp-trust-gate)](https://www.npmjs.com/package/@aumos/mcp-trust-gate)
[![Patent Gate: P0-01 ATP](https://img.shields.io/badge/Patent%20Gate-P0--01%20ATP-orange)](./FIRE_LINE.md)

MCP middleware for trust-based governance of AI agent tool calls.

`@aumos/mcp-trust-gate` intercepts MCP tool calls before execution, compares
the agent's current trust level against per-tool requirements, enforces
hard-cap spending budgets, and records every governance decision in a
tamper-evident hash-chain audit log.

---

> **Patent Gate Notice**
> The adaptive governance strategy in the full AumOS product is protected under
> patent application P0-01 (filing in progress). This package implements only
> the static subset: level comparison, hard-cap budgets, and structured
> audit logging. See [FIRE_LINE.md](./FIRE_LINE.md) for the exact boundary.

---

## Installation

```bash
npm install @aumos/mcp-trust-gate @aumos/types
```

Node.js >= 20.0.0 is required.

---

## Quick Start

```typescript
import { TrustGate } from '@aumos/mcp-trust-gate';
import { TrustLevel } from '@aumos/types';

const gate = new TrustGate({
  defaultTrustLevel: TrustLevel.L2_SUGGEST,
  toolTrustRequirements: {
    'read-email':    TrustLevel.L1_MONITOR,
    'send-email':    TrustLevel.L3_ACT_APPROVE,
    'delete-account': TrustLevel.L5_AUTONOMOUS,
  },
  auditEnabled: true,
});

// Evaluate before executing any tool
const decision = gate.evaluate('send-email');

if (!decision.permitted) {
  console.error(decision.reason);
  // "Trust level L2_SUGGEST below required L3_ACT_APPROVE"
} else {
  // Safe to call the tool
}

// Manually promote the agent when appropriate
gate.setTrustLevel(TrustLevel.L4_ACT_REPORT);

// Now send-email is permitted (L4 >= L3)
const decision2 = gate.evaluate('send-email');
console.log(decision2.permitted); // true
```

---

## With Budget Enforcement

```typescript
import { TrustGate } from '@aumos/mcp-trust-gate';
import { TrustLevel } from '@aumos/types';

const gate = new TrustGate({
  defaultTrustLevel: TrustLevel.L4_ACT_REPORT,
  toolTrustRequirements: {
    'api-call': TrustLevel.L2_SUGGEST,
  },
  budgetConfig: {
    limitAmount: 10.00,
    currency: 'USD',
    period: 'daily',
  },
});

gate.evaluate('api-call', 2.50);  // permitted — $7.50 remaining
gate.evaluate('api-call', 5.00);  // permitted — $2.50 remaining
gate.evaluate('api-call', 3.00);  // denied    — would exceed $10.00

console.log(gate.getBudgetSummary());
// { spent: 7.5, remaining: 2.5, limit: 10, period: 'daily' }
```

---

## API Reference

### `TrustGate`

The main entry point. Composes `TrustChecker`, `BudgetTracker`, and
`AuditLogger`.

#### Constructor

```typescript
new TrustGate(
  config: Partial<Omit<TrustGateConfig, 'onDeny'>>,
  onDeny?: (decision: GateDecision) => void,
)
```

#### Methods

| Method | Description |
|---|---|
| `evaluate(toolName, estimatedCost?)` | Evaluate a tool call. Returns a `GateDecision`. |
| `setTrustLevel(level)` | Manually assign the agent's trust level. |
| `getTrustLevel()` | Return the current trust level. |
| `setToolRequirement(toolName, level)` | Set the minimum level for a specific tool. |
| `getAuditLog()` | Return all recorded audit entries. |
| `verifyAuditChain()` | Verify hash chain integrity. Returns `boolean`. |
| `getBudgetSummary()` | Return budget utilization snapshot, or `null`. |

### `TrustGateConfig`

| Field | Type | Default | Description |
|---|---|---|---|
| `defaultTrustLevel` | `TrustLevel` | `L0_OBSERVER` | Starting level for new agents. |
| `toolTrustRequirements` | `Record<string, TrustLevel>` | `{}` | Per-tool minimum levels. |
| `budgetConfig` | `BudgetConfig` | — | Optional hard-cap budget. |
| `auditEnabled` | `boolean` | `true` | Enable audit logging. |
| `onDeny` | `(d: GateDecision) => void` | — | Callback on every denial. |

### `BudgetConfig`

| Field | Type | Default | Description |
|---|---|---|---|
| `limitAmount` | `number` | — | Maximum spend per period. |
| `currency` | `string` | `'USD'` | ISO 4217 currency code. |
| `period` | `'hourly' \| 'daily' \| 'weekly' \| 'monthly'` | `'daily'` | Reset window. |

### `GateDecision`

| Field | Type | Description |
|---|---|---|
| `toolName` | `string` | Tool being evaluated. |
| `permitted` | `boolean` | Whether the call is allowed. |
| `reason` | `string` | Human-readable explanation. |
| `trustLevel` | `TrustLevel` | Agent's level at decision time. |
| `requiredLevel` | `TrustLevel` | Tool's minimum required level. |
| `timestamp` | `string` | ISO 8601 UTC timestamp. |
| `budgetRemaining` | `number \| undefined` | Remaining budget (if configured). |

### `TrustChecker`

Lower-level class for direct trust comparison without the full gate wrapper.
Useful when you need to integrate into an existing MCP handler loop.

### `BudgetTracker`

Lower-level class for direct hard-cap budget enforcement.

### `AuditLogger`

Lower-level class for direct hash-chain audit recording.

---

## Exports

```typescript
// Classes
export { TrustGate, TrustChecker, BudgetTracker, AuditLogger };

// Config
export { createConfig, TrustGateConfigSchema };

// Types
export type {
  TrustGateConfig, BudgetConfig, GateDecision, AuditEntry,
  SpendingResult, BudgetSummary, ParsedTrustGateConfig,
};
```

---

## Patent Gate

This package is subject to a patent gate (P0-01 ATP — Awaiting Patent Filing).

The open-source boundary is documented in [FIRE_LINE.md](./FIRE_LINE.md).
The short version: static trust comparison, static hard caps, and structured
logging are permitted. Adaptive trust progression, behavioral scoring, ML-based
budgets, anomaly detection, and integration with PWM/MAE/STP are reserved.

---

## License

Apache 2.0 — see [LICENSE](./LICENSE).

Copyright (c) 2026 MuVeraAI Corporation.
