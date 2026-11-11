# Tier 2: Boundary & Security Vulnerability Checks — Specification Report

## 1. Observation
From inspecting the FlashCard codebase and authoritative documentation:
- `ORIGINAL_REQUEST.md`: R1 & R2 require a comprehensive audit of all functional errors, security vulnerabilities, and stability issues, with verifiable resolution.
- `PROJECT.md` Feature Inventory:
  - Feature 10: Update `src/middleware.ts` to protect `/api/cards/:path*` and `/profile`.
  - Feature 11: Enforce `getServerSession` and deck ownership in `src/app/api/cards/[id]/route.ts` (PUT/DELETE IDOR).
  - Feature 12: Enforce deck ownership in `src/app/api/decks/[id]/cards/route.ts` for GET (private deck) and POST.
  - Feature 13: Enforce session and ownership in `src/app/api/cards/[id]/review/route.ts`.
  - Feature 14: Strip `correctAnswer` and `isCorrect` before returning questions in `/api/quiz/generate`.
  - Feature 15: Server-side validation of answers and idempotent `completedAt` check in `/api/quiz/submit`.
- Codebase state inspection:
  - `src/app/api/cards/[id]/route.ts`:
    - Lines 4-37 (`PUT`): Does not import or call `getServerSession(authOptions)`. Updates `prisma.card.update({ where: { id }, data })` directly without verifying deck ownership.
    - Lines 39-66 (`DELETE`): Does not import or call `getServerSession(authOptions)`. Deletes card and decrements parent deck `cardCount` directly without verifying user ownership.
  - `src/app/api/decks/[id]/cards/route.ts`:
    - Lines 4-22 (`GET`): Does not check if deck is private (`isPublic === false`) and does not verify session or ownership.
    - Lines 24-69 (`POST`): Does not call `getServerSession(authOptions)` and does not verify deck ownership before creating cards.
  - `src/app/api/cards/[id]/review/route.ts`:
    - Lines 39-40: Calls `getServerSession(authOptions)` only optionally for gamification; executes `prisma.card.update` and SM-2 calculations even when unauthenticated or for cards belonging to other users.
  - `src/app/api/quiz/generate/route.ts`:
    - Lines 96-98: Multiple choice questions include `options: [{ text, isCorrect }]` and `correctAnswer: card.back`.
    - Lines 112-113: Meaning match questions include `options: [{ text, isCorrect }]` and `correctAnswer: card.front`.
    - Line 135: Fill blank questions include `correctAnswer: card.front`.
    - Line 151: Listening questions include `correctAnswer: card.back`.
    - Lines 170-174: Leaks all `questions` directly in HTTP response payload.
  - `src/app/api/quiz/submit/route.ts`:
    - Lines 33-51: Accepts client-supplied `a.isCorrect` and increments `correctCount` blindly without server-side card lookup or verification.
    - Lines 57-65: Does not check whether `quizSession.completedAt !== null`, allowing infinite duplicate submission replay attacks.

## 2. Logic Chain
1. **IDOR & Authorization Flaws (Cards & Decks)**:
   - In Next.js App Router, any exposed API route is reachable via HTTP unless guarded.
   - If `/api/cards/[id]` (PUT/DELETE) and `/api/decks/[id]/cards` (GET/POST) lack session validation and deck-user equality checks (`deck.userId === session.user.id`), any attacker can alter or delete arbitrary cards and view private decks simply by guessing or iterating cuid IDs.
   - Therefore, the server contract must require:
     - Unauthenticated -> 401 Unauthorized
     - Non-existent resource -> 404 Not Found
     - Mismatched user ID -> 403 Forbidden
     - Valid owner -> 200 OK (or 201 Created for POST)
2. **Quiz Answer Leakage**:
   - Returning `correctAnswer` or `isCorrect` in `/api/quiz/generate` violates confidential assessment integrity. Any browser inspection or API interceptor exposes answers before the user responds.
   - Therefore, contract requires stripping `correctAnswer` and `isCorrect` from every question object and choice item.
3. **Client-Side Grading Spoofing & Replay Attack**:
   - Trusting client-supplied `isCorrect` allows attackers to submit forged quiz results and inflate scores or gamification achievements.
   - Allowing resubmission on an already completed session allows replay attacks for repetitive score/gamification exploitation.
   - Therefore, `/api/quiz/submit` must:
     - Reject resubmissions where `completedAt !== null` with HTTP 400 Bad Request.
     - Fetch each card by `cardId` from the database and verify `selectedAnswer` server-side before computing score.
4. **Deterministic Test Execution Without Live Services**:
   - The test suite `tests/e2e/tier2-security.test.mjs` must run reliably on developer machines and CI pipelines where no Supabase PostgreSQL instance or Google OAuth credentials exist.
   - Route handlers in Next.js App Router are pure functions `(request: Request, context: { params }) => Promise<Response>`.
   - By transpiling route handlers in-memory using `typescript.transpileModule` (already present in `devDependencies`) and injecting a mock database store and mock session context, all security boundaries, status codes, payload sanitization, and anti-replay constraints can be tested deterministically in milliseconds without network calls.

## 3. Caveats
- Direct route execution via in-memory transpilation tests the route handlers directly. It does not invoke Next.js edge middleware (`src/middleware.ts`). Edge middleware behavior is specified and tested separately in route protection checks.
- When M3 implements the server-side grading in `/api/quiz/submit`, both `selectedAnswer` and `userAnswer` property names should be accepted from the request body to maintain compatibility with legacy frontend code.

## 4. Conclusion
A 22-test security and boundary test suite must be implemented in `tests/e2e/tier2-security.test.mjs`. It covers:
1. Card IDOR protection (PUT, DELETE on `/api/cards/[id]`) -> 401, 403, 404, 200.
2. Deck Cards IDOR & Privacy (GET, POST on `/api/decks/[id]/cards`) -> 401, 403, 404, 400, 200, 201.
3. Card Review Authorization (POST on `/api/cards/[id]/review`) -> 400, 401, 403, 404, 200.
4. Quiz Sanitization (POST on `/api/quiz/generate`) -> 401, 400, 403, 200 with 0% answer leakage.
5. Quiz Server-Side Grading & Anti-Replay (POST on `/api/quiz/submit`) -> 401, 400 (replay), 403, 200 with spoofed grade rejection.

## 5. Verification Method
- Independent command to run Tier 2 security tests:
  `node tests/e2e/tier2-security.test.mjs`
  or via the master runner:
  `node tests/e2e/runner.mjs --tier=2`
- Pass condition: Exit code 0, 22/22 test cases passing.
- Invalidation condition: Exit code non-zero, uncaught rejection, or leaking `isCorrect`/`correctAnswer`.

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Security / IDOR | Card Update Authorization | Enforce authentication and deck ownership on card updates | `PUT /api/cards/[id]` with JSON body `{ front?, back?, ... }` | HTTP 200 OK with updated card JSON | Unauthenticated: 401 Unauthorized. Card not found: 404. Non-owner: 403 Forbidden | `src/app/api/cards/[id]/route.ts`, PROJECT.md F11 |
| 2 | Security / IDOR | Card Deletion Authorization | Enforce authentication and deck ownership on card deletions, decrement deck `cardCount` | `DELETE /api/cards/[id]` | HTTP 200 OK `{ success: true }` | Unauthenticated: 401. Card not found: 404. Non-owner: 403 | `src/app/api/cards/[id]/route.ts`, PROJECT.md F11 |
| 3 | Security / Privacy | Private Deck Cards Access Control | Prevent unauthorized access to cards belonging to private decks (`isPublic === false`) | `GET /api/decks/[id]/cards` | HTTP 200 OK with card array | Unauthenticated on private deck: 401. Non-owner on private deck: 403. Deck not found: 404 | `src/app/api/decks/[id]/cards/route.ts`, PROJECT.md F12 |
| 4 | Security / Privacy | Public Deck Cards Access | Allow open access to cards belonging to public decks (`isPublic === true`) | `GET /api/decks/[id]/cards` | HTTP 200 OK with card array | Non-existent deck: 404 Not Found | `src/app/api/decks/[id]/cards/route.ts`, PROJECT.md F12 |
| 5 | Security / IDOR | Deck Card Addition Authorization | Prevent adding cards to another user's deck; validate inputs | `POST /api/decks/[id]/cards` with `{ front, back, ... }` | HTTP 201 Created with new card JSON | Missing front/back: 400. Unauthenticated: 401. Non-owner: 403. Deck not found: 404 | `src/app/api/decks/[id]/cards/route.ts`, PROJECT.md F12 |
| 6 | Security / IDOR | Card Review Session & Ownership | Prevent reviewing cards without login or for cards belonging to other users; validate quality | `POST /api/cards/[id]/review` with `{ quality: 0..5 }` | HTTP 200 OK with updated SM-2 card | Quality not in 0..5: 400. Unauthenticated: 401. Non-owner: 403. Card not found: 404 | `src/app/api/cards/[id]/review/route.ts`, PROJECT.md F13 |
| 7 | Security / Sanitization | Quiz MCQ Choice Sanitization | Strip `isCorrect` and `correctAnswer` from multiple choice questions | `POST /api/quiz/generate` with `{ deckId, type: "multiple_choice" }` | HTTP 200 OK `{ sessionId, questions: [{ cardId, question, options: [{ text }] }] }` | Unauthenticated: 401. Deck < 4 cards: 400. Private deck non-owner: 403 | `src/app/api/quiz/generate/route.ts`, PROJECT.md F14 |
| 8 | Security / Sanitization | Quiz Meaning Match Sanitization | Strip `isCorrect` and `correctAnswer` from meaning match questions | `POST /api/quiz/generate` with `{ deckId, type: "meaning_match" }` | HTTP 200 OK `{ sessionId, questions: [{ cardId, question, options: [{ text }] }] }` | Unauthenticated: 401. Private deck non-owner: 403 | `src/app/api/quiz/generate/route.ts`, PROJECT.md F14 |
| 9 | Security / Sanitization | Quiz Fill Blank Sanitization | Ensure fill-in-the-blank question does NOT expose `correctAnswer` to client | `POST /api/quiz/generate` with `{ deckId, type: "fill_blank" }` | HTTP 200 OK `{ sessionId, questions: [{ cardId, question, hint }] }` | Unauthenticated: 401. Private deck non-owner: 403 | `src/app/api/quiz/generate/route.ts`, PROJECT.md F14 |
| 10 | Security / Sanitization | Quiz Listening Sanitization | Strip `isCorrect` and `correctAnswer` from listening questions | `POST /api/quiz/generate` with `{ deckId, type: "listening" }` | HTTP 200 OK `{ sessionId, questions: [{ cardId, question, options: [{ text }] }] }` | Unauthenticated: 401. Private deck non-owner: 403 | `src/app/api/quiz/generate/route.ts`, PROJECT.md F14 |
| 11 | Security / Integrity | Server-Side Quiz Grading | Grade quiz answers strictly against database cards; ignore client-supplied `isCorrect` | `POST /api/quiz/submit` with `{ sessionId, answers: [{ cardId, selectedAnswer, isCorrect: true }] }` | HTTP 200 OK `{ score, correctCount, wrongCount, totalQuestions }` | Unauthenticated: 401. Session not found: 404. Non-owner session: 403. Spoofed answer graded as false | `src/app/api/quiz/submit/route.ts`, PROJECT.md F15 |
| 12 | Security / Anti-Replay | Quiz Session Anti-Replay | Block re-submission of completed quiz sessions | `POST /api/quiz/submit` with `sessionId` where `completedAt !== null` | HTTP 400 Bad Request `{ error: "Quiz session already completed" }` | Re-submission rejected with 400; previous score unchanged | `src/app/api/quiz/submit/route.ts`, PROJECT.md F15 |

---

## Edge Cases

| # | Feature | Input | Observed / Expected Behavior |
|---|---------|-------|------------------------------|
| 1 | Card PUT IDOR | Request from user B targeting card owned by user A | Return HTTP 403 Forbidden with `{ error: "Forbidden" }` (or Unauthorized). Database card data unchanged. |
| 2 | Card PUT Missing ID | Request targeting non-existent cuid `cuid_does_not_exist` | Return HTTP 404 Not Found with `{ error: "Card not found" }`. |
| 3 | Card PUT Unauthenticated | Valid card ID but session is null | Return HTTP 401 Unauthorized with `{ error: "Unauthorized" }`. |
| 4 | Card DELETE IDOR | Request from user B targeting card owned by user A | Return HTTP 403 Forbidden. Card is not deleted and parent deck count is unchanged. |
| 5 | Card DELETE Unauthenticated | Valid card ID but session is null | Return HTTP 401 Unauthorized. |
| 6 | Deck Cards GET Privacy | Unauthenticated request for private deck (`isPublic: false`) | Return HTTP 401 Unauthorized (or 403 Forbidden). No card data returned. |
| 7 | Deck Cards GET Privacy IDOR | Authenticated user B requesting cards of user A's private deck | Return HTTP 403 Forbidden. No card data returned. |
| 8 | Deck Cards GET Public Access | Unauthenticated request for public deck (`isPublic: true`) | Return HTTP 200 OK with array of cards. |
| 9 | Deck Cards POST IDOR | Authenticated user B attempting to create card in user A's deck | Return HTTP 403 Forbidden. No card created, deck count unchanged. |
| 10 | Deck Cards POST Validation | Body with empty `front: ""` or missing `back` | Return HTTP 400 Bad Request with descriptive validation error. |
| 11 | Card Review Invalid Quality | Body with `quality: -1`, `quality: 6`, or `quality: "good"` | Return HTTP 400 Bad Request with `{ error: "Quality must be a number between 0 and 5" }`. |
| 12 | Card Review IDOR | User B reviewing card owned by user A | Return HTTP 403 Forbidden. Card's SM-2 fields (`easeFactor`, `interval`, `repetitions`, `nextReview`) unchanged. |
| 13 | Card Review Unauthenticated | User submits review without session | Return HTTP 401 Unauthorized. |
| 14 | Quiz Generate Minimum Cards | Deck with only 3 cards | Return HTTP 400 Bad Request with `{ error: "Cần ít nhất 4 thẻ trong bộ để tạo quiz" }`. |
| 15 | Quiz Generate Answer Leakage | Multiple choice quiz generated for valid deck | Deep inspection of JSON response: 0 occurrences of keys `correctAnswer` or `isCorrect`. Regex check `/\"(isCorrect\|correctAnswer)\"\s*:/` fails to match. |
| 16 | Quiz Generate Privacy IDOR | User B requesting quiz on user A's private deck | Return HTTP 403 Forbidden. |
| 17 | Quiz Submit Client Spoofing | Client submits incorrect answer with `{ isCorrect: true, correctAnswer: "spoofed" }` | Server ignores client flags, queries DB card, grades as incorrect (`wrongCount: 1`, `correctCount: 0`). |
| 18 | Quiz Submit Anti-Replay | Client submits payload for a `sessionId` whose `completedAt` is non-null | Return HTTP 400 Bad Request `{ error: "Quiz session already completed" }`. Answers not duplicated. |
| 19 | Quiz Submit Session IDOR | User B submitting answers for user A's `sessionId` | Return HTTP 403 Forbidden (or 404 Not Found). |
| 20 | Quiz Submit Missing Session | Body has `{ sessionId: "" }` or missing `answers` | Return HTTP 400 Bad Request. |
| 21 | Malformed JSON Body | Request with malformed JSON payload (e.g. `{ front: `) | Route handler returns HTTP 400 / 500 cleanly without crashing Node process. |
| 22 | Empty Deck / Deleted Cards | Quiz submit references a card ID deleted from database | Server handles gracefully without throwing unhandled exception (grades wrong or skips). |

---

## Node.js Test Runner & Mock Architecture Specification

### Module & Execution Design:
1. **File Location**: `tests/e2e/tier2-security.test.mjs`
2. **Runtime**: Node.js 18+ native ESM (`.mjs`).
3. **Dependencies**: Uses built-in `node:assert`, `node:fs`, `node:path`, plus `typescript` (from `devDependencies`) to transpile route handlers dynamically.
4. **Mock Database (`MockDb`)**:
   - An in-memory store maintaining:
     - `users`: `usr_owner_1`, `usr_attacker_2`
     - `decks`:
       - `dck_priv_1`: `{ id: "dck_priv_1", userId: "usr_owner_1", isPublic: false, cardCount: 4 }`
       - `dck_pub_1`: `{ id: "dck_pub_1", userId: "usr_owner_1", isPublic: true, cardCount: 4 }`
     - `cards`:
       - `crd_1`: `{ id: "crd_1", deckId: "dck_priv_1", front: "Hello", back: "Xin chào", easeFactor: 2.5, interval: 0, repetitions: 0 }`
       - `crd_2`: `{ id: "crd_2", deckId: "dck_priv_1", front: "Goodbye", back: "Tạm biệt", easeFactor: 2.5, interval: 0, repetitions: 0 }`
       - `crd_3`: `{ id: "crd_3", deckId: "dck_priv_1", front: "Cat", back: "Con mèo", easeFactor: 2.5, interval: 0, repetitions: 0 }`
       - `crd_4`: `{ id: "crd_4", deckId: "dck_priv_1", front: "Dog", back: "Con chó", easeFactor: 2.5, interval: 0, repetitions: 0 }`
     - `quizSessions`:
       - `qs_active`: `{ id: "qs_active", userId: "usr_owner_1", deckId: "dck_priv_1", completedAt: null, totalCards: 4 }`
       - `qs_completed`: `{ id: "qs_completed", userId: "usr_owner_1", deckId: "dck_priv_1", completedAt: new Date(), totalCards: 4 }`
5. **Session Context Management**:
   ```js
   let currentSession = null;
   export function setSessionUser(user) {
     currentSession = user ? { user } : null;
   }
   ```
6. **Route Transpiler & Loader**:
   - Compiles TypeScript route files to CommonJS using `ts.transpileModule`.
   - Wraps execution with mocked `@/lib/prisma` delegating to `MockDb`, and mocked `next-auth` delegating `getServerSession` to `currentSession`.
7. **Clean Assertions**:
   - Directly calls exported `GET`, `POST`, `PUT`, `DELETE` with `new Request(url, { method, headers, body })` and `{ params }`.
   - Reads `res.status` and `await res.json()`.
   - Performs strict assertions on status codes and response bodies.
