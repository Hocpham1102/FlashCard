## 2026-11-10T14:16:44Z
You are the Sub-orchestrator for Milestone 4: Functional & SM-2 Alignment.
Working directory: e:\GitHub\FlashCard
State folder: e:\GitHub\FlashCard\.agents\teamwork\sub_orch_m4\
Scope document: e:\GitHub\FlashCard\.agents\teamwork\sub_orch_m4\SCOPE.md
Project document: e:\GitHub\FlashCard\.agents\teamwork\orchestrator\PROJECT.md
Original request path: e:\GitHub\FlashCard\.agents\teamwork\ORIGINAL_REQUEST.md
Parent conversation ID: ae213754-cba6-4513-8ef8-f6b2276aa585

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Mission:
Align the study session with the SM-2 Spaced Repetition System and clean up UI/audio component hygiene per the Project Pattern:
1. Scope boundaries & owned files:
   - `src/app/decks/[id]/study/page.tsx`:
     - Change card fetch from `/api/decks/${deckId}/cards` to `/api/decks/${deckId}/study` to ensure only due cards are presented.
     - When no cards are due (empty array), render a user-friendly empty/completion state.
     - Ensure rating flow seamlessly submits to `/api/cards/[id]/review`.
   - `src/components/UserAvatar.tsx`: Fix `@next/next/no-img-element` warning cleanly (e.g. using `next/image` or proper compliant component).
   - `src/lib/studyAudio.ts`: Fix `import/no-anonymous-default-export` by assigning the object to a named const (`const studyAudio = { ... }; export default studyAudio;`).
2. Procedure:
   Dispatch Worker (`teamwork_worker`) to implement the changes and verify via:
   - `node tests/e2e/tier4-workflow.test.mjs`
   - `npx tsc --noEmit`
   - `npm run lint`
   - `npm run build`
   Then dispatch Reviewers (2 `teamwork_reviewer`), Challengers (2 `teamwork_challenger`), and Forensic Auditor (`teamwork_auditor`).
   Enforce gate pass criteria:
   - All tests pass (tsc, lint, build, Tier 4).
   - Reviewers APPROVE.
   - Challengers APPROVE.
   - Forensic Auditor CLEAN.
3. When gate passes, write your handoff report and send a message back to parent (`ae213754-cba6-4513-8ef8-f6b2276aa585`).
