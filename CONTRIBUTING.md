# Contributing to mcp-server-trust-gate

Thank you for your interest in contributing to `@aumos/mcp-trust-gate`.

---

## Before You Start — Patent Gate

**Read `FIRE_LINE.md` first. This is non-negotiable.**

This project operates under a patent gate (P0-01 ATP). There is a hard
boundary between what can be open-sourced now and what is reserved pending
patent filing. Any pull request that crosses the fire line will be closed
immediately regardless of code quality.

If you are unsure whether a feature crosses the fire line, open a discussion
issue before writing any code.

---

## Development Setup

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0

### Install

```bash
npm install
```

### Build

```bash
npm run build
```

### Type check

```bash
npm run typecheck
```

### Lint

```bash
npm run lint
```

---

## Pull Request Process

1. Fork the repository and create a branch from `main`.
   - Feature branches: `feature/short-description`
   - Bug fix branches: `fix/short-description`
   - Documentation branches: `docs/short-description`

2. Ensure `npm run typecheck` and `npm run lint` both pass with zero errors
   and zero warnings.

3. Update `CHANGELOG.md` under `[Unreleased]` with a summary of your change.

4. Write a clear commit message explaining WHY the change is needed, not
   just what changed. Follow conventional commits:
   - `feat(mcp-trust-gate): ...`
   - `fix(mcp-trust-gate): ...`
   - `docs(mcp-trust-gate): ...`
   - `refactor(mcp-trust-gate): ...`

5. Open a pull request against `main`. The CI pipeline must pass before review.

---

## Code Standards

- TypeScript strict mode — no `any`, no `@ts-ignore`
- Named exports only — no default exports
- `import type` for all type-only imports (`verbatimModuleSyntax` is on)
- Import local modules with `.js` extension
- All public APIs must have TSDoc comments
- Every source file must start with the SPDX license header:
  ```typescript
  // SPDX-License-Identifier: Apache-2.0
  // Copyright (c) 2026 MuVeraAI Corporation
  ```
- Zero ESLint warnings — treat warnings as errors

---

## Reporting Issues

Use GitHub Issues. For security vulnerabilities, email
security@muveraai.com directly rather than opening a public issue.

---

## License

By contributing, you agree that your contributions will be licensed under
the Apache 2.0 License.
