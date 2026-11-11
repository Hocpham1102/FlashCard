# Prisma Migration & Database Hardening Specification Analysis (Milestone 2)

**Author:** Specification Miner (`teamwork_spec_miner_m2_1`)  
**Target Milestone:** Milestone 2 (Prisma & Database Hardening)  
**Investigation Date:** 2026-11-10  
**Status:** Complete  

---

## Executive Summary

This report establishes the authoritative specification for Milestone 2 tasks covering:
1. Current state and severe schema drift in `prisma/migrations`.
2. Baseline migration generation mechanism using `prisma migrate diff` without requiring a live database connection or shadow database.
3. CI/CD and deployment workflows (`prisma migrate deploy` and `prisma migrate resolve`).
4. Exact verification commands for Worker, Reviewer, and Challenger.
5. Concrete step-by-step instructions and command examples for the Worker.

---

## 1. Inspection of `prisma/migrations`

### 1.1 Current Files and Structure
```text
prisma/migrations/
├── 20260424102124_add_user_role/
│   └── migration.sql (116 lines)
└── migration_lock.toml (provider = "postgresql")
```

### 1.2 State Assessment & Drift Forensics
- **Origin:** Created on Thu Apr 30, 2026 (commit `d3ddc5f7e7d73d07e99c00507fb315c017e5244d`).
- **Missing Models (6 of 12 completely missing):**
  - `CardReview`
  - `QuizSession`
  - `QuizAnswer`
  - `UserStats`
  - `Achievement`
  - `DailyActivity`
- **Missing Columns on Existing Models:**
  - `Deck`: missing `category`, `toeicParts`, `isPublic`.
  - `Card`: missing 10 columns (`phonetic`, `example`, `partOfSpeech`, `synonyms`, `antonyms`, `collocations`, `toeicPart`, `difficulty`, `audioUrl`, `lastReviewed`).
  - `Card`: missing `nextReview` index.
- **Root Cause:** Historical development relied entirely on `npx prisma db push` directly against a remote Supabase instance (documented in `README.md:85`), skipping Prisma Migrate workflows.
- **Production Impact:** Any attempt to deploy to a new environment (Docker, Vercel, Railway, Render) using standard `prisma migrate deploy` will produce an incomplete database missing 50% of tables and columns, causing fatal runtime 500 errors on quiz, study, review, and gamification APIs.

---

## 2. Baseline Migration Generation & Deployment Architecture

### 2.1 Baseline Generation Command (Offline / No Live DB Required)
Prisma provides the `prisma migrate diff` command powered by its built-in WebAssembly Schema Engine (`@prisma/prisma-schema-wasm`).

#### The Exact Command
```powershell
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script --output prisma/migrations/0_init/migration.sql
```

#### Why This Works Without a Database
- `--from-empty`: Directs Prisma engine to assume the starting point is an empty datamodel.
- `--to-schema-datamodel prisma/schema.prisma`: Directs Prisma engine to parse the declarative AST of `schema.prisma`.
- `--script`: Renders fully valid, dialect-specific PostgreSQL DDL statements to SQL instead of human-readable text diff.
- `--output <path>`: Writes directly to the target file with proper UTF-8 encoding. This eliminates the PowerShell redirection bug where `>` on Windows can corrupt output with UTF-16 LE encoding.
- **Zero Network Traffic:** Requires NO active database connection, NO internet connection, and NO shadow database.

### 2.2 Directory Structure & Baselining Strategy

#### Recommended Directory Structure
```text
prisma/migrations/
├── 0_init/
│   └── migration.sql
└── migration_lock.toml
```
*(Alternatively: `20261110000000_init/migration.sql` if timestamp prefix is preferred; `0_init` is the official Prisma documentation standard for baselines).*

#### Migration Strategy Options & Recommendation

| Option | Approach | Clean DB Deploy (`migrate deploy`) | Existing Dev DB (`db push` applied) | Shadow DB Needed? | Recommendation |
|---|---|---|---|---|---|
| **Option 1: Clean Baseline Replacement (Recommended)** | Remove `20260424102124_add_user_role`, create `0_init/migration.sql` from empty to complete schema. | **Succeeds cleanly** in a single transaction. | Mark applied via `prisma migrate resolve --applied 0_init`. | **NO** | **STRONGLY RECOMMENDED** |
| **Option 2: Additive Delta Migration** | Keep old `20260424102124_add_user_role` and create a second migration folder with ALTER/CREATE statements. | Requires differential generation. | Complex drift resolution. | **YES** (`--shadow-database-url` mandatory) | **NOT RECOMMENDED** (Impossible in offline CI without shadow DB) |

**Decision:** Option 1 is the standard Prisma baselining method when migrating from prototyping (`db push`) to production (`migrate deploy`).

### 2.3 CI/CD & Deployment Execution
- **Fresh Environments (CI, Docker, Staging, Production):**
  ```powershell
  npx prisma migrate deploy
  ```
  Applies `0_init/migration.sql` and registers it in PostgreSQL table `_prisma_migrations`.
- **Existing Environments (Where `db push` was already run):**
  ```powershell
  npx prisma migrate resolve --applied 0_init
  ```
  Registers `0_init` as already applied in `_prisma_migrations` without re-executing DDL statements that would throw `relation already exists`.

---

## 3. Schema Hardening Prerequisites (Milestone 2 Requirements)

Before generating the baseline migration SQL, `prisma/schema.prisma` must be updated with the Milestone 2 schema enhancements:

### 3.1 Model `User` Timestamps
```prisma
model User {
  id             String          @id @default(cuid())
  name           String?
  username       String?         @unique
  email          String?         @unique
  emailVerified  DateTime?
  password       String?
  image          String?
  role           UserRole        @default(USER)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  accounts       Account[]
  sessions       Session[]
  decks          Deck[]
  cardReviews    CardReview[]
  quizSessions   QuizSession[]
  stats          UserStats?
  achievements   Achievement[]
  dailyActivities DailyActivity[]
}
```

### 3.2 Model `Card` Composite Index & QuizAnswer Relation
```prisma
model Card {
  // ... existing fields ...
  quizAnswers  QuizAnswer[]

  @@index([deckId])
  @@index([nextReview])
  @@index([deckId, nextReview])
}
```

### 3.3 Model `Account` and `Session` User Foreign Key Indexes
```prisma
model Account {
  // ... existing fields ...
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  // ... existing fields ...
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

### 3.4 Model `QuizAnswer` Foreign Key Relation & Index
```prisma
model QuizAnswer {
  id            String      @id @default(cuid())
  quizSessionId String
  cardId        String
  userAnswer    String
  correctAnswer String
  isCorrect     Boolean
  timeSpentMs   Int         @default(0)
  createdAt     DateTime    @default(now())
  quizSession   QuizSession @relation(fields: [quizSessionId], references: [id], onDelete: Cascade)
  card          Card        @relation(fields: [cardId], references: [id], onDelete: Cascade)

  @@index([quizSessionId])
  @@index([cardId])
}
```

---

## 4. Exact Verification Commands for Worker, Reviewer, and Challenger

### Check 1: Schema Syntax & Model Validation (`prisma validate`)
- **Command:**
  ```powershell
  $env:DATABASE_URL="postgresql://user:pass@localhost:5432/flashcard"; $env:DIRECT_URL="postgresql://user:pass@localhost:5432/flashcard"; npx prisma validate
  ```
- **Alternative (when `.env` is present):**
  ```powershell
  npx prisma validate
  ```
- **Expected Output:**
  ```text
  The schema at prisma\schema.prisma is valid 🚀
  ```
- **Exit Code:** `0`
- **Error Condition:** If `DIRECT_URL` is missing from environment, fails with `P1012: Environment variable not found: DIRECT_URL`.

### Check 2: Prisma Client Generation (`prisma generate`)
- **Command:**
  ```powershell
  npx prisma generate
  ```
  *(or `node node_modules/prisma/build/index.js generate`)*
- **Expected Output:**
  ```text
  ✔ Generated Prisma Client (v5.22.0) to .\node_modules\@prisma\client in XXXms
  ```
- **Exit Code:** `0`
- **Note:** Operates offline, does not require `DATABASE_URL`. Updates TypeScript definitions in `node_modules/@prisma/client`.

### Check 3: Lazy Client Import Verification (`src/lib/prisma.ts`)
- **Objective:** Ensure importing `src/lib/prisma.ts` does NOT eagerly call `$connect()`, does NOT attempt network sockets, and does NOT throw `PrismaClientInitializationError`.
- **Command:**
  ```powershell
  node -e "const jiti = require('jiti')(process.cwd()); const { prisma } = jiti('./src/lib/prisma'); console.log('Prisma loaded:', typeof prisma);"
  ```
- **Alternative via tsx:**
  ```powershell
  npx tsx -e "import { prisma } from './src/lib/prisma'; console.log('Prisma loaded:', typeof prisma);"
  ```
- **Expected Output:**
  ```text
  Prisma loaded: object
  ```
- **Exit Code:** `0`
- **Failure Output (Current Broken Behavior):**
  ```text
  ❌ Failed to connect to Supabase database: PrismaClientInitializationError: error: Environment variable not found: DATABASE_URL.
  ```

### Check 4: Admin Stats Route Compatibility
- **Command:**
  ```powershell
  npx tsc --noEmit
  ```
- **Objective:** Verify that changing `orderBy: { emailVerified: "desc" }` to `orderBy: { createdAt: "desc" }` in `src/app/api/admin/stats/route.ts` and `src/app/api/admin/users/route.ts` passes typecheck without TS2322/TS2353 errors.
- **Exit Code:** `0`

---

## 5. Step-by-Step Instructions for Worker

### Step 1: Create `.env.example`
Create `e:\GitHub\FlashCard\.env.example` documenting all configuration keys:
```env
# Database Connection (Supabase / PostgreSQL)
# Pooled connection string (Port 6543 for PgBouncer / Supavisor)
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct connection string for Prisma migrations (Port 5432)
DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-super-secret-jwt-key-min-32-chars-long"

# Google Gemini API Key (AI Deck Generation)
GEMINI_API_KEY="your-google-gemini-api-key"
```

### Step 2: Refactor `src/lib/prisma.ts` to Lazy Singleton
Replace eager `$connect()` with the standard lazy singleton:
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
```

### Step 3: Update `prisma/schema.prisma`
Apply the 5 schema enhancements:
1. In `model User`: Add `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`.
2. In `model Card`: Add `@@index([deckId, nextReview])` and `quizAnswers QuizAnswer[]`.
3. In `model Account`: Add `@@index([userId])`.
4. In `model Session`: Add `@@index([userId])`.
5. In `model QuizAnswer`: Add `card Card @relation(fields: [cardId], references: [id], onDelete: Cascade)` and `@@index([cardId])`.

### Step 4: Update Admin Queries
In `src/app/api/admin/stats/route.ts` (line 34) and `src/app/api/admin/users/route.ts` (line 21):
Change:
```typescript
orderBy: { emailVerified: "desc" }
```
To:
```typescript
orderBy: { createdAt: "desc" }
```

### Step 5: Regenerate Prisma Client
Run:
```powershell
npx prisma generate
```

### Step 6: Create Baseline Migration
1. Remove outdated drift folder:
   ```powershell
   Remove-Item -Recurse -Force "prisma\migrations\20260424102124_add_user_role"
   ```
2. Create baseline migration directory:
   ```powershell
   New-Item -ItemType Directory -Path "prisma\migrations\0_init" -Force
   ```
3. Generate comprehensive baseline migration SQL:
   ```powershell
   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script --output prisma/migrations/0_init/migration.sql
   ```
4. Verify `prisma/migrations/migration_lock.toml` exists with:
   ```toml
   provider = "postgresql"
   ```

### Step 7: Run Full Verification Suite
Execute the exact verification checks:
```powershell
# 1. Schema Validation
$env:DATABASE_URL="postgresql://user:pass@localhost:5432/flashcard"; $env:DIRECT_URL="postgresql://user:pass@localhost:5432/flashcard"; npx prisma validate

# 2. Prisma Client Generation
npx prisma generate

# 3. Lazy Prisma Client Import (Must not log connection error or attempt connection)
node -e "const jiti = require('jiti')(process.cwd()); const { prisma } = jiti('./src/lib/prisma'); console.log('Prisma loaded:', typeof prisma);"

# 4. TypeScript Type Checking
npx tsc --noEmit
```

---

## 6. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Database Config | Schema Environment Dependency | `prisma/schema.prisma` requires `DIRECT_URL` and `DATABASE_URL` in `datasource db` block | `schema.prisma:7-8` | Datasource configuration | Fails with P1012 if `DIRECT_URL` not defined | `npx prisma validate` |
| 2 | Migration | Offline Baseline Diffing | `prisma migrate diff` compiles schema AST to PostgreSQL DDL without live DB | `--from-empty --to-schema-datamodel <path> --script` | Standard PostgreSQL DDL SQL | Exits 1 if schema has syntax errors | `npx prisma migrate diff` CLI probe |
| 3 | Migration | CLI Output File Flag | `--output <file>` writes diff output cleanly with UTF-8 encoding | `--output <path>` | Generated SQL file | Overwrites or creates target file safely without PowerShell UTF-16 bugs | `prisma migrate diff --help` |
| 4 | Migration | Shadow DB Requirement for Delta | `--from-migrations` requires active `--shadow-database-url` | `--from-migrations <dir>` | Error if shadow DB omitted | Throws "You must pass the --shadow-database-url" | Execution test |
| 5 | ORM / Runtime | Eager vs Lazy Prisma Client | Top-level `$connect()` in `src/lib/prisma.ts` triggers unhandled connection failures during module import | Import of `src/lib/prisma.ts` | Connection attempt / Console error | Crashes build / logs P1012 | `node -e jiti require` |
| 6 | ORM / Runtime | Native `jiti` Loader in Project | `jiti` is already present in `node_modules` and can load `.ts` files synchronously | `process.cwd()`, file path | Module exports | Throws if TypeScript has syntax errors | `node_modules/.bin` exploration |
| 7 | Data Modeling | Composite Study Index | Query `Card.findMany({ where: { deckId, nextReview: { lte } } })` benefits from compound index | `@@index([deckId, nextReview])` | B-tree index in migration SQL | None | Schema analysis |
| 8 | Data Modeling | User Audit Timestamps | Adding `createdAt` and `updatedAt` to `User` enables sorting by registration date | `createdAt DateTime @default(now())` | Prisma Client model properties | None | Code audit `admin/stats` |
| 9 | Data Modeling | QuizAnswer Foreign Key & Index | `QuizAnswer.cardId` links to `Card.id` with cascade deletion and index | `@relation(fields: [cardId]...)` and `@@index([cardId])` | Constraint and Index in SQL | Prevents orphaned records | Schema analysis |
| 10 | Migration | Baseline Resolve Command | Mark existing drifted DB as baseline without executing DDL | `prisma migrate resolve --applied <name>` | Marks migration in `_prisma_migrations` | Requires DB connection | Prisma docs probe |

---

## 7. Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | `npx prisma validate` | Running without `.env` or environment variables | Fails with `Error code: P1012 - error: Environment variable not found: DIRECT_URL` |
| 2 | `npx prisma validate` | Running with dummy `DATABASE_URL` and `DIRECT_URL` set | Passes with exit code 0 (`The schema at prisma\schema.prisma is valid 🚀`) |
| 3 | `npx prisma generate` | Running without any environment variables | Succeeds with exit code 0, generates `@prisma/client` in ~130ms |
| 4 | `npx prisma migrate diff` | `--from-empty --to-schema-datamodel prisma/schema.prisma --script` without env vars | Succeeds with exit code 0 and outputs 276 lines of PostgreSQL DDL without DB connection |
| 5 | `npx prisma migrate diff` | `--from-migrations prisma/migrations` without `--shadow-database-url` | Fails with `Error: You must pass the --shadow-database-url if you want to diff a migrations directory` |
| 6 | `src/lib/prisma.ts` import | Eager `$connect()` when DB unreachable | Prints `❌ Failed to connect to Supabase database: PrismaClientInitializationError: DATABASE_URL not found` |
| 7 | `src/lib/prisma.ts` import | Lazy singleton (no top-level `$connect()`) | Loads silently and exports PrismaClient instance without throwing or connecting |
| 8 | PowerShell Redirection | `npx prisma migrate diff ... > migration.sql` in Windows PowerShell | May write in UTF-16 LE encoding depending on shell configuration |
| 9 | Direct File Output | `npx prisma migrate diff ... --output migration.sql` | Writes pure UTF-8 encoding across all operating systems and shells |
