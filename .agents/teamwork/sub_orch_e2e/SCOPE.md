# Scope: E2E Testing Track (FlashCard)

## Mission
Design and implement a comprehensive, requirement-driven, opaque-box E2E test suite for FlashCard per Dual Track guidelines in PROJECT.md.

## Architecture
- **Purpose**: Independent, requirement-driven, opaque-box E2E test suite verifying FlashCard system integrity, build health, security controls, and study workflows.
- **Test Runner**: Node.js script `node tests/e2e/runner.mjs` that discovers, runs, and reports on all test tiers with exit code 0 on complete pass, non-zero on failure.
- **Tiers**:
  - **Tier 1: Feature Coverage (Core Command Acceptance)** (5 tests):
    - `next.config.mjs` build flag integrity (no ignore flags)
    - `tsc --noEmit` (TypeScript compilation with 0 errors)
    - `next lint --max-warnings 0` (ESLint static analysis with 0 errors and 0 warnings)
    - `prisma validate` (Prisma schema validation with env fallbacks)
    - `next build` (Next.js production build check creating valid `.next/BUILD_ID`)
  - **Tier 2: Boundary & Corner Cases (Security & Authorization Vulnerability Checks)** (22 tests):
    - IDOR tests on `/api/cards/[id]` (PUT / DELETE without ownership/session rejected with 401/403)
    - IDOR tests on `/api/decks/[id]/cards` (GET private deck / POST without ownership rejected with 403)
    - Quiz option leakage check (`/api/quiz/generate` must NOT return `correctAnswer` or `isCorrect` to client)
    - Quiz anti-replay & grading check (`/api/quiz/submit` verifies answers against DB and blocks re-submissions with 400)
  - **Tier 3: Cross-Feature Combinations (Integration Checks)** (10 tests):
    - Prisma client singleton import check (`src/lib/prisma.ts` does not execute eager `$connect()` or throw on import)
    - User stats calculation check (`/api/user/stats` conforms to `NextRequest` typing and handles auth)
    - Relational integrity check (Deck-to-card cascade delete, User audit timestamps, compound SRS indexes)
  - **Tier 4: Real-World Application Scenarios (Study Workflow)** (12 tests):
    - Deck creation -> Card addition -> SM-2 due cards retrieval -> Review rating calculation -> Next review date update -> 1.30 EF clamp.

## Feature Inventory Mapping
| # | Feature Under Test | Source Requirement | Tier | Test File / Target | Status |
|---|--------------------|-------------------|:----:|--------------------|:------:|
| 1 | TypeScript Compilation Zero Errors | ORIGINAL_REQUEST § Acceptance Criteria | 1 | `tests/e2e/tier1-commands.test.mjs` | VERIFIED |
| 2 | ESLint Zero Errors & Warnings | ORIGINAL_REQUEST § Acceptance Criteria | 1 | `tests/e2e/tier1-commands.test.mjs` | VERIFIED |
| 3 | Prisma Schema Valid Definition | ORIGINAL_REQUEST § Acceptance Criteria | 1 | `tests/e2e/tier1-commands.test.mjs` | VERIFIED |
| 4 | Next.js Production Build | ORIGINAL_REQUEST § Acceptance Criteria | 1 | `tests/e2e/tier1-commands.test.mjs` | VERIFIED |
| 5 | Card Authorization & IDOR Guard | PROJECT.md F11, Explorer 2/3 Survey | 2 | `tests/e2e/tier2-security.test.mjs` | VERIFIED |
| 6 | Deck Cards Authorization & IDOR | PROJECT.md F12, Explorer 2/3 Survey | 2 | `tests/e2e/tier2-security.test.mjs` | VERIFIED |
| 7 | Quiz Question Sanitization | PROJECT.md F14, Explorer 2/3 Survey | 2 | `tests/e2e/tier2-security.test.mjs` | VERIFIED |
| 8 | Quiz Anti-Replay & Server Grading | PROJECT.md F15, Explorer 2/3 Survey | 2 | `tests/e2e/tier2-security.test.mjs` | VERIFIED |
| 9 | Prisma Singleton Lazy Connect | PROJECT.md F6, Explorer 1/2 Survey | 3 | `tests/e2e/tier3-integration.test.mjs` | VERIFIED |
| 10| User Stats API Request Contract | PROJECT.md F1, Explorer 1/3 Survey | 3 | `tests/e2e/tier3-integration.test.mjs` | VERIFIED |
| 11| SM-2 Study Workflow & Due Cards | PROJECT.md F17, Explorer 3 Survey | 4 | `tests/e2e/tier4-workflow.test.mjs` | VERIFIED |

## Milestones
| # | Name | Scope | Dependencies | Status | Key Outputs |
|---|------|-------|-------------|--------|-------------|
| E2E-M1 | E2E Suite & Infrastructure Creation | Test runner, Tiers 1-4 tests, TEST_INFRA.md, TEST_READY.md | none | DONE | 49 automated tests in `tests/e2e/**`, `TEST_INFRA.md`, `TEST_READY.md` |

## Files Owned
- `tests/**`
- `TEST_INFRA.md`
- `TEST_READY.md`

## Interface Contracts
- Command `node tests/e2e/runner.mjs` executes all tiers.
- Runner can execute individual tier via `node tests/e2e/runner.mjs --tier=N` (or comma-separated tiers).
- Reports pass/fail breakdown and outputs exit code 0 on full success, non-zero on failure.
