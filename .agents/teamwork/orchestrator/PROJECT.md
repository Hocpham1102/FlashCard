# Project: FlashCard Remediation & System Hardening

## Architecture
- **Framework**: Next.js 14 App Router, React 18, Tailwind CSS, Lucide icons.
- **Language & Runtime**: TypeScript 5, Node.js (Windows).
- **ORM & Database**: Prisma ORM 5.22.0, PostgreSQL (Supabase / Local).
- **Authentication**: NextAuth v4 (Credentials Provider, Google OAuth Provider, PrismaAdapter).
- **External Integrations**: Google Gemini API (@google/generative-ai) for AI deck generation.
- **Core Modules**:
  - `src/app/api`: REST API routes (Auth, Cards, Decks, Quiz, AI, User Stats, Admin).
  - `src/lib`: Prisma Client (`prisma.ts`), SM-2 Algorithm (`sm2.ts`), Auth config (`auth.ts`), Audio (`studyAudio.ts`).
  - `src/components`: UI components (Navbar, UserAvatar, DashboardStats, UserStatsDisplay, Modals).
  - `src/middleware.ts`: Route protection and session authorization.
  - `prisma/schema.prisma`: Data models (User, Account, Session, Deck, Card, CardReview, QuizSession, QuizAnswer, UserStats, DailyActivity, Achievement).

## Feature Inventory
| # | Feature / Defect | Description | Milestone | Source |
|---|------------------|-------------|-----------|--------|
| 1 | TypeScript Compile Error | Fix TS2322 in `src/app/api/user/stats/route.ts:11` (`Request` -> `NextRequest` / `getServerSession`) | M1 | Explorer 1, 3 |
| 2 | ESLint Quality Fixes | Fix 31 ESLint errors and 5 warnings across 10 files (unused vars, explicit `any`, hook deps) | M1 | Explorer 1, 3 |
| 3 | Package Scripts & Checks | Add `"typecheck": "tsc --noEmit"` and verify scripts in `package.json` | M1 | Explorer 1 |
| 4 | Build Configuration Integrity | Remove `ignoreBuildErrors: true` and `ignoreDuringBuilds: true` in `next.config.mjs` | M1 | Explorer 1, 2, 3 |
| 5 | Environment Template | Create `.env.example` documenting all required variables (`DATABASE_URL`, `DIRECT_URL`, etc.) | M2 | Explorer 1, 2, 3 |
| 6 | Prisma Client Singleton | Refactor `src/lib/prisma.ts` to remove eager top-level `$connect()`, preventing build failures | M2 | Explorer 1, 2 |
| 7 | User Model Audit Timestamps | Add `createdAt` and `updatedAt` to `User` model; update `src/app/api/admin/stats/route.ts` | M2 | Explorer 2, 3 |
| 8 | Database Relations & Indexes | Add `Card` index `@@index([deckId, nextReview])`, FK indexes for NextAuth & QuizAnswer | M2 | Explorer 2 |
| 9 | Migration Drift Resolution | Create baseline/comprehensive migration representing all current Prisma models | M2 | Explorer 2 |
| 10 | Route Protection Middleware | Update `src/middleware.ts` to protect `/api/cards/:path*` and `/profile` | M3 | Explorer 3 |
| 11 | Card Authorization & IDOR Fix | Enforce `getServerSession` and deck ownership in `src/app/api/cards/[id]/route.ts` (PUT/DELETE) | M3 | Explorer 2, 3 |
| 12 | Deck Cards IDOR Fix | Enforce deck ownership in `src/app/api/decks/[id]/cards/route.ts` for GET (private) and POST | M3 | Explorer 2, 3 |
| 13 | Card Review Auth Fix | Enforce session and ownership in `src/app/api/cards/[id]/review/route.ts` | M3 | Explorer 2, 3 |
| 14 | Quiz Answer Leakage Fix | Strip `correctAnswer` and `isCorrect` before returning questions in `/api/quiz/generate` | M3 | Explorer 2, 3 |
| 15 | Quiz Grading & Anti-Replay | Server-side validation of answers and idempotent `completedAt` check in `/api/quiz/submit` | M3 | Explorer 2, 3 |
| 16 | AI Generation Hardening | Add input validation on `cardCount` and quota/error handling in `/api/ai/generate` | M3 | Explorer 3 |
| 17 | Spaced Repetition Study Flow | Update `src/app/decks/[id]/study/page.tsx` to fetch due cards from `/api/decks/[id]/study` | M4 | Explorer 3 |
| 18 | UI & Audio Cleanliness | Fix next/image in `UserAvatar.tsx` and named export in `studyAudio.ts` | M4 | Explorer 1, 3 |
| 19 | Opaque-Box E2E Test Suite | Create automated test suite for TypeScript, ESLint, Prisma, Security endpoints | E2E | R1, R2, Acceptance Criteria |
| 20 | Final Acceptance & Hardening | 100% pass across tsc, lint, build, prisma validate, and adversarial challenge | M5 | Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Type & Lint Remediation | Features 1, 2, 3, 4: Fix TS2322, all 31 ESLint errors + warnings, add typecheck, remove build ignore flags | none | **DONE** (Gate: PASS, 0 errors, clean audit) |
| M2 | Prisma & Environment Hardening | Features 5, 6, 7, 8, 9: `.env.example`, lazy Prisma singleton, User timestamps, indexes, migration alignment | none | **DONE** (Gate: PASS, clean audit, 0% drift migration) |
| E2E | E2E Testing Track | Feature 19: Test infra, Tiers 1-4 test runner, TEST_INFRA.md, TEST_READY.md (49 tests) | none | **DONE** (Gate: PASS, clean audit, TEST_READY.md published) |
| M3 | Security & API Authorization | Features 10, 11, 12, 13, 14, 15, 16: Middleware protection, IDOR prevention, Quiz answer strip & grading anti-replay | M1, M2 | **DONE** (Gate: PASS, 22/22 Tier 2 tests pass, clean audit) |
| M4 | Functional & SM-2 Alignment | Features 17, 18: Study page due-cards SRS flow, UI/Audio warnings cleanup | M1, M3 | **DONE** (Gate: PASS, 12/12 Tier 4 tests pass, clean audit) |
| M5 | Final Milestone: Full E2E & Adversarial Hardening | Feature 20: 100% pass tsc, lint, build, prisma validate, E2E test suite (49 tests), and clean forensic audit | M1, M2, M3, M4, E2E | IN_PROGRESS (a1ba5b1b-c75f-4c91-a3e4-7c24efcaa2e6) |

## Interface Contracts
### Client ↔ `/api/quiz/generate`
- Output: Questions array where each choice object contains `{ id: string, text: string }`. `isCorrect` and `correctAnswer` MUST NOT be leaked to the client.

### Client ↔ `/api/quiz/submit`
- Input: `{ sessionId: string, answers: { cardId: string, selectedAnswer: string }[] }`.
- Server behavior: Verifies `selectedAnswer` against `Card` record in database. Checks `session.completedAt === null`. Rejects repeat submissions with 400.

### Client ↔ `/api/cards/[id]` (PUT & DELETE)
- Server behavior: Validates `session.user.id`. Finds card, retrieves `card.deckId`, checks `deck.userId === session.user.id`. Returns 401 if unauthenticated, 403 if unauthorized, 404 if not found.

### Client ↔ `/api/decks/[id]/cards` (GET & POST)
- Server behavior: For GET: If deck is private (`isPublic === false`), user must be owner. For POST: User must be owner. Returns 403 if not owner.

## Code Layout
- `src/app/api/**`: Backend API endpoints.
- `src/lib/**`: Core utility libraries (`prisma.ts`, `sm2.ts`, `auth.ts`, `studyAudio.ts`).
- `src/middleware.ts`: Next.js Edge Middleware for routing and session checks.
- `prisma/**`: Database schema (`schema.prisma`) and migrations.
- `src/components/**`: Reusable UI elements.
- `src/app/**`: Next.js pages and layouts.
- `tests/e2e/**`: Automated integration and security test scripts.
