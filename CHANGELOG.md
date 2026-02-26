# Changelog

All notable changes to `@aumos/mcp-trust-gate` will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.1.0] — 2026-02-26

### Added

- `TrustGate` — main middleware class composing trust checking, budget
  enforcement, and audit logging into a single `evaluate()` call
- `TrustChecker` — static `>=` trust level comparison with manual `setLevel()`
  and per-tool `setRequirement()` APIs
- `BudgetTracker` — hard-cap per-period spending limits with lazy period reset;
  supports `hourly`, `daily`, `weekly`, and `monthly` windows
- `AuditLogger` — append-only hash chain audit log with `verifyChain()` and
  `exportJSON()` APIs
- `createConfig()` — Zod-validated configuration factory with safe defaults
- `TrustGateConfigSchema` — exported Zod schema for external validation
- Full TypeScript type exports: `TrustGateConfig`, `BudgetConfig`,
  `GateDecision`, `AuditEntry`, `SpendingResult`, `BudgetSummary`
- Examples: `basic-usage.ts`, `with-budget.ts`, `custom-checker.ts`
- Apache 2.0 license
- `FIRE_LINE.md` documenting the patent gate boundary (P0-01 ATP)

### Notes

- This is a scaffold release. Core adaptive governance features are reserved
  under patent application P0-01 and will not appear in this package until
  after filing and clearance.

[Unreleased]: https://github.com/aumos-ai/mcp-server-trust-gate/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/aumos-ai/mcp-server-trust-gate/releases/tag/v0.1.0
