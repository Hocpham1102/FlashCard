# Handoff Report: Challenger 2 (E2E Testing Track)

## 1. Observation

Direct empirical observations gathered via command execution and source code analysis on Windows (Node.js v20.18.0):

1. **SM-2 Repetition Chain Date Overflow (`src/lib/sm2.ts:42, 46-47`)**:
   - Source code in `src/lib/sm2.ts`:
     ```typescript
     42: newInterval = Math.round(interval * newEaseFactor);
     ...
     46: const nextReview = new Date();
     47: nextReview.setDate(nextReview.getDate() + newInterval);
     ```
   - Running sequential review quality 5 ratings via `node tests/adversarial_challenge.mjs` directly produced:
     ```text
     Repetition 15: EF = 4.0, Interval = 45243744 days, ValidDate = true
     Repetition 16: EF = 4.1, Interval = 185499350 days, ValidDate = false
     Repetition 20: EF = 4.5, Interval = 66332341566 days, ValidDate = false
     Repetition 50: EF = 7.5, Interval = 1.3757046060141432e+34 days, ValidDate = false
     ```
   - At repetition 16, `nextReview.toString()` evaluates verbatim to `"Invalid Date"`.
   - Tier 4 test suite (`tests/e2e/tier4-workflow.test.mjs:308-335`) only tests up to repetition 3 (`interval = 17`), failing to detect this catastrophic overflow.

2. **SM-2 Zero-Interval Infinite Trapping Loop (`src/lib/sm2.ts:42`)**:
   - Calling `sm2({ easeFactor: 2.5, interval: 0, repetitions: 2 }, 4)` produced:
     ```text
     Result interval: 0, Repetitions: 3, nextReview <= now: true
     ```
   - Because `Math.round(0 * 2.5) === 0`, `nextReview` is set to the current date/time, keeping `nextReview <= now` true. The card remains due immediately and permanently in subsequent reviews.

3. **`NaN` Route Validation Bypass (`src/app/api/cards/[id]/review/route.ts:16`)**:
   - Source code in `src/app/api/cards/[id]/review/route.ts`:
     ```typescript
     16: if (typeof quality !== "number" || quality < 0 || quality > 5) {
     17:   return NextResponse.json({ error: "Quality must be a number between 0 and 5" }, { status: 400 });
     18: }
     ```
   - In JavaScript: `typeof NaN === "number"` is `true`, `NaN < 0` is `false`, and `NaN > 5` is `false`.
   - Calling `sm2({ easeFactor: 2.5, interval: 6, repetitions: 2 }, NaN)` produced verbatim:
     ```text
     EF: NaN | interval: NaN | rep: 3 | nextReview: Invalid Date
     ```
   - Tier 4 test 4.11 (`tests/e2e/tier4-workflow.test.mjs:406-437`) only checks `content.includes('typeof quality !== "number"')` via static string search and does not invoke the endpoint with runtime invalid inputs.

4. **SM-2 100 Consecutive Failures Minimum Floor Test (`src/lib/sm2.ts:22-24`)**:
   - Executing 100 consecutive reviews with `quality = 0` on an initial card `{ easeFactor: 2.5, interval: 30, repetitions: 5 }`:
     ```text
     Initial EF: 2.5 -> Final EF: 1.3, Final Interval: 1, Repetitions: 0
     Minimum EF observed: 1.3, Violations below 1.30 floor: 0
     ```
   - The 1.30 minimum ease factor floor holds with zero floating-point degradation.

5. **Answer Leakage Regex Evasion Vectors (`tests/e2e/tier2-security.test.mjs:741-742`)**:
   - The regex in Tier 2 test 2.20:
     ```javascript
     const leaksCorrectAnswer = /"correctAnswer"\s*:/.test(rawJson);
     const leaksIsCorrect = /"isCorrect"\s*:/.test(rawJson);
     ```
   - Testing against JSON RFC 8259 compliant Unicode escapes:
     - `{"\u0063orrectAnswer":"Meaning"}`: Parsed object contains `{ correctAnswer: "Meaning" }`. Regex match: `false`. **EVADED / BYPASSED**.
     - `{"options":[{"text":"Meaning","\u0069sCorrect":true}]}`: Parsed object contains `{ isCorrect: true }`. Regex match: `false`. **EVADED / BYPASSED**.
   - Testing case variations and alternative keys:
     - `{"CorrectAnswer":"Meaning"}`: Regex match: `false`. **EVADED / BYPASSED**.
     - `{"solution":"Meaning"}` / `{"answer":"Meaning"}`: Regex match: `false`. **EVADED / BYPASSED**.
     - `{"options":[{"text":"Meaning","correct":true}]}`: Regex match: `false`. **EVADED / BYPASSED**.

6. **MockDb Concurrency and State Isolation (`tests/e2e/tier2-security.test.mjs:32-260`)**:
   - Central runner executed across 3 repeated sequential runs (`node tests/e2e/runner.mjs --tier=3,4`):
     - Run 1: 22 passed, 0 failed (Duration: 2.67s)
     - Run 2: 22 passed, 0 failed (Duration: 2.34s)
     - Run 3: 22 passed, 0 failed (Duration: 2.28s)
   - Two concurrent child processes running `node tests/e2e/runner.mjs --tier=3,4` in parallel completed simultaneously with exit code 0.
   - `MockDb.reset()` re-initializes all collections (`users`, `decks`, `cards`, `quizSessions`) with fresh object literals prior to every test case, preventing cross-test pollution.

---

## 2. Logic Chain

1. **From Observation 1**: ECMAScript specifications (Section 21.4.1.1) define the maximum Date value as `±8.64e15` milliseconds (`±100,000,000` days). In `sm2.ts`, consecutive quality 5 reviews expand the interval via exponential multiplication `Math.round(interval * newEaseFactor)` without an interval ceiling (`maxInterval`). At repetition 16, the interval reaches 185,499,350 days, which exceeds the 100,000,000 day limit. Consequently, `nextReview.setDate(...)` overflows and produces `Invalid Date`. When persisted via Prisma into PostgreSQL, this results in fatal runtime database crashes (`datetime value out of range`).

2. **From Observation 2**: If an existing card has `interval: 0` with `repetitions >= 2`, `Math.round(interval * newEaseFactor)` evaluates to `0`. `sm2.ts` contains no lower bound clamp (e.g., `Math.max(1, ...)`). Consequently, `newInterval = 0` and `nextReview` is set to the current time, permanently violating the spaced repetition invariant that successful reviews must advance review dates into the future.

3. **From Observation 3**: The review route guard relies on `typeof quality !== "number" || quality < 0 || quality > 5`. Because `typeof NaN === "number"` and comparisons with `NaN` return `false`, `NaN` bypasses the check. Feeding `NaN` into `sm2()` corrupts `easeFactor`, `interval`, and `nextReview` to `NaN`/`Invalid Date`. Furthermore, Tier 4 test 4.11 failed to verify this at runtime because it only inspected the file text with `content.includes(...)`.

4. **From Observation 5**: The leakage detection in Tier 2 relies exclusively on string regex matching against `rawJson`. Because JSON parsers natively decode Unicode escape sequences (`\u0063` -> `c`, `\u0069` -> `i`), an API can transmit answers using valid JSON escapes that decode directly in browser clients while bypassing the regex test entirely. Similarly, case insensitivity and synonym keys (`solution`, `answer`) evade detection.

5. **From Observation 4 & 6**: The 1.30 easeFactor floor and MockDb state isolation are empirically solid. MockDb instantiates fresh collections on each `reset()`, ensuring 100% deterministic test execution across repeated and concurrent runs.

---

## 3. Caveats

1. **Direct JSON Client Payloads**: Standard `JSON.stringify({ quality: NaN })` serializes `NaN` to `null`. However, raw string bodies or internal microservice/programmatic calls can transmit `NaN`, and any internal calculation yielding `NaN` will bypass the route check.
2. **Review Track Boundary**: Per review-only constraints, Challenger 2 did not modify `src/lib/sm2.ts`, `src/app/api/cards/[id]/review/route.ts`, or `tests/e2e/tier2-security.test.mjs`. All tests were executed via the independent empirical challenge harness `tests/adversarial_challenge.mjs`.
3. **Database Clock Skew**: Network Time Protocol (NTP) backward clock shifts on production database servers were not simulated as the test suite currently executes against an in-memory mock environment.

---

## 4. Conclusion

### Overall Verdict: **REJECT (Conditional on Remediation of SRS Date Overflow and Regex Evasion Blindspots)**

While MockDb state isolation and the 1.30 easeFactor floor are confirmed robust, the review-facing systems possess three significant defects:
1. **Critical SRS Date Overflow**: `src/lib/sm2.ts` produces `Invalid Date` after 16 consecutive ratings of 5 due to lack of an interval ceiling (`maxInterval`), causing database write crashes.
2. **Infinite Due Trapping Loop**: Mature cards with `interval: 0` never advance into the future upon successful review due to lack of `Math.max(1, ...)`.
3. **Regex Evasion Blindspot**: Tier 2 test 2.20 can be evaded via Unicode escapes (`\u0063orrectAnswer`), case variation, or alternative semantic keys (`solution`, `answer`).

### Concrete Recommendations for Remediation:
1. In `src/lib/sm2.ts`:
   - Enforce an upper bound: `const MAX_INTERVAL = 36500; // 100 years`
   - Enforce a lower bound: `newInterval = Math.max(1, Math.min(MAX_INTERVAL, Math.round(interval * newEaseFactor)));`
2. In `src/app/api/cards/[id]/review/route.ts`:
   - Update guard to: `if (typeof quality !== "number" || Number.isNaN(quality) || quality < 0 || quality > 5)`
3. In `tests/e2e/tier2-security.test.mjs` (Test 2.20):
   - Replace regex with structured AST inspection: Parse `JSON.parse(rawJson)`, recursively scan object keys against `/^(correct_?answer|solution|is_?correct|answer)$/i`, and assert options objects only contain `id` and `text`.
4. In `tests/e2e/tier4-workflow.test.mjs`:
   - Add test case verifying numerical stability for 50+ consecutive ratings of 5 without Date overflow.
   - Replace static string check in Test 4.11 with an actual invocation passing invalid qualities (`-1`, `6`, `NaN`, `"bad"`).

---

## 5. Verification Method

To independently reproduce and verify all observations and findings:

1. **Run Central Acceptance Test Suite**:
   ```powershell
   node tests/e2e/runner.mjs --tier=3,4
   ```
   *Expected*: All 22 tests pass cleanly in ~2.3 seconds.

2. **Run Empirical Adversarial Challenge Suite**:
   ```powershell
   node tests/adversarial_challenge.mjs
   ```
   *Expected*:
   - Demonstrates Date overflow at repetition 16 (`ValidDate = false`, `Invalid Date`).
   - Demonstrates zero-interval trapping loop on mature cards (`interval = 0`, `nextReview <= now: true`).
   - Demonstrates regex evasion for `\u0063orrectAnswer`, `\u0069sCorrect`, `CorrectAnswer`, and `solution`.
   - Confirms easeFactor floor 1.30 across 100 consecutive failures.
   - Confirms MockDb isolation between sequential and concurrent executions.
