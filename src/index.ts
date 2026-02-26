// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

/**
 * @packageDocumentation
 * MCP Trust Gate — static trust-level governance middleware for AI agent tool calls.
 *
 * @remarks
 * **Patent Gate: P0-01 ATP (Pending)**
 * The adaptive governance strategy implemented in the full AumOS product is
 * protected under patent application P0-01. This open-source package exposes
 * only the static subset: level comparison, hard-cap budgets, and audit logging.
 *
 * @example
 * ```typescript
 * import { TrustGate } from '@aumos/mcp-trust-gate';
 * import { TrustLevel } from '@aumos/types';
 *
 * const gate = new TrustGate({
 *   defaultTrustLevel: TrustLevel.L2_SUGGEST,
 *   toolTrustRequirements: { 'send-email': TrustLevel.L3_ACT_APPROVE },
 * });
 *
 * const decision = gate.evaluate('send-email');
 * // decision.permitted === false at L2
 * ```
 */

export { TrustGate } from './gate.js';
export { TrustChecker } from './trust-checker.js';
export { BudgetTracker } from './budget-tracker.js';
export type { SpendingResult, BudgetSummary } from './budget-tracker.js';
export { AuditLogger } from './audit-logger.js';
export { createConfig, TrustGateConfigSchema } from './config.js';
export type { ParsedTrustGateConfig } from './config.js';
export type {
  TrustGateConfig,
  BudgetConfig,
  GateDecision,
  AuditEntry,
} from './types.js';
