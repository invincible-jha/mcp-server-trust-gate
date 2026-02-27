#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

import { runScan, formatScanReport } from './scanner.js';
import type { McpServerConfig } from './scanner-rules.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--scan') || args.includes('-s')) {
    const configPath = args.find((a) => a.startsWith('--config='))?.split('=')[1];

    if (!configPath) {
      // Scan with defaults — report what's missing
      const defaultConfig: McpServerConfig = {
        transport: 'stdio',
        authentication: null,
        tools: [],
        serverInfo: { name: 'unknown', version: '0.0.0', protocolVersion: '2024-11-05' },
      };

      console.log('No --config provided. Running scan with default (unconfigured) profile.');
      console.log('Usage: npx @aumos/mcp-trust-gate --scan --config=path/to/mcp-config.json');
      console.log('');

      const result = runScan(defaultConfig);

      if (args.includes('--json')) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatScanReport(result));
      }

      process.exit(result.summary.critical > 0 ? 2 : result.summary.high > 0 ? 1 : 0);
      return;
    }

    // Load config from file
    const fs = await import('fs');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw) as McpServerConfig;

    const result = runScan(config);

    if (args.includes('--json')) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatScanReport(result));
    }

    process.exit(result.summary.critical > 0 ? 2 : result.summary.high > 0 ? 1 : 0);
    return;
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
@aumos/mcp-trust-gate

Usage:
  npx @aumos/mcp-trust-gate --scan                    Scan with default profile
  npx @aumos/mcp-trust-gate --scan --config=FILE      Scan MCP server config
  npx @aumos/mcp-trust-gate --scan --json             Output JSON report
  npx @aumos/mcp-trust-gate --help                    Show this help

Exit codes:
  0  No critical/high findings
  1  High-severity findings detected
  2  Critical findings detected
`);
    return;
  }

  console.log('Use --scan to run security scanner or --help for usage.');
}

main().catch((error: unknown) => {
  console.error('Scan failed:', error);
  process.exit(1);
});
