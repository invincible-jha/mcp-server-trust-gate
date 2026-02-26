// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

/**
 * with-budget.ts
 *
 * Demonstrates static hard-cap budget enforcement combined with trust gating.
 * The gate denies calls once the daily limit is exhausted.
 */

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
  auditEnabled: true,
});

// Call 1: $2.50 — permitted, $7.50 remaining
const call1 = gate.evaluate('api-call', 2.50);
console.log('Call 1:', call1.permitted, '| budgetRemaining:', call1.budgetRemaining);

// Call 2: $5.00 — permitted, $2.50 remaining
const call2 = gate.evaluate('api-call', 5.00);
console.log('Call 2:', call2.permitted, '| budgetRemaining:', call2.budgetRemaining);

// Call 3: $3.00 — denied, would exceed $10.00 daily limit
const call3 = gate.evaluate('api-call', 3.00);
console.log('Call 3:', call3.permitted, '| reason:', call3.reason);

// Budget summary reflects the two permitted calls ($7.50 spent)
const summary = gate.getBudgetSummary();
console.log('\nBudget summary:', summary);
// { spent: 7.5, remaining: 2.5, limit: 10, period: 'daily' }

console.log('\nAudit log entries:', gate.getAuditLog().length);
console.log('Audit chain intact:', gate.verifyAuditChain());
