/**
 * tests/e2e/tier2-security.test.mjs
 * Tier 2: Boundary & Security Vulnerability Checks
 *
 * Implements 22 security, IDOR, sanitization, and anti-replay checks
 * specified in spec_miner_e2e_tier2/handoff.md.
 *
 * Uses in-memory route compilation and MockDb sandbox:
 * - Card IDOR protection on /api/cards/[id] (PUT & DELETE)
 * - Deck Cards IDOR & privacy on /api/decks/[id]/cards (GET & POST)
 * - Card Review authorization on /api/cards/[id]/review (POST)
 * - Quiz question sanitization on /api/quiz/generate (0% leakage)
 * - Quiz server-side grading and anti-replay on /api/quiz/submit (POST)
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

export const name = 'Tier 2: Boundary & Security Vulnerability Checks';

// ----------------------------------------------------------------------------
// Mock Database Architecture
// ----------------------------------------------------------------------------
class MockDb {
  constructor() {
    this.reset();
  }

  reset() {
    this.users = [
      { id: 'usr_owner_1', name: 'Deck Owner', email: 'owner@test.com' },
      { id: 'usr_attacker_2', name: 'Attacker User', email: 'attacker@test.com' },
    ];

    this.decks = [
      {
        id: 'dck_priv_1',
        title: 'Private Deck 1',
        userId: 'usr_owner_1',
        isPublic: false,
        cardCount: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'dck_pub_1',
        title: 'Public Deck 1',
        userId: 'usr_owner_1',
        isPublic: true,
        cardCount: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    this.cards = [
      {
        id: 'crd_1',
        deckId: 'dck_priv_1',
        front: 'Abandon',
        back: 'Từ bỏ',
        phonetic: '/əˈbændən/',
        example: 'They had to abandon the plan.',
        partOfSpeech: 'verb',
        synonyms: '',
        antonyms: '',
        collocations: '',
        toeicPart: 'Part 5',
        difficulty: 'medium',
        audioUrl: '',
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReview: new Date(),
        lastReviewed: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'crd_2',
        deckId: 'dck_priv_1',
        front: 'Benefit',
        back: 'Lợi ích',
        phonetic: '/ˈbenɪfɪt/',
        example: 'The new policy has many benefits.',
        partOfSpeech: 'noun',
        synonyms: '',
        antonyms: '',
        collocations: '',
        toeicPart: 'Part 5',
        difficulty: 'easy',
        audioUrl: '',
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReview: new Date(),
        lastReviewed: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'crd_3',
        deckId: 'dck_priv_1',
        front: 'Candidate',
        back: 'Ứng viên',
        phonetic: '/ˈkændɪdət/',
        example: 'He is a top candidate for the job.',
        partOfSpeech: 'noun',
        synonyms: '',
        antonyms: '',
        collocations: '',
        toeicPart: 'Part 5',
        difficulty: 'medium',
        audioUrl: '',
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReview: new Date(),
        lastReviewed: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'crd_4',
        deckId: 'dck_priv_1',
        front: 'Decide',
        back: 'Quyết định',
        phonetic: '/dɪˈsaɪd/',
        example: 'We must decide today.',
        partOfSpeech: 'verb',
        synonyms: '',
        antonyms: '',
        collocations: '',
        toeicPart: 'Part 5',
        difficulty: 'easy',
        audioUrl: '',
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReview: new Date(),
        lastReviewed: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    this.quizSessions = [
      {
        id: 'qs_active_1',
        userId: 'usr_owner_1',
        deckId: 'dck_priv_1',
        quizType: 'multiple_choice',
        totalCards: 4,
        correctCount: 0,
        wrongCount: 0,
        score: 0,
        completedAt: null,
        createdAt: new Date(),
      },
      {
        id: 'qs_completed_1',
        userId: 'usr_owner_1',
        deckId: 'dck_priv_1',
        quizType: 'multiple_choice',
        totalCards: 4,
        correctCount: 4,
        wrongCount: 0,
        score: 100,
        completedAt: new Date(Date.now() - 3600000),
        createdAt: new Date(Date.now() - 7200000),
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
        findFirst: async ({ where, include, select }) => {
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
        findMany: async ({ where, select, orderBy }) => {
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
            audioUrl: data.audioUrl || '',
            easeFactor: data.easeFactor ?? 2.5,
            interval: data.interval ?? 0,
            repetitions: data.repetitions ?? 0,
            nextReview: data.nextReview || new Date(),
            lastReviewed: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          db.cards.push(card);
          return { ...card };
        },
        update: async ({ where, data }) => {
          const card = db.cards.find((c) => c.id === where.id);
          if (!card) throw new Error(`Card ${where.id} not found`);
          Object.assign(card, data, { updatedAt: new Date() });
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
        findFirst: async ({ where, include }) => {
          const deck = db.decks.find((d) => {
            for (const key of Object.keys(where)) {
              if (d[key] !== where[key]) return false;
            }
            return true;
          });
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
          if (data.cardCount?.increment) {
            deck.cardCount += data.cardCount.increment;
          }
          if (data.cardCount?.decrement) {
            deck.cardCount -= data.cardCount.decrement;
          }
          for (const key of Object.keys(data)) {
            if (key !== 'cardCount') deck[key] = data[key];
          }
          deck.updatedAt = new Date();
          return { ...deck };
        },
      },
      quizSession: {
        findUnique: async ({ where }) => {
          const qs = db.quizSessions.find((s) => s.id === where.id);
          return qs ? { ...qs } : null;
        },
        findFirst: async ({ where }) => {
          const qs = db.quizSessions.find((s) => {
            for (const key of Object.keys(where)) {
              if (s[key] !== where[key]) return false;
            }
            return true;
          });
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
            db.quizAnswers.push({
              id: `qa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              ...item,
              createdAt: new Date(),
            });
          }
          return { count: data.length };
        },
      },
      cardReview: {
        create: async ({ data }) => {
          const cr = {
            id: `cr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            ...data,
            createdAt: new Date(),
          };
          db.cardReviews.push(cr);
          return { ...cr };
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
// Dynamic Route Loader & Session Context
// ----------------------------------------------------------------------------
let currentSessionUser = null;

function setSessionUser(user) {
  currentSessionUser = user ? { user: { id: user.id, name: user.name, email: user.email } } : null;
}

function loadRouteHandler(relativePath, mockDb) {
  const filePath = path.join(ROOT_DIR, relativePath);
  const tsSource = fs.readFileSync(filePath, 'utf8');
  const ts = require('typescript');
  const transpiled = ts.transpileModule(tsSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });

  const customRequire = (id) => {
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
        },
      };
    }
    if (id === '@/lib/sm2' || id.endsWith('/sm2')) {
      const sm2Src = fs.readFileSync(path.join(ROOT_DIR, 'src/lib/sm2.ts'), 'utf8');
      const sm2Trans = ts.transpileModule(sm2Src, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
      const sm2Mod = { exports: {} };
      new Function('exports', 'require', 'module', sm2Trans.outputText)(sm2Mod.exports, require, sm2Mod);
      return { __esModule: true, ...sm2Mod.exports };
    }
    if (id === '@/lib/gamification' || id.endsWith('/gamification')) {
      return {
        __esModule: true,
        addStudyActivity: async () => ({ xpEarned: 10, newLevel: 1 }),
        addQuizActivity: async () => ({ xpEarned: 20, newLevel: 1 }),
        getLevelProgress: () => 50,
        calculateLevel: () => 1,
      };
    }
    return require(id);
  };

  const mod = { exports: {} };
  const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', transpiled.outputText);
  fn(mod.exports, customRequire, mod, filePath, path.dirname(filePath));
  return mod.exports;
}

function makeRequest(url, { method = 'GET', body = null, headers = {} } = {}) {
  const reqInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  if (body !== null && method !== 'GET' && method !== 'HEAD') {
    reqInit.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  return new Request(url, reqInit);
}

/**
 * Execute all Tier 2 tests
 * @param {object} [options]
 * @param {boolean} [options.verbose=false]
 * @returns {Promise<Array<{ name: string, pass: boolean, error?: string, durationMs: number, details?: string }>>}
 */
export async function runTests({ verbose = false } = {}) {
  const results = [];
  const mockDb = new MockDb();

  // Helper test runner wrapper
  async function runCase(name, fn) {
    mockDb.reset();
    setSessionUser(null);
    const start = Date.now();
    try {
      await fn();
      results.push({
        name,
        pass: true,
        durationMs: Date.now() - start,
      });
    } catch (err) {
      results.push({
        name,
        pass: false,
        error: err.message,
        durationMs: Date.now() - start,
      });
    }
  }

  // Load compiled route modules
  const cardRoute = loadRouteHandler('src/app/api/cards/[id]/route.ts', mockDb);
  const deckCardsRoute = loadRouteHandler('src/app/api/decks/[id]/cards/route.ts', mockDb);
  const reviewRoute = loadRouteHandler('src/app/api/cards/[id]/review/route.ts', mockDb);
  const quizGenRoute = loadRouteHandler('src/app/api/quiz/generate/route.ts', mockDb);
  const quizSubmitRoute = loadRouteHandler('src/app/api/quiz/submit/route.ts', mockDb);

  // ==========================================================================
  // Group 1: Card IDOR Protection (/api/cards/[id])
  // ==========================================================================

  await runCase('2.1 Card PUT: Unauthenticated request rejected with HTTP 401', async () => {
    setSessionUser(null);
    const req = makeRequest('http://localhost:3000/api/cards/crd_1', {
      method: 'PUT',
      body: { front: 'Hacked Title' },
    });
    const res = await cardRoute.PUT(req, { params: { id: 'crd_1' } });
    assert.strictEqual(res.status, 401, `Expected HTTP 401 Unauthorized, got ${res.status}`);
  });

  await runCase('2.2 Card PUT: Target card not found returns HTTP 404', async () => {
    setSessionUser({ id: 'usr_owner_1' });
    const req = makeRequest('http://localhost:3000/api/cards/crd_not_found', {
      method: 'PUT',
      body: { front: 'New Front' },
    });
    const res = await cardRoute.PUT(req, { params: { id: 'crd_not_found' } });
    assert.strictEqual(res.status, 404, `Expected HTTP 404 Not Found, got ${res.status}`);
  });

  await runCase('2.3 Card PUT IDOR: Non-owner modification rejected with HTTP 403', async () => {
    setSessionUser({ id: 'usr_attacker_2' }); // User 2 attempts to edit card belonging to User 1
    const req = makeRequest('http://localhost:3000/api/cards/crd_1', {
      method: 'PUT',
      body: { front: 'Malicious Overwrite' },
    });
    const res = await cardRoute.PUT(req, { params: { id: 'crd_1' } });
    assert.strictEqual(res.status, 403, `Expected HTTP 403 Forbidden for non-owner, got ${res.status}`);

    // Verify database record remained untampered
    const card = mockDb.cards.find((c) => c.id === 'crd_1');
    assert.strictEqual(card.front, 'Abandon', 'Card in database must not be modified by non-owner');
  });

  await runCase('2.4 Card PUT: Valid owner update succeeds with HTTP 200 and updates record', async () => {
    setSessionUser({ id: 'usr_owner_1' });
    const req = makeRequest('http://localhost:3000/api/cards/crd_1', {
      method: 'PUT',
      body: { front: 'Legitimate Update' },
    });
    const res = await cardRoute.PUT(req, { params: { id: 'crd_1' } });
    assert.strictEqual(res.status, 200, `Expected HTTP 200 OK, got ${res.status}`);
    const card = mockDb.cards.find((c) => c.id === 'crd_1');
    assert.strictEqual(card.front, 'Legitimate Update', 'Card front should be updated in database');
  });

  await runCase('2.5 Card DELETE: Unauthenticated request rejected with HTTP 401', async () => {
    setSessionUser(null);
    const req = makeRequest('http://localhost:3000/api/cards/crd_1', { method: 'DELETE' });
    const res = await cardRoute.DELETE(req, { params: { id: 'crd_1' } });
    assert.strictEqual(res.status, 401, `Expected HTTP 401 Unauthorized, got ${res.status}`);
  });

  await runCase('2.6 Card DELETE: Target card not found returns HTTP 404', async () => {
    setSessionUser({ id: 'usr_owner_1' });
    const req = makeRequest('http://localhost:3000/api/cards/crd_not_found', { method: 'DELETE' });
    const res = await cardRoute.DELETE(req, { params: { id: 'crd_not_found' } });
    assert.strictEqual(res.status, 404, `Expected HTTP 404 Not Found, got ${res.status}`);
  });

  await runCase('2.7 Card DELETE IDOR: Non-owner deletion rejected with HTTP 403', async () => {
    setSessionUser({ id: 'usr_attacker_2' }); // User 2 attempts to delete User 1's card
    const req = makeRequest('http://localhost:3000/api/cards/crd_1', { method: 'DELETE' });
    const res = await cardRoute.DELETE(req, { params: { id: 'crd_1' } });
    assert.strictEqual(res.status, 403, `Expected HTTP 403 Forbidden for non-owner, got ${res.status}`);

    // Verify card is not deleted
    const card = mockDb.cards.find((c) => c.id === 'crd_1');
    assert.ok(card, 'Card must not be deleted by unauthorized user');
  });

  await runCase('2.8 Card DELETE: Valid owner deletion succeeds with HTTP 200 and decrements deck cardCount', async () => {
    setSessionUser({ id: 'usr_owner_1' });
    const initialDeck = mockDb.decks.find((d) => d.id === 'dck_priv_1');
    const initialCount = initialDeck.cardCount;

    const req = makeRequest('http://localhost:3000/api/cards/crd_1', { method: 'DELETE' });
    const res = await cardRoute.DELETE(req, { params: { id: 'crd_1' } });
    assert.strictEqual(res.status, 200, `Expected HTTP 200 OK, got ${res.status}`);

    const card = mockDb.cards.find((c) => c.id === 'crd_1');
    assert.strictEqual(card, undefined, 'Card should be removed from database');
    assert.strictEqual(initialDeck.cardCount, initialCount - 1, 'Deck cardCount must decrement by 1');
  });

  // ==========================================================================
  // Group 2: Deck Cards Privacy & IDOR (/api/decks/[id]/cards)
  // ==========================================================================

  await runCase('2.9 Deck Cards GET: Unauthenticated request on private deck rejected with HTTP 401', async () => {
    setSessionUser(null);
    const req = makeRequest('http://localhost:3000/api/decks/dck_priv_1/cards', { method: 'GET' });
    const res = await deckCardsRoute.GET(req, { params: { id: 'dck_priv_1' } });
    assert.strictEqual(res.status, 401, `Expected HTTP 401 Unauthorized for private deck, got ${res.status}`);
  });

  await runCase('2.10 Deck Cards GET IDOR: Non-owner access to private deck rejected with HTTP 403', async () => {
    setSessionUser({ id: 'usr_attacker_2' }); // User 2 attempts to fetch private deck of User 1
    const req = makeRequest('http://localhost:3000/api/decks/dck_priv_1/cards', { method: 'GET' });
    const res = await deckCardsRoute.GET(req, { params: { id: 'dck_priv_1' } });
    assert.strictEqual(res.status, 403, `Expected HTTP 403 Forbidden for non-owner, got ${res.status}`);
  });

  await runCase('2.11 Deck Cards GET: Public deck accessible without session (HTTP 200)', async () => {
    setSessionUser(null);
    const req = makeRequest('http://localhost:3000/api/decks/dck_pub_1/cards', { method: 'GET' });
    const res = await deckCardsRoute.GET(req, { params: { id: 'dck_pub_1' } });
    assert.strictEqual(res.status, 200, `Public deck should return HTTP 200, got ${res.status}`);
    const data = await res.json();
    assert.ok(Array.isArray(data), 'Response must be an array of cards');
  });

  await runCase('2.12 Deck Cards GET: Target deck not found returns HTTP 404', async () => {
    setSessionUser({ id: 'usr_owner_1' });
    const req = makeRequest('http://localhost:3000/api/decks/dck_non_existent/cards', { method: 'GET' });
    const res = await deckCardsRoute.GET(req, { params: { id: 'dck_non_existent' } });
    assert.strictEqual(res.status, 404, `Expected HTTP 404 Not Found, got ${res.status}`);
  });

  await runCase('2.13 Deck Cards POST: Unauthenticated card creation rejected with HTTP 401', async () => {
    setSessionUser(null);
    const req = makeRequest('http://localhost:3000/api/decks/dck_priv_1/cards', {
      method: 'POST',
      body: { front: 'Word', back: 'Nghĩa' },
    });
    const res = await deckCardsRoute.POST(req, { params: { id: 'dck_priv_1' } });
    assert.strictEqual(res.status, 401, `Expected HTTP 401 Unauthorized, got ${res.status}`);
  });

  await runCase('2.14 Deck Cards POST IDOR: Non-owner card addition to deck rejected with HTTP 403', async () => {
    setSessionUser({ id: 'usr_attacker_2' }); // User 2 attempts to add card to User 1's deck
    const req = makeRequest('http://localhost:3000/api/decks/dck_priv_1/cards', {
      method: 'POST',
      body: { front: 'Spam Front', back: 'Spam Back' },
    });
    const res = await deckCardsRoute.POST(req, { params: { id: 'dck_priv_1' } });
    assert.strictEqual(res.status, 403, `Expected HTTP 403 Forbidden for non-owner, got ${res.status}`);
  });

  await runCase('2.15 Deck Cards POST: Missing front or back text rejected with HTTP 400', async () => {
    setSessionUser({ id: 'usr_owner_1' });
    const req = makeRequest('http://localhost:3000/api/decks/dck_priv_1/cards', {
      method: 'POST',
      body: { front: '', back: 'Missing front' },
    });
    const res = await deckCardsRoute.POST(req, { params: { id: 'dck_priv_1' } });
    assert.strictEqual(res.status, 400, `Expected HTTP 400 Bad Request, got ${res.status}`);
  });

  await runCase('2.16 Deck Cards POST: Valid owner card addition succeeds with HTTP 201 and increments cardCount', async () => {
    setSessionUser({ id: 'usr_owner_1' });
    const deck = mockDb.decks.find((d) => d.id === 'dck_priv_1');
    const prevCount = deck.cardCount;

    const req = makeRequest('http://localhost:3000/api/decks/dck_priv_1/cards', {
      method: 'POST',
      body: { front: 'Enhance', back: 'Tăng cường', difficulty: 'hard' },
    });
    const res = await deckCardsRoute.POST(req, { params: { id: 'dck_priv_1' } });
    assert.ok(
      res.status === 201 || res.status === 200,
      `Expected HTTP 201 Created or 200 OK, got ${res.status}`,
    );

    const added = mockDb.cards.find((c) => c.front === 'Enhance');
    assert.ok(added, 'New card should be inserted into database');
    assert.strictEqual(deck.cardCount, prevCount + 1, 'Deck cardCount should increment by 1');
  });

  // ==========================================================================
  // Group 3: Card Review Authorization (/api/cards/[id]/review)
  // ==========================================================================

  await runCase('2.17 Card Review: Unauthenticated review submission rejected with HTTP 401', async () => {
    setSessionUser(null);
    const req = makeRequest('http://localhost:3000/api/cards/crd_1/review', {
      method: 'POST',
      body: { quality: 4 },
    });
    const res = await reviewRoute.POST(req, { params: { id: 'crd_1' } });
    assert.strictEqual(res.status, 401, `Expected HTTP 401 Unauthorized, got ${res.status}`);
  });

  await runCase('2.18 Card Review: Target card not found returns HTTP 404', async () => {
    setSessionUser({ id: 'usr_owner_1' });
    const req = makeRequest('http://localhost:3000/api/cards/crd_not_found/review', {
      method: 'POST',
      body: { quality: 4 },
    });
    const res = await reviewRoute.POST(req, { params: { id: 'crd_not_found' } });
    assert.strictEqual(res.status, 404, `Expected HTTP 404 Not Found, got ${res.status}`);
  });

  await runCase('2.19 Card Review IDOR: Non-owner reviewing card rejected with HTTP 403', async () => {
    setSessionUser({ id: 'usr_attacker_2' }); // User 2 attempts to review User 1's card
    const req = makeRequest('http://localhost:3000/api/cards/crd_1/review', {
      method: 'POST',
      body: { quality: 5 },
    });
    const res = await reviewRoute.POST(req, { params: { id: 'crd_1' } });
    assert.strictEqual(res.status, 403, `Expected HTTP 403 Forbidden for non-owner, got ${res.status}`);

    const card = mockDb.cards.find((c) => c.id === 'crd_1');
    assert.strictEqual(card.repetitions, 0, 'Card repetitions must remain 0');
  });

  // ==========================================================================
  // Group 4: Quiz Question Sanitization (/api/quiz/generate)
  // ==========================================================================

  await runCase('2.20 Quiz Generation: Strips correctAnswer and isCorrect with 0% leakage in response', async () => {
    setSessionUser({ id: 'usr_owner_1' });
    const req = makeRequest('http://localhost:3000/api/quiz/generate', {
      method: 'POST',
      body: { deckId: 'dck_priv_1', type: 'multiple_choice', questionCount: 4 },
    });
    const res = await quizGenRoute.POST(req);
    assert.strictEqual(res.status, 200, `Expected HTTP 200 OK, got ${res.status}`);

    const rawJson = await res.text();

    // Adversarial leak detector: checks if correctAnswer or isCorrect keys exist in JSON
    const leaksCorrectAnswer = /"correctAnswer"\s*:/.test(rawJson);
    const leaksIsCorrect = /"isCorrect"\s*:/.test(rawJson);

    assert.equal(
      leaksCorrectAnswer,
      false,
      'Response payload must NOT contain "correctAnswer" key (assessment confidentiality)',
    );
    assert.equal(
      leaksIsCorrect,
      false,
      'Option choices must NOT contain "isCorrect" boolean flag (answer leakage protection)',
    );
  });

  // ==========================================================================
  // Group 5: Quiz Server-Side Grading & Anti-Replay (/api/quiz/submit)
  // ==========================================================================

  await runCase('2.21 Quiz Submit: Server-side grading validates against database, rejecting client-spoofed grades', async () => {
    setSessionUser({ id: 'usr_owner_1' });

    // Client maliciously attempts to submit a wrong answer while claiming isCorrect: true
    const req = makeRequest('http://localhost:3000/api/quiz/submit', {
      method: 'POST',
      body: {
        sessionId: 'qs_active_1',
        answers: [
          {
            cardId: 'crd_1',
            selectedAnswer: 'Completely Wrong Answer',
            userAnswer: 'Completely Wrong Answer',
            correctAnswer: 'Spoofed Correct Answer',
            isCorrect: true, // Forged flag
          },
        ],
      },
    });

    const res = await quizSubmitRoute.POST(req);
    assert.strictEqual(res.status, 200, `Expected HTTP 200 OK, got ${res.status}`);
    const data = await res.json();

    // Server must grade against crd_1 in DB (back: 'Từ bỏ'). 'Completely Wrong Answer' is incorrect!
    assert.strictEqual(
      data.correctCount,
      0,
      'Server must independently evaluate answer against DB and ignore client isCorrect flag',
    );
    assert.strictEqual(
      data.wrongCount,
      1,
      'Wrong answer must be recorded as 1 wrong answer',
    );
    assert.strictEqual(
      data.score,
      0,
      'Score must be 0% when answer does not match database record',
    );
  });

  await runCase('2.22 Quiz Submit Anti-Replay: Re-submitting on already completed session rejected with HTTP 400', async () => {
    setSessionUser({ id: 'usr_owner_1' });

    // qs_completed_1 is already completed (completedAt != null)
    const req = makeRequest('http://localhost:3000/api/quiz/submit', {
      method: 'POST',
      body: {
        sessionId: 'qs_completed_1',
        answers: [
          {
            cardId: 'crd_1',
            selectedAnswer: 'Từ bỏ',
            userAnswer: 'Từ bỏ',
          },
        ],
      },
    });

    const res = await quizSubmitRoute.POST(req);
    assert.strictEqual(
      res.status,
      400,
      `Expected HTTP 400 Bad Request for duplicate submission on completed session, got ${res.status}`,
    );

    const data = await res.json();
    assert.ok(
      (data.error || '').toLowerCase().includes('already completed') ||
        (data.error || '').toLowerCase().includes('completed'),
      'Response error message must state that quiz session is already completed',
    );
  });

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
