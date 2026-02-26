// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

/**
 * basic-usage.ts
 *
 * Demonstrates static trust level gating across a set of tools with
 * different minimum-level requirements.
 */

import { TrustGate } from '@aumos/mcp-trust-gate';
import { TrustLevel } from '@aumos/types';

const gate = new TrustGate({
  defaultTrustLevel: TrustLevel.L2_SUGGEST,
  toolTrustRequirements: {
    'read-email': TrustLevel.L1_MONITOR,
    'send-email': TrustLevel.L3_ACT_APPROVE,
    'delete-account': TrustLevel.L5_AUTONOMOUS,
  },
  auditEnabled: true,
});

// Passes: current level L2 >= required L1
const readResult = gate.evaluate('read-email');
console.log('read-email:', readResult);
// { toolName: 'read-email', permitted: true, ... }

// Denied: current level L2 < required L3
const sendResult = gate.evaluate('send-email');
console.log('send-email:', sendResult);
// { toolName: 'send-email', permitted: false, reason: '...', ... }

// Manually promote the agent to L4
gate.setTrustLevel(TrustLevel.L4_ACT_REPORT);

// Now passes: L4 >= L3
const sendResultAfterPromotion = gate.evaluate('send-email');
console.log('send-email after promotion:', sendResultAfterPromotion);
// { toolName: 'send-email', permitted: true, ... }

// Still denied: L4 < L5
const deleteResult = gate.evaluate('delete-account');
console.log('delete-account:', deleteResult);
// { toolName: 'delete-account', permitted: false, ... }

console.log('\nAudit log entries:', gate.getAuditLog().length);
console.log('Audit chain intact:', gate.verifyAuditChain());
