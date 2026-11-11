# FlashCard E2E Test Suite Readiness Report (`TEST_READY.md`)

## 1. Executive Summary

The automated, opaque-box E2E test suite for FlashCard has been fully implemented, verified, and integrated into the project root. The test suite adheres strictly to the Dual Track Testing Architecture, providing complete opaque-box coverage across build health, security controls, cross-feature contracts, and the SM-2 spaced repetition study loop.

- **Total Test Cases**: 49 independent automated tests
- **Tiers Covered**: 4 tiers (Core Commands, Security & Boundaries, Cross-Feature Integration, SM-2 Study Workflow)
- **Central Runner**: `tests/e2e/runner.mjs`
- **Infrastructure Guide**: `TEST_INFRA.md`

---

## 2. Test Execution Commands

```powershell
# 1. Execute all test suites across all 4 tiers
node tests/e2e/runner.mjs

# 2. Execute individual tiers
node tests/e2e/runner.mjs --tier=1      # Tier 1: Core Command Acceptance (5 tests)
node tests/e2e/runner.mjs --tier=2      # Tier 2: Boundary & Security Checks (22 tests)
node tests/e2e/runner.mjs --tier=3      # Tier 3: Cross-Feature Integration (10 tests)
node tests/e2e/runner.mjs --tier=4      # Tier 4: SM-2 Study Workflow (12 tests)

# 3. Combine specific tiers
node tests/e2e/runner.mjs --tier=1,3,4
node tests/e2e/runner.mjs --tier=3,4

# 4. Command line flags
node tests/e2e/runner.mjs --verbose     # Display granular assertion details
node tests/e2e/runner.mjs --bail        # Halt execution on first failing test
node tests/e2e/runner.mjs --help        # Display CLI usage manual
```

---

## 3. Tier Breakdown & Test Inventory

### Tier 1: Core Command Acceptance Checks (`tests/e2e/tier1-commands.test.mjs`)
*Scope: Non-negotiable acceptance criteria from ORIGINAL_REQUEST.md*
- **1.1 Next.js Configuration Integrity**: Asserts that `next.config.mjs` does not enable `ignoreBuildErrors: true` or `ignoreDuringBuilds: true`.
- **1.2 TypeScript Static Compilation**: Executes `tsc --noEmit` and verifies 0 compile errors.
- **1.3 ESLint Static Analysis**: Executes `next lint --max-warnings 0` and verifies 0 errors and 0 warnings.
- **1.4 Prisma Schema AST Validation**: Executes `prisma validate` with fallback env vars and verifies valid schema.
- **1.5 Next.js Production Build**: Executes `next build` verifying exit code 0 and valid `.next/BUILD_ID` artifact.

### Tier 2: Boundary & Security Vulnerability Checks (`tests/e2e/tier2-security.test.mjs`)
*Scope: Authorization, IDOR, data leakage, and anti-replay verification via in-memory route sandbox*
- **2.1 Card PUT Unauthenticated Guard**: Rejects unauthenticated PUT with HTTP 401.
- **2.2 Card PUT Non-Existent Target**: Returns HTTP 404 for unknown card cuid.
- **2.3 Card PUT IDOR Protection**: Blocks non-owner modification with HTTP 403; database record unchanged.
- **2.4 Card PUT Authorized Update**: Permits owner modification with HTTP 200; updates card in database.
- **2.5 Card DELETE Unauthenticated Guard**: Rejects unauthenticated DELETE with HTTP 401.
- **2.6 Card DELETE Non-Existent Target**: Returns HTTP 404 for unknown card cuid.
- **2.7 Card DELETE IDOR Protection**: Blocks non-owner deletion with HTTP 403; card remains in database.
- **2.8 Card DELETE Authorized Deletion**: Permits owner deletion with HTTP 200; decrements deck `cardCount`.
- **2.9 Deck Cards GET Private Deck Guard**: Rejects unauthenticated access to private deck with HTTP 401.
- **2.10 Deck Cards GET Private Deck IDOR**: Rejects non-owner access to private deck with HTTP 403.
- **2.11 Deck Cards GET Public Deck Access**: Permits open access to public deck with HTTP 200.
- **2.12 Deck Cards GET Non-Existent Deck**: Returns HTTP 404 for non-existent deck.
- **2.13 Deck Cards POST Unauthenticated Guard**: Rejects unauthenticated card creation with HTTP 401.
- **2.14 Deck Cards POST IDOR Protection**: Blocks non-owner card insertion into another user's deck with HTTP 403.
- **2.15 Deck Cards POST Input Validation**: Rejects empty `front` or missing `back` with HTTP 400.
- **2.16 Deck Cards POST Authorized Creation**: Permits owner card creation with HTTP 201; increments deck `cardCount`.
- **2.17 Card Review Unauthenticated Guard**: Rejects unauthenticated study review with HTTP 401.
- **2.18 Card Review Non-Existent Target**: Returns HTTP 404 for unknown card cuid.
- **2.19 Card Review IDOR Protection**: Blocks non-owner review with HTTP 403; card SM-2 state unchanged.
- **2.20 Quiz Question Confidentiality (0% Leakage)**: Generates MCQ quiz and verifies 0 occurrences of `correctAnswer` or `isCorrect` in response payload.
- **2.21 Quiz Server-Side Grading**: Rejects client-forged `isCorrect: true`; independently computes score against database.
- **2.22 Quiz Anti-Replay Guard**: Rejects resubmission on an already completed session (`completedAt != null`) with HTTP 400.

### Tier 3: Cross-Feature Integration Checks (`tests/e2e/tier3-integration.test.mjs`)
*Scope: Inter-module contracts, schema integrity, and runtime typings*
- **3.1 Prisma Singleton Lazy Code Structure**: Asserts absence of top-level `.$connect()` in `src/lib/prisma.ts`.
- **3.2 Prisma Singleton Isolated Import**: Asserts silent import of `prisma.ts` with dummy env without connection error logs.
- **3.3 User Stats Handler Signature**: Confirms `GET(request: NextRequest)` typing preventing TS2322 compile error.
- **3.4 User Stats Auth Gate**: Confirms unauthenticated requests are rejected with HTTP 401 Unauthorized.
- **3.5 Gamification Contract**: Validates XP-to-level curves (Levels 1, 2, 3) and progress percentage calculations.
- **3.6 Relational Schema Deck Cascade**: Validates `Card.deck` relation specifies `onDelete: Cascade` in DMMF.
- **3.7 Relational Schema Review Cascade**: Validates `CardReview.card` and `user` relations specify `onDelete: Cascade` in DMMF.
- **3.8 Relational Schema Audit Timestamps**: Validates `User` model defines `createdAt` and `updatedAt` in DMMF.
- **3.9 Relational Schema SRS Index**: Validates `Card` model declares compound index `@@index([deckId, nextReview])`.
- **3.10 Relational Schema Foreign Key Indexes**: Validates foreign key indexes on `Account`, `Session`, and `QuizAnswer`.

### Tier 4: SM-2 SRS Study Workflow Checks (`tests/e2e/tier4-workflow.test.mjs`)
*Scope: End-to-end spaced repetition learning loop and mathematical accuracy*
- **4.1 Initial Provisioning**: Validates initial card SRS fields (`easeFactor = 2.5`, `interval = 0`, `repetitions = 0`, `nextReview <= now`).
- **4.2 Due Cards Retrieval**: Validates query `where: { deckId, nextReview: { lte: now } }` strictly isolates target deck and returns only due cards.
- **4.3 Review Rating 0 ('Again')**: Validates repetition reset to 0, interval set to 1 day, and easeFactor decreased to 1.70.
- **4.4 Review Rating 3 ('Good')**: Validates repetition incremented to 1, interval set to 1 day, and easeFactor calculated as 2.36.
- **4.5 Review Rating 5 ('Easy')**: Validates repetition incremented to 1, interval set to 1 day, and easeFactor increased to 2.60 (+0.10).
- **4.6 Immediate Due Exclusion**: Validates that all reviewed cards with `interval > 0` are immediately excluded from subsequent due queries.
- **4.7 Multi-Day Progression (Day 2)**: Validates second consecutive rating 5 expands interval to 6 days (`repetitions = 2`, `easeFactor = 2.70`).
- **4.8 Exponential Interval Progression (Day 8)**: Validates third consecutive rating 5 scales interval exponentially to 17 days via `Math.round(6 * 2.8)`.
- **4.9 Post-Mastery Lapse Reset**: Validates forgotten mature card (`quality = 0`) resets repetitions to 0 and interval to 1 day.
- **4.10 Ease Factor Floor Clamping**: Validates that consecutive failures strictly clamp easeFactor at the minimum 1.30 floor.
- **4.11 Review Input Range Enforcement**: Validates that rating values outside 0..5 or non-numbers are rejected with HTTP 400.
- **4.12 Study API Query Filter Contract**: Inspects `/api/decks/[id]/study` source code to verify due timestamp filtering.

---

## 4. Current Baseline Execution Status

| Tier | File | Total | Passed | Failed | Status | Notes |
|:----:|------|:-----:|:------:|:------:|:------:|-------|
| **1** | `tests/e2e/tier1-commands.test.mjs` | 5 | 5 | 0 | **PASSED (100%)** | Verified across `tsc`, `lint`, `prisma validate`, `next build` |
| **2** | `tests/e2e/tier2-security.test.mjs` | 22 | 7 | 15 | **EXPECTED FAIL (32%)** | 15 security failures accurately detect absent IDOR/auth checks; will turn green in Milestone M3 |
| **3** | `tests/e2e/tier3-integration.test.mjs` | 10 | 10 | 0 | **PASSED (100%)** | Verified lazy Prisma client, TS typing, and DMMF schema relations |
| **4** | `tests/e2e/tier4-workflow.test.mjs` | 12 | 12 | 0 | **PASSED (100%)** | Verified full SM-2 algorithm, intervals, due queries, and edge cases |
| **Total** | **All Suites** | **49** | **34** | **15** | **READY FOR REMEDIATION** | Opaque-box test suite actively guards all critical requirements |

---

## 5. Coverage Checklist (Mapped to Project Features)

- [x] **Feature 1**: TypeScript Compile Error (`src/app/api/user/stats/route.ts`) -> Tested in Tier 1 (1.2) & Tier 3 (3.3).
- [x] **Feature 2**: ESLint Quality Fixes -> Tested in Tier 1 (1.3).
- [x] **Feature 3**: Package Scripts & Typecheck -> Tested in Tier 1 (1.2).
- [x] **Feature 4**: Build Configuration Integrity (no error masking) -> Tested in Tier 1 (1.1, 1.5).
- [x] **Feature 6**: Prisma Client Singleton (lazy initialization) -> Tested in Tier 3 (3.1, 3.2).
- [x] **Feature 7**: User Model Audit Timestamps (`createdAt`, `updatedAt`) -> Tested in Tier 3 (3.8).
- [x] **Feature 8**: Database Relations & Indexes (compound index, foreign keys) -> Tested in Tier 3 (3.6, 3.7, 3.9, 3.10).
- [x] **Feature 11**: Card Authorization & IDOR Fix (`/api/cards/[id]`) -> Tested in Tier 2 (2.1 - 2.8).
- [x] **Feature 12**: Deck Cards IDOR & Privacy (`/api/decks/[id]/cards`) -> Tested in Tier 2 (2.9 - 2.16).
- [x] **Feature 13**: Card Review Auth Fix (`/api/cards/[id]/review`) -> Tested in Tier 2 (2.17 - 2.19) & Tier 4 (4.11).
- [x] **Feature 14**: Quiz Question Sanitization (`/api/quiz/generate`) -> Tested in Tier 2 (2.20).
- [x] **Feature 15**: Quiz Grading & Anti-Replay (`/api/quiz/submit`) -> Tested in Tier 2 (2.21, 2.22).
- [x] **Feature 17**: Spaced Repetition Study Flow & Due Cards -> Tested in Tier 4 (4.1 - 4.12).
- [x] **Acceptance Criteria R1 & R2**: Full verification suite complete.
