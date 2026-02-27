# Claude Desktop Integration Guide

This guide shows you how to add `@aumos/mcp-trust-gate` to an MCP server you run with **Claude Desktop**, so every tool call from Claude passes through trust-level governance, rate limiting, and audit logging.

---

## Prerequisites

- Claude Desktop installed (macOS or Windows)
- Node.js 20+
- An existing MCP server, or the example below

---

## Step 1: Install the package

In your MCP server project:

```bash
npm install @aumos/mcp-trust-gate @aumos/types
```

---

## Step 2: Wrap your MCP server with TrustGate

Before adding to Claude Desktop, update your MCP server to use `TrustGate` for governance:

```typescript
// server.ts
import { TrustGate, TokenBucketRateLimiter } from '@aumos/mcp-trust-gate';
import { TrustLevel } from '@aumos/types';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const gate = new TrustGate(
  {
    defaultTrustLevel: TrustLevel.L2_SUGGEST,
    toolTrustRequirements: {
      'read-file':   TrustLevel.L1_MONITOR,
      'write-file':  TrustLevel.L3_ACT_APPROVE,
      'delete-file': TrustLevel.L4_ACT_AUTO,
    },
    budgetConfig: {
      limitAmount: 5.00,
      currency: 'USD',
      period: 'daily',
    },
    auditEnabled: true,
  },
  undefined,
  {
    rateLimiter: {
      maxRequestsPerMinute: 30,
      maxTokensPerMinute: 5_000,
    },
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeoutMs: 30_000,
      halfOpenMaxAttempts: 2,
    },
  }
);

const server = new McpServer({ name: 'my-server', version: '1.0.0' });

server.tool('read-file', 'Read a file', { path: { type: 'string' } }, async ({ path }) => {
  const decision = gate.evaluate('read-file');
  if (!decision.permitted) {
    return { content: [{ type: 'text', text: `Denied: ${decision.reason}` }] };
  }
  // ... actual implementation
  gate.recordSuccess();
  return { content: [{ type: 'text', text: 'file contents here' }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

Build your server:

```bash
npm run build
# produces dist/server.js
```

---

## Step 3: Locate the Claude Desktop config file

Claude Desktop reads MCP server configuration from:

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

If the file does not exist, create it.

---

## Step 4: Add your server to the config

Open `claude_desktop_config.json` and add your server under `"mcpServers"`:

```json
{
  "mcpServers": {
    "my-trust-gated-server": {
      "command": "node",
      "args": ["/absolute/path/to/your/server/dist/server.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

**Important:** Use absolute paths. Claude Desktop does not resolve relative paths.

---

## Step 5: Restart Claude Desktop

Quit and relaunch Claude Desktop. Your server should appear in the MCP servers list. Claude will now route tool calls through your `TrustGate`.

---

## Step 6: Verify the integration

Ask Claude to use one of your tools. Then check the audit log from your server process. You should see entries like:

```json
{
  "id": "abc123",
  "decision": {
    "toolName": "read-file",
    "permitted": true,
    "reason": "Trust level sufficient",
    "trustLevel": 2,
    "requiredLevel": 1,
    "timestamp": "2026-02-26T10:00:00.000Z"
  }
}
```

---

## Adjusting Trust Level

Trust level changes are **manual only** — there is no automatic promotion. To change the trust level at runtime, call:

```typescript
gate.setTrustLevel(TrustLevel.L3_ACT_APPROVE);
```

To change it via an environment variable at startup:

```typescript
const trustLevel = process.env.MCP_TRUST_LEVEL
  ? parseInt(process.env.MCP_TRUST_LEVEL, 10)
  : TrustLevel.L2_SUGGEST;

const gate = new TrustGate({ defaultTrustLevel: trustLevel });
```

Then in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/path/to/dist/server.js"],
      "env": {
        "MCP_TRUST_LEVEL": "2"
      }
    }
  }
}
```

---

## Running the Security Scanner

Before adding your server to Claude Desktop, scan it for vulnerabilities:

```bash
npx @aumos/mcp-trust-gate --scan --config=./mcp-config.json
```

Fix any CRITICAL or HIGH findings before connecting to Claude Desktop.

---

## Troubleshooting

**Server does not appear in Claude Desktop**
- Verify the path in `args` is absolute and the file exists.
- Check that Node.js 20+ is on your PATH (`node --version`).
- Look at Claude Desktop logs: Help > Show Logs.

**All tool calls are denied**
- Check `defaultTrustLevel` — `L0_OBSERVER` blocks all write operations.
- Inspect the audit log (`gate.getAuditLog()`) to see the denial reason.

**Circuit breaker is open**
- Check `gate.getCircuitBreakerStatus()` to see the failure count.
- Call `gate.circuitBreaker.reset()` after fixing the underlying issue.

---

## See Also

- [Security Scanner](./security-scanner.md)
- [MCP Security Best Practices](./mcp-security-best-practices.md)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk)
