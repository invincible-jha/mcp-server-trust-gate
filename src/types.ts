// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

import type { TrustLevel } from '@aumos/types';

/**
 * Top-level configuration object for a TrustGate instance.
 *
 * @remarks
 * All fields are readonly to prevent mutation after construction.
 * Use {@link createConfig} to produce a validated instance via Zod.
 */
export interface TrustGateConfig {
  /** The trust level assigned to the agent when no explicit level has been set. */
  readonly defaultTrustLevel: TrustLevel;

  /**
   * A map of tool name to the minimum {@link TrustLevel} required to invoke it.
   * Tools not listed here default to {@link TrustLevel.L0_OBSERVER}.
   */
  readonly toolTrustRequirements: Record<string, TrustLevel>;

  /** Optional hard-cap spending limits. When absent, budget enforcement is disabled. */
  readonly budgetConfig?: BudgetConfig;

  /**
   * When `true`, every {@link GateDecision} is recorded by the {@link AuditLogger}.
   * Defaults to `true`.
   */
  readonly auditEnabled: boolean;

  /**
   * Optional callback invoked whenever a tool call is denied.
   * Useful for surfacing denials to monitoring infrastructure without
   * coupling the gate to a specific transport.
   */
  readonly onDeny?: (decision: GateDecision) => void;
}

/**
 * Hard-cap budget constraints for a single time period.
 *
 * @remarks
 * FIRE LINE: Static limits only. No adaptive caps, no ML-based allocation.
 */
export interface BudgetConfig {
  /** Maximum spending permitted within a single {@link period}. Must be positive. */
  readonly limitAmount: number;

  /** ISO 4217 currency code. Defaults to `'USD'`. */
  readonly currency: string;

  /** Rolling window over which the limit is enforced. */
  readonly period: 'hourly' | 'daily' | 'weekly' | 'monthly';
}

/**
 * The outcome produced by {@link TrustGate.evaluate} for a single tool invocation.
 *
 * @remarks
 * Immutable value object. Every field is populated regardless of outcome so
 * callers can log decisions without conditional field access.
 */
export interface GateDecision {
  /** Name of the tool being evaluated. */
  readonly toolName: string;

  /** `true` if the tool call is allowed to proceed. */
  readonly permitted: boolean;

  /** Human-readable explanation of the decision. */
  readonly reason: string;

  /** The agent's trust level at the time of evaluation. */
  readonly trustLevel: TrustLevel;

  /** The minimum trust level required by this tool. */
  readonly requiredLevel: TrustLevel;

  /** ISO 8601 UTC timestamp of when the decision was made. */
  readonly timestamp: string;

  /**
   * Remaining budget in {@link BudgetConfig.currency} after this decision.
   * Only present when a {@link BudgetConfig} is active.
   */
  readonly budgetRemaining?: number;
}

/**
 * A single entry in the append-only audit log maintained by {@link AuditLogger}.
 *
 * @remarks
 * Entries are linked by {@link previousHash} to form a simple hash chain that
 * allows tamper-evidence verification via {@link AuditLogger.verifyChain}.
 *
 * FIRE LINE: Recording only. No anomaly detection, no counterfactual generation.
 */
export interface AuditEntry {
  /** Opaque identifier unique within a single process lifetime. */
  readonly id: string;

  /** The gate decision that triggered this audit entry. */
  readonly decision: GateDecision;

  /**
   * The arguments that were passed to the tool at call time, if provided.
   * Callers may omit sensitive arguments before logging.
   */
  readonly toolArguments?: Record<string, unknown>;

  /**
   * The {@link hash} of the previous entry in the chain,
   * or `'0'` for the first entry.
   */
  readonly previousHash: string;

  /** Hash computed over {@link decision} and {@link previousHash}. */
  readonly hash: string;
}
