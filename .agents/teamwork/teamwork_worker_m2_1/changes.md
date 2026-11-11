# Milestone 2 Implementation Changes Record

**Worker:** `teamwork_worker_m2_1`  
**Milestone:** Milestone 2 - Database & Prisma Hardening  
**Date:** 2026-11-10  

---

## 1. Summary of Changes

| File | Change Type | Summary of Modification |
|---|---|---|
| `.env.example` | Created | Documented all 8 required project environment variables (`DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY`, `NODE_ENV`) with realistic local fallback defaults. |
| `prisma/schema.prisma` | Modified | Added `createdAt` and `updatedAt` to `User` model; added composite index `@@index([deckId, nextReview])` and `quizAnswers QuizAnswer[]` back-relation to `Card` model; added `@@index([userId])` to `Account` and `Session` models; added `card Card @relation(...)` cascade relation and `@@index([cardId])` to `QuizAnswer` model; formatted with `npx prisma format`. |
| `src/lib/prisma.ts` | Modified | Eliminated eager top-level `prisma.$connect()`; implemented safe lazy singleton using `globalThis.prismaGlobal` with environment-aware logging (`query/error/warn` in dev, `error` in prod); exported BOTH named `export const prisma` and default `export default prisma` for 100% backward compatibility across all 23 consumers. |
| `src/app/api/admin/stats/route.ts` | Modified | Changed user query sorting to `orderBy: { createdAt: "desc" }` (replacing temporary `emailVerified: "desc"`); added `createdAt: true` to the `select` projection to fulfill frontend `DashboardStats.recentUsers` type contract. |
| `prisma/migrations/20260424102124_add_user_role/` | Deleted | Cleaned up obsolete partial migration that lacked 6 models and 10+ columns. |
| `prisma/migrations/0_init/migration.sql` | Created | Generated complete baseline PostgreSQL DDL migration (293 lines) representing the full declarative schema AST without live database connection using `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`. |
| `prisma/migrations/migration_lock.toml` | Verified / Maintained | Confirmed `provider = "postgresql"` is locked and present. |

---

## 2. Detailed File Diffs & Rationale

### 2.1 `.env.example`
- **Rationale:** Prisma CLI 5.22.0 requires both `DATABASE_URL` and `DIRECT_URL` in `datasource db`. NextAuth and Gemini AI features also require configured keys. Documenting these prevents build/validate failures and guides developers and CI environments.
- **Keys Documented:**
  - `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/flashcard?schema=public"`
  - `DIRECT_URL="postgresql://postgres:postgres@localhost:5432/flashcard?schema=public"`
  - `NEXTAUTH_URL="http://localhost:3000"`
  - `NEXTAUTH_SECRET="flashcard-development-secret-key-must-be-at-least-32-chars-long!"`
  - `AUTH_SECRET="flashcard-development-secret-key-must-be-at-least-32-chars-long!"`
  - `GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"`
  - `GOOGLE_CLIENT_SECRET="your-google-client-secret"`
  - `GEMINI_API_KEY="your-gemini-api-key-here"`
  - `NODE_ENV="development"`

### 2.2 `prisma/schema.prisma`
- **Rationale:**
  1. `User` timestamps (`createdAt`, `updatedAt`): Essential for user auditing, onboarding ordering, and sorting in admin endpoints.
  2. `Card` composite index (`@@index([deckId, nextReview])`): Directly accelerates spaced-repetition study queries (`where: { deckId, nextReview: { lte: now } }`) from $O(N)$ sequential or bitmap scans to direct B-tree range scans.
  3. `Account` & `Session` foreign key indexes (`@@index([userId])`): Prevents full table locks and sequential scans when deleting users or cascading sessions.
  4. `QuizAnswer` relation and index (`card Card @relation(...)`, `@@index([cardId])`): Ensures referential integrity with cascade delete, prevents orphan quiz answers when cards are removed, and accelerates card question analysis.
  5. Back-relation `quizAnswers QuizAnswer[]` on `Card`: Completes bidirectional Prisma relation contract.

### 2.3 `src/lib/prisma.ts`
- **Rationale:**
  1. Eager `$connect()` at module top-level triggered 15+ initialization errors during `next build` static page generation and serverless module evaluation when DB was offline.
  2. Prisma natively employs lazy connection semantics (connecting on first executed query).
  3. Dual exports (`export const prisma` and `export default prisma`) prevent breaking the 12 named import consumers and 11 default import consumers across the codebase.
  4. Using `globalThis.prismaGlobal` prevents connection leakages across Next.js HMR reloads in development.

### 2.4 `src/app/api/admin/stats/route.ts`
- **Rationale:**
  1. Sorting by `emailVerified: "desc"` broke recent user visibility because password-registered users have `emailVerified = null`.
  2. With `createdAt` now on `User`, sorting by `createdAt: "desc"` accurately displays recent registrations.
  3. Selecting `createdAt: true` satisfies `src/app/admin/page.tsx` interface `recentUsers: { ..., createdAt: string }[]`.

### 2.5 Baseline Migration (`prisma/migrations/0_init/migration.sql`)
- **Rationale:**
  1. The legacy migration `20260424102124_add_user_role` suffered from 50% schema drift (missing 6 tables and 10+ columns).
  2. Replacing it with `0_init/migration.sql` allows clean production provisioning (`npx prisma migrate deploy`) and clean marking of existing environments (`npx prisma migrate resolve --applied 0_init`).
  3. Generated via offline Wasm AST compilation (`prisma migrate diff`), requiring zero live database connectivity or shadow database.
