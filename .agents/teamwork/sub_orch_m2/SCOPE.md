# Scope: Milestone 2 - Prisma & Database Hardening

## Architecture
- Prisma Schema, connection pooling singleton, migrations, environment configuration, database query optimization (indices).

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|--------|
| 1 | .env.example | Document required environment variables and local fallback defaults | M2 | Survey / Dispatch | DONE |
| 2 | Safe Lazy Prisma Singleton | Eliminate eager prisma.$connect(), implement lazy singleton in src/lib/prisma.ts | M2 | Survey / Dispatch | DONE |
| 3 | User Timestamps | Add createdAt and updatedAt to User model | M2 | Survey / Dispatch | DONE |
| 4 | Card Indexing | Add composite index @@index([deckId, nextReview]) | M2 | Survey / Dispatch | DONE |
| 5 | Auth Indices | Add foreign key index on Account(userId) and Session(userId) | M2 | Survey / Dispatch | DONE |
| 6 | QuizAnswer Relation & Index | Link QuizAnswer relation to Card and add @@index([cardId]) | M2 | Survey / Dispatch | DONE |
| 7 | Admin Stats Query Fix | Update user sorting to createdAt: "desc" in src/app/api/admin/stats/route.ts | M2 | Survey / Dispatch | DONE |
| 8 | Baseline Migration | Generate initial Prisma migration representing full schema in prisma/migrations/ | M2 | Survey / Dispatch | DONE |

## Code Boundaries / Owned Files
- `.env.example`
- `src/lib/prisma.ts`
- `prisma/schema.prisma`
- `src/app/api/admin/stats/route.ts`
- `prisma/migrations/**`

## Verification Summary
- `npx prisma validate`: Exit 0 (Schema valid)
- `node node_modules/prisma/build/index.js generate`: Exit 0 (Prisma Client v5.22.0 generated)
- Lazy import test: Exit 0 (Zero premature TCP/DB connection errors, named and default exports identical)
- Static page generation: Exit 0 (`npm run build` generated 21/21 static pages cleanly)
- Zero migration drift: `prisma/migrations/0_init/migration.sql` exactly matches datamodel AST
- `npx tsc --noEmit` & `npm run lint`: Exit 0
- Gate Verdicts: Reviewers (2) APPROVE, Challengers (2) APPROVE, Auditor CLEAN.
