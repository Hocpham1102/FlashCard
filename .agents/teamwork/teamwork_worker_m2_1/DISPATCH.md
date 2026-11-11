## 2026-11-10T13:27:15Z
MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Read ORIGINAL_REQUEST.md at: e:\GitHub\FlashCard\.agents\teamwork\ORIGINAL_REQUEST.md
Read PROJECT.md at: e:\GitHub\FlashCard\.agents\teamwork\orchestrator\PROJECT.md
Read SCOPE.md at: e:\GitHub\FlashCard\.agents\teamwork\sub_orch_m2\SCOPE.md

Read Explorer & Spec Miner handoffs and reports:
- Schema & Route Explorer: e:\GitHub\FlashCard\.agents\teamwork\teamwork_explorer_m2_1\handoff.md and analysis.md
- Prisma Client & Env Explorer: e:\GitHub\FlashCard\.agents\teamwork\teamwork_explorer_m2_2\handoff.md and analysis.md
- Prisma Migration Spec Miner: e:\GitHub\FlashCard\.agents\teamwork\teamwork_spec_miner_m2_1\handoff.md and analysis.md

Your role: Worker for Milestone 2 (Database & Prisma Hardening)
Working directory: e:\GitHub\FlashCard
State folder: e:\GitHub\FlashCard\.agents\teamwork\teamwork_worker_m2_1\

Write Ownership (You own ONLY these files exclusively):
- `.env.example`
- `src/lib/prisma.ts`
- `prisma/schema.prisma`
- `src/app/api/admin/stats/route.ts`
- `prisma/migrations/**`

Task Instructions:
1. Create `.env.example` at the project root documenting all 8 required project environment variables (`DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY`, and `NODE_ENV`). Provide realistic local fallback placeholders so `npx prisma validate` runs cleanly.
2. Update `prisma/schema.prisma`:
   - `User` model: Add `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`.
   - `Card` model: Add composite index `@@index([deckId, nextReview])` and back-relation `quizAnswers QuizAnswer[]`.
   - `Account` model: Add index `@@index([userId])`.
   - `Session` model: Add index `@@index([userId])`.
   - `QuizAnswer` model: Add relation `card Card @relation(fields: [cardId], references: [id], onDelete: Cascade)` and `@@index([cardId])`.
   - Format schema using `npx prisma format`.
3. Refactor `src/lib/prisma.ts`:
   - Remove eager top-level `prisma.$connect()`.
   - Implement safe lazy singleton using `globalThis.prismaGlobal`.
   - CRITICAL: Export BOTH named and default (`export const prisma = ...; export default prisma;`) to maintain 100% compatibility with all 23 consumer files in `src/`.
4. Update `src/app/api/admin/stats/route.ts`:
   - Change user sorting to `createdAt: "desc"` (replacing `emailVerified: "desc"`).
   - Ensure `createdAt: true` is included in the select projection.
5. Generate baseline migration in `prisma/migrations`:
   - Clean up the obsolete partial migration `20260424102124_add_user_role` and generate a complete baseline migration representing the entire schema at `prisma/migrations/0_init/migration.sql` using:
     `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script --output prisma/migrations/0_init/migration.sql`
   - Ensure `prisma/migrations/migration_lock.toml` is present with `provider = "postgresql"`.
6. Run Verification Commands:
   - `npx prisma validate`
   - `node node_modules/prisma/build/index.js generate` (or `npx prisma generate`)
   - Test lazy prisma loading without database errors: `node -e "const jiti = require('jiti')(process.cwd()); const { prisma } = jiti('./src/lib/prisma'); console.log('Prisma loaded successfully:', typeof prisma);"`
   - `npx tsc --noEmit` to verify all TypeScript types compile cleanly.

Record all code changes in `e:\GitHub\FlashCard\.agents\teamwork\teamwork_worker_m2_1\changes.md` and write a self-contained `handoff.md` in your state folder documenting the exact verification results and commands.
When complete, send a message back to sub-orchestrator.
