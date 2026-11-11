## 2026-11-10T13:30:30Z
You are the E2E Test Suite Author for the FlashCard project under the Dual Track architecture.
Working directory: e:\GitHub\FlashCard
State folder: e:\GitHub\FlashCard\.agents\teamwork\test_writer_e2e_m1\
Original request path: e:\GitHub\FlashCard\.agents\teamwork\ORIGINAL_REQUEST.md
Project document: e:\GitHub\FlashCard\.agents\teamwork\orchestrator\PROJECT.md
Scope document: e:\GitHub\FlashCard\.agents\teamwork\sub_orch_e2e\SCOPE.md

Survey & Spec Miner Reports:
- Tier 1 Specification: e:\GitHub\FlashCard\.agents\teamwork\spec_miner_e2e_tier1\handoff.md
- Tier 2 Specification: e:\GitHub\FlashCard\.agents\teamwork\spec_miner_e2e_tier2\handoff.md
- Tier 3 & 4 Specification: e:\GitHub\FlashCard\.agents\teamwork\spec_miner_e2e_tier3_4\handoff.md

MANDATORY: You MUST read ORIGINAL_REQUEST.md before starting work.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write Ownership:
You own exclusively:
- `tests/e2e/**`
- `TEST_INFRA.md` (at project root)
- `TEST_READY.md` (at project root)

Your Mission:
Implement the comprehensive, opaque-box, requirement-driven E2E test suite for FlashCard based on the spec miner findings:

1. Test Execution Helper (`tests/e2e/helpers/exec.mjs`):
   - Cross-platform process spawn supporting Windows Node 20 (handling CVE-2024-27980 EINVAL, `.cmd` resolution, and tree termination on timeout).
   - Combines stdout and stderr streams so checks don't miss output.

2. Test Runner (`tests/e2e/runner.mjs`):
   - Central CLI entrypoint. Supports `--tier=1`, `--tier=2`, `--tier=3`, `--tier=4`, `--bail`, `--verbose`.
   - Runs test suites, tracks assertions and elapsed time, formats clear ANSI summary, and exits with code 0 on full success, non-zero if tests fail.

3. Tier 1 Test Suite (`tests/e2e/tier1-commands.test.mjs`):
   - Verifies TypeScript compilation (`tsc --noEmit`).
   - Verifies ESLint (`next lint` / `npm run lint`).
   - Verifies Prisma schema validation (`prisma validate` with fallback env vars).
   - Verifies Next.js config integrity (ensuring `ignoreBuildErrors` and `ignoreDuringBuilds` are disabled/removed).
   - Verifies Next.js production build (`next build`).

4. Tier 2 Test Suite (`tests/e2e/tier2-security.test.mjs`):
   - 22 security & boundary checks per `spec_miner_e2e_tier2/handoff.md`:
     * IDOR protection on `/api/cards/[id]` (PUT and DELETE: 401, 403, 404, 200).
     * IDOR protection on `/api/decks/[id]/cards` (GET private deck, POST: 401, 403, 404, 400, 200, 201).
     * Card Review authorization on `/api/cards/[id]/review` (400, 401, 403, 404, 200).
     * Quiz question sanitization on `/api/quiz/generate` (ensuring 0% leakage of `correctAnswer` or `isCorrect`).
     * Quiz anti-replay and server-side grading on `/api/quiz/submit` (rejecting client-spoofed grades, validating against DB, and rejecting repeat submissions on completed sessions with 400).
   - Uses the in-memory route compilation / mock architecture specified in `spec_miner_e2e_tier2/handoff.md`.

5. Tier 3 Test Suite (`tests/e2e/tier3-integration.test.mjs`):
   - Verifies lazy Prisma client singleton (`src/lib/prisma.ts` does not execute eager `$connect()` on isolated import).
   - Verifies `/api/user/stats` endpoint contract and NextRequest typing.
   - Verifies relational schema & cascade delete rules via Prisma DMMF.

6. Tier 4 Test Suite (`tests/e2e/tier4-workflow.test.mjs`):
   - Verifies real-world SM-2 SRS study workflow:
     * Deck creation -> initial cards setup.
     * Initial due cards retrieval (`nextReview <= now`).
     * Review rating submissions (0, 3, 5) and calculation of new interval / easeFactor per `sm2.ts`.
     * Exclusion of reviewed cards from immediate due reviews.
     * Multi-day repetition interval progression.

7. Create `TEST_INFRA.md` at project root documenting test philosophy, architecture, feature inventory mapping, 4-tier methodology, and runner commands.

8. Once all test suites are constructed and validated, create `TEST_READY.md` at project root summarizing runner commands, tier breakdown, test counts, and coverage checklist.

9. Execute the test runner (e.g. `node tests/e2e/runner.mjs`) to verify that the test runner executes properly, captures diagnostics, and produces structured output.

10. Document all created files, test execution results, and verification commands in `e:\GitHub\FlashCard\.agents\teamwork\test_writer_e2e_m1\handoff.md`. Send a completion message to your parent when finished.
