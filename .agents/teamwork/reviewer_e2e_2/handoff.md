# Handoff Report: E2E Acceptance Test Suite Review & Adversarial Challenge

**Module**: End-to-End Testing Track (FlashCard)  
**Author**: Reviewer 2 & Adversarial Critic (`reviewer_e2e_2`)  
**Target Files Reviewed**:
- `tests/e2e/tier2-security.test.mjs`
- `tests/e2e/runner.mjs`
- `tests/e2e/helpers/exec.mjs`
- `tests/e2e/tier1-commands.test.mjs`
- `tests/e2e/tier3-integration.test.mjs`
- `tests/e2e/tier4-workflow.test.mjs`
- `TEST_INFRA.md`
- `TEST_READY.md`
- Upstream handoff: `.agents/teamwork/test_writer_e2e_m1/handoff.md`
**Timestamp**: 2026-11-10T13:52:00Z  

---

## 1. Observation

### 1.1 Direct Inspection of Tier 2 Security Assertions (`tests/e2e/tier2-security.test.mjs`)
All 22 security assertions were inspected against the source requirements and target API handlers:

1. **Card IDOR on `/api/cards/[id]` (PUT & DELETE)**:
   - Line 519: Test 2.1 (PUT unauthenticated -> expects 401). Real route `src/app/api/cards/[id]/route.ts` lacks `getServerSession`. Received 200 -> Failed as expected.
   - Line 529: Test 2.2 (PUT target not found -> expects 404). Real route calls `prisma.card.update` which throws, caught into 500. Received 500 -> Failed as expected.
   - Line 539: Test 2.3 (PUT IDOR non-owner modification -> expects 403, verifies DB unmutated). Real route allows non-owner update. Received 200 -> Failed as expected.
   - Line 553: Test 2.4 (PUT authorized owner update -> expects 200, updates record). Passed (0ms).
   - Line 565: Test 2.5 (DELETE unauthenticated -> expects 401). Real route lacks session gate. Received 200 -> Failed as expected.
   - Line 572: Test 2.6 (DELETE target not found -> expects 404). Real route has `if (!card) return 404`. Passed (0ms).
   - Line 579: Test 2.7 (DELETE IDOR non-owner deletion -> expects 403, verifies DB record retained). Real route allows deletion. Received 200 -> Failed as expected.
   - Line 590: Test 2.8 (DELETE authorized owner deletion -> expects 200, verifies card removed & `deck.cardCount` decremented). Passed (0ms).

2. **Deck Cards Privacy & IDOR on `/api/decks/[id]/cards` (GET & POST)**:
   - Line 608: Test 2.9 (GET unauthenticated private deck -> expects 401). Real route `src/app/api/decks/[id]/cards/route.ts` lacks auth check. Received 200 -> Failed as expected.
   - Line 615: Test 2.10 (GET IDOR non-owner private deck -> expects 403). Real route allows reading private cards. Received 200 -> Failed as expected.
   - Line 622: Test 2.11 (GET public deck accessible anonymously -> expects 200). Passed (0ms).
   - Line 631: Test 2.12 (GET non-existent deck -> expects 404). Real route does not verify deck existence, returns empty array with 200. Received 200 -> Failed as expected.
   - Line 638: Test 2.13 (POST unauthenticated card creation -> expects 401). Real route lacks session gate. Received 201 -> Failed as expected.
   - Line 648: Test 2.14 (POST IDOR non-owner card creation -> expects 403). Real route lacks ownership validation. Received 201 -> Failed as expected.
   - Line 658: Test 2.15 (POST missing front/back validation -> expects 400). Passed (0ms).
   - Line 668: Test 2.16 (POST valid owner addition -> expects 201, verifies card created & `deck.cardCount` incremented). Passed (2ms).

3. **Card Review Authorization on `/api/cards/[id]/review` (POST)**:
   - Line 692: Test 2.17 (POST unauthenticated review -> expects 401). Real route `src/app/api/cards/[id]/review/route.ts` continues even if `userId` is missing. Received 200 -> Failed as expected.
   - Line 702: Test 2.18 (POST target card not found -> expects 404). Passed (0ms).
   - Line 712: Test 2.19 (POST IDOR non-owner review -> expects 403, verifies repetitions unmutated). Real route lacks ownership check. Received 200 -> Failed as expected.

4. **Quiz Question Sanitization on `/api/quiz/generate` (POST)**:
   - Line 729: Test 2.20 (0% leakage check on `correctAnswer` and `isCorrect`). Raw JSON regex check `/"correctAnswer"\s*:/` and `/"isCorrect"\s*:/`. Real route lines 86-98 returns options with `isCorrect` flag and `correctAnswer: card.back`. Regex triggered `true !== false` -> Failed as expected.

5. **Quiz Server-Side Grading & Anti-Replay on `/api/quiz/submit` (POST)**:
   - Line 760: Test 2.21 (Server-side grading against DB, ignoring client-forged `isCorrect: true`). Real route line 40 trusts `a.isCorrect`. Expected `correctCount: 0`, received `1` -> Failed as expected.
   - Line 802: Test 2.22 (Anti-replay rejection on already completed session `completedAt != null` -> expects 400). Real route line 21 ignores `completedAt`. Received 200 -> Failed as expected.

### 1.2 In-Memory Route Compilation & MockDb Sandbox
- `MockDb` (lines 32-389) accurately mirrors Prisma operations: `findUnique`, `findFirst`, `findMany` (including `{ id: { in: [...] } }`), `create`, `update` (including atomic `cardCount: { increment / decrement }`), `delete`, `quizAnswer.createMany`, and `$transaction` (both array and callback formats).
- State reset (`mockDb.reset()`) and session clearing (`setSessionUser(null)`) execute hermetically before every single test case (lines 488-490), ensuring 0% cross-test state pollution.
- `loadRouteHandler` (lines 400-460) dynamically transpiles the real Next.js App Router route files using `typescript.transpileModule` and CommonJS sandbox execution, injecting the `MockDb` Prisma client and NextAuth session interceptor without needing a live network or PostgreSQL database.

### 1.3 Verbatim Execution Commands & Outputs

#### Verification Command 1: `node tests/e2e/runner.mjs --tier=2`
```text
═══════════════════════════════════════════════════════════════════════════
  FLASHCARD E2E ACCEPTANCE TEST SUITE
  Tiers selected: [2] | Verbose: false | Bail: false
═══════════════════════════════════════════════════════════════════════════

▶ Tier 2: Boundary & Security Vulnerability Checks
  ✗ FAIL: 2.1 Card PUT: Unauthenticated request rejected with HTTP 401 (8ms)
  ✗ FAIL: 2.2 Card PUT: Target card not found returns HTTP 404 (1ms)
  ✗ FAIL: 2.3 Card PUT IDOR: Non-owner modification rejected with HTTP 403 (1ms)
  ✓ PASS: 2.4 Card PUT: Valid owner update succeeds with HTTP 200 and updates record (0ms)
  ✗ FAIL: 2.5 Card DELETE: Unauthenticated request rejected with HTTP 401 (1ms)
  ✓ PASS: 2.6 Card DELETE: Target card not found returns HTTP 404 (0ms)
  ✗ FAIL: 2.7 Card DELETE IDOR: Non-owner deletion rejected with HTTP 403 (1ms)
  ✓ PASS: 2.8 Card DELETE: Valid owner deletion succeeds with HTTP 200 and decrements deck cardCount (0ms)
  ✗ FAIL: 2.9 Deck Cards GET: Unauthenticated request on private deck rejected with HTTP 401 (1ms)
  ✗ FAIL: 2.10 Deck Cards GET IDOR: Non-owner access to private deck rejected with HTTP 403 (0ms)
  ✓ PASS: 2.11 Deck Cards GET: Public deck accessible without session (HTTP 200) (0ms)
  ✗ FAIL: 2.12 Deck Cards GET: Target deck not found returns HTTP 404 (1ms)
  ✗ FAIL: 2.13 Deck Cards POST: Unauthenticated card creation rejected with HTTP 401 (0ms)
  ✗ FAIL: 2.14 Deck Cards POST IDOR: Non-owner card addition to deck rejected with HTTP 403 (1ms)
  ✓ PASS: 2.15 Deck Cards POST: Missing front or back text rejected with HTTP 400 (0ms)
  ✓ PASS: 2.16 Deck Cards POST: Valid owner card addition succeeds with HTTP 201 and increments cardCount (2ms)
  ✗ FAIL: 2.17 Card Review: Unauthenticated review submission rejected with HTTP 401 (1ms)
  ✓ PASS: 2.18 Card Review: Target card not found returns HTTP 404 (0ms)
  ✗ FAIL: 2.19 Card Review IDOR: Non-owner reviewing card rejected with HTTP 403 (1ms)
  ✗ FAIL: 2.20 Quiz Generation: Strips correctAnswer and isCorrect with 0% leakage in response (1ms)
  ✗ FAIL: 2.21 Quiz Submit: Server-side grading validates against database, rejecting client-spoofed grades (1ms)
  ✗ FAIL: 2.22 Quiz Submit Anti-Replay: Re-submitting on already completed session rejected with HTTP 400 (1ms)

═══════════════════════════════════════════════════════════════════════════
TEST SUITE EXECUTION SUMMARY
  Total Tests : 22
  Passed      : 7
  Failed      : 15
  Duration    : 0.36s
═══════════════════════════════════════════════════════════════════════════
RESULT: FAILED (15 test(s) failed)
```

#### Verification Command 2: `node tests/e2e/runner.mjs --tier=3,4`
```text
═══════════════════════════════════════════════════════════════════════════
  FLASHCARD E2E ACCEPTANCE TEST SUITE
  Tiers selected: [3, 4] | Verbose: false | Bail: false
═══════════════════════════════════════════════════════════════════════════

▶ Tier 3: Cross-Feature Integration Checks
  ✓ PASS: 3.1 Prisma Singleton: Source code eliminates eager top-level .$connect() (1ms)
  ✓ PASS: 3.2 Prisma Singleton: Isolated import with dummy env succeeds without connection error (2042ms)
  ✓ PASS: 3.3 User Stats Route: Handler signature conforms to NextRequest (TS2322 prevention) (0ms)
  ✓ PASS: 3.4 User Stats Route: Unauthenticated request rejected with HTTP 401 (0ms)
  ✓ PASS: 3.5 Gamification Contract: XP level progression and percentage calculation (230ms)
  ✓ PASS: 3.6 Schema Relational Integrity: Deck -> Card relation specifies onDelete: Cascade (26ms)
  ✓ PASS: 3.7 Schema Relational Integrity: CardReview specifies onDelete: Cascade for Card & User (0ms)
  ✓ PASS: 3.8 Schema Audit Timestamps: User model contains createdAt and updatedAt (0ms)
  ✓ PASS: 3.9 Schema Index Optimization: Card defines composite index on [deckId, nextReview] (0ms)
  ✓ PASS: 3.10 Schema Index Optimization: Foreign key indexes defined on Account, Session, QuizAnswer (0ms)

▶ Tier 4: SM-2 SRS Study Workflow Checks
  ✓ PASS: 4.1 Initial Provisioning: Cards initialized with SRS defaults (0ms)
  ✓ PASS: 4.2 Due Cards Retrieval: Query strictly filters by deckId and nextReview <= now (1ms)
  ✓ PASS: 4.3 Review Rating 0 ('Again'): Resets repetitions and schedules next review in 1 day (1ms)
  ✓ PASS: 4.4 Review Rating 3 ('Good'): Advances repetitions to 1 and schedules review in 1 day (0ms)
  ✓ PASS: 4.5 Review Rating 5 ('Easy'): Advances repetitions to 1 and increases EF by +0.10 (0ms)
  ✓ PASS: 4.6 Immediate Due Exclusion: Reviewed cards are excluded from immediate due reviews (0ms)
  ✓ PASS: 4.7 Multi-Day Progression: Second consecutive rating 5 sets interval to 6 days (0ms)
  ✓ PASS: 4.8 Exponential Interval: Third consecutive rating 5 scales interval via Math.round(interval * EF) (0ms)
  ✓ PASS: 4.9 Lapse Handling: Forgotten mature card resets repetitions to 0 and interval to 1 day (0ms)
  ✓ PASS: 4.10 Ease Factor Floor: Consecutive failures clamp easeFactor strictly at 1.30 minimum (0ms)
  ✓ PASS: 4.11 Input Validation: Card review endpoint rejects quality < 0 or > 5 with HTTP 400 (0ms)
  ✓ PASS: 4.12 Study API Contract: /api/decks/[id]/study filters by nextReview <= now() (1ms)

═══════════════════════════════════════════════════════════════════════════
TEST SUITE EXECUTION SUMMARY
  Total Tests : 22
  Passed      : 22
  Failed      : 0
  Duration    : 2.33s
═══════════════════════════════════════════════════════════════════════════
RESULT: ALL TESTS PASSED (22/22)
```

#### Verification Command 3: `node tests/e2e/runner.mjs --tier=1`
```text
═══════════════════════════════════════════════════════════════════════════
  FLASHCARD E2E ACCEPTANCE TEST SUITE
  Tiers selected: [1] | Verbose: false | Bail: false
═══════════════════════════════════════════════════════════════════════════

▶ Tier 1: Core Command Acceptance Checks
  ✓ PASS: 1.1 Next.js config disables ignoreBuildErrors and ignoreDuringBuilds (1ms)
  ✓ PASS: 1.2 TypeScript compilation check (tsc --noEmit) with 0 errors (2355ms)
  ✓ PASS: 1.3 ESLint static analysis check (next lint --max-warnings 0) (5896ms)
  ✓ PASS: 1.4 Prisma schema validation (prisma validate) with 0 errors (721ms)
  ✓ PASS: 1.5 Next.js production build check (next build) (45640ms)

═══════════════════════════════════════════════════════════════════════════
TEST SUITE EXECUTION SUMMARY
  Total Tests : 5
  Passed      : 5
  Failed      : 0
  Duration    : 54.65s
═══════════════════════════════════════════════════════════════════════════
RESULT: ALL TESTS PASSED (5/5)
```

#### Verification Command 4: Standalone Execution Checks
- `node tests/e2e/tier3-integration.test.mjs` -> 10/10 PASS (1.95s, exit code 0)
- `node tests/e2e/tier4-workflow.test.mjs` -> 12/12 PASS (0.01s, exit code 0)
- `node tests/e2e/runner.mjs --tier=2 --bail` -> Immediately halts upon first failure with exit code 1.
- `node tests/e2e/runner.mjs --help` -> Successfully outputs CLI manual with exit code 0.

---

## 2. Logic Chain

1. **Integrity & Authenticity Check**:
   - The test suite was examined for integrity violations: hardcoded results, dummy facades, shortcuts, or fabricated outputs.
   - Inspection of `tests/e2e/tier2-security.test.mjs` confirms that all assertions execute against compiled route handlers. None of the assertions are hardcoded `true`.
   - The 15 failures in Tier 2 are **not** test bugs; they are genuine, accurate detections of the 15 known security and authorization gaps in the unpatched routes (`/api/cards/[id]`, `/api/decks/[id]/cards`, `/api/cards/[id]/review`, `/api/quiz/generate`, `/api/quiz/submit`), scheduled to be remediated in Milestone M3.
   - The baseline passes in Tier 2 (e.g. 2.4, 2.6, 2.8, 2.11, 2.15, 2.16, 2.18) prove that when inputs are valid and authorized, the handlers behave normally.
2. **Sandbox Fidelity & Isolation**:
   - `MockDb` implements transactional and relational capabilities matching the real Prisma Client without requiring an external database.
   - Route modules are re-compiled dynamically via TypeScript compiler API, completely isolating each test case from external state or previous runs.
3. **Execution Reliability**:
   - Process helper `tests/e2e/helpers/exec.mjs` provides robust protection on Windows (solving CVE-2024-27980 EINVAL, managing child process trees via `taskkill /pid <pid> /f /t`, and multiplexing stderr and stdout).
   - Tiers 1, 3, and 4 achieve 100% pass rates across their respective domains (build health, schema relations, and SRS study workflow).
4. **Documentation Alignment**:
   - `TEST_READY.md` accurately documents the 49 test cases, current baseline status (34 passed, 15 expected detections), and execution CLI options.
   - `TEST_INFRA.md` provides an accurate architecture blueprint.

---

## 3. Caveats & Adversarial Findings

1. **Expected Failure Gate on Tier 2**:
   - Tier 2 currently exits with code 1 (15 failed). This is the intended behavior of requirement-driven acceptance testing prior to Milestone M3 implementation. Milestone M3 implementers must use `node tests/e2e/runner.mjs --tier=2` as their verification gate to achieve 22/22 passes.
2. **Concurrent Build Collisions on Windows**:
   - Running multiple `next build` processes simultaneously in the same directory causes Windows file-locking collisions on `.next/build-manifest.json` and `.next/pages-manifest.json`. Standalone sequential execution of Tier 1 completes cleanly in ~45-55s.
3. **Ergonomic Recommendation (Minor)**:
   - `package.json` currently lacks a `"test"` script. Adding `"test": "node tests/e2e/runner.mjs"` will allow developers to run `npm test`.

---

## 4. Conclusion

**Verdict: APPROVE**

The E2E test suite implementation is verified, comprehensive, and of high quality.
- Zero integrity violations.
- Genuine assertions detecting real unpatched vulnerabilities in Milestone M3.
- In-memory route compilation and `MockDb` sandbox function reliably.
- CLI runner and documentation (`TEST_INFRA.md`, `TEST_READY.md`) are accurate and fully verified.

---

## 5. Verification Method

To independently reproduce and verify this review, execute the following commands in PowerShell from the repository root:

```powershell
# 1. Run Tier 2 Security & IDOR test suite (verifies 7 pass, 15 expected detections)
node tests/e2e/runner.mjs --tier=2

# 2. Run Tiers 3 & 4 Cross-Feature Integration and SRS Study Workflow (verifies 22/22 pass)
node tests/e2e/runner.mjs --tier=3,4

# 3. Run Tier 1 Core Command Acceptance suite (verifies 5/5 pass)
node tests/e2e/runner.mjs --tier=1

# 4. Verify standalone execution of integration and workflow files
node tests/e2e/tier3-integration.test.mjs
node tests/e2e/tier4-workflow.test.mjs

# 5. Verify CLI flags
node tests/e2e/runner.mjs --tier=2 --bail
node tests/e2e/runner.mjs --help
```
