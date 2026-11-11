# Scope: Milestone 1 — Type & Lint Remediation

## Mission
Eliminate all TypeScript compilation errors, fix all 31 ESLint errors and warnings across the codebase, add `typecheck` script to `package.json`, and remove build bypass suppression flags in `next.config.mjs`.

## Features
- Feature 1: Fix TS2322 in `src/app/api/user/stats/route.ts:11` (`Request` vs `NextRequest` or use `getServerSession`).
- Feature 2: Fix all 31 ESLint errors and 5 warnings in 10 files (replace `any` with precise types / `unknown` type narrowing, remove unused vars, satisfy react-hooks).
- Feature 3: Add `"typecheck": "tsc --noEmit"` in `package.json`.
- Feature 4: Remove `ignoreBuildErrors: true` and `ignoreDuringBuilds: true` in `next.config.mjs`.

## Files Owned Exclusively
- `src/app/api/user/stats/route.ts`
- `src/app/admin/layout.tsx`
- `src/app/api/ai/generate/route.ts`
- `src/app/api/auth/change-password/route.ts`
- `src/app/api/decks/import/route.ts`
- `src/app/api/decks/import-ai/route.ts`
- `src/app/api/quiz/generate/route.ts`
- `src/app/dashboard/page.tsx`
- `src/app/profile/page.tsx`
- `src/app/register/page.tsx`
- `src/components/DashboardStats.tsx`
- `src/components/UserStatsDisplay.tsx`
- `src/components/UserAvatar.tsx`
- `src/lib/studyAudio.ts`
- `package.json`
- `next.config.mjs`

## Exit Criteria
- [x] `npx tsc --noEmit` exits with 0 errors.
- [x] `npm run lint` exits with 0 errors.
- [x] Worker, Reviewer, Challenger, and Auditor pass.

## Status
**DONE** (Gate Passed on Iteration 1)
