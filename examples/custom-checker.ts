// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

/**
 * custom-checker.ts
 *
 * Demonstrates using TrustChecker and AuditLogger directly without TrustGate
 * for scenarios where you need fine-grained control over the evaluation loop,
 * for example when integrating with an existing MCP server handler.
 */

import { TrustChecker, AuditLogger } from '@aumos/mcp-trust-gate';
import { TrustLevel } from '@aumos/types';

// Build a standalone checker with a custom requirements map
const checker = new TrustChecker({
  defaultTrustLevel: TrustLevel.L1_MONITOR,
  toolTrustRequirements: {
    'read-file': TrustLevel.L1_MONITOR,
    'write-file': TrustLevel.L3_ACT_APPROVE,
    'exec-command': TrustLevel.L4_ACT_REPORT,
  },
  auditEnabled: true,
});

const logger = new AuditLogger();

/**
 * Simulated MCP tool handler that gates execution behind a trust check.
 */
function handleToolCall(toolName: string, args: Record<string, unknown>): void {
  const decision = checker.check(toolName);

  // Record the decision with the tool arguments
  logger.log(decision, args);

  if (!decision.permitted) {
    console.error(`[DENIED] ${toolName}: ${decision.reason}`);
    return;
  }

  console.log(`[PERMITTED] ${toolName} — executing...`);
  // Tool execution would happen here
}

// L1 can read files
handleToolCall('read-file', { path: '/tmp/data.json' });

// L1 cannot write files
handleToolCall('write-file', { path: '/tmp/output.json', content: '{}' });

// Promote to L3 — simulating an operator action
checker.setLevel(TrustLevel.L3_ACT_APPROVE);
console.log('\nTrust level promoted to:', checker.getLevel());

// Now write-file passes
handleToolCall('write-file', { path: '/tmp/output.json', content: '{}' });

// exec-command still denied at L3
handleToolCall('exec-command', { cmd: 'ls -la' });

// Dynamically add a new tool requirement
checker.setRequirement('list-dir', TrustLevel.L2_SUGGEST);
handleToolCall('list-dir', { path: '/tmp' });

console.log('\nAudit log:');
console.log(logger.exportJSON());
console.log('Chain valid:', logger.verifyChain());
