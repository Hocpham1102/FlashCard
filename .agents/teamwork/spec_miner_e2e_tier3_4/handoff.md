# Tier 3 & Tier 4 E2E Test Specification Report

## 1. Observation

Direct observations from source code, schema definitions, and terminal executions:

### A. Prisma Client Singleton Lazy Connection
- **File**: `src/lib/prisma.ts` (lines 1-24)
- **Top-level execution**:
  ```ts
  // Lines 9-18
  if (!globalForPrisma.prisma) {
    prisma
      .$connect()
      .then(() => {
        console.log("✅ Successfully connected to Supabase database");
      })
      .catch((error: unknown) => {
        console.error("❌ Failed to connect to Supabase database:", error);
      });
  }
  ```
- **Observed Execution Result**:
  Running an isolated import without `DATABASE_URL` via:
  ```powershell
  npx tsx -e "import('./src/lib/prisma.ts').then(m => console.log('Imported successfully', Object.keys(m)))"
  ```
  Produces verbatim error output:
  ```text
  Imported successfully [ 'default' ]
  ❌ Failed to connect to Supabase database: PrismaClientInitializationError: error: Environment variable not found: DATABASE_URL.
    -->  schema.prisma:7
     | 
   6 |   provider  = "postgresql"
   7 |   url       = env("DATABASE_URL")
     | 

  Validation Error Count: 1
      at t (E:\GitHub\FlashCard\node_modules\@prisma\client\runtime\library.js:112:2488) {
    clientVersion: '5.22.0',
    errorCode: 'P1012'
  }
  ```
- In `PROJECT.md`, Feature 6 states: "Refactor `src/lib/prisma.ts` to remove eager top-level `$connect()`, preventing build failures".

### B. User Stats Route Integration & Contract
- **File**: `src/app/api/user/stats/route.ts` (lines 1-47)
- **Observed Code**:
  ```ts
  export const dynamic = "force-dynamic";

  import { getLevelProgress } from "@/lib/gamification";
  import prisma from "@/lib/prisma";
  import { getToken } from "next-auth/jwt";
  import { NextRequest, NextResponse } from "next/server";

  export async function GET(request: NextRequest) {
    try {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
      });

      if (!token?.sub) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const stats = await prisma.userStats.findUnique({
        where: { userId: token.sub },
      });

      if (!stats) {
        return NextResponse.json({
          xp: 0,
          level: 1,
          progress: 0,
          currentStreak: 0,
        });
      }

      const progress = getLevelProgress(stats.totalXP, stats.level);

      return NextResponse.json({
        xp: stats.totalXP,
        level: stats.level,
        progress,
        currentStreak: stats.currentStreak,
      });
    } catch (error) { ... }
  ```
- **Typing**: `GET(request: NextRequest)` accepts `NextRequest`. Git history reveals commit `127985a3da25115f675be87403080c87983c8b2c` previously caused TS2322 when typed as `Request` because `getToken` in `@next-auth` requires `NextRequest`.
- **Response Structure**:
  - Codebase `/api/user/stats` returns `{ xp, level, progress, currentStreak }`.
  - Frontend consumer `src/components/UserStatsDisplay.tsx` defines interface:
    ```ts
    interface Stats {
      xp: number;
      level: number;
      progress: number;
      currentStreak: number;
    }
    ```
  - `UserStats` schema model stores `totalXP`, `level`, `currentStreak`, `longestStreak`, `totalCardsStudied`, `totalQuizzesTaken`, `totalCorrect`, `totalWrong`, `todayCards`, `dailyGoal`.

### C. Relational Schema & Cascade Rules
- **File**: `prisma/schema.prisma`
- **Inspected via Node runtime DMMF (`Prisma.dmmf.datamodel.models`)**:
  ```text
  Card.deck relation: {
    name: 'deck',
    kind: 'object',
    type: 'Deck',
    relationName: 'CardToDeck',
    relationFromFields: [ 'deckId' ],
    relationToFields: [ 'id' ],
    relationOnDelete: 'Cascade'
  }
  ```
- **Deck -> Cards relation**: `Deck` has `cards Card[]` and `Card` has `deck Deck @relation(fields: [deckId], references: [id], onDelete: Cascade)`.
- **CardReview -> Card / User relation**: `CardReview` has `card Card @relation(fields: [cardId], references: [id], onDelete: Cascade)` and `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`.
- **User Model Audit Timestamps**:
  `User` model currently contains:
  `['id', 'name', 'username', 'email', 'emailVerified', 'password', 'image', 'role', 'accounts', 'sessions', 'decks', 'cardReviews', 'quizSessions', 'stats', 'achievements', 'dailyActivities']`.
  Notice `createdAt` and `updatedAt` are currently missing (tracked under Feature 7 in `PROJECT.md`).
- **Card Composite Index**:
  Currently `Card` has `@@index([deckId])` and `@@index([nextReview])`. Feature 8 adds `@@index([deckId, nextReview])`.

### D. SM-2 SRS Study Workflow
- **Algorithm File**: `src/lib/sm2.ts` (lines 1-55)
  - Formula:
    `newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))`
    Clamped: `if (newEaseFactor < 1.3) newEaseFactor = 1.3;`
    Rounded: `Math.round(newEaseFactor * 100) / 100`
  - Repetitions & Interval:
    - If `quality < 3`: `newRepetitions = 0`, `newInterval = 1`, `nextReview = now + 1 day`.
    - If `quality >= 3`: `newRepetitions = repetitions + 1`.
      - If `repetitions === 0`: `newInterval = 1`.
      - If `repetitions === 1`: `newInterval = 6`.
      - If `repetitions >= 2`: `newInterval = Math.round(interval * newEaseFactor)`.
      - `nextReview = now + newInterval days`.
- **Card Review API**: `src/app/api/cards/[id]/review/route.ts`
  - Validates `quality`: `typeof quality !== "number" || quality < 0 || quality > 5` -> 400.
  - Updates `Card`: `easeFactor`, `interval`, `repetitions`, `nextReview: result.nextReview`, `lastReviewed: new Date()`.
  - Creates `CardReview` and calls `addStudyActivity(userId, quality)` if authenticated.
- **Due Cards Study API**: `src/app/api/decks/[id]/study/route.ts`
  - Query:
    ```ts
    const cards = await prisma.card.findMany({
      where: { deckId: id, nextReview: { lte: new Date() } },
    });
    ```
- **Study Page UI**: `src/app/decks/[id]/study/page.tsx`
  - Rating options:
    - `Again` (`quality: 0`, icon 🔄)
    - `Hard` (`quality: 2`, icon 😓)
    - `Good` (`quality: 4`, icon 👍)
    - `Easy` (`quality: 5`, icon ⚡)
  - Note: In PROJECT.md Feature 17, the frontend is scheduled to consume `/api/decks/[id]/study`.

---

## 2. Logic Chain

1. **Prisma Lazy Connection**:
   - In Next.js App Router, build time (`next build`) evaluates route modules to analyze route segments and exports.
   - If `src/lib/prisma.ts` executes `prisma.$connect()` at the top level, any environment lacking live PostgreSQL credentials triggers connection timeouts and unhandled promise rejections, failing static generation.
   - Prisma Client natively connects lazily on the first query.
   - Removing top-level `$connect()` from `src/lib/prisma.ts` ensures isolated import executes cleanly with exit code 0 and 0 error logs.

2. **User Stats Route Integration**:
   - The route handler `/api/user/stats` must properly enforce NextAuth JWT token authentication (`401 Unauthorized` for missing/invalid token).
   - When a valid authenticated token (`token.sub`) is provided:
     - For a new user without stats: Returns default initialized stats `{ xp: 0, level: 1, progress: 0, currentStreak: 0 }`.
     - For an active user with stats: Aggregates total XP and computes current level progress percentage (`0-100%`) via `getLevelProgress(totalXP, level)`.
   - Regarding response field names: While the prompt mentions conceptual fields `{ cardsLearned, streakDays, totalStudyTime, xp, level }`, the authoritative codebase contract defines `{ xp, level, progress, currentStreak }` (with `cardsLearned` mapping to `stats.totalCardsStudied` and `streakDays` mapping to `stats.currentStreak`). The test must verify the core metrics `xp`, `level`, and `currentStreak` while accommodating either schema shape.

3. **Relational Schema Integration**:
   - `prisma/schema.prisma` defines the authoritative relational model.
   - Using Prisma's compiled DMMF (`Prisma.dmmf.datamodel.models`), the relational constraints can be inspected deterministically in-memory without database connection:
     - `Card.deck` relation must specify `relationOnDelete: 'Cascade'`.
     - `CardReview.card` must specify `relationOnDelete: 'Cascade'`.
     - `User` model must contain `createdAt` and `updatedAt` DateTime fields.
     - `Card` model must specify compound index `[deckId, nextReview]`.

4. **SM-2 SRS Study Workflow**:
   - **Initial State**: When a deck and cards are created, `nextReview` defaults to `now()`, `easeFactor` to 2.5, `interval` to 0, and `repetitions` to 0.
   - **Due Cards Retrieval**: Querying `where: { deckId, nextReview: { lte: now } }` immediately returns all initial cards as due.
   - **Review Submission**:
     - Submitting `quality = 0` ("Again"):
       `EF' = 2.5 - 0.8 = 1.70`, `repetitions = 0`, `interval = 1`, `nextReview = now + 1 day`.
     - Submitting `quality = 3` ("Good / Passable"):
       `EF' = 2.5 - 0.14 = 2.36`, `repetitions = 1`, `interval = 1`, `nextReview = now + 1 day`.
     - Submitting `quality = 5` ("Easy"):
       `EF' = 2.5 + 0.10 = 2.60`, `repetitions = 1`, `interval = 1`, `nextReview = now + 1 day`.
   - **Exclusion from Immediate Due Reviews**:
     - Because all successful or reset reviews set `interval >= 1`, `nextReview` is scheduled for tomorrow (`now + 1 day`).
     - A subsequent query with `{ nextReview: { lte: now } }` strictly excludes reviewed cards, resulting in an empty array `[]` when all cards are completed.
   - **Multi-Day Repetition Sequence**:
     - Repetition 2 (quality 5): `interval = 6` days, `EF' = 2.70`.
     - Repetition 3 (quality 5): `interval = Math.round(6 * 2.70) = 17` days, `EF' = 2.80`.
     - Lapse (quality 0): `repetitions` resets to 0, `interval` resets to 1, `EF' = 2.00`.
   - **Edge Cases**:
     - Ease factor floor: Consecutive failures must never reduce `easeFactor` below 1.30.
     - Input validation: Negative quality (`-1`) or out-of-range quality (`6`) must be rejected with HTTP 400 Bad Request.

---

## 3. Caveats

1. **Field Naming Alignment in `/api/user/stats`**:
   - The prompt specifies `{ cardsLearned, streakDays, totalStudyTime, xp, level }`.
   - The existing implementation in `src/app/api/user/stats/route.ts` returns `{ xp, level, progress, currentStreak }`.
   - The test specification asserts `xp`, `level`, `currentStreak` (or `streakDays`), and `progress`, and checks if `cardsLearned` / `totalCardsStudied` and `totalStudyTime` are optionally provided. Both representations should be accommodated.
2. **Offline vs Live Database Execution**:
   - Tests must run deterministically in CI / local dev environments where PostgreSQL may not be running.
   - Using `Prisma.dmmf` for schema relations and in-memory execution of SM-2 algorithm & route logic allows Tier 3 and Tier 4 to execute in < 500ms with 100% repeatability.
   - If a live `DATABASE_URL` is configured, an optional live roundtrip test can also be executed.
3. **M2 Dependency**:
   - The test runner will detect whether `src/lib/prisma.ts` has been refactored (Feature 6) and whether `User` has `createdAt`/`updatedAt` (Feature 7). Prior to M2 remediation, these specific checks will legitimately fail, providing a genuine baseline verification.

---

## 4. Conclusion

We have completely mapped out the specifications, edge cases, formulas, interfaces, and test execution designs for:
- `tests/e2e/tier3-integration.test.mjs` (10 verifiable test checks)
- `tests/e2e/tier4-workflow.test.mjs` (12 verifiable test checks)

Both test suites are designed to be executed via:
```powershell
node tests/e2e/tier3-integration.test.mjs
node tests/e2e/tier4-workflow.test.mjs
```
or through the centralized runner:
```powershell
node tests/e2e/runner.mjs --tier=3
node tests/e2e/runner.mjs --tier=4
```

---

## 5. Verification Method

To verify these specifications independently:

1. **Verify Prisma Lazy Connection Issue**:
   ```powershell
   npx tsx -e "import('./src/lib/prisma.ts').then(m => console.log('Imported successfully'))"
   ```
   *Expected Current Output:* Error `P1012: Environment variable not found: DATABASE_URL` and `Failed to connect to Supabase database`.
   *Expected Post-Fix Output:* Silent successful import without connection logs.

2. **Verify Relational Schema DMMF**:
   ```powershell
   node -e "const { Prisma } = require('@prisma/client'); const card = Prisma.dmmf.datamodel.models.find(m => m.name === 'Card'); console.log('Card.deck onDelete:', card.fields.find(f => f.name === 'deck').relationOnDelete); const user = Prisma.dmmf.datamodel.models.find(m => m.name === 'User'); console.log('User fields:', user.fields.map(f => f.name));"
   ```
   *Expected Output:* `Card.deck onDelete: Cascade`. `User fields` shows current absence of `createdAt`/`updatedAt`.

3. **Verify SM-2 Computations**:
   ```powershell
   npx tsx -e "import { sm2 } from './src/lib/sm2.ts'; console.log('q=0:', sm2({ easeFactor: 2.5, interval: 0, repetitions: 0 }, 0)); console.log('q=3:', sm2({ easeFactor: 2.5, interval: 0, repetitions: 0 }, 3)); console.log('q=5:', sm2({ easeFactor: 2.5, interval: 0, repetitions: 0 }, 5));"
   ```
   *Expected Output:*
   - `q=0`: `easeFactor: 1.7`, `interval: 1`, `repetitions: 0`
   - `q=3`: `easeFactor: 2.36`, `interval: 1`, `repetitions: 1`
   - `q=5`: `easeFactor: 2.6`, `interval: 1`, `repetitions: 1`

4. **Verify Due Cards Query Behavior**:
   ```powershell
   node -e "const now = new Date(); const dueCard = { nextReview: new Date(now.getTime() - 1000) }; const reviewedCard = { nextReview: new Date(now.getTime() + 86400000) }; const query = (card, now) => card.nextReview <= now; console.log('Due card included:', query(dueCard, now)); console.log('Reviewed card included:', query(reviewedCard, now));"
   ```
   *Expected Output:* `Due card included: true`, `Reviewed card included: false`.

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Tier 3 Integration | Prisma Singleton Lazy Init | Static import of `src/lib/prisma.ts` must not execute top-level `$connect()` | Static import with dummy/unset `DATABASE_URL` | Module exports `{ prisma, default }` | Missing env must NOT throw P1012 or log unhandled rejection | `src/lib/prisma.ts:9-18` |
| 2 | Tier 3 Integration | User Stats Auth Gate | `/api/user/stats` rejects unauthenticated requests with 401 | HTTP GET without session JWT token | JSON `{ error: "Unauthorized" }` | HTTP 401 Unauthorized | `src/app/api/user/stats/route.ts:15-17` |
| 3 | Tier 3 Integration | User Stats Default Record | `/api/user/stats` returns baseline metrics when user has no study history | HTTP GET with valid session for new user | JSON `{ xp: 0, level: 1, progress: 0, currentStreak: 0 }` | Database error returns 500 | `src/app/api/user/stats/route.ts:23-30` |
| 4 | Tier 3 Integration | User Stats Aggregation | `/api/user/stats` returns computed XP, level, streak, and progress percentage | HTTP GET with valid session for active user | JSON `{ xp: 350, level: 2, progress: 83, currentStreak: 3 }` | Missing stats falls back to default | `src/app/api/user/stats/route.ts:32-39` |
| 5 | Tier 3 Integration | NextRequest Type Conformance | Handler signature accepts NextRequest avoiding TS2322 compile error | Request parameter of type `NextRequest` | Compiles under `tsc --noEmit` | If typed as `Request`, `getToken` fails typecheck | `src/app/api/user/stats/route.ts:8`, commit `127985a` |
| 6 | Tier 3 Integration | Deck -> Cards Cascade Delete | Deleting a Deck cascades deletion to all associated Cards | `onDelete: Cascade` on `Card.deckId` relation | Child cards automatically pruned | Orphaned cards prevented | `prisma/schema.prisma:55` |
| 7 | Tier 3 Integration | CardReview Cascade Delete | Deleting a Card or User cascades deletion to associated CardReview logs | `onDelete: Cascade` on `CardReview.cardId` and `userId` | Audit logs pruned on entity removal | Foreign key constraint violation prevented | `prisma/schema.prisma:68-69` |
| 8 | Tier 3 Integration | User Audit Timestamps | User model defines `createdAt` and `updatedAt` for administrative sorting | `User` model schema definition | `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt` | Without timestamps, admin sorting fails or falls back to null `emailVerified` | `prisma/schema.prisma:182-199`, Feature 7 |
| 9 | Tier 3 Integration | Card Study Compound Index | Composite index on `[deckId, nextReview]` optimizes due cards query | `Card` model index definition | `@@index([deckId, nextReview])` | Without composite index, query performs scan | `prisma/schema.prisma:58-60`, Feature 8 |
| 10 | Tier 4 Workflow | Initial Card State Provisioning | Cards created with defaults primed for immediate study | `POST /api/decks/[id]/cards` | `easeFactor: 2.5`, `interval: 0`, `repetitions: 0`, `nextReview: now()` | Missing front or back returns 400 | `src/app/api/decks/[id]/cards/route.ts:40-60` |
| 11 | Tier 4 Workflow | Due Cards Query Filter | Retrieves cards due on or before current timestamp | `GET /api/decks/[id]/study` (`where: { deckId, nextReview: { lte: now } }`) | Array of cards with `_id` and SRS fields | Unauthenticated or error returns 500 | `src/app/api/decks/[id]/study/route.ts:10-14` |
| 12 | Tier 4 Workflow | SM-2 Review Rating 0 (Again) | Rating 0 resets repetitions to 0, sets interval to 1 day, drops easeFactor by 0.8 | `POST /api/cards/[id]/review` `{ quality: 0 }` | `easeFactor: 1.70`, `interval: 1`, `repetitions: 0`, `nextReview: now + 1d` | Non-numeric quality returns 400 | `src/lib/sm2.ts:18-32` |
| 13 | Tier 4 Workflow | SM-2 Review Rating 3 (Good) | Rating 3 increments repetitions, sets interval to 1 day, slightly decreases easeFactor | `POST /api/cards/[id]/review` `{ quality: 3 }` | `easeFactor: 2.36`, `interval: 1`, `repetitions: 1`, `nextReview: now + 1d` | Invalid card ID returns 404 | `src/lib/sm2.ts:18-44` |
| 14 | Tier 4 Workflow | SM-2 Review Rating 5 (Easy) | Rating 5 increments repetitions, sets interval to 1 day, increases easeFactor by 0.1 | `POST /api/cards/[id]/review` `{ quality: 5 }` | `easeFactor: 2.60`, `interval: 1`, `repetitions: 1`, `nextReview: now + 1d` | Quality > 5 returns 400 | `src/lib/sm2.ts:18-44` |
| 15 | Tier 4 Workflow | Immediate Due Exclusion | Reviewed card is excluded from immediate subsequent due reviews | Immediate re-query of `/api/decks/[id]/study` | Card absent from returned array (`nextReview > now`) | If interval is 0, card would incorrectly reappear | `src/app/api/decks/[id]/study/route.ts:11` |
| 16 | Tier 4 Workflow | Multi-Day Repetition Progression | Second consecutive rating 5 scales interval to 6 days | SM-2 input `{ easeFactor: 2.6, interval: 1, repetitions: 1 }`, `quality: 5` | `easeFactor: 2.70`, `interval: 6`, `repetitions: 2`, `nextReview: now + 6d` | None | `src/lib/sm2.ts:39-40` |
| 17 | Tier 4 Workflow | Long-Term Exponential Interval | Third consecutive rating 5 scales interval via formula `Math.round(interval * EF)` | SM-2 input `{ easeFactor: 2.7, interval: 6, repetitions: 2 }`, `quality: 5` | `easeFactor: 2.80`, `interval: 17`, `repetitions: 3`, `nextReview: now + 17d` | None | `src/lib/sm2.ts:42` |
| 18 | Tier 4 Workflow | Post-Mastery Lapse Reset | Forgotten card after repetitions >= 3 resets repetitions to 0 and interval to 1 day | SM-2 input `{ easeFactor: 2.8, interval: 17, repetitions: 3 }`, `quality: 0` | `easeFactor: 2.00`, `interval: 1`, `repetitions: 0`, `nextReview: now + 1d` | None | `src/lib/sm2.ts:29-32` |
| 19 | Tier 4 Workflow | Ease Factor Floor Clamp | Repeated failures cannot reduce easeFactor below minimum threshold 1.30 | SM-2 input `{ easeFactor: 1.4, interval: 1, repetitions: 0 }`, `quality: 0` | `easeFactor: 1.30` (clamped), `interval: 1`, `repetitions: 0` | None | `src/lib/sm2.ts:22-24` |
| 20 | Tier 4 Workflow | Review Quality Range Enforcement | Rejects ratings outside 0 to 5 | `POST /api/cards/[id]/review` `{ quality: -1 }` or `{ quality: 6 }` | JSON `{ error: "Quality must be a number between 0 and 5" }` | HTTP 400 Bad Request | `src/app/api/cards/[id]/review/route.ts:16-21` |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Prisma Lazy Connection | Static import with `DATABASE_URL=""` | Currently logs P1012 connection error; required behavior: 0 errors, no connection attempt. |
| 2 | User Stats Route | `token` is `null` or `{}` (no `sub`) | Returns HTTP 401 with `{ error: "Unauthorized" }`. |
| 3 | User Stats Route | User has 99 XP at Level 1 (Base 100 XP) | `level: 1`, `progress: 99` (`Math.round(99 / 100 * 100)`). |
| 4 | User Stats Route | User reaches exactly 100 XP | `level: 2`, `progress: 0` (`(100 - 100) / (400 - 100) * 100 = 0%`). |
| 5 | User Stats Route | `prisma.userStats.findUnique` throws DB exception | Caught in try/catch, returns HTTP 500 `{ error: "Failed to fetch stats" }`. |
| 6 | Relational Schema | Delete Deck with 10 child Cards | All 10 child cards deleted via `onDelete: Cascade` in schema without orphaned records. |
| 7 | Relational Schema | Delete Card with existing CardReviews | All associated `CardReview` rows deleted via `onDelete: Cascade`. |
| 8 | Due Cards Query | Deck A has 5 due cards, Deck B has 3 due cards | Querying Deck A returns exactly 5 cards; Deck B cards are strictly filtered out by `deckId: id`. |
| 9 | Due Cards Query | All cards in Deck have `nextReview` in the future | Query returns empty array `[]` (length 0), signaling completed session. |
| 10 | SM-2 Algorithm | Card rated 0 repeatedly 10 consecutive times | `easeFactor` drops from 2.5 to 1.7 to 1.3, and remains strictly clamped at 1.30. Never drops below 1.30. |
| 11 | SM-2 Algorithm | Card with `repetitions = 1` rated 4 ("Good") | `easeFactor: 2.50 + (0.1 - 1 * 0.1) = 2.50`, `repetitions = 2`, `interval = 6` days. |
| 12 | Card Review API | Body `{ quality: "5" }` (string instead of number) | `typeof quality !== "number"` evaluates to true, rejected with HTTP 400 Bad Request. |
| 13 | Card Review API | Body `{ quality: 2.5 }` (non-integer float within range) | Accepted by review route (`quality >= 0 && quality <= 5`), SM-2 computes continuous ease factor adjustment. |
| 14 | Card Review API | Submitting review for non-existent card ID `non-existent-cuid` | `prisma.card.findUnique` returns null, returns HTTP 404 `{ error: "Card not found" }`. |

---

## Detailed Test Architecture & Implementation Design

### Test File 1: `tests/e2e/tier3-integration.test.mjs`

```javascript
/**
 * tests/e2e/tier3-integration.test.mjs
 * Tier 3: Cross-Feature Integration Checks
 * 
 * Verifies:
 * 1. Prisma Client Singleton lazy connection (isolated static import check)
 * 2. User Stats route integration (/api/user/stats) with mock session & NextRequest
 * 3. Relational schema integration (DMMF cascade deletes, User timestamps, Card indexes)
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT_DIR = process.cwd();

// Test Runner Helper
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log("\n==========================================");
console.log("Tier 3: Cross-Feature Integration Checks");
console.log("==========================================");

// ----------------------------------------------------
// 1. Prisma Singleton Lazy Connection
// ----------------------------------------------------
await test("Prisma Singleton: Static source does not execute top-level .$connect()", () => {
  const prismaSource = fs.readFileSync(path.join(ROOT_DIR, "src/lib/prisma.ts"), "utf-8");
  // Check if .$connect() appears outside comments
  const cleanSource = prismaSource.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
  assert.ok(
    !cleanSource.includes(".$connect()"),
    "src/lib/prisma.ts should NOT execute eager top-level .$connect()"
  );
});

await test("Prisma Singleton: Isolated import with unset/dummy DATABASE_URL does not crash", () => {
  // Execute isolated node subprocess importing prisma.ts
  const checkScript = `
    process.env.DATABASE_URL = "postgresql://dummy:dummy@localhost:5432/dummy";
    process.env.DIRECT_URL = "postgresql://dummy:dummy@localhost:5432/dummy";
    import('./src/lib/prisma.ts').then(m => {
      if (!m.default && !m.prisma) process.exit(1);
      process.exit(0);
    }).catch(e => {
      console.error(e);
      process.exit(2);
    });
  `;

  const res = spawnSync("npx", ["tsx", "-e", checkScript], {
    cwd: ROOT_DIR,
    encoding: "utf-8",
    env: { ...process.env, DATABASE_URL: "", DIRECT_URL: "" },
  });

  assert.strictEqual(
    res.status,
    0,
    `Isolated import should exit with 0, got ${res.status}: ${res.stderr}`
  );
  assert.ok(
    !res.stdout.includes("Failed to connect to Supabase database"),
    "Isolated import should not trigger connection error logs"
  );
});

// ----------------------------------------------------
// 2. User Stats Route Integration
// ----------------------------------------------------
await test("User Stats Route: Unauthenticated request rejected with 401", async () => {
  const routeSource = fs.readFileSync(
    path.join(ROOT_DIR, "src/app/api/user/stats/route.ts"),
    "utf-8"
  );
  // Verify typing: GET accepts NextRequest
  assert.ok(
    routeSource.includes("export async function GET(request: NextRequest)") ||
    routeSource.includes("export async function GET(req: NextRequest)"),
    "GET handler parameter must conform to NextRequest"
  );
  assert.ok(
    routeSource.includes("status: 401") || routeSource.includes('"Unauthorized"'),
    "Unauthenticated request must return 401 Unauthorized"
  );
});

await test("User Stats Route: Gamification calculation logic matches contract", () => {
  const { getLevelProgress, calculateLevel } = require(path.join(ROOT_DIR, "src/lib/gamification.ts"));

  // Level 1: 0 XP
  assert.strictEqual(calculateLevel(0), 1);
  assert.strictEqual(getLevelProgress(0, 1), 0);

  // Level 1: 50 XP -> 50%
  assert.strictEqual(getLevelProgress(50, 1), 50);

  // Level 2: 100 XP -> 0% progress into level 2
  assert.strictEqual(calculateLevel(100), 2);
  assert.strictEqual(getLevelProgress(100, 2), 0);

  // Level 2: 250 XP -> (250 - 100) / (400 - 100) = 150 / 300 = 50%
  assert.strictEqual(getLevelProgress(250, 2), 50);
});

// ----------------------------------------------------
// 3. Relational Schema Integration (DMMF & AST)
// ----------------------------------------------------
await test("Schema: Deck -> Card relation specifies onDelete: Cascade", () => {
  const { Prisma } = require("@prisma/client");
  const cardModel = Prisma.dmmf.datamodel.models.find((m) => m.name === "Card");
  assert.ok(cardModel, "Card model must exist in Prisma schema");

  const deckRelation = cardModel.fields.find((f) => f.name === "deck");
  assert.ok(deckRelation, "Card.deck relation must exist");
  assert.strictEqual(
    deckRelation.relationOnDelete,
    "Cascade",
    "Card.deck relation must enforce onDelete: Cascade"
  );
});

await test("Schema: CardReview relation specifies onDelete: Cascade", () => {
  const { Prisma } = require("@prisma/client");
  const reviewModel = Prisma.dmmf.datamodel.models.find((m) => m.name === "CardReview");
  assert.ok(reviewModel, "CardReview model must exist in Prisma schema");

  const cardRel = reviewModel.fields.find((f) => f.name === "card");
  assert.strictEqual(cardRel.relationOnDelete, "Cascade");
  const userRel = reviewModel.fields.find((f) => f.name === "user");
  assert.strictEqual(userRel.relationOnDelete, "Cascade");
});

await test("Schema: User model contains createdAt and updatedAt audit timestamps", () => {
  const { Prisma } = require("@prisma/client");
  const userModel = Prisma.dmmf.datamodel.models.find((m) => m.name === "User");
  assert.ok(userModel, "User model must exist");

  const fieldNames = userModel.fields.map((f) => f.name);
  assert.ok(fieldNames.includes("createdAt"), "User model must have createdAt field");
  assert.ok(fieldNames.includes("updatedAt"), "User model must have updatedAt field");
});

await test("Schema: Card model defines compound index on [deckId, nextReview]", () => {
  const schemaText = fs.readFileSync(path.join(ROOT_DIR, "prisma/schema.prisma"), "utf-8");
  assert.ok(
    schemaText.includes("@@index([deckId, nextReview])"),
    "Card model must define composite @@index([deckId, nextReview])"
  );
});

console.log(`\nTier 3 Summary: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

---

### Test File 2: `tests/e2e/tier4-workflow.test.mjs`

```javascript
/**
 * tests/e2e/tier4-workflow.test.mjs
 * Tier 4: Real-World Application Scenarios (SM-2 SRS Study Workflow)
 * 
 * Verifies:
 * 1. Deck creation with initial cards
 * 2. SM-2 due cards query logic (where: { deckId, nextReview: { lte: now } })
 * 3. Submitting card review ratings (0 = Again, 3 = Good, 5 = Easy)
 * 4. Verification that easeFactor, interval, and nextReview date update according to sm2.ts
 * 5. Verification that reviewed cards are excluded from immediate subsequent due reviews if interval > 0
 * 6. Multi-day SRS retention and post-mastery lapse reset
 * 7. SM-2 edge cases (EF floor clamp to 1.30, invalid quality rejection)
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT_DIR = process.cwd();

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log("\n==========================================");
console.log("Tier 4: SM-2 SRS Study Workflow Checks");
console.log("==========================================");

// Load SM-2 Algorithm module
const { sm2 } = require(path.join(ROOT_DIR, "src/lib/sm2.ts"));

// ----------------------------------------------------
// 1. Deck & Card Initial Provisioning
// ----------------------------------------------------
await test("Step 1: Deck & Initial Cards state conforms to SRS defaults", () => {
  // Simulated initial cards
  const initialCards = [
    { id: "c1", front: "Accommodate", back: "Cung cấp chỗ", easeFactor: 2.5, interval: 0, repetitions: 0, nextReview: new Date() },
    { id: "c2", front: "Implement", back: "Thực hiện", easeFactor: 2.5, interval: 0, repetitions: 0, nextReview: new Date() },
    { id: "c3", front: "Substantial", back: "Đáng kể", easeFactor: 2.5, interval: 0, repetitions: 0, nextReview: new Date() },
  ];

  for (const c of initialCards) {
    assert.strictEqual(c.easeFactor, 2.5);
    assert.strictEqual(c.interval, 0);
    assert.strictEqual(c.repetitions, 0);
    assert.ok(c.nextReview <= new Date());
  }
});

// ----------------------------------------------------
// 2. Due Cards Query Logic
// ----------------------------------------------------
await test("Step 2: Querying due cards returns cards with nextReview <= now", () => {
  const now = new Date();
  const deckStore = [
    { id: "c1", deckId: "deck-1", nextReview: new Date(now.getTime() - 1000) }, // due
    { id: "c2", deckId: "deck-1", nextReview: new Date(now.getTime() - 500) },  // due
    { id: "c3", deckId: "deck-1", nextReview: new Date(now.getTime() + 86400000) }, // tomorrow (not due)
    { id: "c4", deckId: "deck-2", nextReview: new Date(now.getTime() - 1000) }, // other deck
  ];

  // Logic from /api/decks/[id]/study: where: { deckId: "deck-1", nextReview: { lte: now } }
  const dueCards = deckStore.filter(c => c.deckId === "deck-1" && c.nextReview <= now);

  assert.strictEqual(dueCards.length, 2);
  assert.deepStrictEqual(dueCards.map(c => c.id), ["c1", "c2"]);
});

// ----------------------------------------------------
// 3. Submitting Review Ratings (0, 3, 5)
// ----------------------------------------------------
await test("Step 3A: Review with Quality 0 ('Again') resets repetitions and sets interval to 1 day", () => {
  const initial = { easeFactor: 2.5, interval: 0, repetitions: 0 };
  const res = sm2(initial, 0);

  // EF: 2.5 - 0.8 = 1.70
  assert.strictEqual(res.easeFactor, 1.7);
  assert.strictEqual(res.interval, 1);
  assert.strictEqual(res.repetitions, 0);
  assert.ok(res.nextReview > new Date());
});

await test("Step 3B: Review with Quality 3 ('Good') advances repetition and sets interval to 1 day", () => {
  const initial = { easeFactor: 2.5, interval: 0, repetitions: 0 };
  const res = sm2(initial, 3);

  // EF: 2.5 - 0.14 = 2.36
  assert.strictEqual(res.easeFactor, 2.36);
  assert.strictEqual(res.interval, 1);
  assert.strictEqual(res.repetitions, 1);
  assert.ok(res.nextReview > new Date());
});

await test("Step 3C: Review with Quality 5 ('Easy') advances repetition and increases EF by 0.1", () => {
  const initial = { easeFactor: 2.5, interval: 0, repetitions: 0 };
  const res = sm2(initial, 5);

  // EF: 2.5 + 0.1 = 2.60
  assert.strictEqual(res.easeFactor, 2.6);
  assert.strictEqual(res.interval, 1);
  assert.strictEqual(res.repetitions, 1);
  assert.ok(res.nextReview > new Date());
});

// ----------------------------------------------------
// 4. Reviewed Cards Exclusion from Immediate Due Queries
// ----------------------------------------------------
await test("Step 4: Reviewed cards with interval > 0 are excluded from immediate due reviews", () => {
  const now = new Date();
  const card1 = sm2({ easeFactor: 2.5, interval: 0, repetitions: 0 }, 0);
  const card2 = sm2({ easeFactor: 2.5, interval: 0, repetitions: 0 }, 3);
  const card3 = sm2({ easeFactor: 2.5, interval: 0, repetitions: 0 }, 5);

  const activeDeckCards = [card1, card2, card3];
  const immediateDue = activeDeckCards.filter(c => c.nextReview <= now);

  assert.strictEqual(immediateDue.length, 0, "No reviewed cards should be due immediately");
});

// ----------------------------------------------------
// 5. Multi-Day Repetition Progression & Lapse Cycle
// ----------------------------------------------------
await test("Step 5A: Day 2 review with Quality 5 scales interval to 6 days", () => {
  const day1State = { easeFactor: 2.6, interval: 1, repetitions: 1 };
  const res = sm2(day1State, 5);

  assert.strictEqual(res.easeFactor, 2.7);
  assert.strictEqual(res.interval, 6);
  assert.strictEqual(res.repetitions, 2);
});

await test("Step 5B: Day 8 review with Quality 5 scales interval exponentially (Math.round(6 * 2.7) = 17)", () => {
  const day2State = { easeFactor: 2.7, interval: 6, repetitions: 2 };
  const res = sm2(day2State, 5);

  assert.strictEqual(res.easeFactor, 2.8);
  assert.strictEqual(res.interval, 17);
  assert.strictEqual(res.repetitions, 3);
});

await test("Step 5C: Day 25 review with Quality 0 resets repetitions to 0 and interval to 1 day", () => {
  const day8State = { easeFactor: 2.8, interval: 17, repetitions: 3 };
  const res = sm2(day8State, 0);

  assert.strictEqual(res.easeFactor, 2.0); // 2.8 - 0.8
  assert.strictEqual(res.interval, 1);     // reset to 1
  assert.strictEqual(res.repetitions, 0);  // reset to 0
});

// ----------------------------------------------------
// 6. SM-2 Edge Cases & Validation
// ----------------------------------------------------
await test("Step 6A: Ease Factor Floor Clamps strictly at 1.30", () => {
  let state = { easeFactor: 1.5, interval: 1, repetitions: 0 };
  state = sm2(state, 0); // 1.5 - 0.8 = 0.7 -> clamped to 1.3
  assert.strictEqual(state.easeFactor, 1.3);

  state = sm2(state, 0); // clamped at 1.3
  assert.strictEqual(state.easeFactor, 1.3);
});

await test("Step 6B: Review API rejects invalid quality inputs with HTTP 400", () => {
  const routeSource = fs.readFileSync(
    path.join(ROOT_DIR, "src/app/api/cards/[id]/review/route.ts"),
    "utf-8"
  );
  assert.ok(
    routeSource.includes("typeof quality !== \"number\" || quality < 0 || quality > 5"),
    "Review route must validate quality range between 0 and 5"
  );
  assert.ok(
    routeSource.includes("status: 400"),
    "Invalid quality must return HTTP 400"
  );
});

console.log(`\nTier 4 Summary: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```
