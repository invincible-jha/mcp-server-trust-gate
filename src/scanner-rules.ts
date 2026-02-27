// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

import { z } from 'zod';

export const SeverityLevel = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);
export type SeverityLevel = z.infer<typeof SeverityLevel>;

export interface ScanRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly severity: SeverityLevel;
  readonly cve?: string;
  readonly check: (config: McpServerConfig) => ScanFinding | null;
}

export interface ScanFinding {
  readonly ruleId: string;
  readonly severity: SeverityLevel;
  readonly message: string;
  readonly remediation: string;
  readonly cve?: string;
}

export interface McpServerConfig {
  readonly transport: 'stdio' | 'sse' | 'streamable-http' | 'unknown';
  readonly authentication: AuthConfig | null;
  readonly tools: ToolConfig[];
  readonly serverInfo: ServerInfo;
}

export interface AuthConfig {
  readonly type: string;
  readonly configured: boolean;
}

export interface ToolConfig {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

export interface ServerInfo {
  readonly name: string;
  readonly version: string;
  readonly protocolVersion: string;
}

export const SCAN_RULES: ScanRule[] = [
  {
    id: 'AUTH-001',
    name: 'No Authentication Configured',
    description: 'MCP server accepts connections without any authentication',
    severity: 'CRITICAL',
    cve: 'CVE-2025-6514',
    check: (config) => {
      if (!config.authentication || !config.authentication.configured) {
        return {
          ruleId: 'AUTH-001',
          severity: 'CRITICAL',
          message: 'No authentication configured. Server accepts anonymous connections.',
          remediation: 'Add authentication via @aumos/mcp-trust-gate TrustGate.wrap() or configure OAuth 2.1.',
          cve: 'CVE-2025-6514',
        };
      }
      return null;
    },
  },
  {
    id: 'AUTH-002',
    name: 'No Authorization Controls',
    description: 'No tool-level authorization or trust level enforcement',
    severity: 'HIGH',
    check: (config) => {
      // Check if any trust level or permission control exists
      if (!config.authentication || config.authentication.type === 'none') {
        return {
          ruleId: 'AUTH-002',
          severity: 'HIGH',
          message: 'No authorization controls. All authenticated users can access all tools.',
          remediation: 'Configure per-tool trust levels using TrustGate tool allowlists.',
        };
      }
      return null;
    },
  },
  {
    id: 'TOOL-001',
    name: 'Unrestricted Tool Access',
    description: 'All tools are accessible without permission boundaries',
    severity: 'HIGH',
    check: (config) => {
      if (config.tools.length > 0) {
        const writeTools = config.tools.filter(
          (t) => /write|delete|create|update|send|execute|run/i.test(t.name + t.description)
        );
        if (writeTools.length > 0) {
          return {
            ruleId: 'TOOL-001',
            severity: 'HIGH',
            message: `${writeTools.length} write/execute tools accessible without trust level restrictions: ${writeTools.map((t) => t.name).join(', ')}`,
            remediation: 'Configure tool allowlists per trust level. Restrict write operations to L3+.',
          };
        }
      }
      return null;
    },
  },
  {
    id: 'TOOL-002',
    name: 'No Rate Limiting',
    description: 'No rate limits on tool invocations',
    severity: 'MEDIUM',
    check: () => ({
      ruleId: 'TOOL-002',
      severity: 'MEDIUM',
      message: 'No rate limiting detected. Agents can invoke tools without throttling.',
      remediation: 'Add rate limiting via TrustGate budget tracking or custom rate limiter.',
    }),
  },
  {
    id: 'BUDGET-001',
    name: 'No Budget Enforcement',
    description: 'No cost tracking or budget limits configured',
    severity: 'MEDIUM',
    check: () => ({
      ruleId: 'BUDGET-001',
      severity: 'MEDIUM',
      message: 'No budget enforcement. Agent cost overruns cannot be prevented.',
      remediation: 'Configure budget limits using TrustGate budget-tracker.',
    }),
  },
  {
    id: 'AUDIT-001',
    name: 'No Audit Logging',
    description: 'Tool invocations are not logged for audit purposes',
    severity: 'MEDIUM',
    check: () => ({
      ruleId: 'AUDIT-001',
      severity: 'MEDIUM',
      message: 'No audit logging detected. Tool invocations are not recorded.',
      remediation: 'Enable audit logging via TrustGate audit-logger.',
    }),
  },
  {
    id: 'TRANSPORT-001',
    name: 'SSE Transport Without TLS',
    description: 'Server-Sent Events transport may expose data in transit',
    severity: 'HIGH',
    check: (config) => {
      if (config.transport === 'sse') {
        return {
          ruleId: 'TRANSPORT-001',
          severity: 'HIGH',
          message: 'SSE transport detected. Ensure TLS is configured for data in transit protection.',
          remediation: 'Deploy behind TLS-terminating reverse proxy or use HTTPS directly.',
        };
      }
      return null;
    },
  },
  {
    id: 'INPUT-001',
    name: 'No Input Validation on Tool Schemas',
    description: 'Tool input schemas may allow injection attacks',
    severity: 'MEDIUM',
    check: (config) => {
      const noSchema = config.tools.filter(
        (t) => !t.inputSchema || Object.keys(t.inputSchema).length === 0
      );
      if (noSchema.length > 0) {
        return {
          ruleId: 'INPUT-001',
          severity: 'MEDIUM',
          message: `${noSchema.length} tools have empty or missing input schemas: ${noSchema.map((t) => t.name).join(', ')}`,
          remediation: 'Define strict JSON Schema for all tool inputs with type constraints.',
        };
      }
      return null;
    },
  },
];
