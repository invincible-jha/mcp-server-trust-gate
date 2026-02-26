// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

import { TrustLevel } from '@aumos/types';
import { TrustChecker } from './trust-checker.js';
import { BudgetTracker } from './budget-tracker.js';
import type { BudgetSummary } from './budget-tracker.js';
import { AuditLogger } from './audit-logger.js';
import type { TrustGateConfig, GateDecision, AuditEntry } from './types.js';
import { createConfig } from './config.js';

/**
 * TrustGate is an MCP middleware that intercepts tool calls, validates the
 * agent's trust level, enforces hard-cap budget limits, and records every
 * governance decision in a hash-chain audit log.
 *
 * @remarks
 * **FIRE LINE — P0-01 ATP (Patent Pending):**
 * The core implementation strategy for adaptive governance is protected under
 * patent application P0-01. Until that application is filed and cleared for
 * open-source disclosure, this class exposes ONLY the following:
 *
 * - **STATIC trust comparison** — `currentLevel >= requiredLevel`. Trust
 *   changes are manual only via {@link setTrustLevel}.
 * - **STATIC hard budget caps** — a fixed per-period spending limit.
 *   No adaptive caps, no ML-based allocation.
 * - **Structured audit recording** — append-only hash chain. No anomaly
 *   detection, no counterfactual generation, no alerting.
 *
 * **Integration with PWM, MAE, STP, or the GOVERNANCE_PIPELINE is
 * explicitly prohibited in this package.**
 *
 * @example
 * ```typescript
 * const gate = new TrustGate({
 *   defaultTrustLevel: TrustLevel.L2_SUGGEST,
 *   toolTrustRequirements: {
 *     'read-email': TrustLevel.L1_MONITOR,
 *     'send-email': TrustLevel.L3_ACT_APPROVE,
 *   },
 * });
 *
 * const decision = gate.evaluate('send-email');
 * if (!decision.permitted) {
 *   throw new Error(decision.reason);
 * }
 * ```
 */
export class TrustGate {
  private readonly checker: TrustChecker;
  private readonly budget: BudgetTracker | null;
  private readonly auditLogger: AuditLogger;
  private readonly config: TrustGateConfig;

  /**
   * Construct a new TrustGate.
   *
   * @param config - Partial configuration object. Missing fields receive Zod
   *   defaults (see {@link TrustGateConfigSchema}). Pass `onDeny` as a separate
   *   argument because Zod cannot validate function shapes at runtime.
   * @param onDeny - Optional callback invoked for every denied decision. This
   *   is equivalent to setting `config.onDeny` but is accepted here to avoid
   *   placing a non-serializable value inside the validated schema input.
   */
  constructor(
    config: Partial<Omit<TrustGateConfig, 'onDeny'>>,
    onDeny?: TrustGateConfig['onDeny'],
  ) {
    this.config = createConfig(config, onDeny);
    this.checker = new TrustChecker(this.config);
    this.budget = this.config.budgetConfig
      ? new BudgetTracker(this.config.budgetConfig)
      : null;
    this.auditLogger = new AuditLogger();
  }

  /**
   * Evaluate whether a tool call should be permitted.
   *
   * @remarks
   * Evaluation proceeds in three steps:
   * 1. **Trust check** — compare `currentLevel >= requiredLevel` for the tool.
   * 2. **Budget check** — if a {@link BudgetConfig} is active and
   *    `estimatedCost` is provided, attempt to record the spend.
   * 3. **Audit log** — record the final decision when `auditEnabled` is `true`.
   *
   * If any step fails, a denied {@link GateDecision} is returned immediately
   * without advancing to subsequent steps.
   *
   * @param toolName - The MCP tool name being invoked.
   * @param estimatedCost - Optional estimated cost of the call in
   *   {@link BudgetConfig.currency} units. Ignored when no budget is configured.
   * @returns A {@link GateDecision} describing the outcome. Callers MUST check
   *   `decision.permitted` before executing the tool.
   */
  evaluate(toolName: string, estimatedCost?: number): GateDecision {
    // Step 1: Static trust level comparison
    const trustDecision = this.checker.check(toolName);

    if (!trustDecision.permitted) {
      if (this.config.auditEnabled) {
        this.auditLogger.log(trustDecision);
      }
      this.config.onDeny?.(trustDecision);
      return trustDecision;
    }

    // Step 2: Static hard-cap budget enforcement
    if (this.budget !== null && estimatedCost !== undefined) {
      const budgetResult = this.budget.recordSpending(estimatedCost);

      if (!budgetResult.permitted) {
        const deniedDecision: GateDecision = {
          ...trustDecision,
          permitted: false,
          reason: budgetResult.reason ?? 'Budget limit reached',
          budgetRemaining: budgetResult.remaining,
        };

        if (this.config.auditEnabled) {
          this.auditLogger.log(deniedDecision);
        }
        this.config.onDeny?.(deniedDecision);
        return deniedDecision;
      }

      // Permitted: annotate remaining budget on the decision
      const permittedDecision: GateDecision = {
        ...trustDecision,
        budgetRemaining: budgetResult.remaining,
      };

      if (this.config.auditEnabled) {
        this.auditLogger.log(permittedDecision);
      }
      return permittedDecision;
    }

    // Step 3: No budget configured or no cost supplied — log and permit
    if (this.config.auditEnabled) {
      this.auditLogger.log(trustDecision);
    }
    return trustDecision;
  }

  /**
   * Manually assign the agent's trust level.
   *
   * @remarks
   * This is the ONLY mechanism for changing the trust level. Automatic
   * promotion based on behavior is explicitly prohibited (FIRE LINE — P0-01).
   *
   * @param level - The new {@link TrustLevel} to assign.
   */
  setTrustLevel(level: TrustLevel): void {
    this.checker.setLevel(level);
  }

  /**
   * Return the agent's current trust level.
   */
  getTrustLevel(): TrustLevel {
    return this.checker.getLevel();
  }

  /**
   * Register or update the minimum trust level required for a specific tool.
   *
   * @param toolName - The MCP tool name to configure.
   * @param level - The minimum {@link TrustLevel} required to invoke the tool.
   */
  setToolRequirement(toolName: string, level: TrustLevel): void {
    this.checker.setRequirement(toolName, level);
  }

  /**
   * Return all recorded audit log entries as a readonly array.
   */
  getAuditLog(): readonly AuditEntry[] {
    return this.auditLogger.getEntries();
  }

  /**
   * Verify the integrity of the audit log hash chain.
   *
   * @returns `true` if all entries are consistent; `false` if the chain
   *   has been tampered with.
   */
  verifyAuditChain(): boolean {
    return this.auditLogger.verifyChain();
  }

  /**
   * Return a snapshot of the current budget period utilization.
   *
   * @returns A {@link BudgetSummary} when a budget is configured, or `null`
   *   when the gate was constructed without a {@link BudgetConfig}.
   */
  getBudgetSummary(): BudgetSummary | null {
    return this.budget?.getSummary() ?? null;
  }
}
