// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

/**
 * Output filtering stage for the trust gate pipeline.
 *
 * This module adds a post-action governance gate that inspects tool output
 * before it is returned to the agent. It can redact sensitive content,
 * enforce output size limits, and block responses that contain forbidden
 * patterns.
 *
 * Output filtering is the complement to input trust-gating: the input gate
 * decides whether an agent CAN call a tool, the output filter decides what
 * the agent SEES from the result.
 */

/**
 * A single output filter rule.
 */
export interface OutputFilterRule {
  /** Unique identifier for this rule. */
  readonly id: string;
  /** Human-readable description. */
  readonly description: string;
  /** Pattern to match in the output. Evaluated as a RegExp. */
  readonly pattern: string;
  /** Whether the pattern is case-insensitive. Defaults to false. */
  readonly caseInsensitive?: boolean;
  /** Action to take when the pattern matches. */
  readonly action: OutputFilterAction;
  /** Replacement text when action is "redact". */
  readonly replacement?: string;
}

/**
 * Actions the output filter can take when a pattern matches.
 */
export type OutputFilterAction = 'block' | 'redact' | 'warn';

/**
 * Result of running the output filter.
 */
export interface OutputFilterResult {
  /** Whether the output passed all filters. */
  readonly passed: boolean;
  /** The (possibly modified) output text. */
  readonly output: string;
  /** Rules that were triggered. */
  readonly triggeredRules: ReadonlyArray<{
    ruleId: string;
    action: OutputFilterAction;
    matchCount: number;
  }>;
  /** Reason if the output was blocked. */
  readonly blockReason?: string;
}

/**
 * Configuration for the output filter.
 */
export interface OutputFilterConfig {
  /** Filter rules to apply. */
  readonly rules: readonly OutputFilterRule[];
  /** Maximum output length in characters. Truncates if exceeded. */
  readonly maxOutputLength?: number;
  /** Whether to enable the filter. Defaults to true. */
  readonly enabled?: boolean;
}

/**
 * OutputFilter applies post-action governance rules to tool outputs.
 *
 * @example
 * ```typescript
 * const filter = new OutputFilter({
 *   rules: [
 *     {
 *       id: 'pii-ssn',
 *       description: 'Redact Social Security Numbers',
 *       pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b',
 *       action: 'redact',
 *       replacement: '[SSN REDACTED]',
 *     },
 *     {
 *       id: 'api-key',
 *       description: 'Block output containing API keys',
 *       pattern: 'sk-[a-zA-Z0-9]{32,}',
 *       action: 'block',
 *     },
 *   ],
 *   maxOutputLength: 50000,
 * });
 *
 * const result = filter.apply(toolOutput);
 * if (!result.passed) {
 *   // Output was blocked
 * }
 * ```
 */
export class OutputFilter {
  readonly #rules: readonly OutputFilterRule[];
  readonly #maxOutputLength: number | undefined;
  readonly #enabled: boolean;

  constructor(config: OutputFilterConfig) {
    this.#rules = config.rules;
    this.#maxOutputLength = config.maxOutputLength;
    this.#enabled = config.enabled ?? true;
  }

  /**
   * Apply all filter rules to the given output text.
   *
   * Rules are evaluated in order. Block rules halt immediately.
   * Redact rules modify the output in-place. Warn rules are recorded
   * but do not modify the output.
   *
   * @param output - The raw tool output to filter.
   * @returns The filter result with possibly modified output.
   */
  apply(output: string): OutputFilterResult {
    if (!this.#enabled) {
      return { passed: true, output, triggeredRules: [] };
    }

    let filteredOutput = output;
    const triggeredRules: Array<{
      ruleId: string;
      action: OutputFilterAction;
      matchCount: number;
    }> = [];

    // Apply length limit first
    if (this.#maxOutputLength !== undefined && filteredOutput.length > this.#maxOutputLength) {
      filteredOutput = filteredOutput.slice(0, this.#maxOutputLength);
    }

    for (const rule of this.#rules) {
      const flags = rule.caseInsensitive ? 'gi' : 'g';
      const regex = new RegExp(rule.pattern, flags);
      const matches = filteredOutput.match(regex);

      if (matches === null || matches.length === 0) {
        continue;
      }

      const matchCount = matches.length;

      switch (rule.action) {
        case 'block':
          return {
            passed: false,
            output: '',
            triggeredRules: [
              ...triggeredRules,
              { ruleId: rule.id, action: 'block', matchCount },
            ],
            blockReason: `Output blocked by rule "${rule.id}": ${rule.description}`,
          };

        case 'redact':
          filteredOutput = filteredOutput.replace(
            regex,
            rule.replacement ?? '[REDACTED]',
          );
          triggeredRules.push({ ruleId: rule.id, action: 'redact', matchCount });
          break;

        case 'warn':
          triggeredRules.push({ ruleId: rule.id, action: 'warn', matchCount });
          break;
      }
    }

    return {
      passed: true,
      output: filteredOutput,
      triggeredRules,
    };
  }
}
