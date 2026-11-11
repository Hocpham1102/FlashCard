# Spec Miner Tier 3 & 4 Dispatch
Assigned task: Investigate and specify Tier 3 cross-feature integration and Tier 4 real-world study workflow tests.


## 2026-11-10T13:20:12Z
You are the E2E Tier 3 & Tier 4 Spec Miner for the FlashCard project under the Dual Track architecture.
Working directory: e:\GitHub\FlashCard
State folder: e:\GitHub\FlashCard\.agents\teamwork\spec_miner_e2e_tier3_4\
Original request path: e:\GitHub\FlashCard\.agents\teamwork\ORIGINAL_REQUEST.md
Project document: e:\GitHub\FlashCard\.agents\teamwork\orchestrator\PROJECT.md
Scope document: e:\GitHub\FlashCard\.agents\teamwork\sub_orch_e2e\SCOPE.md

MANDATORY: You MUST read ORIGINAL_REQUEST.md before starting work.
DO NOT CHEAT. All test specifications must be genuine and verifiable.

Your Objective:
Investigate and design the exact specifications for:
- Tier 3: Cross-Feature Integration Checks
- Tier 4: Real-World Application Scenarios (SM-2 SRS Study Workflow)

Specifically:
1. Tier 3 Integration Specifications:
   - Prisma Client Singleton lazy connection: Test importing `src/lib/prisma.ts` in isolation with unset or dummy `DATABASE_URL` to assert that no eager `$connect()` executes and no unhandled promise rejections / crashes occur during static import.
   - User stats route integration: Test `/api/user/stats` with mock authenticated session to ensure stats aggregation logic executes, response contains `{ cardsLearned, streakDays, totalStudyTime, xp, level }`, and typing conforms to NextRequest.
   - Relational schema integration: Verify Prisma relations and schema models (Deck -> Cards relation, cascade delete rules, User model with `createdAt`/`updatedAt` fields).
2. Tier 4 Real-World Application Workflow Specifications:
   - End-to-end SM-2 study session flow:
     * Deck creation with initial cards
     * SM-2 due cards query logic (`where: { deckId, nextReview: { lte: now } }`)
     * Submitting card review ratings (0 = Again, 3 = Good, 5 = Easy)
     * Verifying that `easeFactor`, `interval`, and `nextReview` date update according to `sm2.ts` algorithms.
     * Verifying that reviewed cards are properly excluded from immediate subsequent due reviews if `interval > 0`.
3. Design how `tests/e2e/tier3-integration.test.mjs` and `tests/e2e/tier4-workflow.test.mjs` should be structured and executed.
4. Document the complete findings and test specifications in `e:\GitHub\FlashCard\.agents\teamwork\spec_miner_e2e_tier3_4\handoff.md`.
5. Send a message to your parent upon completion with the path to your handoff report.
