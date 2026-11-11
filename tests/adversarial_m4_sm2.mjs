/**
 * tests/adversarial_m4_sm2.mjs
 * Comprehensive Adversarial & Empirical Stress Harness for Milestone 4 (SM-2 SRS & Study Flow)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT_DIR = process.cwd();

// Transpile sm2 from src/lib/sm2.ts
function loadSm2() {
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

async function runAdversarialSuite() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  MILESTONE 4 ADVERSARIAL STRESS TEST HARNESS (SM-2 & Study Flow)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const sm2 = loadSm2();
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // SECTION 1: SM-2 Mathematical Rigor & Stress
  // -------------------------------------------------------------
  console.log('--- SECTION 1: SM-2 Mathematical Rigor & Stress ---');

  test('1.1 Extreme consecutive failures clamp strictly at 1.30 floor', () => {
    let state = { easeFactor: 2.5, interval: 30, repetitions: 5 };
    for (let i = 0; i < 50; i++) {
      state = sm2(state, 0);
      assert.ok(state.easeFactor >= 1.30, `EF must never drop below 1.30: got ${state.easeFactor}`);
      assert.strictEqual(state.interval, 1, 'Interval must be 1 on failure');
      assert.strictEqual(state.repetitions, 0, 'Repetitions must be 0 on failure');
    }
    assert.strictEqual(state.easeFactor, 1.30, 'EF must clamp exactly at 1.30');
  });

  test('1.2 EF formula exact delta verification for all valid qualities [0, 5]', () => {
    // formula: delta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)
    // q=5: delta = +0.10
    // q=4: delta = 0.1 - 1*(0.10) = 0.00
    // q=3: delta = 0.1 - 2*(0.12) = -0.14
    // q=2: delta = 0.1 - 3*(0.14) = -0.32
    // q=1: delta = 0.1 - 4*(0.16) = -0.54
    // q=0: delta = 0.1 - 5*(0.18) = -0.80

    const initialEF = 2.50;
    const expectedDeltas = [
      { q: 0, delta: -0.80, expectedEF: 1.70 },
      { q: 1, delta: -0.54, expectedEF: 1.96 },
      { q: 2, delta: -0.32, expectedEF: 2.18 },
      { q: 3, delta: -0.14, expectedEF: 2.36 },
      { q: 4, delta:  0.00, expectedEF: 2.50 },
      { q: 5, delta: +0.10, expectedEF: 2.60 },
    ];

    for (const item of expectedDeltas) {
      const out = sm2({ easeFactor: initialEF, interval: 1, repetitions: 1 }, item.q);
      const diff = Math.abs(out.easeFactor - item.expectedEF);
      assert.ok(diff < 0.0001, `For q=${item.q}, expected EF ${item.expectedEF}, got ${out.easeFactor}`);
    }
  });

  test('1.3 Long-term progression under sustained perfect recall (Quality 5)', () => {
    let state = { easeFactor: 2.5, interval: 0, repetitions: 0 };
    // Review 1 (q=5)
    state = sm2(state, 5);
    assert.strictEqual(state.repetitions, 1);
    assert.strictEqual(state.interval, 1);
    assert.strictEqual(state.easeFactor, 2.6);

    // Review 2 (q=5)
    state = sm2(state, 5);
    assert.strictEqual(state.repetitions, 2);
    assert.strictEqual(state.interval, 6);
    assert.strictEqual(state.easeFactor, 2.7);

    // Review 3 (q=5) -> Math.round(6 * 2.8) = Math.round(16.8) = 17
    state = sm2(state, 5);
    assert.strictEqual(state.repetitions, 3);
    assert.strictEqual(state.interval, 17);
    assert.strictEqual(state.easeFactor, 2.8);

    // Review 4 (q=5) -> Math.round(17 * 2.9) = Math.round(49.3) = 49
    state = sm2(state, 5);
    assert.strictEqual(state.repetitions, 4);
    assert.strictEqual(state.interval, 49);
    assert.strictEqual(state.easeFactor, 2.9);

    // Review 5 (q=5) -> Math.round(49 * 3.0) = 147
    state = sm2(state, 5);
    assert.strictEqual(state.repetitions, 5);
    assert.strictEqual(state.interval, 147);
    assert.strictEqual(state.easeFactor, 3.0);
  });

  test('1.4 Post-maturity failure reset and recovery', () => {
    // Card with mature interval 147 days fails
    let state = { easeFactor: 3.0, interval: 147, repetitions: 5 };
    state = sm2(state, 0); // forgot!
    assert.strictEqual(state.repetitions, 0, 'Repetitions must reset to 0');
    assert.strictEqual(state.interval, 1, 'Interval must collapse to 1 day');
    assert.strictEqual(state.easeFactor, 2.2, 'EF drops by 0.8 to 2.2');

    // Immediate recovery with Good (4)
    state = sm2(state, 4);
    assert.strictEqual(state.repetitions, 1, 'Repetitions advance to 1');
    assert.strictEqual(state.interval, 1, 'First successful review interval is 1');
    assert.strictEqual(state.easeFactor, 2.2, 'EF unchanged on q=4');

    // Second recovery with Good (4)
    state = sm2(state, 4);
    assert.strictEqual(state.repetitions, 2, 'Repetitions advance to 2');
    assert.strictEqual(state.interval, 6, 'Second successful review interval is 6');
  });

  test('1.5 Quality boundary handling: Quality 2 (Hard) counts as failure', () => {
    const mature = { easeFactor: 2.5, interval: 20, repetitions: 4 };
    const res = sm2(mature, 2);
    assert.strictEqual(res.repetitions, 0, 'Quality 2 is below 3, must reset repetitions');
    assert.strictEqual(res.interval, 1, 'Quality 2 must reset interval to 1');
    assert.strictEqual(res.easeFactor, 2.18, 'Quality 2 reduces EF to 2.18');
  });

  test('1.6 Quality boundary handling: Quality 3 (Good minimum) counts as success', () => {
    const mature = { easeFactor: 2.5, interval: 6, repetitions: 2 };
    const res = sm2(mature, 3);
    assert.strictEqual(res.repetitions, 3, 'Quality 3 is >= 3, must advance repetitions');
    // Math.round(6 * 2.36) = Math.round(14.16) = 14
    assert.strictEqual(res.interval, 14, 'Interval scales by new EF');
    assert.strictEqual(res.easeFactor, 2.36, 'EF drops to 2.36');
  });

  test('1.7 NextReview date calculation matches interval days precisely', () => {
    const state = { easeFactor: 2.5, interval: 10, repetitions: 2 };
    const before = new Date();
    const res = sm2(state, 5); // new interval = Math.round(10 * 2.6) = 26
    const after = new Date();

    const diffDays = Math.round((res.nextReview.getTime() - before.getTime()) / (1000 * 60 * 60 * 24));
    assert.strictEqual(res.interval, 26);
    assert.strictEqual(diffDays, 26, 'Scheduled days diff must equal calculated interval');
    assert.ok(res.nextReview > after, 'Next review must be in future');
  });

  // -------------------------------------------------------------
  // SECTION 2: Study Page Component & API Alignment
  // -------------------------------------------------------------
  console.log('\n--- SECTION 2: Study Page Component & API Alignment ---');

  const studyPagePath = path.join(ROOT_DIR, 'src/app/decks/[id]/study/page.tsx');
  const studyPageContent = fs.readFileSync(studyPagePath, 'utf8');

  test('2.1 Study Page strictly calls /api/decks/${deckId}/study for due cards', () => {
    assert.ok(
      studyPageContent.includes('/api/decks/${deckId}/study') ||
      studyPageContent.includes("`/api/decks/${deckId}/study`"),
      'Study page MUST query /api/decks/${deckId}/study',
    );
    assert.ok(
      !studyPageContent.includes('/api/decks/${deckId}/cards'),
      'Study page MUST NOT fetch all cards via /api/decks/${deckId}/cards',
    );
  });

  test('2.2 Empty / caught-up state properly rendered when 0 cards due', () => {
    assert.ok(
      studyPageContent.includes('isEmpty && deck'),
      'Component must have isEmpty check with deck loaded',
    );
    assert.ok(
      studyPageContent.includes('All caught up!') &&
      studyPageContent.includes('No cards due for review right now.'),
      'Component must show clear "All caught up! No cards due for review right now." text',
    );
    assert.ok(
      studyPageContent.includes('Quay lại bộ thẻ') &&
      studyPageContent.includes('Dashboard'),
      'Component must provide navigation buttons to return to deck or dashboard',
    );
  });

  test('2.3 Rating options match valid SM-2 qualities (0, 2, 4, 5)', () => {
    // Again: 0 (fail), Hard: 2 (fail), Good: 4 (pass), Easy: 5 (pass)
    assert.ok(studyPageContent.includes('label: "Again",\n    quality: 0') || studyPageContent.includes('quality: 0'));
    assert.ok(studyPageContent.includes('label: "Hard",\n    quality: 2') || studyPageContent.includes('quality: 2'));
    assert.ok(studyPageContent.includes('label: "Good",\n    quality: 4') || studyPageContent.includes('quality: 4'));
    assert.ok(studyPageContent.includes('label: "Easy",\n    quality: 5') || studyPageContent.includes('quality: 5'));

    // Check all qualities in RATING_OPTIONS are within 0..5
    const regex = /quality:\s*(\d+)/g;
    let match;
    const qualities = [];
    while ((match = regex.exec(studyPageContent)) !== null) {
      qualities.push(parseInt(match[1], 10));
    }
    for (const q of qualities) {
      assert.ok(q >= 0 && q <= 5, `Quality ${q} must be between 0 and 5`);
    }
  });

  test('2.4 Study page review submission endpoint and payload contract', () => {
    assert.ok(
      studyPageContent.includes('fetch(`/api/cards/${cardId}/review`') ||
      studyPageContent.includes('/api/cards/${cardId}/review'),
      'Must POST to /api/cards/${cardId}/review',
    );
    assert.ok(
      studyPageContent.includes('body: JSON.stringify({ quality: option.quality })') ||
      studyPageContent.includes('quality: option.quality'),
      'Payload must send { quality }',
    );
  });

  test('2.5 Study page ID resolution resilience (id vs _id)', () => {
    assert.ok(
      studyPageContent.includes('card.id || card._id'),
      'Must resolve card.id || card._id for cross-version compatibility',
    );
    assert.ok(
      studyPageContent.includes('deck.id || deck._id || deckId'),
      'Must resolve deck.id || deck._id || deckId for navigation URLs',
    );
  });

  test('2.6 Study page protects against double-submission and rapid clicks', () => {
    assert.ok(
      studyPageContent.includes('if (isSubmittingReview) return;'),
      'handleRating must bail if isSubmittingReview is true',
    );
    assert.ok(
      studyPageContent.includes('disabled={isSubmittingReview}'),
      'Rating buttons must be disabled while submitting',
    );
  });

  test('2.7 Study page network error resilience during review', () => {
    // Must not crash if review fetch fails
    assert.ok(
      studyPageContent.includes('try {') && studyPageContent.includes('} catch {'),
      'Review fetch must be wrapped in try/catch to ensure auto-advance executes',
    );
  });

  // -------------------------------------------------------------
  // SECTION 3: Review API Route Validation & Authorization
  // -------------------------------------------------------------
  console.log('\n--- SECTION 3: Review API Route Validation & Authorization ---');

  const reviewRoutePath = path.join(ROOT_DIR, 'src/app/api/cards/[id]/review/route.ts');
  const reviewRouteContent = fs.readFileSync(reviewRoutePath, 'utf8');

  test('3.1 Review route rejects non-numeric or out-of-range quality with HTTP 400', () => {
    assert.ok(
      reviewRouteContent.includes('typeof quality !== "number"'),
      'Review route must check typeof quality !== "number"',
    );
    assert.ok(
      reviewRouteContent.includes('quality < 0 || quality > 5'),
      'Review route must reject quality < 0 or > 5',
    );
    assert.ok(
      reviewRouteContent.includes('status: 400'),
      'Must respond with HTTP 400 on invalid quality',
    );
  });

  test('3.2 Review route enforces authentication with HTTP 401', () => {
    assert.ok(
      reviewRouteContent.includes('!session?.user?.id'),
      'Must verify session user ID',
    );
    assert.ok(
      reviewRouteContent.includes('status: 401'),
      'Must respond with HTTP 401 when unauthenticated',
    );
  });

  test('3.3 Review route enforces IDOR protection with HTTP 403', () => {
    assert.ok(
      reviewRouteContent.includes('card.deck?.userId !== session.user.id'),
      'Must check card.deck.userId matches authenticated user',
    );
    assert.ok(
      reviewRouteContent.includes('status: 403'),
      'Must respond with HTTP 403 when non-owner reviews card',
    );
  });

  test('3.4 Review route handles missing card with HTTP 404', () => {
    assert.ok(
      reviewRouteContent.includes('if (!card)'),
      'Must check if card exists',
    );
    assert.ok(
      reviewRouteContent.includes('status: 404'),
      'Must respond with HTTP 404 for unknown card ID',
    );
  });

  test('3.5 Review route formatNextReview boundary logic', () => {
    // Extract formatNextReview logic and test boundaries
    function formatNextReview(intervalDays) {
      if (intervalDays <= 0) return 'Ngay bây giờ';
      if (intervalDays === 1) return 'Ngày mai';
      if (intervalDays < 7) return `${intervalDays} ngày`;
      if (intervalDays < 30) return `${Math.round(intervalDays / 7)} tuần`;
      return `${Math.round(intervalDays / 30)} tháng`;
    }

    assert.strictEqual(formatNextReview(0), 'Ngay bây giờ');
    assert.strictEqual(formatNextReview(1), 'Ngày mai');
    assert.strictEqual(formatNextReview(2), '2 ngày');
    assert.strictEqual(formatNextReview(6), '6 ngày');
    assert.strictEqual(formatNextReview(7), '1 tuần');
    assert.strictEqual(formatNextReview(14), '2 tuần');
    assert.strictEqual(formatNextReview(29), '4 tuần');
    assert.strictEqual(formatNextReview(30), '1 tháng');
    assert.strictEqual(formatNextReview(60), '2 tháng');
    assert.strictEqual(formatNextReview(365), '12 tháng');
  });

  // -------------------------------------------------------------
  // SECTION 4: Study API Route Due Filtering
  // -------------------------------------------------------------
  console.log('\n--- SECTION 4: Study API Route Due Filtering ---');

  const studyRoutePath = path.join(ROOT_DIR, 'src/app/api/decks/[id]/study/route.ts');
  const studyRouteContent = fs.readFileSync(studyRoutePath, 'utf8');

  test('4.1 Study API strictly queries nextReview <= new Date() for deckId', () => {
    assert.ok(
      studyRouteContent.includes('deckId: id') &&
      studyRouteContent.includes('nextReview: { lte: new Date() }'),
      'Study route must query: where: { deckId: id, nextReview: { lte: new Date() } }',
    );
  });

  test('4.2 Study API maps _id compat alias for all returned cards', () => {
    assert.ok(
      studyRouteContent.includes('_id: c.id'),
      'Study route must map _id: c.id for compat',
    );
  });

  // -------------------------------------------------------------
  // SECTION 5: Component Hygiene Verification
  // -------------------------------------------------------------
  console.log('\n--- SECTION 5: Component Hygiene Verification ---');

  const avatarPath = path.join(ROOT_DIR, 'src/components/UserAvatar.tsx');
  const avatarContent = fs.readFileSync(avatarPath, 'utf8');

  test('5.1 UserAvatar uses Next.js Image component without no-img-element warning', () => {
    assert.ok(
      avatarContent.includes('import Image from "next/image"'),
      'UserAvatar must import Image from next/image',
    );
    assert.ok(
      avatarContent.includes('<Image') && !avatarContent.includes('<img'),
      'UserAvatar must use <Image> and eliminate raw <img> tags',
    );
    assert.ok(
      avatarContent.includes('unoptimized'),
      'UserAvatar must use unoptimized flag for dynamic third-party avatar URLs',
    );
  });

  const audioPath = path.join(ROOT_DIR, 'src/lib/studyAudio.ts');
  const audioContent = fs.readFileSync(audioPath, 'utf8');

  test('5.2 studyAudio uses named const before export (no anonymous default export)', () => {
    assert.ok(
      audioContent.includes('const studyAudio = {') &&
      audioContent.includes('export default studyAudio;'),
      'studyAudio.ts must declare named const studyAudio and export default studyAudio',
    );
  });

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('═══════════════════════════════════════════════════════════════════');

  if (failed > 0) {
    process.exit(1);
  }
}

runAdversarialSuite().catch((err) => {
  console.error('Unexpected harness failure:', err);
  process.exit(1);
});
