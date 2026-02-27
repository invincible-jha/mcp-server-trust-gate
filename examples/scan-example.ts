// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

/**
 * MCP Security Scanner — example usage.
 *
 * Demonstrates how to scan an MCP server configuration for common
 * security vulnerabilities and interpret the resulting report.
 *
 * Run with:
 *   node --loader ts-node/esm examples/scan-example.ts
 */

import { runScan, formatScanReport } from '../src/scanner.js';
import type { McpServerConfig } from '../src/scanner-rules.js';

// Example 1: A fully-unconfigured server (worst case)
const unconfiguredServer: McpServerConfig = {
  transport: 'sse',
  authentication: null,
  tools: [
    {
      name: 'write-file',
      description: 'Write content to a file on the filesystem',
      inputSchema: {},
    },
    {
      name: 'execute-command',
      description: 'Execute a shell command',
      inputSchema: {},
    },
    {
      name: 'read-file',
      description: 'Read a file from the filesystem',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
        required: ['path'],
      },
    },
  ],
  serverInfo: {
    name: 'example-mcp-server',
    version: '1.0.0',
    protocolVersion: '2024-11-05',
  },
};

console.log('=== Example 1: Unconfigured Server ===');
const unconfiguredResult = runScan(unconfiguredServer);
console.log(formatScanReport(unconfiguredResult));
console.log('JSON output:');
console.log(JSON.stringify(unconfiguredResult.summary, null, 2));
console.log('');

// Example 2: A partially-configured server (auth present, but missing other controls)
const partialServer: McpServerConfig = {
  transport: 'stdio',
  authentication: {
    type: 'api-key',
    configured: true,
  },
  tools: [
    {
      name: 'query-database',
      description: 'Query the application database',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'number' },
        },
        required: ['query'],
      },
    },
    {
      name: 'send-notification',
      description: 'Send a push notification to a user',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['userId', 'message'],
      },
    },
  ],
  serverInfo: {
    name: 'app-mcp-server',
    version: '2.1.0',
    protocolVersion: '2024-11-05',
  },
};

console.log('=== Example 2: Partially-Configured Server ===');
const partialResult = runScan(partialServer);
console.log(formatScanReport(partialResult));
