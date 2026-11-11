## 2026-11-10T13:19:19Z
You are the Worker for Milestone 1: Type & Lint Remediation.
Working directory: e:\GitHub\FlashCard
State folder: e:\GitHub\FlashCard\.agents\teamwork\teamwork_worker_m1_1\
Original request path: e:\GitHub\FlashCard\.agents\teamwork\ORIGINAL_REQUEST.md
Scope document: e:\GitHub\FlashCard\.agents\teamwork\sub_orch_m1\SCOPE.md
Project document: e:\GitHub\FlashCard\.agents\teamwork\orchestrator\PROJECT.md
Survey analysis: e:\GitHub\FlashCard\.agents\teamwork\teamwork_explorer_survey_1\handoff.md & e:\GitHub\FlashCard\.agents\teamwork\teamwork_explorer_survey_1\analysis.md
Caller agent ID: 64ba6590-4990-4e99-9012-fd54a56c8f4a

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Tasks:
1. First read `ORIGINAL_REQUEST.md`, `SCOPE.md`, and `teamwork_explorer_survey_1\handoff.md`.
2. Fix TypeScript compile error TS2322 in `src/app/api/user/stats/route.ts`:
   Change `request: Request` to `request: NextRequest` (import from `next/server`) or use `getServerSession(authOptions)` consistent with other API routes.
3. Fix all 31 ESLint errors and 5 warnings across the codebase without using `@ts-ignore`, `eslint-disable`, or dummy types:
   - `src/app/admin/layout.tsx`: Remove unused imports (`useEffect`, `router`).
   - `src/app/api/ai/generate/route.ts`: Type narrow catch block `(error: unknown)` and check `instanceof Error`.
   - `src/app/api/auth/change-password/route.ts`: Fix unused `req` parameter, remove or prefix unused `error` in catch, type narrow errors instead of `any`.
   - `src/app/api/decks/import/route.ts`: Replace explicit `any` usages with proper TypeScript interfaces for imported cards/data and unknown narrowing.
   - `src/app/api/decks/import-ai/route.ts`: Replace explicit `any` usages with proper interfaces for AI response parsing and cards.
   - `src/app/api/quiz/generate/route.ts`: Fix unused `e` parameter in catch block.
   - `src/app/dashboard/page.tsx`: Replace `any` with proper deck types; fix `react-hooks/exhaustive-deps` for `fetchDecks` (e.g. wrap with `useCallback` or move inside `useEffect`).
   - `src/app/profile/page.tsx`: Replace `any` with proper typing.
   - `src/app/register/page.tsx`: Replace `any` with proper typing.
   - `src/components/DashboardStats.tsx`: Remove unused `session`, replace `any` with proper stats interfaces.
   - `src/components/UserStatsDisplay.tsx`: Remove unused declarations (`session`, `updatedStats`, `e`), replace `any` with proper interfaces.
   - `src/components/UserAvatar.tsx`: Replace `<img>` with `next/image` (`Image` component) or use Next.js image best practices.
   - `src/lib/studyAudio.ts`: Replace `any` with proper types for AudioContext/AudioBuffer; assign the object to a named constant before `export default` (or export named functions) to fix `import/no-anonymous-default-export`.
4. Update `package.json`:
   Add `"typecheck": "tsc --noEmit"` to the `"scripts"` section.
5. Update `next.config.mjs`:
   Remove `ignoreBuildErrors: true` and `ignoreDuringBuilds: true` (or remove the `typescript` and `eslint` ignore blocks completely so Next.js enforces builds).
6. Verification:
   Run:
   - `npx tsc --noEmit`
   - `npm run lint`
   Both MUST exit with 0 errors. Document the exact command outputs in your handoff report.
7. Deliverable:
   Write a comprehensive handoff report to:
   `e:\GitHub\FlashCard\.agents\teamwork\teamwork_worker_m1_1\handoff.md`
   When complete, send a message back to caller (64ba6590-4990-4e99-9012-fd54a56c8f4a).
