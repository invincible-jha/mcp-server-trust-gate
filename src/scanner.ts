// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

import { SCAN_RULES, type McpServerConfig, type ScanFinding, type ScanRule } from './scanner-rules.js';

export interface ScanResult {
  readonly serverName: string;
  readonly serverVersion: string;
  readonly scanTimestamp: string;
  readonly transport: string;
  readonly toolCount: number;
  readonly findings: ScanFinding[];
  readonly summary: ScanSummary;
}

export interface ScanSummary {
  readonly critical: number;
  readonly high: number;
  readonly medium: number;
  readonly low: number;
  readonly info: number;
  readonly score: number; // 0-100, higher = more secure
}

/**
 * Run the MCP security scanner against a server configuration.
 *
 * @param config - The MCP server configuration to scan.
 * @param rules - Optional list of rules to run. Defaults to {@link SCAN_RULES}.
 * @returns A {@link ScanResult} containing all findings and a summary score.
 */
export function runScan(config: McpServerConfig, rules?: ScanRule[]): ScanResult {
  const activeRules = rules ?? SCAN_RULES;
  const findings: ScanFinding[] = [];

  for (const rule of activeRules) {
    const finding = rule.check(config);
    if (finding) {
      findings.push(finding);
    }
  }

  const summary = buildSummary(findings);

  return {
    serverName: config.serverInfo.name,
    serverVersion: config.serverInfo.version,
    scanTimestamp: new Date().toISOString(),
    transport: config.transport,
    toolCount: config.tools.length,
    findings,
    summary,
  };
}

function buildSummary(findings: ScanFinding[]): ScanSummary {
  const counts = {
    critical: findings.filter((f) => f.severity === 'CRITICAL').length,
    high: findings.filter((f) => f.severity === 'HIGH').length,
    medium: findings.filter((f) => f.severity === 'MEDIUM').length,
    low: findings.filter((f) => f.severity === 'LOW').length,
    info: findings.filter((f) => f.severity === 'INFO').length,
  };

  // Score: start at 100, deduct per finding severity
  const deductions =
    counts.critical * 25 +
    counts.high * 15 +
    counts.medium * 8 +
    counts.low * 3 +
    counts.info * 1;
  const score = Math.max(0, 100 - deductions);

  return { ...counts, score };
}

/**
 * Format a {@link ScanResult} as a human-readable text report.
 *
 * @param result - The scan result to format.
 * @returns A multi-line string suitable for printing to stdout.
 */
export function formatScanReport(result: ScanResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('=== AumOS MCP Security Scan Report ===');
  lines.push('');
  lines.push(`Server: ${result.serverName} v${result.serverVersion}`);
  lines.push(`Transport: ${result.transport}`);
  lines.push(`Tools: ${result.toolCount}`);
  lines.push(`Scanned: ${result.scanTimestamp}`);
  lines.push('');
  lines.push(`Security Score: ${result.summary.score}/100`);
  lines.push('');

  if (result.findings.length === 0) {
    lines.push('No security issues found.');
  } else {
    lines.push(`Findings: ${result.findings.length}`);
    lines.push(`  CRITICAL: ${result.summary.critical}`);
    lines.push(`  HIGH:     ${result.summary.high}`);
    lines.push(`  MEDIUM:   ${result.summary.medium}`);
    lines.push(`  LOW:      ${result.summary.low}`);
    lines.push('');
    lines.push('--- Details ---');
    lines.push('');

    for (const finding of result.findings) {
      const cveTag = finding.cve ? ` [${finding.cve}]` : '';
      lines.push(`[${finding.severity}] ${finding.ruleId}${cveTag}`);
      lines.push(`  ${finding.message}`);
      lines.push(`  Fix: ${finding.remediation}`);
      lines.push('');
    }
  }

  lines.push('=== End of Report ===');
  lines.push('');
  lines.push('Protect your MCP server: npm install @aumos/mcp-trust-gate');
  lines.push('');

  return lines.join('\n');
}
