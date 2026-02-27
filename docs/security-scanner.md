# MCP Security Scanner

`@aumos/mcp-trust-gate` ships with a built-in security scanner that audits your MCP server configuration for common vulnerabilities — including CVE-2025-6514 (unauthenticated server access).

The scanner is the **missing security layer for MCP**: a fast, zero-dependency static analysis tool you can run in CI, as a pre-deploy gate, or on-demand against any MCP server configuration.

---

## Quick Start

Scan with the default unconfigured profile:

```bash
npx @aumos/mcp-trust-gate --scan
```

Scan a specific server config:

```bash
npx @aumos/mcp-trust-gate --scan --config=path/to/mcp-config.json
```

Output as JSON (useful for CI integration):

```bash
npx @aumos/mcp-trust-gate --scan --config=./mcp-config.json --json
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | No critical or high findings |
| `1` | High-severity findings detected |
| `2` | Critical findings detected (CI should fail here) |

Use exit code `2` as a build gate:

```yaml
# GitHub Actions example
- name: MCP Security Scan
  run: npx @aumos/mcp-trust-gate --scan --config=./mcp-config.json
```

---

## Security Score

Each scan produces a **Security Score** from 0 to 100:

| Score | Assessment |
|-------|-----------|
| 90-100 | Secure |
| 70-89 | Acceptable with known gaps |
| 50-69 | Needs improvement |
| 0-49 | High risk — remediate before deploying |

Score deductions per finding: CRITICAL -25, HIGH -15, MEDIUM -8, LOW -3, INFO -1.

---

## Scanner Rules

### AUTH-001 — No Authentication Configured

**Severity:** CRITICAL
**CVE:** CVE-2025-6514

Fires when the MCP server accepts connections without any authentication mechanism. Approximately 2,000 publicly-exposed MCP servers are currently vulnerable to this issue.

**Remediation:** Wrap your server with `TrustGate` or configure OAuth 2.1 token validation.

```typescript
import { TrustGate } from '@aumos/mcp-trust-gate';
import { TrustLevel } from '@aumos/types';

const gate = new TrustGate({
  defaultTrustLevel: TrustLevel.L1_MONITOR,
});
```

---

### AUTH-002 — No Authorization Controls

**Severity:** HIGH

Authentication establishes identity; authorization controls what an identity can do. This rule fires when no per-tool access controls are configured.

**Remediation:** Configure `toolTrustRequirements` in `TrustGate` to assign minimum trust levels per tool.

```typescript
const gate = new TrustGate({
  defaultTrustLevel: TrustLevel.L1_MONITOR,
  toolTrustRequirements: {
    'read-data':   TrustLevel.L1_MONITOR,
    'write-data':  TrustLevel.L3_ACT_APPROVE,
    'delete-data': TrustLevel.L4_ACT_AUTO,
  },
});
```

---

### TOOL-001 — Unrestricted Tool Access

**Severity:** HIGH

Write and execute tools (names or descriptions matching: write, delete, create, update, send, execute, run) are accessible without trust-level restrictions.

**Remediation:** Use `toolTrustRequirements` or the `ToolPolicyConfig` middleware to restrict destructive operations to higher trust levels.

---

### TOOL-002 — No Rate Limiting

**Severity:** MEDIUM

No rate limits are configured on tool invocations. An agent could invoke tools at unbounded frequency, causing costs to spiral or downstream systems to be overwhelmed.

**Remediation:** Use `TokenBucketRateLimiter` middleware:

```typescript
import { TrustGate } from '@aumos/mcp-trust-gate';

const gate = new TrustGate(
  { defaultTrustLevel: TrustLevel.L2_SUGGEST },
  undefined,
  {
    rateLimiter: {
      maxRequestsPerMinute: 60,
      maxTokensPerMinute: 10_000,
    },
  }
);
```

---

### BUDGET-001 — No Budget Enforcement

**Severity:** MEDIUM

No cost tracking or hard-cap budget limits are configured. Agent costs cannot be bounded.

**Remediation:** Configure `budgetConfig` in `TrustGate`:

```typescript
const gate = new TrustGate({
  defaultTrustLevel: TrustLevel.L2_SUGGEST,
  budgetConfig: {
    limitAmount: 10.00,
    currency: 'USD',
    period: 'daily',
  },
});
```

---

### AUDIT-001 — No Audit Logging

**Severity:** MEDIUM

Tool invocations are not recorded for compliance, debugging, or incident investigation.

**Remediation:** Ensure `auditEnabled: true` in `TrustGate` (this is the default). Access the audit log via `gate.getAuditLog()` and persist entries to your logging infrastructure.

---

### TRANSPORT-001 — SSE Transport Without TLS

**Severity:** HIGH

Server-Sent Events transport sends data as plaintext HTTP streams by default. Without TLS, tool invocations and their arguments are visible to network observers.

**Remediation:** Deploy behind a TLS-terminating reverse proxy (nginx, Caddy, Cloudflare) or configure your Node.js server to use HTTPS directly.

---

### INPUT-001 — No Input Validation on Tool Schemas

**Severity:** MEDIUM

Tools with empty or missing `inputSchema` definitions cannot validate incoming arguments, making them vulnerable to injection attacks and unexpected inputs.

**Remediation:** Define strict JSON Schema for every tool input. Use `required` fields and type constraints.

```json
{
  "name": "query-database",
  "inputSchema": {
    "type": "object",
    "properties": {
      "table": { "type": "string", "enum": ["users", "orders"] },
      "limit": { "type": "integer", "minimum": 1, "maximum": 100 }
    },
    "required": ["table"],
    "additionalProperties": false
  }
}
```

---

## Programmatic Usage

The scanner can be used directly in your Node.js code:

```typescript
import { runScan, formatScanReport, SCAN_RULES } from '@aumos/mcp-trust-gate';
import type { McpServerConfig } from '@aumos/mcp-trust-gate';

const config: McpServerConfig = {
  transport: 'stdio',
  authentication: { type: 'api-key', configured: true },
  tools: [
    {
      name: 'read-file',
      description: 'Read a file',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
    },
  ],
  serverInfo: { name: 'my-server', version: '1.0.0', protocolVersion: '2024-11-05' },
};

const result = runScan(config);
console.log(formatScanReport(result));

// Check findings programmatically
if (result.summary.critical > 0) {
  throw new Error(`${result.summary.critical} critical security issues found`);
}
```

### Custom Rules

Pass a custom rules array to `runScan` to run only a subset of rules or add your own:

```typescript
import { runScan, SCAN_RULES } from '@aumos/mcp-trust-gate';
import type { ScanRule } from '@aumos/mcp-trust-gate';

const customRule: ScanRule = {
  id: 'CUSTOM-001',
  name: 'No Internal Tools Exposed',
  description: 'Internal admin tools must not be exposed via MCP',
  severity: 'HIGH',
  check: (config) => {
    const internalTools = config.tools.filter((t) => t.name.startsWith('admin-'));
    if (internalTools.length > 0) {
      return {
        ruleId: 'CUSTOM-001',
        severity: 'HIGH',
        message: `${internalTools.length} internal tools exposed: ${internalTools.map((t) => t.name).join(', ')}`,
        remediation: 'Remove or rename admin tools before exposing the MCP server.',
      };
    }
    return null;
  },
};

const result = runScan(config, [...SCAN_RULES, customRule]);
```

---

## MCP Config File Format

When passing `--config=FILE`, the file must match `McpServerConfig`:

```json
{
  "transport": "stdio",
  "authentication": {
    "type": "api-key",
    "configured": true
  },
  "tools": [
    {
      "name": "read-email",
      "description": "Read emails from the inbox",
      "inputSchema": {
        "type": "object",
        "properties": {
          "limit": { "type": "integer", "minimum": 1, "maximum": 50 }
        }
      }
    }
  ],
  "serverInfo": {
    "name": "email-mcp-server",
    "version": "1.0.0",
    "protocolVersion": "2024-11-05"
  }
}
```

---

## See Also

- [Claude Desktop Integration Guide](./claude-desktop-guide.md)
- [MCP Security Best Practices](./mcp-security-best-practices.md)
- [Rate Limiter & Circuit Breaker](../src/rate-limiter.ts)
- [Tool Allowlist/Denylist](../src/tool-policy.ts)
