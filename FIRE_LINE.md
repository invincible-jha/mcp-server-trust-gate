# FIRE LINE — mcp-server-trust-gate

**Patent Gate: P0-01 ATP (Awaiting Patent Filing)**

This document defines the exact boundary between what is permitted in this
open-source package and what is reserved under patent application P0-01.

---

## IN SCOPE (safe to implement and ship)

| Feature | Implementation |
|---|---|
| Static trust level comparison | `currentLevel >= requiredLevel` only |
| Manual trust level assignment | `TrustGate.setTrustLevel()` — owner sets, never automatic |
| Tool-level trust requirements | Static map of `toolName -> TrustLevel` |
| Hard-cap budget enforcement | Fixed per-period spend limit, period reset on elapsed time |
| Structured audit logging | Append-only hash chain, JSON export |
| Hash chain integrity verification | Offline tamper-evidence check |
| `onDeny` callback | Notification hook, no logic inside gate |

---

## EXCLUDED (reserved under P0-01 — DO NOT IMPLEMENT)

### Trust Progression
- Adaptive or automatic trust promotion based on observed behavior
- Behavioral scoring or trust score computation of any kind
- Decay rates, tuning parameters, convergence targets
- Any form of `progressLevel`, `promoteLevel`, or `computeTrustScore`

### Budget Management
- Adaptive or dynamic budget caps
- ML-based spend prediction or optimization
- Spending pattern analysis across sessions
- Any form of `adaptiveBudget`, `optimizeBudget`, or `predictSpending`

### Audit Intelligence
- Anomaly detection over the audit stream
- Counterfactual decision generation
- Real-time alerting or stream forwarding
- Cross-session log correlation
- Any form of `detectAnomaly` or `generateCounterfactual`

### System Integration
- PWM (Personal World Model) integration
- MAE (Mission Alignment Engine) integration
- STP (Social Trust Protocol) integration
- GOVERNANCE_PIPELINE orchestration
- Three-tier attention filters
- AGENTS.md consumption or cross-protocol orchestration

---

## Forbidden Identifiers

The following identifiers must NEVER appear in any source file in this repository:

```
progressLevel          promoteLevel           computeTrustScore
behavioralScore        adaptiveBudget         optimizeBudget
predictSpending        detectAnomaly          generateCounterfactual
PersonalWorldModel     MissionAlignment       SocialTrust
CognitiveLoop          AttentionFilter        GOVERNANCE_PIPELINE
```

---

## Enforcement

- Pre-push hook at `scripts/pre-push-gate.sh` scans for forbidden identifiers
- CI pipeline runs the same scan on every pull request
- Any PR that crosses the fire line must be closed immediately — do not merge

---

*Last updated: 2026-02-26*
*Patent application: P0-01 (filing in progress)*
