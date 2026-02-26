# mcp-server-trust-gate — Project Instructions

## Identity
Package: `@aumos/mcp-trust-gate`
Purpose: MCP middleware for static trust-level governance of AI agent tool calls.
Repo: `github.com/aumos-ai/mcp-server-trust-gate`

---

## CRITICAL: Patent Gate

**P0-01 ATP — Awaiting Patent Filing.**

Read `FIRE_LINE.md` before touching ANY source file. The full rules are in
`M:/Project Quasar/aumos-oss/CLAUDE.md`. Summary:

- Trust changes are **MANUAL ONLY** — no automatic promotion
- Budget caps are **STATIC ONLY** — no adaptive or ML-based allocation
- Audit logging is **RECORDING ONLY** — no anomaly detection, no counterfactuals
- **NEVER** reference PWM, MAE, STP, CognitiveLoop, GOVERNANCE_PIPELINE
- **NEVER** add: `progressLevel`, `promoteLevel`, `computeTrustScore`,
  `behavioralScore`, `adaptiveBudget`, `optimizeBudget`, `predictSpending`,
  `detectAnomaly`, `generateCounterfactual`

---

## Architecture

```
src/
  types.ts         — Interfaces only (TrustGateConfig, GateDecision, AuditEntry)
  config.ts        — Zod schema + createConfig()
  trust-checker.ts — Static >= comparison, manual setLevel() only
  budget-tracker.ts — Hard-cap period reset, no ML
  audit-logger.ts  — Append-only hash chain, no intelligence
  gate.ts          — Composes the three above, public API surface
  index.ts         — Barrel exports
```

Dependency direction is strictly top-down: `gate` -> `checker/budget/logger` -> `types/config`.
No circular dependencies.

---

## Code Standards

- TypeScript strict mode, zero `any`, zero `@ts-ignore`
- ESLint 9 flat config — zero warnings
- All public exports have TSDoc comments
- Named exports only (no default exports)
- Every source file starts with SPDX license header
- `verbatimModuleSyntax` is on — use `import type` for type-only imports
- Import local modules with `.js` extension (Node ESM requirement)

---

## Common Tasks

### Build
```bash
npm run build
```

### Type check only (no emit)
```bash
npm run typecheck
```

### Lint
```bash
npm run lint
```

### Run an example
```bash
node --loader ts-node/esm examples/basic-usage.ts
```

---

## Adding a New Tool Requirement

Tool requirements are data, not code. Add to `toolTrustRequirements` in the
config at call site. Do NOT hardcode tool names inside `TrustChecker` —
the class is intentionally generic.

---

## Releasing

1. Update `CHANGELOG.md` with the new version entry
2. Bump `version` in `package.json`
3. Run `npm run build && npm run typecheck && npm run lint`
4. Tag: `git tag v0.x.0`
5. Publish: `npm publish --access public`

---

## What NOT to Build Here

See `FIRE_LINE.md`. If a feature crosses any fire line, it belongs in the
closed-source AumOS product, not in this package.
