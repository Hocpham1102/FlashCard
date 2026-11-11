## 2026-11-10T13:54:18Z
You are the Sub-orchestrator for Milestone 3: Security & API Authorization.
Working directory: e:\GitHub\FlashCard
State folder: e:\GitHub\FlashCard\.agents\teamwork\sub_orch_m3\
Scope document: e:\GitHub\FlashCard\.agents\teamwork\sub_orch_m3\SCOPE.md
Project document: e:\GitHub\FlashCard\.agents\teamwork\orchestrator\PROJECT.md
Original request path: e:\GitHub\FlashCard\.agents\teamwork\ORIGINAL_REQUEST.md
Survey reports:
- Explorer 3: e:\GitHub\FlashCard\.agents\teamwork\teamwork_explorer_survey_3\handoff.md & analysis.md
Parent conversation ID: ae213754-cba6-4513-8ef8-f6b2276aa585

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Mission:
Remediate all security vulnerabilities, authorization gaps (IDOR), quiz answer leakage, infinite XP replay exploits, and unauthenticated card/deck mutations across the application per the Project Pattern:
1. Scope boundaries & owned files:
   - `src/middleware.ts`: Add `/api/cards/:path*` and `/profile` to matcher.
   - `src/app/api/cards/[id]/route.ts`: Enforce `getServerSession(authOptions)` and check deck ownership on PUT and DELETE.
   - `src/app/api/decks/[id]/cards/route.ts`: Enforce deck ownership for GET (private deck) and POST (creating cards).
   - `src/app/api/cards/[id]/review/route.ts`: Enforce authentication and deck ownership.
   - `src/app/api/quiz/generate/route.ts`: Strip `correctAnswer` and `isCorrect` before returning options to client.
   - `src/app/api/quiz/submit/route.ts`: Re-verify answers against card meaning/database on server, check `quizSession.completedAt === null` to block repeat submissions.
   - `src/app/api/ai/generate/route.ts`: Add input validation on `cardCount` (1-50) and handle rate limits/errors safely.
2. Procedure:
   Dispatch Worker (`teamwork_worker`) to implement the changes and verify via `npx tsc --noEmit`, `npm run lint`, and running Tier 2 security tests (`node tests/e2e/tier2-security.test.mjs`).
   Then dispatch Reviewers (2 `teamwork_reviewer`), Challengers (2 `teamwork_challenger`), and Forensic Auditor (`teamwork_auditor`).
   Enforce gate pass criteria:
   - All tests pass (tsc, lint, security checks).
   - Reviewers APPROVE.
   - Challengers APPROVE.
   - Forensic Auditor CLEAN.
3. When gate passes, write your handoff report and send a message back to parent (`ae213754-cba6-4513-8ef8-f6b2276aa585`).
