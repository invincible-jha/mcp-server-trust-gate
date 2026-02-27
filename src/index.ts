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

// Security scanner
export { runScan, formatScanReport } from './scanner.js';
export type { ScanResult, ScanSummary } from './scanner.js';
export { SCAN_RULES } from './scanner-rules.js';
export type {
  ScanRule,
  ScanFinding,
  McpServerConfig,
  AuthConfig,
  ToolConfig,
  ServerInfo,
  SeverityLevel,
} from './scanner-rules.js';

// Rate limiting
export { TokenBucketRateLimiter, RateLimitConfig } from './rate-limiter.js';
export type { RateLimitResult } from './rate-limiter.js';

// Circuit breaker
export { CircuitBreaker, CircuitBreakerConfig } from './circuit-breaker.js';
export type { CircuitBreakerStatus } from './circuit-breaker.js';

// Tool policy engine
export { evaluateToolPolicy, ToolPolicy, ToolPolicyConfig } from './tool-policy.js';
export type { ToolPolicyResult } from './tool-policy.js';
