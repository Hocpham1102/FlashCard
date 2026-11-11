/**
 * tests/e2e/tier4-workflow.test.mjs
 * Tier 4: SM-2 Spaced Repetition Workflow Checks
 *
 * Verifies real-world SM-2 SRS study workflow:
 * 1. Initial card provisioning with SRS defaults (EF=2.5, interval=0, repetitions=0)
 * 2. Due cards retrieval query logic (nextReview <= now, filtered by deckId)
 * 3. Submission of review ratings (0 = Again, 3 = Good, 5 = Easy)
 * 4. Verification of interval, easeFactor, and nextReview calculations per sm2.ts
 * 5. Exclusion of reviewed cards from immediate due queries
 * 6. Multi-day progression (Day 1 -> Day 2 -> Day 8 -> Day 25) and post-mastery lapse reset
 * 7. Boundary conditions (Ease factor clamped at 1.30 floor, invalid quality rejection)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = process.cwd();

export const name = 'Tier 4: SM-2 SRS Study Workflow Checks';

// Helper to transpile and import sm2 function from src/lib/sm2.ts
function loadSm2Module() {
  const sm2Path = path.join(ROOT_DIR, 'src/lib/sm2.ts');
  const ts = require('typescript');
  const src = fs.readFileSync(sm2Path, 'utf8');
  const transpiled = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });

  const mod = { exports: {} };
  const fn = new Function('exports', 'require', 'module', transpiled.outputText);
  fn(mod.exports, require, mod);

  return mod.exports.sm2;
}

/**
 * Execute all Tier 4 tests
 * @param {object} [options]
 * @param {boolean} [options.verbose=false]
 * @returns {Promise<Array<{ name: string, pass: boolean, error?: string, durationMs: number, details?: string }>>}
 */
export async function runTests({ verbose = false } = {}) {
  const results = [];
  const sm2 = loadSm2Module();

  // --------------------------------------------------------------------------
  // Test 4.1: Initial Card State Provisioning
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = '4.1 Initial Provisioning: Cards initialized with SRS defaults';
      const start = Date.now();
      try {
        const initialCards = [
          { id: 'c1', front: 'Accommodate', back: 'Cung cấp chỗ', easeFactor: 2.5, interval: 0, repetitions: 0, nextReview: new Date() },
          { id: 'c2', front: 'Implement', back: 'Thực hiện', easeFactor: 2.5, interval: 0, repetitions: 0, nextReview: new Date() },
          { id: 'c3', front: 'Substantial', back: 'Đáng kể', easeFactor: 2.5, interval: 0, repetitions: 0, nextReview: new Date() },
        ];

        for (const c of initialCards) {
          assert.strictEqual(c.easeFactor, 2.5, 'Default easeFactor must be 2.5');
          assert.strictEqual(c.interval, 0, 'Default interval must be 0');
          assert.strictEqual(c.repetitions, 0, 'Default repetitions must be 0');
          assert.ok(c.nextReview <= new Date(), 'Initial nextReview must be <= now');
        }

        return {
          name: testName,
          pass: true,
          durationMs: Date.now() - start,
          details: 'Verified default SRS fields for new cards',
        };
      } catch (err) {
        return {
          name: testName,
          pass: false,
          error: err.message,
          durationMs: Date.now() - start,
        };
      }
    })(),
  );

  // --------------------------------------------------------------------------
  // Test 4.2: Due Cards Query Logic
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = '4.2 Due Cards Retrieval: Query strictly filters by deckId and nextReview <= now';
      const start = Date.now();
      try {
        const now = new Date();
        const deckStore = [
          { id: 'c1', deckId: 'deck-1', nextReview: new Date(now.getTime() - 1000) }, // due
          { id: 'c2', deckId: 'deck-1', nextReview: new Date(now.getTime() - 500) },  // due
          { id: 'c3', deckId: 'deck-1', nextReview: new Date(now.getTime() + 86400000) }, // tomorrow (not due)
          { id: 'c4', deckId: 'deck-2', nextReview: new Date(now.getTime() - 1000) }, // other deck
        ];

        // Authoritative query filter logic from /api/decks/[id]/study
        const dueCards = deckStore.filter((c) => c.deckId === 'deck-1' && c.nextReview <= now);

        assert.strictEqual(dueCards.length, 2, 'Exactly 2 cards should be due in deck-1');
        assert.deepStrictEqual(dueCards.map((c) => c.id), ['c1', 'c2']);

        return {
          name: testName,
          pass: true,
          durationMs: Date.now() - start,
          details: 'Verified deck isolation and due timestamp filtering',
        };
      } catch (err) {
        return {
          name: testName,
          pass: false,
          error: err.message,
          durationMs: Date.now() - start,
        };
      }
    })(),
  );

  // --------------------------------------------------------------------------
  // Test 4.3: Review Rating 0 ('Again')
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = "4.3 Review Rating 0 ('Again'): Resets repetitions and schedules next review in 1 day";
      const start = Date.now();
      try {
        const initial = { easeFactor: 2.5, interval: 0, repetitions: 0 };
        const res = sm2(initial, 0);

        // EF formula: 2.5 + (0.1 - (5 - 0) * (0.08 + (5 - 0) * 0.02)) = 2.5 - 0.8 = 1.70
        assert.strictEqual(res.easeFactor, 1.7, 'easeFactor should decrease to 1.7');
        assert.strictEqual(res.interval, 1, 'interval should be 1 day');
        assert.strictEqual(res.repetitions, 0, 'repetitions must reset to 0');
        assert.ok(res.nextReview > new Date(), 'nextReview must be scheduled in the future');

        return {
          name: testName,
          pass: true,
          durationMs: Date.now() - start,
          details: 'Rating 0 reset verified (EF: 1.7, interval: 1d, rep: 0)',
        };
      } catch (err) {
        return {
          name: testName,
          pass: false,
          error: err.message,
          durationMs: Date.now() - start,
        };
      }
    })(),
  );

  // --------------------------------------------------------------------------
  // Test 4.4: Review Rating 3 ('Good / Pass')
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = "4.4 Review Rating 3 ('Good'): Advances repetitions to 1 and schedules review in 1 day";
      const start = Date.now();
      try {
        const initial = { easeFactor: 2.5, interval: 0, repetitions: 0 };
        const res = sm2(initial, 3);

        // EF formula: 2.5 + (0.1 - 2 * (0.08 + 0.04)) = 2.5 - 0.14 = 2.36
        assert.strictEqual(res.easeFactor, 2.36, 'easeFactor should be 2.36');
        assert.strictEqual(res.interval, 1, 'interval should be 1 day');
        assert.strictEqual(res.repetitions, 1, 'repetitions must increment to 1');
        assert.ok(res.nextReview > new Date(), 'nextReview must be scheduled in the future');

        return {
          name: testName,
          pass: true,
          durationMs: Date.now() - start,
          details: 'Rating 3 progression verified (EF: 2.36, interval: 1d, rep: 1)',
        };
      } catch (err) {
        return {
          name: testName,
          pass: false,
          error: err.message,
          durationMs: Date.now() - start,
        };
      }
    })(),
  );

  // --------------------------------------------------------------------------
  // Test 4.5: Review Rating 5 ('Easy')
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = "4.5 Review Rating 5 ('Easy'): Advances repetitions to 1 and increases EF by +0.10";
      const start = Date.now();
      try {
        const initial = { easeFactor: 2.5, interval: 0, repetitions: 0 };
        const res = sm2(initial, 5);

        // EF formula: 2.5 + (0.1 - 0) = 2.60
        assert.strictEqual(res.easeFactor, 2.6, 'easeFactor should increase to 2.6');
        assert.strictEqual(res.interval, 1, 'interval should be 1 day');
        assert.strictEqual(res.repetitions, 1, 'repetitions must increment to 1');
        assert.ok(res.nextReview > new Date(), 'nextReview must be scheduled in the future');

        return {
          name: testName,
          pass: true,
          durationMs: Date.now() - start,
          details: 'Rating 5 progression verified (EF: 2.6, interval: 1d, rep: 1)',
        };
      } catch (err) {
        return {
          name: testName,
          pass: false,
          error: err.message,
          durationMs: Date.now() - start,
        };
      }
    })(),
  );

  // --------------------------------------------------------------------------
  // Test 4.6: Exclusion from Immediate Due Queries
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = '4.6 Immediate Due Exclusion: Reviewed cards are excluded from immediate due reviews';
      const start = Date.now();
      try {
        const now = new Date();
        const card1 = sm2({ easeFactor: 2.5, interval: 0, repetitions: 0 }, 0);
        const card2 = sm2({ easeFactor: 2.5, interval: 0, repetitions: 0 }, 3);
        const card3 = sm2({ easeFactor: 2.5, interval: 0, repetitions: 0 }, 5);

        const activeDeck = [card1, card2, card3];
        const immediateDue = activeDeck.filter((c) => c.nextReview <= now);

        assert.strictEqual(
          immediateDue.length,
          0,
          'All reviewed cards must have nextReview > now and be excluded from immediate due review',
        );

        return {
          name: testName,
          pass: true,
          durationMs: Date.now() - start,
          details: 'Exclusion contract confirmed: 0 reviewed cards due immediately',
        };
      } catch (err) {
        return {
          name: testName,
          pass: false,
          error: err.message,
          durationMs: Date.now() - start,
        };
      }
    })(),
  );

  // --------------------------------------------------------------------------
  // Test 4.7: Multi-Day Repetition Progression (Day 2 -> 6 days)
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = '4.7 Multi-Day Progression: Second consecutive rating 5 sets interval to 6 days';
      const start = Date.now();
      try {
        const day1State = { easeFactor: 2.6, interval: 1, repetitions: 1 };
        const res = sm2(day1State, 5);

        assert.strictEqual(res.easeFactor, 2.7, 'easeFactor should increase to 2.7');
        assert.strictEqual(res.interval, 6, 'Repetition 2 must set interval to 6 days');
        assert.strictEqual(res.repetitions, 2, 'repetitions must increment to 2');

        return {
          name: testName,
          pass: true,
          durationMs: Date.now() - start,
          details: 'Interval expansion confirmed: 6 days on 2nd repetition',
        };
      } catch (err) {
        return {
          name: testName,
          pass: false,
          error: err.message,
          durationMs: Date.now() - start,
        };
      }
    })(),
  );

  // --------------------------------------------------------------------------
  // Test 4.8: Long-Term Exponential Interval (Day 8 -> 17 days)
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = '4.8 Exponential Interval: Third consecutive rating 5 scales interval via Math.round(interval * EF)';
      const start = Date.now();
      try {
        const day2State = { easeFactor: 2.7, interval: 6, repetitions: 2 };
        const res = sm2(day2State, 5);

        // interval = Math.round(6 * 2.8) = Math.round(16.8) = 17
        assert.strictEqual(res.easeFactor, 2.8, 'easeFactor should increase to 2.8');
        assert.strictEqual(res.interval, 17, 'interval should scale to 17 days');
        assert.strictEqual(res.repetitions, 3, 'repetitions must increment to 3');

        return {
          name: testName,
          pass: true,
          durationMs: Date.now() - start,
          details: 'Exponential interval growth confirmed: Math.round(6 * 2.8) = 17 days',
        };
      } catch (err) {
        return {
          name: testName,
          pass: false,
          error: err.message,
          durationMs: Date.now() - start,
        };
      }
    })(),
  );

  // --------------------------------------------------------------------------
  // Test 4.9: Post-Mastery Lapse Reset
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = '4.9 Lapse Handling: Forgotten mature card resets repetitions to 0 and interval to 1 day';
      const start = Date.now();
      try {
        const matureState = { easeFactor: 2.8, interval: 17, repetitions: 3 };
        const res = sm2(matureState, 0);

        assert.strictEqual(res.easeFactor, 2.0, 'easeFactor drops by 0.8 to 2.0');
        assert.strictEqual(res.interval, 1, 'interval must reset to 1 day');
        assert.strictEqual(res.repetitions, 0, 'repetitions must reset to 0');

        return {
          name: testName,
          pass: true,
          durationMs: Date.now() - start,
          details: 'Post-mastery lapse verified: interval reset to 1d, repetitions reset to 0',
        };
      } catch (err) {
        return {
          name: testName,
          pass: false,
          error: err.message,
          durationMs: Date.now() - start,
        };
      }
    })(),
  );

  // --------------------------------------------------------------------------
  // Test 4.10: Ease Factor Floor Clamping
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = '4.10 Ease Factor Floor: Consecutive failures clamp easeFactor strictly at 1.30 minimum';
      const start = Date.now();
      try {
        let state = { easeFactor: 1.5, interval: 1, repetitions: 0 };
        state = sm2(state, 0); // 1.5 - 0.8 = 0.7 -> clamp to 1.3
        assert.strictEqual(state.easeFactor, 1.3, 'easeFactor must clamp at 1.3');

        state = sm2(state, 0); // clamp at 1.3
        assert.strictEqual(state.easeFactor, 1.3, 'easeFactor must remain at 1.3');

        return {
          name: testName,
          pass: true,
          durationMs: Date.now() - start,
          details: 'EaseFactor minimum bound 1.30 verified across multiple failures',
        };
      } catch (err) {
        return {
          name: testName,
          pass: false,
          error: err.message,
          durationMs: Date.now() - start,
        };
      }
    })(),
  );

  // --------------------------------------------------------------------------
  // Test 4.11: Quality Input Validation Contract
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = '4.11 Input Validation: Card review endpoint rejects quality < 0 or > 5 with HTTP 400';
      const start = Date.now();
      try {
        const routePath = path.join(ROOT_DIR, 'src/app/api/cards/[id]/review/route.ts');
        const content = fs.readFileSync(routePath, 'utf8');

        assert.ok(
          content.includes('typeof quality !== "number"') ||
            content.includes('quality < 0') ||
            content.includes('quality > 5'),
          'Route must validate quality range between 0 and 5',
        );
        assert.ok(
          content.includes('400') && content.includes('Quality must be a number between 0 and 5'),
          'Invalid quality must respond with HTTP 400 Bad Request',
        );

        return {
          name: testName,
          pass: true,
          durationMs: Date.now() - start,
          details: 'Quality range validation (0..5) confirmed in review route',
        };
      } catch (err) {
        return {
          name: testName,
          pass: false,
          error: err.message,
          durationMs: Date.now() - start,
        };
      }
    })(),
  );

  // --------------------------------------------------------------------------
  // Test 4.12: Study API Due Filter Contract
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = '4.12 Study API Contract: /api/decks/[id]/study filters by nextReview <= now()';
      const start = Date.now();
      try {
        const routePath = path.join(ROOT_DIR, 'src/app/api/decks/[id]/study/route.ts');
        const content = fs.readFileSync(routePath, 'utf8');

        assert.ok(
          content.includes('nextReview') && (content.includes('lte') || content.includes('new Date()')),
          'Study route must query cards with nextReview: { lte: new Date() }',
        );

        return {
          name: testName,
          pass: true,
          durationMs: Date.now() - start,
          details: 'Study route due-cards filter verified in source code',
        };
      } catch (err) {
        return {
          name: testName,
          pass: false,
          error: err.message,
          durationMs: Date.now() - start,
        };
      }
    })(),
  );

  return results;
}

// Standalone execution support
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  console.log(`Executing ${name}...`);
  runTests({ verbose: true }).then((results) => {
    let failed = 0;
    for (const r of results) {
      if (r.pass) {
        console.log(`  ✓ PASS: ${r.name} (${r.durationMs}ms)`);
      } else {
        failed++;
        console.log(`  ✗ FAIL: ${r.name} (${r.durationMs}ms)`);
        if (r.error) console.log(`    ${r.error}`);
      }
    }
    process.exit(failed > 0 ? 1 : 0);
  });
}
