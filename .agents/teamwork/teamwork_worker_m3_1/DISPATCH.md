# DISPATCH — 2026-11-10T13:56:00Z

## Task Assignment for Worker (teamwork_worker_m3_1)

### Mission
Implement all security fixes, authorization checks, and anti-leak/anti-replay protections for Milestone 3 across the 7 owned files.

### Context & References
- Original Request: `e:\GitHub\FlashCard\.agents\teamwork\ORIGINAL_REQUEST.md`
- Project Document: `e:\GitHub\FlashCard\.agents\teamwork\orchestrator\PROJECT.md`
- Scope Document: `e:\GitHub\FlashCard\.agents\teamwork\sub_orch_m3\SCOPE.md`
- State Folder: `e:\GitHub\FlashCard\.agents\teamwork\teamwork_worker_m3_1\`
- Working Directory: `e:\GitHub\FlashCard`
- Parent Conversation ID: `f5bb5624-e944-43cc-9d1e-c24020624cf0`

### 🔒 MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Owned Files (Exclusively Owned by You)
1. `src/middleware.ts`
2. `src/app/api/cards/[id]/route.ts`
3. `src/app/api/decks/[id]/cards/route.ts`
4. `src/app/api/cards/[id]/review/route.ts`
5. `src/app/api/quiz/generate/route.ts`
6. `src/app/api/quiz/submit/route.ts`
7. `src/app/api/ai/generate/route.ts`

### Detailed Requirements
1. **`src/middleware.ts`**:
   - Add `/api/cards/:path*` and `/profile` (and `/profile/:path*`) to the matcher array.
2. **`src/app/api/cards/[id]/route.ts`**:
   - In both `PUT` and `DELETE`:
     - Call `const session = await getServerSession(authOptions)`. If `!session?.user?.id`, return `NextResponse.json({ error: "Unauthorized" }, { status: 401 })`.
     - Query card with its deck: `const card = await prisma.card.findUnique({ where: { id }, include: { deck: true } })`. If `!card`, return `NextResponse.json({ error: "Card not found" }, { status: 404 })`.
     - Check authorization: if `card.deck.userId !== session.user.id`, return `NextResponse.json({ error: "Forbidden" }, { status: 403 })`.
     - Execute the update / delete accordingly.
3. **`src/app/api/decks/[id]/cards/route.ts`**:
   - `GET`:
     - Fetch `const deck = await prisma.deck.findUnique({ where: { id } })`. If not found, return 404.
     - If `!deck.isPublic`:
       - Check `const session = await getServerSession(authOptions)`. If `!session?.user?.id`, return 401.
       - If `deck.userId !== session.user.id`, return 403.
     - Return the cards.
   - `POST`:
     - Check `const session = await getServerSession(authOptions)`. If `!session?.user?.id`, return 401.
     - Fetch deck: if not found, return 404. If `deck.userId !== session.user.id`, return 403.
     - Validate input: `if (!front?.trim() || !back?.trim()) return NextResponse.json({ error: "Front and back are required" }, { status: 400 })`.
     - Create card and increment deck `cardCount`. Return 201 or 200.
4. **`src/app/api/cards/[id]/review/route.ts`**:
   - Check `const session = await getServerSession(authOptions)`. If `!session?.user?.id`, return 401.
   - Fetch card with deck. If not found, return 404.
   - If `card.deck.userId !== session.user.id`, return 403.
   - Proceed with review calculation and update.
5. **`src/app/api/quiz/generate/route.ts`**:
   - Ensure `session = await getServerSession(authOptions)`.
   - In returned quiz questions and options, strip `correctAnswer` and `isCorrect` so that client never receives answer keys or flags. Options should only contain `{ id: string, text: string }` or text choices without `isCorrect`.
6. **`src/app/api/quiz/submit/route.ts`**:
   - Check `session`. If not authenticated, return 401.
   - Query quiz session: `prisma.quizSession.findUnique({ where: { id: sessionId } })`. If not found, return 404.
   - If `quizSession.completedAt !== null`, return `NextResponse.json({ error: "Quiz session already completed" }, { status: 400 })`.
   - Server-side grading: Fetch the cards referenced in answers from database using `prisma.card.findMany({ where: { id: { in: cardIds } } })`. Compare user's answer against `card.back`. Calculate `correctCount`, `wrongCount`, and `score` directly on the server. DO NOT trust `a.isCorrect` from client payload.
   - Set `completedAt: new Date()` and record answers.
7. **`src/app/api/ai/generate/route.ts`**:
   - Validate and clamp `cardCount`: `const count = Math.max(1, Math.min(Number(cardCount) || 10, 50))`.
   - Wrap AI call with proper error handling for rate limits or quota failures.

### Verification Commands
You must run:
1. `node node_modules/typescript/bin/tsc --noEmit`
2. `node node_modules/eslint/bin/eslint.js "src/**/*.{ts,tsx,js,jsx}"`
3. `node tests/e2e/tier2-security.test.mjs`

### Output
Write `handoff.md` in your state folder (`e:\GitHub\FlashCard\.agents\teamwork\teamwork_worker_m3_1\handoff.md`) with Observation, Logic Chain, Changes Made, Test Results, and send a message back.
