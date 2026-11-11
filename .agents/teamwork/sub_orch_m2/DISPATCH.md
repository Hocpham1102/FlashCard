## 2026-11-10T13:18:16Z
You are the Sub-orchestrator for Milestone 2: Prisma & Database Hardening.
Working directory: e:\GitHub\FlashCard
State folder: e:\GitHub\FlashCard\.agents\teamwork\sub_orch_m2\
Scope document: e:\GitHub\FlashCard\.agents\teamwork\sub_orch_m2\SCOPE.md
Project document: e:\GitHub\FlashCard\.agents\teamwork\orchestrator\PROJECT.md
Original request path: e:\GitHub\FlashCard\.agents\teamwork\ORIGINAL_REQUEST.md
Survey reports:
- Explorer 2: e:\GitHub\FlashCard\.agents\teamwork\teamwork_explorer_survey_2\handoff.md & analysis.md
Parent conversation ID: ae213754-cba6-4513-8ef8-f6b2276aa585

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Mission:
Execute the database and Prisma hardening of Milestone 2 per the Project Pattern:
1. Scope boundaries & owned files:
   - Create `.env.example` documenting all required variables (`DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY`). Also provide local fallback defaults or setup instruction so `npx prisma validate` runs cleanly.
   - `src/lib/prisma.ts`: Refactor to a safe, lazy singleton. Remove eager top-level `prisma.$connect()` that caused 16 connection errors during build. Configure proper connection pooling params.
   - `prisma/schema.prisma`:
     - Add `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt` to `User` model.
     - Add index `@@index([deckId, nextReview])` to `Card` model.
     - Add foreign key index on `Account(userId)` and `Session(userId)`.
     - Link `QuizAnswer` relation to `Card` and add `@@index([cardId])`.
   - `src/app/api/admin/stats/route.ts`: Update user sorting to sort by `createdAt: "desc"` instead of `emailVerified: "desc"`.
   - `prisma/migrations/**`: Generate a comprehensive baseline migration representing all models and fields so production deployment or CI migration runner will succeed.
2. Procedure:
   Dispatch Worker (`teamwork_worker`) to implement these changes and verify via `npx prisma validate` and `node node_modules/prisma/build/index.js generate`.
   Then dispatch Reviewer (`teamwork_reviewer`), Challenger (`teamwork_challenger`), and Forensic Auditor (`teamwork_auditor`).
   Enforce gate pass criteria:
   - `npx prisma validate` exits with 0 errors.
   - Prisma Client generates cleanly without errors.
   - No eager connection failures when importing `src/lib/prisma.ts`.
   - Auditor verdict is CLEAN.
3. When gate passes, write your handoff report and send a message back to parent (`ae213754-cba6-4513-8ef8-f6b2276aa585`).
