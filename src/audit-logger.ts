// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

import type { GateDecision, AuditEntry } from './types.js';

/**
 * AuditLogger records governance decisions in an append-only hash chain.
 *
 * @remarks
 * **FIRE LINE — P0-01 ATP:**
 * This class performs STRUCTURED RECORDING ONLY. The following are explicitly
 * OUT OF SCOPE and must not be added until the P0-01 patent is filed and cleared:
 *
 * - Anomaly detection over the audit stream
 * - Counterfactual decision generation
 * - Real-time alerting or stream forwarding
 * - Cross-session log correlation
 *
 * Hash chain integrity can be verified offline via {@link verifyChain}.
 * The hash algorithm used here is a fast 32-bit integer fold suitable for
 * tamper-evidence in development contexts. Production deployments should
 * replace {@link computeHash} with `crypto.subtle.digest`.
 *
 * @example
 * ```typescript
 * const logger = new AuditLogger();
 * const entry = logger.log(decision, { recipient: 'user@example.com' });
 * console.log(logger.verifyChain()); // true
 * ```
 */
export class AuditLogger {
  private readonly entries: AuditEntry[] = [];
  private lastHash: string = '0';

  /**
   * Append a governance decision to the audit log.
   *
   * @param decision - The {@link GateDecision} to record.
   * @param toolArguments - Optional snapshot of the tool's call arguments.
   *   Callers should redact sensitive values before passing here.
   * @returns The newly created {@link AuditEntry}.
   */
  log(
    decision: GateDecision,
    toolArguments?: Record<string, unknown>,
  ): AuditEntry {
    const previousHash = this.lastHash;
    const hash = this.computeHash(decision, previousHash);

    const entry: AuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      decision,
      ...(toolArguments !== undefined ? { toolArguments } : {}),
      previousHash,
      hash,
    };

    this.entries.push(entry);
    this.lastHash = hash;

    return entry;
  }

  /**
   * Return all audit entries as a readonly array.
   *
   * @remarks
   * The returned array is a readonly view of the internal store. It cannot
   * be used to mutate the logger's state, but individual entries are
   * shared by reference — do not mutate them externally.
   */
  getEntries(): readonly AuditEntry[] {
    return this.entries;
  }

  /**
   * Serialize all entries to a pretty-printed JSON string.
   *
   * @remarks
   * Suitable for writing to a file or shipping to an external log sink.
   * Returns `'[]'` when the log is empty.
   */
  exportJSON(): string {
    return JSON.stringify(this.entries, null, 2);
  }

  /**
   * Walk the chain and verify that every hash is consistent with its
   * predecessor and the recorded decision payload.
   *
   * @returns `true` if the chain is intact, `false` if any entry has been
   *   tampered with or the chain order has been disturbed.
   */
  verifyChain(): boolean {
    let previousHash = '0';

    for (const entry of this.entries) {
      if (entry.previousHash !== previousHash) {
        return false;
      }

      const expectedHash = this.computeHash(entry.decision, previousHash);

      if (entry.hash !== expectedHash) {
        return false;
      }

      previousHash = entry.hash;
    }

    return true;
  }

  /**
   * Compute a deterministic hash string over a decision and its predecessor hash.
   *
   * @remarks
   * Uses a simple 32-bit Bernstein-style integer fold for speed. This is
   * sufficient for tamper-evidence in development but should be replaced with
   * `crypto.subtle.digest('SHA-256', ...)` in production deployments.
   *
   * @param decision - The gate decision to hash.
   * @param previousHash - The hash of the preceding entry (or `'0'`).
   * @returns An 8-character lowercase hex string.
   */
  private computeHash(decision: GateDecision, previousHash: string): string {
    const data = JSON.stringify({ decision, previousHash });
    let hash = 0;

    for (let index = 0; index < data.length; index++) {
      const charCode = data.charCodeAt(index);
      hash = ((hash << 5) - hash) + charCode;
      hash = hash & hash; // Coerce to signed 32-bit integer
    }

    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}
