# Spec Miner Tier 2 Dispatch
Assigned task: Investigate and specify Tier 2 boundary and security vulnerability checks (IDOR, quiz leakage, quiz anti-replay).


## 2026-11-10T13:20:06Z
You are the E2E Tier 2 Spec Miner for the FlashCard project under the Dual Track architecture.
Working directory: e:\GitHub\FlashCard
State folder: e:\GitHub\FlashCard\.agents\teamwork\spec_miner_e2e_tier2\
Original request path: e:\GitHub\FlashCard\.agents\teamwork\ORIGINAL_REQUEST.md
Project document: e:\GitHub\FlashCard\.agents\teamwork\orchestrator\PROJECT.md
Scope document: e:\GitHub\FlashCard\.agents\teamwork\sub_orch_e2e\SCOPE.md

MANDATORY: You MUST read ORIGINAL_REQUEST.md before starting work.
DO NOT CHEAT. All test specifications must be genuine and verifiable.

Your Objective:
Investigate and design the exact specifications for Tier 2: Boundary & Security Vulnerability Checks of the E2E test suite.
Specifically:
1. Examine the API endpoints and route handlers:
   - `src/app/api/cards/[id]/route.ts` (PUT, DELETE authorization & IDOR)
   - `src/app/api/decks/[id]/cards/route.ts` (GET private deck, POST card IDOR)
   - `src/app/api/cards/[id]/review/route.ts` (Review session & ownership check)
   - `src/app/api/quiz/generate/route.ts` (Prevent leakage of `correctAnswer` and `isCorrect`)
   - `src/app/api/quiz/submit/route.ts` (Anti-replay for completed sessions and server-side verification of answers)
2. Specify opaque-box and contract test cases for these endpoints:
   - What inputs to provide (unauthenticated requests, unauthorized user session requests, valid owner requests).
   - What status codes and error messages must be returned (401 Unauthorized, 403 Forbidden, 404 Not Found, 400 Bad Request).
   - How response payloads must be inspected (verifying question choices contain only `{ id, text }` with no `isCorrect` or `correctAnswer`).
   - How anti-replay must be verified (re-submitting a payload to an already completed quizSession returns 400).
3. Design how the test suite in `tests/e2e/tier2-security.test.mjs` can execute these tests in Node.js:
   - Direct handler invocation with mocked `NextRequest` and session context OR local HTTP test server.
   - Clean, robust assertion mechanisms without requiring live external OAuth / Supabase network calls.
4. Document the complete findings and test specification in `e:\GitHub\FlashCard\.agents\teamwork\spec_miner_e2e_tier2\handoff.md`.
5. Send a message to your parent upon completion with the path to your handoff report.
