## 2026-11-10T14:18:03Z
You are the Worker for Milestone 4: Functional & SM-2 Alignment.

Working directory: e:\GitHub\FlashCard
State folder: e:\GitHub\FlashCard\.agents\teamwork\worker_m4_1\
Original request path: e:\GitHub\FlashCard\.agents\teamwork\ORIGINAL_REQUEST.md
Project document: e:\GitHub\FlashCard\.agents\teamwork\orchestrator\PROJECT.md
Scope document: e:\GitHub\FlashCard\.agents\teamwork\sub_orch_m4\SCOPE.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Task:
Implement the required changes for Milestone 4 across the following owned files:
1. `src/app/decks/[id]/study/page.tsx`:
   - Change card fetch from `/api/decks/${deckId}/cards` to `/api/decks/${deckId}/study` to ensure only due cards are presented.
   - When no cards are due (empty array returned), render a user-friendly empty/completion state (e.g., "All caught up! No cards due for review right now.", with actions to return to deck or dashboard).
   - Ensure the study session rating buttons (0-5 / Again, Hard, Good, Easy) seamlessly submit to `/api/cards/${card.id}/review` with payload `{ quality }`.
   - Maintain excellent UX, state transitions, audio cues, and progress indicators.
2. `src/components/UserAvatar.tsx`:
   - Fix the `@next/next/no-img-element` warning cleanly (e.g., using `next/image` or compliant component, handling image error fallbacks or unoptimized flags if external avatars are used).
3. `src/lib/studyAudio.ts`:
   - Fix `import/no-anonymous-default-export` by assigning the object to a named const (`const studyAudio = { ... }; export default studyAudio;`).

Verification:
Run and report the exact results of the following commands:
- `node tests/e2e/tier4-workflow.test.mjs`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`

Deliver your findings and verification results in `e:\GitHub\FlashCard\.agents\teamwork\worker_m4_1\handoff.md` following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
When finished, send a message back to the orchestrator.
