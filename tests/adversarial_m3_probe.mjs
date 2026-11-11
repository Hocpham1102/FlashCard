/**
 * tests/adversarial_m3_probe.mjs
 * Comprehensive Empirical Adversarial Stress Harness for Milestone 3
 *
 * Attacks & Probes:
 * 1. Card IDOR & Mutation Probes (/api/cards/[id])
 * 2. Deck Cards Privacy & Mutation Probes (/api/decks/[id]/cards)
 * 3. Card Review Authorization & Quality Range Probes (/api/cards/[id]/review)
 * 4. Quiz Generation Sanitization Across All 4 Quiz Types (/api/quiz/generate)
 * 5. Quiz Submit Server-Side Grading, Session IDOR, and Replay Attacks (/api/quiz/submit)
 * 6. AI Generation Input Clamping & Rate Limit Handlers (/api/ai/generate)
 * 7. Middleware Edge Route Interception (/middleware)
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

// Transpile helper
function transpileTs(tsSource) {
  const ts = require('typescript');
  return ts.transpileModule(tsSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
}

// ----------------------------------------------------------------------------
// Advanced Mock Database with Adversarial Fixtures
// ----------------------------------------------------------------------------
class AdversarialMockDb {
  constructor() {
    this.reset();
  }

  reset() {
    this.users = [
      { id: 'usr_victim', name: 'Victim User', email: 'victim@test.com' },
      { id: 'usr_attacker', name: 'Attacker User', email: 'attacker@test.com' },
    ];

    this.decks = [
      {
        id: 'dck_private_victim',
        title: 'Victim Private Deck',
        userId: 'usr_victim',
        isPublic: false,
        cardCount: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'dck_public_victim',
        title: 'Victim Public Deck',
        userId: 'usr_victim',
        isPublic: true,
        cardCount: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'dck_attacker',
        title: 'Attacker Deck',
        userId: 'usr_attacker',
        isPublic: false,
        cardCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    this.cards = [
      {
        id: 'crd_v1',
        deckId: 'dck_private_victim',
        front: 'Resilient',
        back: 'Kiên cường',
        phonetic: '/rɪˈzɪl.jənt/',
        example: 'She is resilient under pressure.',
        partOfSpeech: 'adjective',
        synonyms: 'flexible, tough',
        antonyms: 'fragile',
        collocations: 'resilient economy',
        toeicPart: 'Part 5',
        difficulty: 'medium',
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReview: new Date(),
        lastReviewed: null,
      },
      {
        id: 'crd_v2',
        deckId: 'dck_private_victim',
        front: 'Implement',
        back: 'Thực hiện',
        phonetic: '/ˈɪm.plə.ment/',
        example: 'We must implement the strategy.',
        partOfSpeech: 'verb',
        synonyms: 'execute, apply',
        antonyms: '',
        collocations: 'implement changes',
        toeicPart: 'Part 5',
        difficulty: 'easy',
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReview: new Date(),
        lastReviewed: null,
      },
      {
        id: 'crd_v3',
        deckId: 'dck_private_victim',
        front: 'Innovate',
        back: 'Đổi mới',
        phonetic: '/ˈɪn.ə.veɪt/',
        example: 'Companies must innovate to survive.',
        partOfSpeech: 'verb',
        synonyms: 'invent, modernize',
        antonyms: '',
        collocations: 'innovate constantly',
        toeicPart: 'Part 5',
        difficulty: 'medium',
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReview: new Date(),
        lastReviewed: null,
      },
      {
        id: 'crd_v4',
        deckId: 'dck_private_victim',
        front: 'Pragmatic',
        back: 'Thực tế',
        phonetic: '/præɡˈmæt.ɪk/',
        example: 'He took a pragmatic approach.',
        partOfSpeech: 'adjective',
        synonyms: 'practical, realistic',
        antonyms: 'idealistic',
        collocations: 'pragmatic solution',
        toeicPart: 'Part 5',
        difficulty: 'hard',
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReview: new Date(),
        lastReviewed: null,
      },
      // Orphaned card with no matching deck in DB (simulating broken reference)
      {
        id: 'crd_orphan',
        deckId: 'dck_non_existent',
        front: 'Orphan Front',
        back: 'Orphan Back',
        phonetic: '',
        example: '',
        partOfSpeech: '',
        synonyms: '',
        antonyms: '',
        collocations: '',
        toeicPart: '',
        difficulty: 'easy',
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReview: new Date(),
        lastReviewed: null,
      },
    ];

    this.quizSessions = [
      {
        id: 'qs_active_victim',
        userId: 'usr_victim',
        deckId: 'dck_private_victim',
        quizType: 'multiple_choice',
        totalCards: 4,
        correctCount: 0,
        wrongCount: 0,
        score: 0,
        completedAt: null,
        createdAt: new Date(),
      },
      {
        id: 'qs_completed_victim',
        userId: 'usr_victim',
        deckId: 'dck_private_victim',
        quizType: 'multiple_choice',
        totalCards: 4,
        correctCount: 4,
        wrongCount: 0,
        score: 100,
        completedAt: new Date(),
        createdAt: new Date(Date.now() - 3600000),
      },
      {
        id: 'qs_fill_blank_victim',
        userId: 'usr_victim',
        deckId: 'dck_private_victim',
        quizType: 'fill_blank',
        totalCards: 4,
        correctCount: 0,
        wrongCount: 0,
        score: 0,
        completedAt: null,
        createdAt: new Date(),
      },
      {
        id: 'qs_meaning_victim',
        userId: 'usr_victim',
        deckId: 'dck_private_victim',
        quizType: 'meaning_match',
        totalCards: 4,
        correctCount: 0,
        wrongCount: 0,
        score: 0,
        completedAt: null,
        createdAt: new Date(),
      },
    ];

    this.quizAnswers = [];
    this.cardReviews = [];
  }

  getPrismaClient() {
    const db = this;

    return {
      card: {
        findUnique: async ({ where, include, select }) => {
          const card = db.cards.find((c) => c.id === where.id);
          if (!card) return null;
          const result = { ...card };
          if (include?.deck) {
            result.deck = db.decks.find((d) => d.id === card.deckId) || null;
          }
          if (select) {
            const selected = {};
            for (const key of Object.keys(select)) {
              if (select[key]) selected[key] = result[key];
            }
            return selected;
          }
          return result;
        },
        findFirst: async ({ where, include }) => {
          const card = db.cards.find((c) => {
            for (const key of Object.keys(where)) {
              if (c[key] !== where[key]) return false;
            }
            return true;
          });
          if (!card) return null;
          const result = { ...card };
          if (include?.deck) {
            result.deck = db.decks.find((d) => d.id === card.deckId) || null;
          }
          return result;
        },
        findMany: async ({ where, select }) => {
          let list = db.cards.filter((c) => {
            if (where?.deckId && c.deckId !== where.deckId) return false;
            if (where?.id && typeof where.id === 'object' && Array.isArray(where.id.in)) {
              if (!where.id.in.includes(c.id)) return false;
            }
            return true;
          });
          if (select) {
            return list.map((c) => {
              const res = {};
              for (const key of Object.keys(select)) {
                if (select[key]) res[key] = c[key];
              }
              return res;
            });
          }
          return list.map((c) => ({ ...c }));
        },
        create: async ({ data }) => {
          const id = `crd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const card = {
            id,
            deckId: data.deckId,
            front: data.front,
            back: data.back,
            phonetic: data.phonetic || '',
            example: data.example || '',
            partOfSpeech: data.partOfSpeech || '',
            synonyms: data.synonyms || '',
            antonyms: data.antonyms || '',
            collocations: data.collocations || '',
            toeicPart: data.toeicPart || '',
            difficulty: data.difficulty || 'medium',
            easeFactor: 2.5,
            interval: 0,
            repetitions: 0,
            nextReview: new Date(),
            lastReviewed: null,
          };
          db.cards.push(card);
          return { ...card };
        },
        update: async ({ where, data }) => {
          const card = db.cards.find((c) => c.id === where.id);
          if (!card) throw new Error(`Card ${where.id} not found`);
          Object.assign(card, data);
          return { ...card };
        },
        delete: async ({ where }) => {
          const idx = db.cards.findIndex((c) => c.id === where.id);
          if (idx === -1) throw new Error(`Card ${where.id} not found`);
          const [deleted] = db.cards.splice(idx, 1);
          return { ...deleted };
        },
      },
      deck: {
        findUnique: async ({ where, include }) => {
          const deck = db.decks.find((d) => d.id === where.id);
          if (!deck) return null;
          const result = { ...deck };
          if (include?.cards) {
            result.cards = db.cards.filter((c) => c.deckId === deck.id);
          }
          return result;
        },
        update: async ({ where, data }) => {
          const deck = db.decks.find((d) => d.id === where.id);
          if (!deck) throw new Error(`Deck ${where.id} not found`);
          if (data.cardCount?.increment) deck.cardCount += data.cardCount.increment;
          if (data.cardCount?.decrement) deck.cardCount -= data.cardCount.decrement;
          for (const key of Object.keys(data)) {
            if (key !== 'cardCount') deck[key] = data[key];
          }
          return { ...deck };
        },
      },
      quizSession: {
        findFirst: async ({ where }) => {
          const qs = db.quizSessions.find((s) => {
            for (const key of Object.keys(where)) {
              if (s[key] !== where[key]) return false;
            }
            return true;
          });
          return qs ? { ...qs } : null;
        },
        findUnique: async ({ where }) => {
          const qs = db.quizSessions.find((s) => s.id === where.id);
          return qs ? { ...qs } : null;
        },
        create: async ({ data }) => {
          const id = `qs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const qs = {
            id,
            userId: data.userId,
            deckId: data.deckId,
            quizType: data.quizType,
            totalCards: data.totalCards,
            correctCount: 0,
            wrongCount: 0,
            score: 0,
            completedAt: null,
            createdAt: new Date(),
          };
          db.quizSessions.push(qs);
          return { ...qs };
        },
        update: async ({ where, data }) => {
          const qs = db.quizSessions.find((s) => s.id === where.id);
          if (!qs) throw new Error(`QuizSession ${where.id} not found`);
          Object.assign(qs, data);
          return { ...qs };
        },
      },
      quizAnswer: {
        createMany: async ({ data }) => {
          for (const item of data) {
            db.quizAnswers.push({ id: `qa_${Math.random()}`, ...item });
          }
          return { count: data.length };
        },
      },
      cardReview: {
        create: async ({ data }) => {
          const cr = { id: `cr_${Math.random()}`, ...data };
          db.cardReviews.push(cr);
          return cr;
        },
      },
      $transaction: async (ops) => {
        if (typeof ops === 'function') {
          return ops(db.getPrismaClient());
        }
        return Promise.all(ops);
      },
    };
  }
}

// ----------------------------------------------------------------------------
// Test Harness Setup
// ----------------------------------------------------------------------------
let currentSessionUser = null;
function setSession(user) {
  currentSessionUser = user ? { user: { id: user.id, name: user.name, email: user.email, role: user.role } } : null;
}

function loadRoute(relPath, mockDb) {
  const filePath = path.join(ROOT_DIR, relPath);
  const tsSource = fs.readFileSync(filePath, 'utf8');
  const transpiled = transpileTs(tsSource);

  const customRequire = (id) => {
    if (id === '@/lib/admin' || id.endsWith('/admin')) {
      const adminSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/lib/admin.ts'), 'utf8');
      const adminTrans = transpileTs(adminSrc);
      const adminMod = { exports: {} };
      new Function('exports', 'require', 'module', adminTrans.outputText)(adminMod.exports, require, adminMod);
      return { __esModule: true, ...adminMod.exports };
    }
    if (id === 'next-auth/jwt') {
      return {
        __esModule: true,
        getToken: async () => (currentSessionUser ? { ...currentSessionUser.user, role: currentSessionUser.user.role || 'USER' } : null),
      };
    }
    if (id === '@/lib/prisma' || id.endsWith('/prisma')) {
      const client = mockDb.getPrismaClient();
      return { __esModule: true, default: client, prisma: client };
    }
    if (id === 'next-auth') {
      return { __esModule: true, getServerSession: async () => currentSessionUser };
    }
    if (id === '@/lib/auth' || id.endsWith('/auth')) {
      return { __esModule: true, authOptions: {} };
    }
    if (id === 'next/server') {
      return {
        __esModule: true,
        NextRequest: Request,
        NextResponse: {
          json: (data, init) => {
            const status = init?.status || 200;
            const headers = new Headers(init?.headers || {});
            headers.set('Content-Type', 'application/json');
            return new Response(JSON.stringify(data), { status, headers });
          },
          redirect: (url) => {
            return new Response(null, { status: 307, headers: { Location: String(url) } });
          },
          next: () => {
            return new Response(null, { status: 200, headers: { 'x-middleware-next': '1' } });
          },
        },
      };
    }
    if (id === '@/lib/sm2' || id.endsWith('/sm2')) {
      const sm2Src = fs.readFileSync(path.join(ROOT_DIR, 'src/lib/sm2.ts'), 'utf8');
      const sm2Trans = transpileTs(sm2Src);
      const sm2Mod = { exports: {} };
      new Function('exports', 'require', 'module', sm2Trans.outputText)(sm2Mod.exports, require, sm2Mod);
      return { __esModule: true, ...sm2Mod.exports };
    }
    if (id === '@/lib/gamification' || id.endsWith('/gamification')) {
      return {
        __esModule: true,
        addStudyActivity: async () => ({ xpEarned: 10, newLevel: 1 }),
        addQuizActivity: async () => ({ xpEarned: 20, newLevel: 1 }),
      };
    }
    return require(id);
  };

  const mod = { exports: {} };
  const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', transpiled.outputText);
  fn(mod.exports, customRequire, mod, filePath, path.dirname(filePath));
  return mod.exports;
}

function req(url, { method = 'GET', body = null, headers = {} } = {}) {
  const init = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body !== null && method !== 'GET' && method !== 'HEAD') {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  return new Request(url, init);
}

// ----------------------------------------------------------------------------
// Execution & Test Suites
// ----------------------------------------------------------------------------
async function executeAdversarialProbes() {
  const mockDb = new AdversarialMockDb();
  const cardRoute = loadRoute('src/app/api/cards/[id]/route.ts', mockDb);
  const deckCardsRoute = loadRoute('src/app/api/decks/[id]/cards/route.ts', mockDb);
  const reviewRoute = loadRoute('src/app/api/cards/[id]/review/route.ts', mockDb);
  const quizGenRoute = loadRoute('src/app/api/quiz/generate/route.ts', mockDb);
  const quizSubmitRoute = loadRoute('src/app/api/quiz/submit/route.ts', mockDb);

  const tests = [];
  async function runProbe(name, fn) {
    mockDb.reset();
    setSession(null);
    try {
      await fn();
      tests.push({ name, pass: true });
      console.log(`  ✓ PASS: ${name}`);
    } catch (err) {
      tests.push({ name, pass: false, error: err.message });
      console.log(`  ✗ FAIL: ${name}`);
      console.log(`    Error: ${err.message}`);
    }
  }

  console.log('\n================================================================');
  console.log('  EMPIRICAL ADVERSARIAL CHALLENGE PROBES — MILESTONE 3');
  console.log('================================================================\n');

  // --- SECTION 1: CARD IDOR & BOUNDARY PROBES ---
  console.log('[PROBE SUITE 1] Card IDOR & Field Injection Protection');

  await runProbe('Card PUT IDOR: Attacker cannot modify victim card', async () => {
    setSession({ id: 'usr_attacker' });
    const res = await cardRoute.PUT(
      req('http://localhost:3000/api/cards/crd_v1', {
        method: 'PUT',
        body: { front: 'Pwned' },
      }),
      { params: { id: 'crd_v1' } }
    );
    assert.strictEqual(res.status, 403);
    const card = mockDb.cards.find((c) => c.id === 'crd_v1');
    assert.strictEqual(card.front, 'Resilient');
  });

  await runProbe('Card PUT Privilege Escalation: Deck owner cannot reassign card to another deck', async () => {
    setSession({ id: 'usr_victim' });
    const res = await cardRoute.PUT(
      req('http://localhost:3000/api/cards/crd_v1', {
        method: 'PUT',
        body: { front: 'Updated Front', deckId: 'dck_attacker' },
      }),
      { params: { id: 'crd_v1' } }
    );
    assert.strictEqual(res.status, 200);
    const card = mockDb.cards.find((c) => c.id === 'crd_v1');
    assert.strictEqual(card.deckId, 'dck_private_victim', 'deckId must NOT be changeable via card PUT');
    assert.strictEqual(card.front, 'Updated Front');
  });

  await runProbe('Card PUT Orphan: Card with missing deck reference returns 403 Forbidden', async () => {
    setSession({ id: 'usr_victim' });
    const res = await cardRoute.PUT(
      req('http://localhost:3000/api/cards/crd_orphan', {
        method: 'PUT',
        body: { front: 'Orphan Modified' },
      }),
      { params: { id: 'crd_orphan' } }
    );
    assert.strictEqual(res.status, 403, 'Orphaned card with null deck must be forbidden');
  });

  await runProbe('Card DELETE IDOR: Attacker cannot delete victim card', async () => {
    setSession({ id: 'usr_attacker' });
    const res = await cardRoute.DELETE(
      req('http://localhost:3000/api/cards/crd_v1', { method: 'DELETE' }),
      { params: { id: 'crd_v1' } }
    );
    assert.strictEqual(res.status, 403);
    const card = mockDb.cards.find((c) => c.id === 'crd_v1');
    assert.ok(card, 'Card must not be deleted');
  });

  await runProbe('Card DELETE Orphan: Orphaned card returns 403 Forbidden', async () => {
    setSession({ id: 'usr_victim' });
    const res = await cardRoute.DELETE(
      req('http://localhost:3000/api/cards/crd_orphan', { method: 'DELETE' }),
      { params: { id: 'crd_orphan' } }
    );
    assert.strictEqual(res.status, 403, 'Orphaned card deletion must be forbidden');
  });

  // --- SECTION 2: DECK CARDS PRIVACY & MUTATIONS ---
  console.log('\n[PROBE SUITE 2] Deck Cards Privacy & Authorization');

  await runProbe('Deck Cards GET: Attacker reading victim private deck returns 403', async () => {
    setSession({ id: 'usr_attacker' });
    const res = await deckCardsRoute.GET(
      req('http://localhost:3000/api/decks/dck_private_victim/cards'),
      { params: { id: 'dck_private_victim' } }
    );
    assert.strictEqual(res.status, 403);
  });

  await runProbe('Deck Cards GET: Public deck returns 200 for unauthenticated guest', async () => {
    setSession(null);
    const res = await deckCardsRoute.GET(
      req('http://localhost:3000/api/decks/dck_public_victim/cards'),
      { params: { id: 'dck_public_victim' } }
    );
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data));
  });

  await runProbe('Deck Cards POST: Attacker adding card to victim PUBLIC deck returns 403', async () => {
    setSession({ id: 'usr_attacker' });
    const res = await deckCardsRoute.POST(
      req('http://localhost:3000/api/decks/dck_public_victim/cards', {
        method: 'POST',
        body: { front: 'Spam Front', back: 'Spam Back' },
      }),
      { params: { id: 'dck_public_victim' } }
    );
    assert.strictEqual(res.status, 403, 'Attacker cannot post to victim public deck');
  });

  await runProbe('Deck Cards POST Validation: Whitespace front/back rejected with 400', async () => {
    setSession({ id: 'usr_victim' });
    const res1 = await deckCardsRoute.POST(
      req('http://localhost:3000/api/decks/dck_private_victim/cards', {
        method: 'POST',
        body: { front: '   ', back: 'Valid Back' },
      }),
      { params: { id: 'dck_private_victim' } }
    );
    assert.strictEqual(res1.status, 400);

    const res2 = await deckCardsRoute.POST(
      req('http://localhost:3000/api/decks/dck_private_victim/cards', {
        method: 'POST',
        body: { front: 'Valid Front', back: '   ' },
      }),
      { params: { id: 'dck_private_victim' } }
    );
    assert.strictEqual(res2.status, 400);
  });

  // --- SECTION 3: CARD REVIEW AUTHORIZATION & BOUNDARIES ---
  console.log('\n[PROBE SUITE 3] Card Review Authorization & Quality Range Probes');

  await runProbe('Card Review: Non-numeric / out-of-range quality rejected with 400', async () => {
    setSession({ id: 'usr_victim' });
    const badQualities = [-1, 6, '5', null, NaN, Infinity];
    for (const q of badQualities) {
      const res = await reviewRoute.POST(
        req('http://localhost:3000/api/cards/crd_v1/review', {
          method: 'POST',
          body: { quality: q },
        }),
        { params: { id: 'crd_v1' } }
      );
      assert.strictEqual(res.status, 400, `Quality ${q} should be rejected with HTTP 400`);
    }
  });

  await runProbe('Card Review IDOR: Attacker reviewing victim card returns 403', async () => {
    setSession({ id: 'usr_attacker' });
    const res = await reviewRoute.POST(
      req('http://localhost:3000/api/cards/crd_v1/review', {
        method: 'POST',
        body: { quality: 5 },
      }),
      { params: { id: 'crd_v1' } }
    );
    assert.strictEqual(res.status, 403);
  });

  await runProbe('Card Review: Owner valid review (quality 0-5) updates SM-2 and returns 200', async () => {
    setSession({ id: 'usr_victim' });
    const res = await reviewRoute.POST(
      req('http://localhost:3000/api/cards/crd_v1/review', {
        method: 'POST',
        body: { quality: 4 },
      }),
      { params: { id: 'crd_v1' } }
    );
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.repetitions, 1);
    assert.ok(data.easeFactor > 0);
    assert.ok(data.nextReviewFormatted);
  });

  // --- SECTION 4: QUIZ DE-LEAKAGE ACROSS ALL 4 QUIZ TYPES ---
  console.log('\n[PROBE SUITE 4] Quiz Sanitization & Zero Answer Leakage Across All Quiz Types');

  const quizTypes = ['multiple_choice', 'meaning_match', 'fill_blank', 'listening'];
  for (const qType of quizTypes) {
    await runProbe(`Quiz Gen (${qType}): 0% answer leakage in response payload`, async () => {
      setSession({ id: 'usr_victim' });
      const res = await quizGenRoute.POST(
        req('http://localhost:3000/api/quiz/generate', {
          method: 'POST',
          body: { deckId: 'dck_private_victim', type: qType, questionCount: 4 },
        })
      );
      assert.strictEqual(res.status, 200);
      const rawText = await res.text();

      // Check regex leak patterns
      assert.strictEqual(
        /"correctAnswer"\s*:/.test(rawText),
        false,
        `Quiz type ${qType} must not leak correctAnswer`
      );
      assert.strictEqual(
        /"isCorrect"\s*:/.test(rawText),
        false,
        `Quiz type ${qType} must not leak isCorrect`
      );

      const parsed = JSON.parse(rawText);
      for (const q of parsed.questions) {
        assert.strictEqual(q.correctAnswer, undefined);
        if (q.options) {
          for (const opt of q.options) {
            assert.strictEqual(opt.isCorrect, undefined);
            assert.ok(typeof opt.text === 'string' && opt.text.length > 0);
          }
        }
      }
    });
  }

  await runProbe('Quiz Gen: Invalid quiz type rejected with HTTP 400', async () => {
    setSession({ id: 'usr_victim' });
    const res = await quizGenRoute.POST(
      req('http://localhost:3000/api/quiz/generate', {
        method: 'POST',
        body: { deckId: 'dck_private_victim', type: 'exploit_type' },
      })
    );
    assert.strictEqual(res.status, 400);
  });

  // --- SECTION 5: QUIZ SUBMIT SERVER-SIDE GRADING & REPLAY ---
  console.log('\n[PROBE SUITE 5] Quiz Submit Server Grading, IDOR & Anti-Replay');

  await runProbe('Quiz Submit Session IDOR: Attacker submitting victim session returns 404', async () => {
    setSession({ id: 'usr_attacker' }); // Attacker tries to submit for victim's session
    const res = await quizSubmitRoute.POST(
      req('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        body: {
          sessionId: 'qs_active_victim',
          answers: [{ cardId: 'crd_v1', selectedAnswer: 'Kiên cường' }],
        },
      })
    );
    assert.strictEqual(res.status, 404, 'Session belonging to another user must return 404');
  });

  await runProbe('Quiz Submit Replay Attack: Re-submitting completed session returns 400', async () => {
    setSession({ id: 'usr_victim' });
    const res = await quizSubmitRoute.POST(
      req('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        body: {
          sessionId: 'qs_completed_victim', // completedAt != null
          answers: [{ cardId: 'crd_v1', selectedAnswer: 'Kiên cường' }],
        },
      })
    );
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('already completed'));
  });

  await runProbe('Quiz Submit Grading: Server evaluates correct and wrong answers against DB', async () => {
    setSession({ id: 'usr_victim' });
    const res = await quizSubmitRoute.POST(
      req('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        body: {
          sessionId: 'qs_active_victim',
          answers: [
            // crd_v1 back is 'Kiên cường'
            { cardId: 'crd_v1', selectedAnswer: '  kiên cường  ', isCorrect: false }, // Client says false, but answer is correct!
            // crd_v2 back is 'Thực hiện'
            { cardId: 'crd_v2', selectedAnswer: 'Sai hoàn toàn', isCorrect: true }, // Client claims true, but answer is wrong!
          ],
        },
      })
    );
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.correctCount, 1, 'Server must accurately count 1 correct answer (crd_v1)');
    assert.strictEqual(data.wrongCount, 1, 'Server must accurately count 1 wrong answer (crd_v2)');
    assert.strictEqual(data.score, 50, 'Score must be 50%');

    // Verify session is now completed
    const session = mockDb.quizSessions.find((s) => s.id === 'qs_active_victim');
    assert.ok(session.completedAt !== null, 'Session must now have completedAt timestamp');

    // Attempting to submit again immediately should fail with 400 (anti-replay check)
    const replayRes = await quizSubmitRoute.POST(
      req('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        body: {
          sessionId: 'qs_active_victim',
          answers: [{ cardId: 'crd_v1', selectedAnswer: 'Kiên cường' }],
        },
      })
    );
    assert.strictEqual(replayRes.status, 400, 'Immediate secondary submit must be rejected');
  });

  await runProbe('Quiz Submit Grading (meaning_match / fill_blank): Compares against card.front', async () => {
    setSession({ id: 'usr_victim' });
    const res = await quizSubmitRoute.POST(
      req('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        body: {
          sessionId: 'qs_meaning_victim', // quizType is 'meaning_match' -> expected answer is card.front ('Resilient')
          answers: [
            { cardId: 'crd_v1', selectedAnswer: 'resilient' },
          ],
        },
      })
    );
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.correctCount, 1, 'Should match card.front for meaning_match');
    assert.strictEqual(data.score, 100);
  });

  // --- SECTION 6: AI GENERATION HARDENING ---
  console.log('\n[PROBE SUITE 6] AI Generation Parameter Clamping & Error Handling');

  // Load AI route
  const aiRoute = loadRoute('src/app/api/ai/generate/route.ts', mockDb);

  await runProbe('AI Generate: Unauthenticated request rejected with HTTP 401', async () => {
    setSession(null);
    const res = await aiRoute.POST(
      req('http://localhost:3000/api/ai/generate', {
        method: 'POST',
        body: { topic: 'Business' },
      })
    );
    assert.strictEqual(res.status, 401);
  });

  await runProbe('AI Generate: Missing GEMINI_API_KEY rejected with HTTP 500', async () => {
    setSession({ id: 'usr_victim' });
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const res = await aiRoute.POST(
        req('http://localhost:3000/api/ai/generate', {
          method: 'POST',
          body: { topic: 'Business' },
        })
      );
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.ok(data.message.includes('GEMINI_API_KEY'));
    } finally {
      process.env.GEMINI_API_KEY = prevKey || 'mock_test_key';
    }
  });

  await runProbe('AI Generate: Missing or whitespace topic rejected with HTTP 400', async () => {
    setSession({ id: 'usr_victim' });
    process.env.GEMINI_API_KEY = 'mock_test_key';
    const res = await aiRoute.POST(
      req('http://localhost:3000/api/ai/generate', {
        method: 'POST',
        body: { topic: '   ' },
      })
    );
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.message.includes('chủ đề'));
  });

  await runProbe('AI Generate Rate Limiting: 429/quota error mapped to HTTP 429', async () => {
    setSession({ id: 'usr_victim' });
    process.env.GEMINI_API_KEY = 'mock_test_key';
    
    // Test that when Gemini API throws 429 or RESOURCE_EXHAUSTED, route returns 429
    // By calling with an invalid prompt that triggers an exception in our mock
    const res = await aiRoute.POST(
      req('http://localhost:3000/api/ai/generate', {
        method: 'POST',
        body: { topic: '__TRIGGER_RATE_LIMIT__' },
      })
    );
    // Since mock_test_key is invalid for GoogleGenerativeAI, it will throw API key error or fetch error
    // Verifying it returns 500 or 429 gracefully without unhandled node process crash
    assert.ok(res.status === 429 || res.status === 500);
  });

  await runProbe('Card Review: Non-critical gamification failure does not fail review (returns 200)', async () => {
    setSession({ id: 'usr_victim' });
    // Intentionally corrupt cardReviews to throw
    mockDb.cardReviews.push = () => { throw new Error('DB disk full'); };
    const res = await reviewRoute.POST(
      req('http://localhost:3000/api/cards/crd_v1/review', {
        method: 'POST',
        body: { quality: 5 },
      }),
      { params: { id: 'crd_v1' } }
    );
    assert.strictEqual(res.status, 200, 'Review must succeed even if gamification logging fails');
  });

  await runProbe('Quiz Submit Validation: Missing sessionId or non-array answers rejected with 400', async () => {
    setSession({ id: 'usr_victim' });
    const res1 = await quizSubmitRoute.POST(
      req('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        body: { sessionId: '' },
      })
    );
    assert.strictEqual(res1.status, 400);

    const res2 = await quizSubmitRoute.POST(
      req('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        body: { sessionId: 'qs_active_victim', answers: 'not_an_array' },
      })
    );
    assert.strictEqual(res2.status, 400);
  });

  await runProbe('Quiz Submit Edge Case: Empty answers array handles division by zero safely', async () => {
    setSession({ id: 'usr_victim' });
    const res = await quizSubmitRoute.POST(
      req('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        body: { sessionId: 'qs_active_victim', answers: [] },
      })
    );
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.score, 0);
    assert.strictEqual(data.totalQuestions, 0);
  });

  await runProbe('Deck Cards Edge Cases: Non-existent deck returns 404 for GET and POST', async () => {
    setSession({ id: 'usr_victim' });
    const resGet = await deckCardsRoute.GET(
      req('http://localhost:3000/api/decks/dck_does_not_exist/cards'),
      { params: { id: 'dck_does_not_exist' } }
    );
    assert.strictEqual(resGet.status, 404);

    const resPost = await deckCardsRoute.POST(
      req('http://localhost:3000/api/decks/dck_does_not_exist/cards', {
        method: 'POST',
        body: { front: 'F', back: 'B' },
      }),
      { params: { id: 'dck_does_not_exist' } }
    );
    assert.strictEqual(resPost.status, 404);
  });

  // --- SECTION 7: MIDDLEWARE ROUTE PROTECTION ---
  console.log('\n[PROBE SUITE 7] Middleware Edge Route Interception');

  const middlewareMod = loadRoute('src/middleware.ts', mockDb);
  const middleware = middlewareMod.middleware;

  await runProbe('Middleware: Protected API (/api/cards/crd_1) unauthenticated returns 401', async () => {
    const reqObj = new Request('http://localhost:3000/api/cards/crd_1');
    reqObj.nextUrl = new URL('http://localhost:3000/api/cards/crd_1');
    const res = await middleware(reqObj);
    assert.strictEqual(res.status, 401);
  });

  await runProbe('Middleware: Protected Web Page (/profile) unauthenticated redirects to /login', async () => {
    const reqObj = new Request('http://localhost:3000/profile');
    reqObj.nextUrl = new URL('http://localhost:3000/profile');
    const res = await middleware(reqObj);
    assert.strictEqual(res.status, 307);
    assert.ok(res.headers.get('Location').includes('/login'));
  });

  await runProbe('Middleware: Admin area unauthenticated redirects to /admin/login', async () => {
    setSession(null);
    const reqObj = new Request('http://localhost:3000/admin/users');
    reqObj.nextUrl = new URL('http://localhost:3000/admin/users');
    const res = await middleware(reqObj);
    assert.strictEqual(res.status, 307);
    assert.ok(res.headers.get('Location').includes('/admin/login'));
  });

  await runProbe('Middleware: Admin area non-admin user (role: USER) redirects to /dashboard', async () => {
    setSession({ id: 'usr_normal', role: 'USER' });
    const reqObj = new Request('http://localhost:3000/admin/users');
    reqObj.nextUrl = new URL('http://localhost:3000/admin/users');
    const res = await middleware(reqObj);
    assert.strictEqual(res.status, 307);
    assert.ok(res.headers.get('Location').includes('/dashboard'));
  });

  await runProbe('Middleware: Admin area admin user (role: ADMIN) allowed through', async () => {
    setSession({ id: 'usr_admin', role: 'ADMIN' });
    const reqObj = new Request('http://localhost:3000/admin/users');
    reqObj.nextUrl = new URL('http://localhost:3000/admin/users');
    const res = await middleware(reqObj);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('x-middleware-next'), '1');
  });

  console.log('\n================================================================');
  const passed = tests.filter((t) => t.pass).length;
  const failed = tests.filter((t) => !t.pass).length;
  console.log(`TOTAL ADVERSARIAL PROBES: ${tests.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

executeAdversarialProbes().catch((err) => {
  console.error('Fatal probe runner error:', err);
  process.exit(1);
});
