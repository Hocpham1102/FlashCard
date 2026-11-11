# Reviewer Handoff Report — Milestone 4: Functional & SM-2 Alignment

**Reviewer**: Reviewer 2 (reviewer, critic)  
**Date**: 2026-11-10T14:38:30Z  
**Verdict**: **APPROVE**  
**Overall Risk Assessment**: LOW  
**Integrity Audit**: PASS (0 violations detected)

---

## 1. Observation

### 1.1 Scope & Target Files Reviewed
The review targeted the three implementation files modified in Milestone 4:
1. `src/app/decks/[id]/study/page.tsx`
2. `src/components/UserAvatar.tsx`
3. `src/lib/studyAudio.ts`

Interface contracts examined:
- `e:\GitHub\FlashCard\.agents\teamwork\sub_orch_m4\SCOPE.md`
- `e:\GitHub\FlashCard\.agents\teamwork\orchestrator\PROJECT.md`
- `src/app/api/decks/[id]/study/route.ts`
- `src/app/api/cards/[id]/review/route.ts`

### 1.2 Verbatim Code Observations

#### A. Study Session Page (`src/app/decks/[id]/study/page.tsx`)
- **Due Cards Retrieval**: Lines 129-132:
  ```ts
  const [deckRes, cardsRes] = await Promise.all([
    fetch(`/api/decks/${deckId}`),
    fetch(`/api/decks/${deckId}/study`),
  ]);
  ```
  Strictly fetches due cards via `/api/decks/${deckId}/study` rather than indiscriminate cards list `/api/decks/${deckId}/cards`.
- **Card ID Resolution & Rating Submission**: Lines 166-191:
  ```ts
  const handleRating = useCallback(async (option: RatingOption) => {
    if (isSubmittingReview) return;
    const card = cards[currentIndex];
    const cardId = card.id || card._id;

    setIsSubmittingReview(true);
    ...
    const res = await fetch(`/api/cards/${cardId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quality: option.quality }),
    });
  ```
  Resolves either Prisma cuid `card.id` or compatibility alias `card._id` and submits `{ quality: option.quality }` to `/api/cards/${cardId}/review`.
- **Rating Quality Mappings**: Lines 54-95:
  - "Again": `quality: 0`
  - "Hard": `quality: 2`
  - "Good": `quality: 4`
  - "Easy": `quality: 5`
  Conforms to SM-2 SRS scale (integers 0-5).
- **Empty Due State UX**: Lines 292-322:
  ```tsx
  if (isEmpty && deck) {
    const deckUrl = `/decks/${deck.id || deck._id || deckId}`;
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 sm:p-12 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">All caught up!</h2>
          <p className="text-slate-600 font-medium mb-1">
            No cards due for review right now.
          </p>
          <p className="text-slate-400 text-sm mb-8">
            Bạn đã hoàn thành tất cả các thẻ cần ôn tập trong bộ thẻ này. Hãy quay lại sau nhé!
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href={deckUrl} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-colors shadow-sm">
              Quay lại bộ thẻ
            </Link>
            <Link href="/dashboard" className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold py-2.5 px-6 rounded-xl transition-colors shadow-sm">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }
  ```
- **Session Completion**: Lines 324-387 calculate recall rate (`goodRate = ((stats.good + stats.easy) / totalCards) * 100`) and display breakdown across Again, Hard, Good, and Easy with navigation buttons.
- **Audio Feedback**: Lines 178-182 trigger tone cues: `playFeedbackTone("correct")` when `option.quality >= 3`, else `playFeedbackTone("wrong")`. Lines 250 and 478-486 handle SpeechSynthesis TTS.

#### B. Component Hygiene: `src/components/UserAvatar.tsx`
- Lines 1-38:
  ```tsx
  import Image from "next/image";
  ...
  if (user.image && !error) {
    return (
      <Image
        src={user.image}
        alt="Avatar"
        width={96}
        height={96}
        className={`${className} object-cover`}
        onError={() => setError(true)}
        referrerPolicy="no-referrer"
        unoptimized
      />
    );
  }

  return (
    <div className={`flex items-center justify-center font-bold text-white ${className} ${fallbackClassName}`}>
      {initial}
    </div>
  );
  ```
  Replaced native `<img>` with Next.js `<Image ... unoptimized />`, preventing `@next/next/no-img-element`. Gracefully catches broken images via `onError` fallback to user initial and adds `referrerPolicy="no-referrer"` preventing 403 Forbidden on Google OAuth images.

#### C. Component Hygiene: `src/lib/studyAudio.ts`
- Lines 88-97:
  ```ts
  const studyAudio = {
    isSoundEnabled,
    setSoundEnabled,
    isSpeechSynthesisSupported,
    speakText,
    stopSpeaking,
    playFeedbackTone,
  };

  export default studyAudio;
  ```
  Replaces anonymous default object export with named const `studyAudio`, completely resolving `import/no-anonymous-default-export`. Retains individual named exports for clean tree-shaking.

### 1.3 Verbatim Verification Command Outputs

#### 1. TypeScript Static Typecheck (`npx tsc --noEmit`)
```
Command exited with code 0.
(0 compile errors)
```

#### 2. ESLint Static Analysis (`npm run lint`)
```
> flashcard@0.1.0 lint
> next lint

✔ No ESLint warnings or errors
Exit code: 0
```

#### 3. Tier 4 SM-2 Workflow Checks (`node tests/e2e/tier4-workflow.test.mjs`)
```
Executing Tier 4: SM-2 SRS Study Workflow Checks...
  ✓ PASS: 4.1 Initial Provisioning: Cards initialized with SRS defaults (0ms)
  ✓ PASS: 4.2 Due Cards Retrieval: Query strictly filters by deckId and nextReview <= now (1ms)
  ✓ PASS: 4.3 Review Rating 0 ('Again'): Resets repetitions and schedules next review in 1 day (1ms)
  ✓ PASS: 4.4 Review Rating 3 ('Good'): Advances repetitions to 1 and schedules review in 1 day (0ms)
  ✓ PASS: 4.5 Review Rating 5 ('Easy'): Advances repetitions to 1 and increases EF by +0.10 (0ms)
  ✓ PASS: 4.6 Immediate Due Exclusion: Reviewed cards are excluded from immediate due reviews (1ms)
  ✓ PASS: 4.7 Multi-Day Progression: Second consecutive rating 5 sets interval to 6 days (0ms)
  ✓ PASS: 4.8 Exponential Interval: Third consecutive rating 5 scales interval via Math.round(interval * EF) (0ms)
  ✓ PASS: 4.9 Lapse Handling: Forgotten mature card resets repetitions to 0 and interval to 1 day (0ms)
  ✓ PASS: 4.10 Ease Factor Floor: Consecutive failures clamp easeFactor strictly at 1.30 minimum (0ms)
  ✓ PASS: 4.11 Input Validation: Card review endpoint rejects quality < 0 or > 5 with HTTP 400 (0ms)
  ✓ PASS: 4.12 Study API Contract: /api/decks/[id]/study filters by nextReview <= now() (0ms)
Exit code: 0
```

#### 4. Full Dual-Track E2E Test Suite (`node tests/e2e/runner.mjs`)
```
═══════════════════════════════════════════════════════════════════════════
  FLASHCARD E2E ACCEPTANCE TEST SUITE
  Tiers selected: [1, 2, 3, 4] | Verbose: false | Bail: false
═══════════════════════════════════════════════════════════════════════════

▶ Tier 1: Core Command Acceptance Checks
  ✓ PASS: 1.1 Next.js config disables ignoreBuildErrors and ignoreDuringBuilds (1ms)
  ✓ PASS: 1.2 TypeScript compilation check (tsc --noEmit) with 0 errors (5884ms)
  ✓ PASS: 1.3 ESLint static analysis check (next lint --max-warnings 0) (5298ms)
  ✓ PASS: 1.4 Prisma schema validation (prisma validate) with 0 errors (1172ms)
  ✓ PASS: 1.5 Next.js production build check (next build) (63953ms)

▶ Tier 2: Boundary & Security Vulnerability Checks (22/22 PASS)
▶ Tier 3: Cross-Feature Integration Checks (10/10 PASS)
▶ Tier 4: SM-2 SRS Study Workflow Checks (12/12 PASS)

═══════════════════════════════════════════════════════════════════════════
TEST SUITE EXECUTION SUMMARY
  Total Tests : 49
  Passed      : 49
  Failed      : 0
  Duration    : 79.98s
═══════════════════════════════════════════════════════════════════════════
RESULT: ALL TESTS PASSED (49/49)
Exit code: 0
```

---

## 2. Logic Chain

1. **Alignment with SM-2 Spaced Repetition**:
   - Upstream study route `src/app/api/decks/[id]/study/route.ts` strictly queries cards with `where: { deckId: id, nextReview: { lte: new Date() } }`.
   - By updating `src/app/decks/[id]/study/page.tsx` line 131 to fetch `/api/decks/${deckId}/study`, only due cards are loaded into the review session. Cards already reviewed today are naturally excluded until their scheduled date.
   - When no cards are due (`cardsData.length === 0`), `isEmpty` triggers the caught-up empty state, preventing confusing "No cards" messaging for populated decks.

2. **Rating Submission Integrity**:
   - Card objects from Prisma supply `id` (cuid) with `_id` alias. Resolving `card.id || card._id` at line 169 prevents undefined route params (`/api/cards/undefined/review`).
   - The payload `{ quality: option.quality }` strictly adheres to `/api/cards/[id]/review` contract, where quality values 0, 2, 4, 5 fall within the valid `[0, 5]` integer range.
   - Gamification custom event `gamificationUpdate` is safely dispatched to client listeners upon review response.

3. **Defensive UI & Resource Protection**:
   - `handleRating` guards against race conditions by checking `if (isSubmittingReview) return;` and disabling rating buttons.
   - External Google avatars often fail with 403 Forbidden without `referrerPolicy="no-referrer"`; `UserAvatar.tsx` incorporates this policy and adds `onError` state fallback to the user's initial.
   - Next.js `unoptimized` prevents internal Next.js optimizer crashes on remote hosts not whitelisted in `next.config.mjs`.

4. **Code Quality & Linter Compliance**:
   - `studyAudio.ts` naming the const prior to default export directly satisfies ESLint `import/no-anonymous-default-export` without disabling linter rules.
   - No `@ts-ignore`, no `any` casts, no disabled ESLint rules.

---

## 3. Adversarial Analysis & Stress-Testing

| Challenge / Edge Case | Attack Scenario | Observed Behavior & Defense | Blast Radius | Verdict |
|---|---|---|---|---|
| **Rapid Double-Clicking Rating Buttons** | User spams rating button or presses shortcut keys in rapid succession | `isSubmittingReview` boolean state flag immediately locks handler; buttons disabled; shortcuts blocked | Low (prevented) | **PASS** |
| **API Review Network Failure** | Review POST request fails with network error or 500 | Request wrapped in `try/catch`; UI logs non-critical error, advances user to next card after delay; unreviewed card remains due on next fetch | Minimal | **PASS** |
| **Broken Remote Avatar URL** | User has an invalid or expired avatar image URL | `<Image onError={() => setError(true)} />` instantly flips to rendering initial letter fallback box | None | **PASS** |
| **Headless Environment (No Audio Devices)** | Client browser has no Web Audio API or SpeechSynthesis | `isSpeechSynthesisSupported()` and `playFeedbackTone` guard against undefined `AudioContext` and wrap synthesis in `try/catch` | None | **PASS** |
| **Empty Deck vs Caught-Up Deck** | Deck has 0 cards created vs. all cards scheduled in future | Handled gracefully: renders "All caught up!" screen with "Quay lại bộ thẻ" and "Dashboard" links | None | **PASS** |

### Integrity Audit
- **Hardcoded test fixtures in production code**: None found.
- **Dummy/facade implementations**: None found. Real Web Audio tone synthesis, real SpeechSynthesis, real Prisma queries.
- **Shortcuts bypassing task**: None found.
- **Fabricated verification logs**: None found. Independent execution logs verified above.
- **Verdict**: PASS.

---

## 4. Caveats

No caveats. All target files have been directly reviewed, diffs verified, and full test suite validated.

---

## 5. Conclusion

Milestone 4 implementation strictly satisfies all functional, architectural, and quality requirements:
- Spaced repetition study page correctly fetches due cards via `/api/decks/${deckId}/study`.
- The empty/caught-up state displays "All caught up! No cards due for review right now." with navigation to the deck and dashboard.
- SM-2 quality ratings submit seamlessly to `/api/cards/${cardId}/review`.
- `UserAvatar.tsx` uses Next.js `Image` with fallback and `unoptimized` flag.
- `studyAudio.ts` exports named const `studyAudio`.
- All verification gates (`tsc --noEmit`, `npm run lint`, `tier4-workflow.test.mjs`, and full 49/49 `runner.mjs`) pass with 0 errors.

**Official Verdict**: **APPROVE**

---

## 6. Verification Method

To independently reproduce the verification results:

```bash
# 1. Type check
npx tsc --noEmit

# 2. Lint check
npm run lint

# 3. SM-2 Study Workflow tests
node tests/e2e/tier4-workflow.test.mjs

# 4. Clean Next.js Production Build
npm run build

# 5. Full Dual-Track E2E Test Suite (All 49 tests)
node tests/e2e/runner.mjs
```
