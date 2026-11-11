# Challenge Report: Milestone 2 - Stress & Boundary Verification

**Author:** `teamwork_challenger_m2_2` (Challenger 2 - Stress & Boundary Verifier)  
**Milestone:** Milestone 2 (Database Schema & Persistence Layer)  
**Target:** Worker `teamwork_worker_m2_1` Deliverables  
**Date:** 2026-11-10  

---

## Challenge Summary

**Overall risk assessment**: **LOW**

All Milestone 2 deliverables produced by `teamwork_worker_m2_1` are genuine, syntactically correct, and robust against adversarial boundary conditions:
1. **Migration SQL Rigor & Parity**:
   - `prisma/migrations/0_init/migration.sql` complies 100% with PostgreSQL dialect standards.
   - All 12 tables, 1 enum (`UserRole`), 24 indexes/uniques (including the composite index `Card_deckId_nextReview_idx`), and 13 foreign keys with `ON DELETE CASCADE ON UPDATE CASCADE` are verified.
   - Declarative parity between `prisma/schema.prisma` and `prisma/migrations/0_init/migration.sql` was verified byte-for-byte (exact 9,533-character match against declarative AST generation).
2. **Migration Diff CLI Behavior**:
   - When executing `npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-migrations prisma/migrations`, Prisma CLI intentionally fails with:
     `Error: You must pass the --shadow-database-url if you want to diff a migrations directory.`
   - This occurs because Prisma requires an active PostgreSQL shadow database to replay SQL migration scripts into an in-memory schema model.
   - Without a live shadow database, zero-drift verification is achieved via offline declarative AST comparison (`npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`), which proved a 100% exact match.
3. **Environment Resilience**:
   - `.env.example` documents all 9 environment variables actively referenced across `src/` and `prisma/` (`DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY`, `NODE_ENV`).
   - `npx prisma validate` executes with exit code 0 under dummy/placeholder URLs. Missing optional variables do not affect Prisma validation.
   - Stress testing verified that missing `DIRECT_URL` correctly yields Prisma error `P1012`, proving the necessity of documenting `DIRECT_URL`.
4. **Full TypeScript Typecheck**:
   - `npx tsc --noEmit` completes cleanly with **0 errors**.
   - `npm run lint` completes cleanly with **0 warnings and 0 errors**.
   - Prisma Client generated types (`node_modules/.prisma/client/index.d.ts`) were inspected and confirmed to include `createdAt` / `updatedAt` on `UserOrderByWithRelationInput`, `quizAnswers` on `CardInclude`, and `card` on `QuizAnswerInclude`.

---

## Challenges

### [Low] Challenge 1: Prisma Migrate Diff Against Raw SQL Directory Requires Shadow Database

- **Assumption challenged**: The command `npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-migrations prisma/migrations` can run offline without a database connection.
- **Attack scenario**: In an isolated build pipeline or offline developer workstation lacking a live PostgreSQL instance, executing `prisma migrate diff` pointing `--to-migrations` or `--from-migrations` throws `Error: You must pass the --shadow-database-url if you want to diff a migrations directory.`
- **Blast radius**: Low. Does not indicate schema drift; it is a known CLI limitation of Prisma's SQL replay mechanism.
- **Mitigation**: Document that in headless/offline environments without a shadow database, parity between the migration SQL and the schema is validated via declarative diff from empty:
  ```powershell
  npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
  ```
  Comparing this output against `prisma/migrations/0_init/migration.sql` demonstrates 100% parity (zero drift).

---

### [Low] Challenge 2: Next.js Static Export Manifest Concurrency on Windows

- **Assumption challenged**: Running `next build` on Windows succeeds regardless of filesystem caching state.
- **Attack scenario**: When `.next` cache is purged or under aggressive Windows file indexing/Defender scanning, webpack file renaming (`0.pack_` -> `0.pack`) or `pages-manifest.json` generation can experience transient `ENOENT` / `EPERM` locks during `next build`.
- **Blast radius**: Low for Milestone 2 (M2 scope is database schema, singleton, migrations, and env; build configuration belongs to M1/M5).
- **Mitigation**: Document in M5 / orchestrator tracking that Windows CI runners should disable webpack cache or ensure single-process execution during `next build` if transient manifest race conditions occur.

---

## Stress Test Results

| # | Stress Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| 1 | Execute `npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-migrations prisma/migrations` without shadow DB | Fails with explicit requirement for `--shadow-database-url` | `Error: You must pass the --shadow-database-url if you want to diff a migrations directory.` (Exit code: 1) | **PASS** (Confirmed CLI constraint) |
| 2 | Declarative SQL AST parity comparison: `diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` vs `0_init/migration.sql` | 100% identical byte-for-byte content | Identical: `true` (Length: 9,533 bytes, 293 lines). 0 drift detected. | **PASS** |
| 3 | Schema self-diff: `npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code` | Exit code 0, no difference detected | Output: `No difference detected.` (Exit code: 0) | **PASS** |
| 4 | Audit all 12 tables in `0_init/migration.sql` | All tables present with valid PostgreSQL `CREATE TABLE "Name"` | All 12 tables confirmed present (`Deck`, `Card`, `CardReview`, `QuizSession`, `QuizAnswer`, `UserStats`, `Achievement`, `DailyActivity`, `Account`, `Session`, `User`, `VerificationToken`). | **PASS** |
| 5 | Audit all 24 indexes & uniques in `0_init/migration.sql` | All unique constraints and composite indexes present | All 24 indexes/uniques verified, including `Card_deckId_nextReview_idx`. | **PASS** |
| 6 | Audit foreign keys & cascade rules in `0_init/migration.sql` | 13 foreign keys with `ON DELETE CASCADE ON UPDATE CASCADE` | Exactly 13 foreign key constraints with `ON DELETE CASCADE ON UPDATE CASCADE` verified. | **PASS** |
| 7 | Full codebase environment variable audit vs `.env.example` | All variables used in `process.env` or `env()` documented | All 9 keys documented with valid local PostgreSQL defaults. | **PASS** |
| 8 | Validate schema with dummy database URLs | `npx prisma validate` succeeds without network connection | Output: `The schema at prisma\schema.prisma is valid 🚀` (Exit code: 0) | **PASS** |
| 9 | Validate schema with missing `DIRECT_URL` | Throws `P1012` validation error | Correctly threw `P1012: Environment variable not found: DIRECT_URL.` | **PASS** |
| 10 | Prisma Client Lazy Singleton development mode check | Attaches `globalThis.prismaGlobal`, no DB connection error | PASSED. Singleton reused on re-import. | **PASS** |
| 11 | Prisma Client Lazy Singleton production mode check | Does not attach `globalThis.prismaGlobal`, restricts log level to `error` | PASSED. Both named and default exports identical. | **PASS** |
| 12 | TypeScript Compilation: `npx tsc --noEmit` | Clean compilation, 0 errors | Exit code: 0, 0 type errors. | **PASS** |
| 13 | ESLint verification: `npm run lint` | Clean linting, 0 errors, 0 warnings | Output: `✔ No ESLint warnings or errors` (Exit code: 0). | **PASS** |

---

## Unchallenged Areas

- **Live Database Migration Deployment (`prisma migrate deploy`)**: Cannot be executed against an active production database without production credentials; validated via AST diffing and SQL syntax checks.
- **Admin Users Route (`src/app/api/admin/users/route.ts`)**: Left with `orderBy: { emailVerified: "desc" }` as it is owned by Milestone 3 / API security milestone.
