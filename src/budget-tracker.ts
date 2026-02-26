// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

import type { BudgetConfig } from './types.js';

/** Millisecond durations for each supported budget period. */
const PERIOD_MS: Record<BudgetConfig['period'], number> = {
  hourly: 3_600_000,
  daily: 86_400_000,
  weekly: 604_800_000,
  monthly: 2_592_000_000,
} as const;

/**
 * Result returned by {@link BudgetTracker.recordSpending}.
 */
export interface SpendingResult {
  /** Whether the spend was within the current period limit. */
  readonly permitted: boolean;
  /** Remaining budget in the current period after this transaction. */
  readonly remaining: number;
  /** Human-readable denial reason. Only present when `permitted` is `false`. */
  readonly reason?: string;
}

/**
 * Summary of the current budget period's utilization.
 */
export interface BudgetSummary {
  readonly spent: number;
  readonly remaining: number;
  readonly limit: number;
  readonly period: BudgetConfig['period'];
}

/**
 * BudgetTracker enforces STATIC per-period spending limits.
 *
 * @remarks
 * **FIRE LINE — P0-01 ATP:**
 * This class implements hard caps ONLY. The following are explicitly OUT OF
 * SCOPE and must not be added until the P0-01 patent is filed and cleared:
 *
 * - Adaptive or dynamic budget caps
 * - ML-based spend prediction or optimization
 * - Spending pattern analysis or anomaly detection
 * - Cross-agent or cross-session budget pooling
 *
 * The period resets automatically (lazily) when the next call to
 * {@link recordSpending} or {@link getSummary} occurs after the period has elapsed.
 *
 * @example
 * ```typescript
 * const tracker = new BudgetTracker({ limitAmount: 10, currency: 'USD', period: 'daily' });
 * const result = tracker.recordSpending(2.50);
 * // result.permitted === true, result.remaining === 7.50
 * ```
 */
export class BudgetTracker {
  private spent: number = 0;
  private readonly config: BudgetConfig;
  private periodStart: Date;

  /**
   * @param config - Validated {@link BudgetConfig} specifying the limit,
   *   currency, and period. Use {@link createConfig} to validate before passing.
   */
  constructor(config: BudgetConfig) {
    this.config = config;
    this.periodStart = new Date();
  }

  /**
   * Record a spending amount and determine whether it is within budget.
   *
   * @remarks
   * If the current period has expired, it resets before the check so that
   * fresh-period calls always start from zero.
   *
   * The amount is NOT recorded when the call is denied — the tracker's
   * internal state only advances on permitted transactions.
   *
   * @param amount - Non-negative cost of the tool call in
   *   {@link BudgetConfig.currency} units.
   * @returns A {@link SpendingResult} with the outcome and updated remaining balance.
   */
  recordSpending(amount: number): SpendingResult {
    if (this.isPeriodExpired()) {
      this.reset();
    }

    if (this.spent + amount > this.config.limitAmount) {
      return {
        permitted: false,
        remaining: this.config.limitAmount - this.spent,
        reason: `Budget exceeded: ${this.spent + amount} > ${this.config.limitAmount} ${this.config.currency}`,
      };
    }

    this.spent += amount;

    return {
      permitted: true,
      remaining: this.config.limitAmount - this.spent,
    };
  }

  /**
   * Return a snapshot of current period utilization.
   *
   * @remarks
   * Triggers a period reset if the current period has elapsed.
   */
  getSummary(): BudgetSummary {
    if (this.isPeriodExpired()) {
      this.reset();
    }

    return {
      spent: this.spent,
      remaining: this.config.limitAmount - this.spent,
      limit: this.config.limitAmount,
      period: this.config.period,
    };
  }

  private isPeriodExpired(): boolean {
    const elapsed = Date.now() - this.periodStart.getTime();
    return elapsed >= PERIOD_MS[this.config.period];
  }

  private reset(): void {
    this.spent = 0;
    this.periodStart = new Date();
  }
}
