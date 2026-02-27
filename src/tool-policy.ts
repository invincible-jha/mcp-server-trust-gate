// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

import { z } from 'zod';

/**
 * Policy rule for a single trust level.
 *
 * @remarks
 * Policies are evaluated from highest matching trust level downward.
 * The first matching rule wins. Denylist entries take precedence over
 * allowlist entries within the same policy.
 */
export const ToolPolicy = z.object({
  /**
   * The numeric trust level this policy applies to (0 = observer, 5 = autonomous).
   * An agent at level N inherits all policies where `trustLevel <= N`.
   */
  trustLevel: z.number().int().min(0).max(5),

  /**
   * Explicit list of tool names permitted at this trust level.
   * When absent, falls through to `wildcardAllow`.
   */
  allowedTools: z.array(z.string()).optional(),

  /**
   * Explicit list of tool names blocked at this trust level.
   * Denylist is checked before allowlist.
   */
  deniedTools: z.array(z.string()).optional(),

  /**
   * When `true`, any tool not explicitly denied is allowed at this trust level.
   * Defaults to `false`.
   */
  wildcardAllow: z.boolean().default(false),
});
export type ToolPolicy = z.infer<typeof ToolPolicy>;

/**
 * Top-level tool policy configuration containing all per-level policies.
 */
export const ToolPolicyConfig = z.object({
  policies: z.array(ToolPolicy),

  /**
   * When `true`, any tool not explicitly permitted by a policy is denied.
   * Defaults to `true` (safe default).
   */
  defaultDeny: z.boolean().default(true),
});
export type ToolPolicyConfig = z.infer<typeof ToolPolicyConfig>;

export interface ToolPolicyResult {
  readonly allowed: boolean;
  readonly reason: string;
}

/**
 * Evaluate whether an agent at the given trust level may invoke a tool.
 *
 * @remarks
 * Evaluation order:
 * 1. Collect all policies where `policy.trustLevel <= agentTrustLevel`.
 * 2. Sort by `trustLevel` descending (most specific first).
 * 3. For each applicable policy:
 *    a. If the tool is in `deniedTools` — deny immediately.
 *    b. If the tool is in `allowedTools` — allow immediately.
 *    c. If `wildcardAllow` is `true` — allow immediately.
 * 4. If no policy matched — apply `defaultDeny`.
 *
 * @param toolName - The MCP tool name to evaluate.
 * @param agentTrustLevel - The agent's current numeric trust level (0-5).
 * @param config - The tool policy configuration to evaluate against.
 * @returns A {@link ToolPolicyResult} with the decision and a human-readable reason.
 */
export function evaluateToolPolicy(
  toolName: string,
  agentTrustLevel: number,
  config: ToolPolicyConfig
): ToolPolicyResult {
  // Find all policies applicable to this trust level, most specific first
  const applicablePolicies = config.policies
    .filter((p) => p.trustLevel <= agentTrustLevel)
    .sort((a, b) => b.trustLevel - a.trustLevel);

  if (applicablePolicies.length === 0) {
    return config.defaultDeny
      ? { allowed: false, reason: `No policy found for trust level ${agentTrustLevel}` }
      : { allowed: true, reason: 'Default allow (no policy configured)' };
  }

  for (const policy of applicablePolicies) {
    // Denylist takes precedence over allowlist
    if (policy.deniedTools?.includes(toolName)) {
      return {
        allowed: false,
        reason: `Tool '${toolName}' explicitly denied at trust level ${policy.trustLevel}`,
      };
    }
    // Check allowlist
    if (policy.allowedTools?.includes(toolName)) {
      return {
        allowed: true,
        reason: `Tool '${toolName}' allowed at trust level ${policy.trustLevel}`,
      };
    }
    // Check wildcard
    if (policy.wildcardAllow) {
      return {
        allowed: true,
        reason: `Wildcard allow at trust level ${policy.trustLevel}`,
      };
    }
  }

  return config.defaultDeny
    ? { allowed: false, reason: `Tool '${toolName}' not in any allowlist` }
    : { allowed: true, reason: 'Default allow' };
}
