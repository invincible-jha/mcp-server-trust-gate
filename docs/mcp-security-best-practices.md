# MCP Security Best Practices

Model Context Protocol (MCP) servers give AI agents access to tools, APIs, and data. Without proper security controls, a compromised or misbehaving agent can cause significant harm. This document covers the key security controls every production MCP deployment should implement.

> This document is formatted as a contribution guide for the Anthropic MCP documentation. The controls described here are implemented in `@aumos/mcp-trust-gate`.

---

## 1. Authentication

### Problem

CVE-2025-6514 documented that approximately 2,000 publicly-accessible MCP servers accept connections with no authentication. Any agent — or attacker — can invoke any tool.

### Recommendation

Every MCP server exposed beyond `localhost` must authenticate clients. Two patterns are recommended:

**API Key (Simple, stdio-appropriate)**

```typescript
// Validate an API key on every incoming request
const apiKey = request.headers['x-api-key'];
if (apiKey !== process.env.MCP_API_KEY) {
  return { error: 'Unauthorized' };
}
```

**OAuth 2.1 (Recommended for SSE/HTTP transports)**

Follow the [OAuth 2.1 Authorization Code flow](https://oauth.net/2.1/) with PKCE. Issue short-lived tokens (15 minutes or less) and rotate refresh tokens on every use.

### Detection

Run the security scanner to detect missing authentication:

```bash
npx @aumos/mcp-trust-gate --scan --config=./mcp-config.json
# AUTH-001 fires if authentication is absent
```

---

## 2. Authorization

### Problem

Authentication identifies *who* is connecting. Authorization controls *what they can do*. Most MCP servers have no authorization layer — authenticated clients can invoke any tool.

### Recommendation

Implement per-tool access controls using a trust-level model:

| Trust Level | Permitted Operations |
|------------|---------------------|
| L0 Observer | Read-only, non-sensitive |
| L1 Monitor | Read operations, status checks |
| L2 Suggest | Propose actions for human review |
| L3 Act (Approve) | Execute reversible actions |
| L4 Act (Auto) | Execute irreversible actions |

```typescript
import { TrustGate } from '@aumos/mcp-trust-gate';
import { TrustLevel } from '@aumos/types';

const gate = new TrustGate({
  defaultTrustLevel: TrustLevel.L1_MONITOR,
  toolTrustRequirements: {
    'list-files':   TrustLevel.L1_MONITOR,
    'read-file':    TrustLevel.L1_MONITOR,
    'write-file':   TrustLevel.L3_ACT_APPROVE,
    'delete-file':  TrustLevel.L4_ACT_AUTO,
    'run-command':  TrustLevel.L4_ACT_AUTO,
  },
});
```

Trust level assignment is **manual only**. Automatic promotion based on agent behavior is explicitly not supported — level changes require operator action.

---

## 3. Tool Allowlist and Denylist

### Problem

Even within an authorized trust level, some tools should never be callable by certain agents, regardless of other permissions.

### Recommendation

Use per-trust-level allowlists and denylists:

```typescript
import { evaluateToolPolicy } from '@aumos/mcp-trust-gate';
import type { ToolPolicyConfig } from '@aumos/mcp-trust-gate';

const policyConfig: ToolPolicyConfig = {
  defaultDeny: true,
  policies: [
    {
      trustLevel: 1,
      allowedTools: ['read-file', 'list-files', 'get-status'],
    },
    {
      trustLevel: 3,
      allowedTools: ['read-file', 'list-files', 'write-file', 'create-dir'],
      deniedTools: ['delete-file', 'run-command'],
    },
    {
      trustLevel: 4,
      wildcardAllow: true,
      deniedTools: ['format-disk', 'rm-rf'],
    },
  ],
};

const result = evaluateToolPolicy('write-file', 3, policyConfig);
// result.allowed === true
```

Denylist entries are checked before allowlist entries. Explicit deny always wins.

---

## 4. Rate Limiting

### Problem

Agents can invoke tools in rapid loops. Without rate limits, a single agent session can exhaust downstream API quotas, inflate costs, or trigger abuse protections on third-party services.

### Recommendation

Apply a token bucket rate limiter on all MCP servers:

```typescript
import { TokenBucketRateLimiter } from '@aumos/mcp-trust-gate';

const limiter = new TokenBucketRateLimiter({
  maxRequestsPerMinute: 60,
  maxTokensPerMinute: 10_000,
});

// In your tool handler:
const rateCheck = limiter.check(estimatedTokens);
if (!rateCheck.allowed) {
  return {
    error: `Rate limit exceeded. Retry after ${rateCheck.retryAfterMs}ms`,
  };
}
```

**Recommended limits for production:**

| Agent Type | Requests/min | Tokens/min |
|-----------|-------------|-----------|
| Internal automation | 120 | 20,000 |
| Interactive agent | 60 | 10,000 |
| Public API agent | 20 | 5,000 |

Adjust based on your downstream service limits and cost tolerance.

---

## 5. Circuit Breaker

### Problem

When a downstream service becomes unavailable or starts returning errors, agents may retry aggressively, amplifying the load and making recovery harder.

### Recommendation

Wrap downstream calls with a circuit breaker:

```typescript
import { CircuitBreaker } from '@aumos/mcp-trust-gate';

const breaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenMaxAttempts: 2,
});

// In your tool handler:
if (!breaker.canExecute()) {
  return { error: 'Service temporarily unavailable. Please retry later.' };
}

try {
  const result = await callDownstreamService();
  breaker.recordSuccess();
  return result;
} catch (error) {
  breaker.recordFailure();
  throw error;
}
```

The circuit breaker transitions: CLOSED (normal) → OPEN (blocked) → HALF_OPEN (probe) → CLOSED (recovered).

---

## 6. Budget Enforcement

### Problem

LLM tool use has a direct cost: API calls, compute, storage. Without hard limits, a single runaway agent session can generate unexpected bills.

### Recommendation

Configure hard spending caps with automatic period reset:

```typescript
const gate = new TrustGate({
  defaultTrustLevel: TrustLevel.L2_SUGGEST,
  budgetConfig: {
    limitAmount: 10.00,
    currency: 'USD',
    period: 'daily',
  },
});

// evaluating with an estimated cost
const decision = gate.evaluate('generate-report', 0.05);
if (!decision.permitted) {
  return { error: `Budget exhausted: ${decision.reason}` };
}
```

Budget caps are **static only** — they do not adapt to usage patterns. Set them based on your maximum acceptable cost per period.

---

## 7. Audit Logging

### Problem

Without audit records, you cannot investigate incidents, demonstrate compliance, or debug unexpected agent behavior.

### Recommendation

Enable append-only audit logging with hash-chain integrity verification:

```typescript
const gate = new TrustGate({
  defaultTrustLevel: TrustLevel.L2_SUGGEST,
  auditEnabled: true, // default: true
});

// After a session ends, retrieve and persist the log:
const entries = gate.getAuditLog();
await persistToStorage(entries);

// Verify log integrity:
const isIntact = gate.verifyAuditChain();
if (!isIntact) {
  alert('Audit log integrity failure — investigate immediately');
}
```

**What to log in production:**

- Every tool invocation (permitted and denied)
- The agent's trust level at time of call
- The required trust level for the tool
- Budget remaining after each call
- Session start and end timestamps

**What NOT to log:**

- Raw tool arguments that contain PII or credentials
- Model weights or prompt internals
- Anything prohibited by your data retention policy

---

## 8. Transport Security

### Problem

SSE and HTTP MCP transports send data over the network. Without TLS, invocations are visible to network observers.

### Recommendation

- **stdio transport:** No network exposure. Suitable for local Claude Desktop use.
- **SSE/HTTP transport:** Always deploy behind TLS. Use a reverse proxy (nginx, Caddy, Cloudflare) or configure Node.js TLS directly.
- Use HTTPS-only redirects. Never serve mixed content.
- Set `Strict-Transport-Security` headers.

```nginx
server {
  listen 443 ssl;
  ssl_certificate     /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;

  location / {
    proxy_pass http://localhost:3000;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

---

## 9. Input Validation

### Problem

Tool input schemas define the contract between agents and tools. Empty or overly permissive schemas allow injection attacks and unexpected data shapes.

### Recommendation

Define strict JSON Schema for every tool input:

```json
{
  "name": "query-database",
  "description": "Query the application database",
  "inputSchema": {
    "type": "object",
    "properties": {
      "table": {
        "type": "string",
        "enum": ["users", "orders", "products"]
      },
      "filters": {
        "type": "object",
        "additionalProperties": {
          "type": "string"
        }
      },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 100
      }
    },
    "required": ["table"],
    "additionalProperties": false
  }
}
```

Never construct SQL queries by interpolating schema fields. Use parameterized queries only.

---

## 10. Principle of Least Privilege

### Recommendation

Apply the principle of least privilege across every dimension:

| Dimension | Least Privilege |
|-----------|----------------|
| Trust level | Start at L0/L1; elevate manually only when needed |
| Tool access | Allowlist only what the agent needs; default deny |
| Budget | Set to the minimum expected spend, not maximum possible |
| Network | Bind to localhost unless external access is required |
| File system | Restrict to specific directories, not `/` |
| API scopes | Request minimum OAuth scopes |

---

## Security Checklist

Run this checklist before deploying any MCP server:

- [ ] Authentication configured (API key or OAuth 2.1)
- [ ] Per-tool trust level requirements set
- [ ] Tool allowlist/denylist configured with `defaultDeny: true`
- [ ] Rate limiting enabled
- [ ] Circuit breaker configured for all downstream calls
- [ ] Daily/hourly budget cap configured
- [ ] Audit logging enabled and persisted to durable storage
- [ ] TLS configured (if using SSE/HTTP transport)
- [ ] All tool inputs have strict JSON Schema definitions
- [ ] Security scanner passes with score >= 80

```bash
npx @aumos/mcp-trust-gate --scan --config=./mcp-config.json
# Must exit 0 before deploying
```

---

## References

- [CVE-2025-6514](https://nvd.nist.gov/vuln/detail/CVE-2025-6514) — Unauthenticated MCP server access
- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/)
- [OAuth 2.1 Draft](https://oauth.net/2.1/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [@aumos/mcp-trust-gate on npm](https://www.npmjs.com/package/@aumos/mcp-trust-gate)
