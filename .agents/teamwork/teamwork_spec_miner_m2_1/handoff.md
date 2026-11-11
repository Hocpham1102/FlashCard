# Handoff Report: Prisma Migration & Verification Specification (Milestone 2)

**Agent:** Prisma Migration Spec Miner (`teamwork_spec_miner_m2_1`)  
**Recipient:** Sub-Orchestrator Milestone 2 (`74447281-5666-436f-b2f0-3d88d587b04e`)  
**Date:** 2026-11-10  
**Handoff Type:** Hard (Task complete)  

---

## 1. Observation
1. **Migration State (`prisma/migrations`):**
   - Contains `prisma/migrations/20260424102124_add_user_role/migration.sql` (116 lines) and `prisma/migrations/migration_lock.toml` (`provider = "postgresql"`).
   - Only 6 tables are created in `migration.sql` (`Deck`, `Card`, `Account`, `Session`, `User`, `VerificationToken`).
   - 6 tables declared in `prisma/schema.prisma` are completely missing: `CardReview`, `QuizSession`, `QuizAnswer`, `UserStats`, `Achievement`, `DailyActivity`.
   - `Deck` is missing `category`, `toeicParts`, `isPublic`. `Card` is missing 10 columns (`phonetic`, `example`, `partOfSpeech`, `synonyms`, `antonyms`, `collocations`, `toeicPart`, `difficulty`, `audioUrl`, `lastReviewed`).
2. **`prisma migrate diff` Behavior:**
   - Command `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` executes completely offline without any database connection or environment variables, outputting 276 lines of pure PostgreSQL DDL.
   - Command `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script` fails with `Error: You must pass the --shadow-database-url if you want to diff a migrations directory`.
   - Flag `--output <path>` writes UTF-8 output directly, avoiding Windows PowerShell UTF-16 LE redirection corruption.
3. **`prisma validate` Behavior:**
   - Without `DIRECT_URL` and `DATABASE_URL`, `npx prisma validate` fails with `P1012: Environment variable not found: DIRECT_URL`.
   - When set via `$env:DATABASE_URL` and `$env:DIRECT_URL`, `npx prisma validate` succeeds: `The schema at prisma\schema.prisma is valid 🚀` (Exit code: 0).
4. **`prisma generate` Behavior:**
   - `npx prisma generate` runs offline without environment variables, generating `@prisma/client` (v5.22.0) to `node_modules/@prisma/client` in ~130ms (Exit code: 0).
5. **Prisma Client Eager Connection in `src/lib/prisma.ts`:**
   - Executing `node -e "const jiti = require('jiti')(process.cwd()); const { prisma } = jiti('./src/lib/prisma');"` currently prints:
     `❌ Failed to connect to Supabase database: PrismaClientInitializationError: error: Environment variable not found: DATABASE_URL.`
   - In contrast, a lazy client singleton without module-level `$connect()` loads silently with `Prisma loaded: object` and zero network calls.

---

## 2. Logic Chain
1. *From Observation 1:* The existing migration `20260424102124_add_user_role` represents an obsolete snapshot from an early development stage before quiz, study, and gamification features were implemented with `npx prisma db push`.
2. *From Observation 2:* Creating an incremental/delta migration using `--from-migrations` requires a live shadow database (`--shadow-database-url`), which is not available in offline or CI build environments. In contrast, `prisma migrate diff --from-empty --to-schema-datamodel` uses Prisma's Wasm engine to generate a complete PostgreSQL baseline migration offline.
3. *From Observations 1 & 2:* Keeping `20260424102124_add_user_role` alongside a full baseline would cause `prisma migrate deploy` to fail on clean environments due to duplicate table definitions (`relation "User" already exists`). Therefore, replacing the obsolete partial migration with a single clean baseline migration `0_init/migration.sql` (representing 100% of the updated schema) is the only clean, robust, and Prisma-standard solution.
4. *From Observation 3:* Schema validation in CI or testing requires `.env` or explicit dummy environment variables because `schema.prisma` declares `directUrl = env("DIRECT_URL")`.
5. *From Observation 5:* Top-level `$connect()` in `src/lib/prisma.ts` pollutes Next.js static build phases and throws unhandled exceptions when database credentials are not available. Removing it makes instantiation lazy and safe.

---

## 3. Caveats
- `prisma migrate deploy` cannot be executed in an offline environment without an active PostgreSQL instance; it is verified at the DDL script and generation level via `prisma migrate diff`.
- If a live development database already exists that was synchronized via `db push`, running `prisma migrate deploy` directly would attempt to re-create existing tables; developers must baseline the database once using `npx prisma migrate resolve --applied 0_init`.

---

## 4. Conclusion
1. The baseline migration must be generated into `prisma/migrations/0_init/migration.sql` using:
   `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script --output prisma/migrations/0_init/migration.sql`
2. The old partial migration `prisma/migrations/20260424102124_add_user_role` should be removed, while `prisma/migrations/migration_lock.toml` (`provider = "postgresql"`) must be retained.
3. `prisma/schema.prisma` must be updated with `User` timestamps, `Card` compound index, `Account`/`Session` user indexes, and `QuizAnswer` card relation/index before generating the migration SQL.
4. `src/lib/prisma.ts` must be converted to a lazy singleton by removing eager top-level `$connect()`.
5. All verification commands have been empirically validated and documented in `analysis.md`.

---

## 5. Verification Method
Worker, Reviewer, and Challenger can independently verify Milestone 2 using the following commands:

```powershell
# 1. Schema Validation (Exit code 0)
$env:DATABASE_URL="postgresql://user:pass@localhost:5432/flashcard"; $env:DIRECT_URL="postgresql://user:pass@localhost:5432/flashcard"; npx prisma validate

# 2. Client Generation (Exit code 0)
npx prisma generate

# 3. Lazy Client Import (Must output "Prisma loaded: object" without connection errors)
node -e "const jiti = require('jiti')(process.cwd()); const { prisma } = jiti('./src/lib/prisma'); console.log('Prisma loaded:', typeof prisma);"

# 4. TypeScript Type Checking (Exit code 0)
npx tsc --noEmit

# 5. Migration Diff Verification (Exit code 0, generates valid SQL)
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```
