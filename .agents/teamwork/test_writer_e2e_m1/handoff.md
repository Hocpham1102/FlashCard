# Handoff Report: E2E Acceptance Test Suite Implementation

**Module**: End-to-End Testing Track (FlashCard)  
**Author**: E2E Test Suite Author (`test_writer_e2e_m1`)  
**Target Files Owned**:
- `tests/e2e/helpers/exec.mjs`
- `tests/e2e/runner.mjs`
- `tests/e2e/tier1-commands.test.mjs`
- `tests/e2e/tier2-security.test.mjs`
- `tests/e2e/tier3-integration.test.mjs`
- `tests/e2e/tier4-workflow.test.mjs`
- `TEST_INFRA.md`
- `TEST_READY.md`
**Timestamp**: 2026-11-10T13:43:00Z  

---

## 1. Observation

1. **System & Framework Environment**:
   - Environment: Windows, Node.js v20.19.0.
   - Project dependencies: Next.js 14.2.35, TypeScript 5.9.3, Prisma ORM 5.22.0.
   - Requirements: `ORIGINAL_REQUEST.md` (R1, R2, Acceptance Criteria), `PROJECT.md` Feature Inventory (Features 1-18), and Spec Miner reports.

2. **Node 20 Windows Spawning Behavior**:
   - Executing `.cmd` processes (such as `npx.cmd`) directly via `spawnSync('npx.cmd', ...)` throws `Error: spawnSync npx.cmd EINVAL` due to Node CVE-2024-27980 protection.
   - Direct execution of binary scripts using `process.execPath` (e.g. `node_modules/typescript/bin/tsc`) or setting `shell: true` resolves without `EINVAL`.
   - Process tree timeouts on Windows require `taskkill /pid <pid> /f /t` to avoid leaving orphaned `node.exe` worker processes holding file locks on `.next/trace`.

3. **Verbatim Test Run Outputs**:
   - **Tier 1 (`node tests/e2e/runner.mjs --tier=1`)**:
     - `1.1 Next.js config disables ignoreBuildErrors and ignoreDuringBuilds` -> PASS (1ms)
     - `1.2 TypeScript compilation check (tsc --noEmit) with 0 errors` -> PASS (1949ms)
     - `1.3 ESLint static analysis check (next lint --max-warnings 0)` -> PASS (5071ms)
     - `1.4 Prisma schema validation (prisma validate) with 0 errors` -> PASS (637ms)
     - `1.5 Next.js production build check (next build)` -> PASS (41932ms, generated valid `BUILD_ID`)
     - Result: 5/5 passed (100%).
   - **Tier 2 (`node tests/e2e/runner.mjs --tier=2`)**:
     - Baseline functional assertions PASS: 2.4 (owner card update), 2.6 (target card 404), 2.8 (owner card delete), 2.11 (public deck access), 2.15 (missing fields 400), 2.16 (owner card addition), 2.18 (target review card 404).
     - Security & IDOR assertions FAIL: 15 tests correctly fail because Milestone M3 has not yet added auth checks (`getServerSession`), quiz answer stripping (`correctAnswer`/`isCorrect` leakage in `/api/quiz/generate`), server-side grading, or anti-replay checks in `/api/quiz/submit`.
     - Result: 7/22 passed (32%), 15 failing precisely on expected security vulnerabilities.
   - **Tier 3 (`node tests/e2e/runner.mjs --tier=3`)**:
     - 3.1: Prisma singleton source eliminates top-level `.$connect()` -> PASS
     - 3.2: Prisma singleton isolated import with dummy env succeeds -> PASS
     - 3.3: User stats handler parameter conforms to `NextRequest` -> PASS
     - 3.4: User stats unauthenticated request rejected with 401 -> PASS
     - 3.5: Gamification contract XP/level curves -> PASS
     - 3.6: Deck -> Card relation specifies `onDelete: Cascade` in DMMF -> PASS
     - 3.7: CardReview relations specify `onDelete: Cascade` in DMMF -> PASS
     - 3.8: User model contains `createdAt` and `updatedAt` in DMMF -> PASS
     - 3.9: Card model defines compound index `[deckId, nextReview]` -> PASS
     - 3.10: Foreign key indexes defined on Account, Session, QuizAnswer -> PASS
     - Result: 10/10 passed (100%).
   - **Tier 4 (`node tests/e2e/runner.mjs --tier=4`)**:
     - 4.1: Initial card SRS defaults (`EF=2.5`, `interval=0`, `repetitions=0`, `nextReview<=now`) -> PASS
     - 4.2: Due cards query filters by `deckId` and `nextReview <= now` -> PASS
     - 4.3: Rating 0 ('Again') resets repetitions to 0, sets interval to 1d, EF to 1.70 -> PASS
     - 4.4: Rating 3 ('Good') sets rep=1, interval=1d, EF=2.36 -> PASS
     - 4.5: Rating 5 ('Easy') sets rep=1, interval=1d, EF=2.60 (+0.10) -> PASS
     - 4.6: Reviewed cards strictly excluded from immediate due reviews (`nextReview > now`) -> PASS
     - 4.7: Day 2 rating 5 sets interval to 6 days (`rep=2`, `EF=2.70`) -> PASS
     - 4.8: Day 8 rating 5 scales interval exponentially to 17 days (`Math.round(6 * 2.8)`) -> PASS
     - 4.9: Post-mastery lapse resets repetitions to 0 and interval to 1 day -> PASS
     - 4.10: Ease factor floor clamps strictly at 1.30 across repeated failures -> PASS
     - 4.11: Review endpoint validates quality range (0..5) -> PASS
     - 4.12: Study API endpoint query filter contract -> PASS
     - Result: 12/12 passed (100%).

---

## 2. Logic Chain

1. **Test Runner & Process Spawning Safety**:
   - Windows Node 20 requires either direct binary invocation via `process.execPath` or `shell: true` for `.cmd` launchers (Observation 2).
   - By creating `tests/e2e/helpers/exec.mjs`, all child process invocations are safely dispatched with fallback environment variables (`DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`), multiplexed streams (`combinedOutput`), and process tree timeouts (`taskkill /pid <pid> /f /t`).
2. **Acceptance Criteria Verification (Tier 1)**:
   - `ORIGINAL_REQUEST.md` mandates zero errors across `tsc --noEmit`, `next lint`, `prisma validate`, and `next build`.
   - With M1 and M2 remediations in place, all static tools pass. Tier 1 dynamically verifies these tools and verifies that `next.config.mjs` contains no error-bypassing flags (`ignoreBuildErrors` / `ignoreDuringBuilds`).
3. **Genuine Security Testing (Tier 2)**:
   - Rather than creating facade mocks that always return 200, Tier 2 loads the real route handlers dynamically using TypeScript transpilation and evaluates them against an in-memory transactional database (`MockDb`) and session context.
   - The test suite correctly identifies the 15 unpatched security vulnerabilities discovered by the Explorers (Observation 3). This confirms test integrity: the tests assert the actual requirements and will turn green once Milestone M3 patches the vulnerabilities.
4. **Integration & Workflow Completeness (Tiers 3 & 4)**:
   - Tier 3 verifies structural contracts: lazy Prisma client initialization, `NextRequest` typing preventing TS2322, gamification progression math, and Prisma DMMF cascade/indexing attributes.
   - Tier 4 verifies the algorithmic accuracy and real-world behavior of the SM-2 spaced repetition system across single-day and multi-day repetition sequences.

---

## 3. Caveats

1. **Pending Milestone M3 Remediations**:
   - 15 out of 22 Tier 2 security tests currently fail because the route handlers (`src/app/api/cards/[id]/route.ts`, `src/app/api/decks/[id]/cards/route.ts`, `src/app/api/cards/[id]/review/route.ts`, `src/app/api/quiz/generate/route.ts`, `src/app/api/quiz/submit/route.ts`) have not yet been updated with authorization guards, answer stripping, and anti-replay logic.
   - This is expected in progressive milestone delivery. When M3 is executed, running `node tests/e2e/runner.mjs --tier=2` will directly verify the fixes.
2. **Windows File Locks on Repeated Builds**:
   - Running `next build` back-to-back in rapid succession can trigger an OS file lock on `.next/trace` or `.next/server`. Test 1.5 includes automated cleaning of `.next` prior to execution to prevent lock collisions.

---

## 4. Conclusion

The FlashCard E2E Test Suite is complete, verified, and operational.
- **49 Total Test Cases** across 4 tiers:
  - Tier 1: 5/5 PASSED (100%)
  - Tier 2: 7/22 PASSED (15 expected failures on unpatched M3 vulnerabilities)
  - Tier 3: 10/10 PASSED (100%)
  - Tier 4: 12/12 PASSED (100%)
- Root documentation published:
  - `TEST_INFRA.md`: Full architecture, methodology, security matrix, and CLI documentation.
  - `TEST_READY.md`: Suite readiness report, test inventory, baseline execution status, and feature coverage checklist.

---

## 5. Verification Method

To independently verify the test infrastructure and test suites, run the following commands:

```powershell
# 1. Run full test runner CLI (all 4 tiers)
node tests/e2e/runner.mjs

# 2. Run Tier 1 (Core Command Acceptance - 5 tests)
node tests/e2e/runner.mjs --tier=1

# 3. Run Tier 2 (Security & Boundary Checks - 22 tests)
node tests/e2e/runner.mjs --tier=2

# 4. Run Tier 3 (Cross-Feature Integration - 10 tests)
node tests/e2e/runner.mjs --tier=3

# 5. Run Tier 4 (SM-2 Study Workflow - 12 tests)
node tests/e2e/runner.mjs --tier=4

# 6. Verify individual test files standalone
node tests/e2e/tier3-integration.test.mjs
node tests/e2e/tier4-workflow.test.mjs
```
