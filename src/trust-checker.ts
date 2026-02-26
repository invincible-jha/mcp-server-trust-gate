// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

import { TrustLevel } from '@aumos/types';
import type { TrustGateConfig, GateDecision } from './types.js';

/**
 * TrustChecker performs STATIC trust level comparison.
 *
 * @remarks
 * **FIRE LINE — P0-01 ATP:**
 * This class contains ONLY a static `>=` comparison between the current trust
 * level and the required level for a named tool. The following are explicitly
 * OUT OF SCOPE and must not be added until the corresponding patent (P0-01) is
 * filed and cleared for open-source release:
 *
 * - Adaptive trust progression (auto-promotion based on observed behavior)
 * - Behavioral scoring or trust score computation
 * - Decay rates, tuning parameters, or performance targets
 * - Any integration with PWM, MAE, or STP subsystems
 *
 * Trust level changes are MANUAL ONLY via {@link setLevel}.
 *
 * @example
 * ```typescript
 * const checker = new TrustChecker(config);
 * const decision = checker.check('send-email');
 * if (!decision.permitted) throw new Error(decision.reason);
 * ```
 */
export class TrustChecker {
  private currentLevel: TrustLevel;
  private readonly requirements: Record<string, TrustLevel>;

  /**
   * @param config - Validated gate configuration. The constructor reads
   *   `defaultTrustLevel` and `toolTrustRequirements`; it does not mutate
   *   the config object.
   */
  constructor(config: TrustGateConfig) {
    this.currentLevel = config.defaultTrustLevel;
    this.requirements = { ...config.toolTrustRequirements };
  }

  /**
   * Manually assign the agent's current trust level.
   *
   * @remarks
   * This is the ONLY mechanism for changing the trust level. Automatic
   * promotion based on behavior is explicitly prohibited (see FIRE LINE above).
   *
   * @param level - The new trust level to assign.
   */
  setLevel(level: TrustLevel): void {
    this.currentLevel = level;
  }

  /**
   * Return the agent's current trust level.
   */
  getLevel(): TrustLevel {
    return this.currentLevel;
  }

  /**
   * Evaluate whether the current trust level satisfies the requirement for
   * a named tool.
   *
   * @remarks
   * Tools not present in `toolTrustRequirements` default to
   * {@link TrustLevel.L0_OBSERVER}, meaning any agent may call them.
   *
   * @param toolName - The name of the MCP tool being evaluated.
   * @returns An immutable {@link GateDecision} describing the outcome.
   */
  check(toolName: string): GateDecision {
    const requiredLevel: TrustLevel =
      this.requirements[toolName] ?? TrustLevel.L0_OBSERVER;

    const permitted = this.currentLevel >= requiredLevel;

    return {
      toolName,
      permitted,
      reason: permitted
        ? `Trust level ${this.currentLevel} meets requirement ${requiredLevel}`
        : `Trust level ${this.currentLevel} below required ${requiredLevel}`,
      trustLevel: this.currentLevel,
      requiredLevel,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Register or update the minimum trust level required for a specific tool.
   *
   * @param toolName - The MCP tool name to configure.
   * @param level - The minimum {@link TrustLevel} required to invoke the tool.
   */
  setRequirement(toolName: string, level: TrustLevel): void {
    this.requirements[toolName] = level;
  }
}
