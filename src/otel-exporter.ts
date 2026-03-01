// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

import type { GateDecision } from './types.js';

/**
 * Minimal OpenTelemetry Span interface for trust-gate instrumentation.
 *
 * Avoids a hard dependency on @opentelemetry/api. Any OTel-compatible
 * tracer that produces spans with these methods can be used.
 */
export interface OTelSpanLike {
  setAttribute(key: string, value: string | number | boolean): this;
  setStatus(status: { code: number; message?: string }): this;
  addEvent(name: string, attributes?: Record<string, string | number | boolean>): this;
  end(): void;
}

/**
 * Minimal OpenTelemetry Tracer interface.
 */
export interface OTelTracerLike {
  startSpan(name: string, options?: { attributes?: Record<string, string | number | boolean> }): OTelSpanLike;
}

/**
 * Configuration for trust-gate OTel instrumentation.
 */
export interface TrustGateOTelConfig {
  /** The OTel tracer instance. */
  tracer: OTelTracerLike;
  /** Service name attribute. Defaults to "aumos-trust-gate". */
  serviceName?: string;
}

const SPAN_STATUS_OK = 1;
const SPAN_STATUS_ERROR = 2;

/**
 * TrustGateTracer instruments trust gate evaluations with OpenTelemetry spans.
 *
 * Each evaluate() call creates a span with:
 *   - aumos.tool_name: the MCP tool being evaluated
 *   - aumos.trust_level: the agent's current trust level
 *   - aumos.required_level: the minimum level for the tool
 *   - aumos.permitted: whether the call was allowed
 *   - aumos.reason: the decision reason
 *   - aumos.budget_remaining: remaining budget (if applicable)
 *
 * Usage:
 * ```typescript
 * import { trace } from '@opentelemetry/api';
 * import { TrustGateTracer } from '@aumos/mcp-trust-gate';
 *
 * const tracer = trace.getTracer('aumos-trust-gate');
 * const gateTracer = new TrustGateTracer({ tracer });
 *
 * const decision = gateTracer.traceEvaluate('send-email', () => {
 *   return gate.evaluate('send-email', 0.5);
 * });
 * ```
 */
export class TrustGateTracer {
  readonly #tracer: OTelTracerLike;
  readonly #serviceName: string;

  constructor(config: TrustGateOTelConfig) {
    this.#tracer = config.tracer;
    this.#serviceName = config.serviceName ?? 'aumos-trust-gate';
  }

  /**
   * Traces a trust gate evaluation.
   *
   * @param toolName - The tool being evaluated.
   * @param evaluateFn - The actual gate.evaluate() call.
   * @returns The gate decision.
   */
  traceEvaluate(
    toolName: string,
    evaluateFn: () => GateDecision,
  ): GateDecision {
    const span = this.#tracer.startSpan('aumos.trust_gate.evaluate', {
      attributes: {
        'service.name': this.#serviceName,
        'aumos.tool_name': toolName,
      },
    });

    try {
      const decision = evaluateFn();

      span.setAttribute('aumos.permitted', decision.permitted);
      span.setAttribute('aumos.trust_level', decision.trustLevel);
      span.setAttribute('aumos.required_level', decision.requiredLevel);
      span.setAttribute('aumos.reason', decision.reason);

      if (decision.budgetRemaining !== undefined) {
        span.setAttribute('aumos.budget_remaining', decision.budgetRemaining);
      }

      span.addEvent(decision.permitted ? 'gate.permit' : 'gate.deny', {
        'aumos.tool_name': toolName,
        'aumos.trust_level': decision.trustLevel,
      });

      span.setStatus({ code: SPAN_STATUS_OK });
      return decision;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      span.setStatus({ code: SPAN_STATUS_ERROR, message });
      span.addEvent('gate.error', { 'error.message': message });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Traces an async evaluation (for future async evaluate support).
   */
  async traceEvaluateAsync(
    toolName: string,
    evaluateFn: () => Promise<GateDecision>,
  ): Promise<GateDecision> {
    const span = this.#tracer.startSpan('aumos.trust_gate.evaluate', {
      attributes: {
        'service.name': this.#serviceName,
        'aumos.tool_name': toolName,
      },
    });

    try {
      const decision = await evaluateFn();

      span.setAttribute('aumos.permitted', decision.permitted);
      span.setAttribute('aumos.trust_level', decision.trustLevel);
      span.setAttribute('aumos.required_level', decision.requiredLevel);
      span.setAttribute('aumos.reason', decision.reason);

      if (decision.budgetRemaining !== undefined) {
        span.setAttribute('aumos.budget_remaining', decision.budgetRemaining);
      }

      span.setStatus({ code: SPAN_STATUS_OK });
      return decision;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      span.setStatus({ code: SPAN_STATUS_ERROR, message });
      throw error;
    } finally {
      span.end();
    }
  }
}
