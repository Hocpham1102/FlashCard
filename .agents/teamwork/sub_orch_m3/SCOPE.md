# Scope: Milestone 3 — Security & API Authorization

## Overview
Remediate all security vulnerabilities, authorization gaps (IDOR), quiz answer leakage, infinite XP replay exploits, and unauthenticated card/deck mutations across the application.

## Feature Inventory Coverage
| # | Feature / Defect | Description | Milestone | Source | Status |
|---|------------------|-------------|-----------|--------|--------|
| 10 | Route Protection Middleware | Update `src/middleware.ts` to protect `/api/cards/:path*` and `/profile` | M3 | Explorer 3 | **DONE** |
| 11 | Card Authorization & IDOR Fix | Enforce `getServerSession` and deck ownership in `src/app/api/cards/[id]/route.ts` (PUT/DELETE) | M3 | Explorer 2, 3 | **DONE** |
| 12 | Deck Cards IDOR Fix | Enforce deck ownership in `src/app/api/decks/[id]/cards/route.ts` for GET (private) and POST | M3 | Explorer 2, 3 | **DONE** |
| 13 | Card Review Auth Fix | Enforce session and ownership in `src/app/api/cards/[id]/review/route.ts` | M3 | Explorer 2, 3 | **DONE** |
| 14 | Quiz Answer Leakage Fix | Strip `correctAnswer` and `isCorrect` before returning questions in `/api/quiz/generate` | M3 | Explorer 2, 3 | **DONE** |
| 15 | Quiz Grading & Anti-Replay | Server-side validation of answers against DB and idempotent `completedAt` check in `/api/quiz/submit` | M3 | Explorer 2, 3 | **DONE** |
| 16 | AI Generation Hardening | Add input validation on `cardCount` (1-50) and quota/error handling in `/api/ai/generate` | M3 | Explorer 3 | **DONE** |

## Scope Boundaries & Owned Files
1. `src/middleware.ts`
2. `src/app/api/cards/[id]/route.ts`
3. `src/app/api/decks/[id]/cards/route.ts`
4. `src/app/api/cards/[id]/review/route.ts`
5. `src/app/api/quiz/generate/route.ts`
6. `src/app/api/quiz/submit/route.ts`
7. `src/app/api/ai/generate/route.ts`

## Gate Verdict
- Gate Result: **PASS** (Iteration 1)
- Reviewer 1: APPROVE
- Reviewer 2: APPROVE
- Challenger 1: APPROVE (34/34 adversarial tests passed)
- Challenger 2: APPROVE (26/26 adversarial tests passed)
- Forensic Auditor: CLEAN (0 integrity violations, 0 facades, 0 hardcoded values)
- Test Verification:
  - `node tests/e2e/tier2-security.test.mjs`: 22/22 PASS (100%)
  - `node node_modules/typescript/bin/tsc --noEmit`: 0 errors
  - `node node_modules/eslint/bin/eslint.js "src/**/*.{ts,tsx,js,jsx}"`: 0 errors, 0 warnings
  - `npm run build`: 21/21 static pages generated successfully
