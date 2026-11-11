/**
 * tests/e2e/m3-adversarial-probe.mjs
 * Comprehensive Empirical Adversarial Probe for Milestone 3
 *
 * Authored by: teamwork_challenger_m3_2 (EMPIRICAL CHALLENGER)
 * Target: All 7 Milestone 3 files under adversarial conditions.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT_DIR = process.cwd();

// Load MockDb and Route Loader from tier2-security.test.mjs architecture
const ts = require('typescript');

class AdversarialMockDb {
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
      {
        id: 'dck_small_1',
        title: 'Small Deck (<4 cards)',
        userId: 'usr_owner_1',
        isPublic: true,
        cardCount: 2,
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
        synonyms: '["give up", "relinquish"]',
        antonyms: 'maintain',
        collocations: 'abandon hope',
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
      {
        id: 'crd_orphan',
        deckId: 'dck_non_existent',
        front: 'Orphan Card',
        back: 'Thẻ mồ côi',
        phonetic: '',
        example: '',
        partOfSpeech: '',
        synonyms: '',
        antonyms: '',
        collocations: '',
        toeicPart: '',
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
        id: 'crd_s1',
        deckId: 'dck_small_1',
        front: 'Small 1',
        back: 'Nhỏ 1',
        phonetic: '',
        example: '',
        partOfSpeech: '',
        synonyms: '',
        antonyms: '',
        collocations: '',
        toeicPart: '',
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
        id: 'crd_s2',
        deckId: 'dck_small_1',
        front: 'Small 2',
        back: 'Nhỏ 2',
        phonetic: '',
        example: '',
        partOfSpeech: '',
        synonyms: '',
        antonyms: '',
        collocations: '',
        toeicPart: '',
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
        id: 'qs_active_meaning',
        userId: 'usr_owner_1',
        deckId: 'dck_priv_1',
        quizType: 'meaning_match',
        totalCards: 4,
        correctCount: 0,
        wrongCount: 0,
        score: 0,
        completedAt: null,
        createdAt: new Date(),
      },
      {
        id: 'qs_active_fill',
        userId: 'usr_owner_1',
        deckId: 'dck_priv_1',
        quizType: 'fill_blank',
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
        createMany: async ({ data }) => {
          for (const item of data) {
            const card = {
              id: `crd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              ...item,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            db.cards.push(card);
          }
          return { count: data.length };
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
        create: async ({ data }) => {
          const id = `dck_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const deck = {
            id,
            title: data.title,
            description: data.description || '',
            userId: data.userId,
            isPublic: data.isPublic ?? false,
            cardCount: data.cardCount || 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          db.decks.push(deck);
          return { ...deck };
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

let currentSessionUser = null;
function setSessionUser(user) {
  currentSessionUser = user ? { user: { id: user.id, name: user.name, email: user.email } } : null;
}

let mockGeminiBehavior = 'success'; // 'success' | 'quota' | 'invalid_key' | 'bad_json'

function loadRouteHandler(relativePath, mockDb) {
  const filePath = path.join(ROOT_DIR, relativePath);
  const tsSource = fs.readFileSync(filePath, 'utf8');
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
          redirect: (url, status = 307) => {
            return new Response(null, {
              status,
              headers: { Location: typeof url === 'string' ? url : url.toString() },
            });
          },
          next: () => new Response(null, { status: 200 }),
        },
      };
    }
    if (id === 'next-auth/jwt') {
      return {
        __esModule: true,
        getToken: async ({ req }) => {
          if (!currentSessionUser) return null;
          return {
            sub: currentSessionUser.user.id,
            id: currentSessionUser.user.id,
            name: currentSessionUser.user.name,
            email: currentSessionUser.user.email,
            role: currentSessionUser.user.role || 'USER',
          };
        },
      };
    }
    if (id === '@/lib/admin' || id.endsWith('/admin')) {
      return {
        __esModule: true,
        canAccessAdminArea: ({ role }) => role === 'ADMIN',
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
    if (id === '@google/generative-ai') {
      return {
        __esModule: true,
        GoogleGenerativeAI: class {
          constructor() {}
          getGenerativeModel() {
            return {
              generateContent: async () => {
                if (mockGeminiBehavior === 'quota') {
                  throw new Error('429 RESOURCE_EXHAUSTED: quota exceeded');
                }
                if (mockGeminiBehavior === 'invalid_key') {
                  throw new Error('API_KEY_INVALID: API key is not valid');
                }
                if (mockGeminiBehavior === 'bad_json') {
                  return { response: { text: () => 'Not valid JSON at all' } };
                }
                return {
                  response: {
                    text: () => JSON.stringify({
                      title: 'Test Deck',
                      description: 'Test Description',
                      cards: [
                        { front: 'Hello', back: 'Xin chào', phonetic: '/həˈloʊ/' },
                        { front: 'World', back: 'Thế giới', phonetic: '/wɜːrld/' },
                      ],
                    }),
                  },
                };
              },
            };
          }
        },
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
  const req = new Request(url, reqInit);
  // Add nextUrl for middleware compatibility
  req.nextUrl = new URL(url);
  return req;
}

async function runAdversarialProbes() {
  console.log('================================================================');
  console.log('  CHALLENGER 2: DEEP ADVERSARIAL VERIFICATION HARNESS');
  console.log('================================================================\n');

  const mockDb = new AdversarialMockDb();
  let passed = 0;
  let failed = 0;
  const probeResults = [];

  async function test(name, fn) {
    mockDb.reset();
    setSessionUser(null);
    mockGeminiBehavior = 'success';
    process.env.GEMINI_API_KEY = 'mock_key_123';
    try {
      await fn();
      passed++;
      console.log(`  ✓ PASS: ${name}`);
      probeResults.push({ name, pass: true });
    } catch (err) {
      failed++;
      console.log(`  ✗ FAIL: ${name}`);
      console.log(`    Error: ${err.message}`);
      probeResults.push({ name, pass: false, error: err.message });
    }
  }

  // Load modules
  const middlewareMod = loadRouteHandler('src/middleware.ts', mockDb);
  const cardRoute = loadRouteHandler('src/app/api/cards/[id]/route.ts', mockDb);
  const deckCardsRoute = loadRouteHandler('src/app/api/decks/[id]/cards/route.ts', mockDb);
  const reviewRoute = loadRouteHandler('src/app/api/cards/[id]/review/route.ts', mockDb);
  const quizGenRoute = loadRouteHandler('src/app/api/quiz/generate/route.ts', mockDb);
  const quizSubmitRoute = loadRouteHandler('src/app/api/quiz/submit/route.ts', mockDb);
  const aiRoute = loadRouteHandler('src/app/api/ai/generate/route.ts', mockDb);

  console.log('--- CATEGORY 1: Middleware Route Protection & Session Handling ---');

  await test('ADV 1.1: Middleware unauthenticated API cards request rejected with 401', async () => {
    setSessionUser(null);
    const req = makeRequest('http://localhost:3000/api/cards/crd_1');
    const res = await middlewareMod.middleware(req);
    assert.strictEqual(res.status, 401, `Expected status 401, got ${res.status}`);
  });

  await test('ADV 1.2: Middleware unauthenticated /profile request redirected to /login', async () => {
    setSessionUser(null);
    const req = makeRequest('http://localhost:3000/profile');
    const res = await middlewareMod.middleware(req);
    assert.strictEqual(res.status, 307, `Expected 307 redirect, got ${res.status}`);
    assert.ok(res.headers.get('Location').includes('/login'), 'Redirect target should be /login');
  });

  await test('ADV 1.3: Middleware authenticated user visiting /login redirected to /dashboard', async () => {
    setSessionUser({ id: 'usr_owner_1', name: 'User 1' });
    const req = makeRequest('http://localhost:3000/login');
    const res = await middlewareMod.middleware(req);
    assert.strictEqual(res.status, 307);
    assert.ok(res.headers.get('Location').includes('/dashboard'));
  });

  await test('ADV 1.4: Middleware non-admin accessing /admin redirected to /dashboard', async () => {
    setSessionUser({ id: 'usr_owner_1', name: 'User 1', role: 'USER' });
    const req = makeRequest('http://localhost:3000/admin/users');
    const res = await middlewareMod.middleware(req);
    assert.strictEqual(res.status, 307);
    assert.ok(res.headers.get('Location').includes('/dashboard'));
  });

  console.log('\n--- CATEGORY 2: Card IDOR & Mass Assignment Probes ---');

  await test('ADV 2.1: Mass assignment probe on Card PUT ignores deckId and SRS fields tampering', async () => {
    setSessionUser({ id: 'usr_owner_1' });
    const originalDeckId = 'dck_priv_1';
    const req = makeRequest('http://localhost:3000/api/cards/crd_1', {
      method: 'PUT',
      body: {
        front: 'Updated Word',
        deckId: 'dck_pub_1', // Attempted deck reassignment
        easeFactor: 99.9,     // Attempted SRS tamper
        interval: 10000,
        repetitions: 50,
        userId: 'usr_attacker_2',
      },
    });
    const res = await cardRoute.PUT(req, { params: { id: 'crd_1' } });
    assert.strictEqual(res.status, 200);

    const card = mockDb.cards.find((c) => c.id === 'crd_1');
    assert.strictEqual(card.front, 'Updated Word', 'Allowed field should be updated');
    assert.strictEqual(card.deckId, originalDeckId, 'deckId must NOT be reassigned via PUT');
    assert.strictEqual(card.easeFactor, 2.5, 'easeFactor must NOT be overwritten via card PUT');
    assert.strictEqual(card.interval, 0, 'interval must NOT be overwritten via card PUT');
    assert.strictEqual(card.repetitions, 0, 'repetitions must NOT be overwritten via card PUT');
  });

  await test('ADV 2.2: Orphaned card (card with no deck or missing deck record) fails closed with 403', async () => {
    setSessionUser({ id: 'usr_owner_1' });
    const req = makeRequest('http://localhost:3000/api/cards/crd_orphan', {
      method: 'PUT',
      body: { front: 'Malicious Change' },
    });
    const res = await cardRoute.PUT(req, { params: { id: 'crd_orphan' } });
    assert.strictEqual(res.status, 403, `Expected 403 Forbidden for orphaned card, got ${res.status}`);
  });

  await test('ADV 2.3: Session without user.id returns 401 Unauthorized on Card PUT and DELETE', async () => {
    currentSessionUser = { user: {} }; // Missing user.id
    const reqPut = makeRequest('http://localhost:3000/api/cards/crd_1', {
      method: 'PUT',
      body: { front: 'No User ID' },
    });
    const resPut = await cardRoute.PUT(reqPut, { params: { id: 'crd_1' } });
    assert.strictEqual(resPut.status, 401);

    const reqDel = makeRequest('http://localhost:3000/api/cards/crd_1', { method: 'DELETE' });
    const resDel = await cardRoute.DELETE(reqDel, { params: { id: 'crd_1' } });
    assert.strictEqual(resDel.status, 401);
  });

  console.log('\n--- CATEGORY 3: Deck Cards IDOR & Input Boundary Probes ---');

  await test('ADV 3.1: Attacker cannot insert cards into someone else\'s PUBLIC deck (enforces creator ownership)', async () => {
    setSessionUser({ id: 'usr_attacker_2' }); // Attacker trying to add cards to Owner's public deck
    const req = makeRequest('http://localhost:3000/api/decks/dck_pub_1/cards', {
      method: 'POST',
      body: { front: 'Spam Front', back: 'Spam Back' },
    });
    const res = await deckCardsRoute.POST(req, { params: { id: 'dck_pub_1' } });
    assert.strictEqual(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
  });

  await test('ADV 3.2: Whitespace-only string front and back rejected with 400 Bad Request', async () => {
    setSessionUser({ id: 'usr_owner_1' });
    const req = makeRequest('http://localhost:3000/api/decks/dck_priv_1/cards', {
      method: 'POST',
      body: { front: '    \t\n   ', back: 'Valid Back' },
    });
    const res = await deckCardsRoute.POST(req, { params: { id: 'dck_priv_1' } });
    assert.strictEqual(res.status, 400, `Expected 400 Bad Request, got ${res.status}`);

    const req2 = makeRequest('http://localhost:3000/api/decks/dck_priv_1/cards', {
      method: 'POST',
      body: { front: 'Valid Front', back: '   ' },
    });
    const res2 = await deckCardsRoute.POST(req2, { params: { id: 'dck_priv_1' } });
    assert.strictEqual(res2.status, 400, `Expected 400 Bad Request, got ${res2.status}`);
  });

  await test('ADV 3.3: Non-string front or back (objects, numbers) rejected with 400 Bad Request', async () => {
    setSessionUser({ id: 'usr_owner_1' });
    const req = makeRequest('http://localhost:3000/api/decks/dck_priv_1/cards', {
      method: 'POST',
      body: { front: 12345, back: { evil: 'payload' } },
    });
    const res = await deckCardsRoute.POST(req, { params: { id: 'dck_priv_1' } });
    assert.strictEqual(res.status, 400);
  });

  console.log('\n--- CATEGORY 4: Card Review Security & Boundary Probes ---');

  await test('ADV 4.1: Review quality negative or out of bounds (>5) rejected with 400 Bad Request', async () => {
    setSessionUser({ id: 'usr_owner_1' });
    const req1 = makeRequest('http://localhost:3000/api/cards/crd_1/review', {
      method: 'POST',
      body: { quality: -1 },
    });
    const res1 = await reviewRoute.POST(req1, { params: { id: 'crd_1' } });
    assert.strictEqual(res1.status, 400);

    const req2 = makeRequest('http://localhost:3000/api/cards/crd_1/review', {
      method: 'POST',
      body: { quality: 6 },
    });
    const res2 = await reviewRoute.POST(req2, { params: { id: 'crd_1' } });
    assert.strictEqual(res2.status, 400);
  });

  await test('ADV 4.2: Review quality non-number types (string "5", null, boolean) rejected with 400', async () => {
    setSessionUser({ id: 'usr_owner_1' });
    const req1 = makeRequest('http://localhost:3000/api/cards/crd_1/review', {
      method: 'POST',
      body: { quality: '5' },
    });
    const res1 = await reviewRoute.POST(req1, { params: { id: 'crd_1' } });
    assert.strictEqual(res1.status, 400);

    const req2 = makeRequest('http://localhost:3000/api/cards/crd_1/review', {
      method: 'POST',
      body: { quality: null },
    });
    const res2 = await reviewRoute.POST(req2, { params: { id: 'crd_1' } });
    assert.strictEqual(res2.status, 400);
  });

  console.log('\n--- CATEGORY 5: Quiz Generation Leakage Across All Quiz Types ---');

  const quizTypes = ['multiple_choice', 'meaning_match', 'fill_blank', 'listening'];

  for (const qType of quizTypes) {
    await test(`ADV 5.1 [${qType}]: Zero leakage of correctAnswer or isCorrect across questions & options`, async () => {
      setSessionUser({ id: 'usr_owner_1' });
      const req = makeRequest('http://localhost:3000/api/quiz/generate', {
        method: 'POST',
        body: { deckId: 'dck_priv_1', type: qType, questionCount: 4 },
      });
      const res = await quizGenRoute.POST(req);
      assert.strictEqual(res.status, 200, `Expected 200 OK for ${qType}, got ${res.status}`);

      const rawJson = await res.text();

      // Regex probes
      const leaksCorrectAnswer = /"correctAnswer"\s*:/i.test(rawJson);
      const leaksIsCorrect = /"isCorrect"\s*:/i.test(rawJson);
      assert.equal(leaksCorrectAnswer, false, `Must NOT contain correctAnswer key in ${qType}`);
      assert.equal(leaksIsCorrect, false, `Must NOT contain isCorrect key in ${qType}`);

      // Deep object inspection probe
      const parsed = JSON.parse(rawJson);
      assert.ok(Array.isArray(parsed.questions), 'Must return questions array');

      function deepInspect(obj, path = '') {
        if (!obj || typeof obj !== 'object') return;
        for (const [k, v] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${k}` : k;
          assert.notStrictEqual(
            k.toLowerCase(),
            'correctanswer',
            `Forbidden key "correctAnswer" found at ${currentPath}`,
          );
          assert.notStrictEqual(
            k.toLowerCase(),
            'iscorrect',
            `Forbidden key "isCorrect" found at ${currentPath}`,
          );
          if (typeof v === 'object') deepInspect(v, currentPath);
        }
      }
      deepInspect(parsed);
    });
  }

  await test('ADV 5.2: Quiz generation with invalid quiz type rejected with 400 Bad Request', async () => {
    setSessionUser({ id: 'usr_owner_1' });
    const req = makeRequest('http://localhost:3000/api/quiz/generate', {
      method: 'POST',
      body: { deckId: 'dck_priv_1', type: 'evil_unsupported_type' },
    });
    const res = await quizGenRoute.POST(req);
    assert.strictEqual(res.status, 400);
  });

  await test('ADV 5.3: Quiz generation with deck having <4 cards rejected with 400 Bad Request', async () => {
    setSessionUser({ id: 'usr_owner_1' });
    const req = makeRequest('http://localhost:3000/api/quiz/generate', {
      method: 'POST',
      body: { deckId: 'dck_small_1', type: 'multiple_choice' },
    });
    const res = await quizGenRoute.POST(req);
    assert.strictEqual(res.status, 400);
  });

  console.log('\n--- CATEGORY 6: Quiz Submit Server-Side Grading & Anti-Replay Probes ---');

  await test('ADV 6.1: Submitting to someone else\'s quiz session rejected with 404 Not Found', async () => {
    setSessionUser({ id: 'usr_attacker_2' }); // Attacker tries to submit to Owner's session
    const req = makeRequest('http://localhost:3000/api/quiz/submit', {
      method: 'POST',
      body: {
        sessionId: 'qs_active_1',
        answers: [{ cardId: 'crd_1', selectedAnswer: 'Từ bỏ' }],
      },
    });
    const res = await quizSubmitRoute.POST(req);
    assert.strictEqual(res.status, 404, `Expected 404 Not Found for session hijacking, got ${res.status}`);
  });

  await test('ADV 6.2: Anti-replay idempotent rejection: repeated submissions on finalized session return 400', async () => {
    setSessionUser({ id: 'usr_owner_1' });
    // First submission
    const req1 = makeRequest('http://localhost:3000/api/quiz/submit', {
      method: 'POST',
      body: {
        sessionId: 'qs_active_1',
        answers: [{ cardId: 'crd_1', selectedAnswer: 'Từ bỏ' }],
      },
    });
    const res1 = await quizSubmitRoute.POST(req1);
    assert.strictEqual(res1.status, 200, 'Initial submission must succeed');

    // Replay attempt 1
    const req2 = makeRequest('http://localhost:3000/api/quiz/submit', {
      method: 'POST',
      body: {
        sessionId: 'qs_active_1',
        answers: [{ cardId: 'crd_1', selectedAnswer: 'Từ bỏ' }],
      },
    });
    const res2 = await quizSubmitRoute.POST(req2);
    assert.strictEqual(res2.status, 400, 'Replay attempt 1 must be rejected with 400');

    // Replay attempt 2
    const req3 = makeRequest('http://localhost:3000/api/quiz/submit', {
      method: 'POST',
      body: {
        sessionId: 'qs_active_1',
        answers: [{ cardId: 'crd_1', selectedAnswer: 'Từ bỏ' }],
      },
    });
    const res3 = await quizSubmitRoute.POST(req3);
    assert.strictEqual(res3.status, 400, 'Replay attempt 2 must be rejected with 400');
  });

  await test('ADV 6.3: Meaning match grading validates against card.front (English word)', async () => {
    setSessionUser({ id: 'usr_owner_1' });
    const req = makeRequest('http://localhost:3000/api/quiz/submit', {
      method: 'POST',
      body: {
        sessionId: 'qs_active_meaning',
        answers: [
          { cardId: 'crd_1', selectedAnswer: 'Abandon' }, // Correct front
          { cardId: 'crd_2', selectedAnswer: 'Wrong Word' }, // Incorrect
        ],
      },
    });
    const res = await quizSubmitRoute.POST(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.correctCount, 1);
    assert.strictEqual(data.wrongCount, 1);
    assert.strictEqual(data.score, 50);
  });

  await test('ADV 6.4: Case-insensitive and trimmed answer evaluation produces robust grading', async () => {
    setSessionUser({ id: 'usr_owner_1' });
    const req = makeRequest('http://localhost:3000/api/quiz/submit', {
      method: 'POST',
      body: {
        sessionId: 'qs_active_1',
        answers: [
          { cardId: 'crd_1', selectedAnswer: '   TỪ BỎ   ' }, // Uppercase with leading/trailing spaces
        ],
      },
    });
    const res = await quizSubmitRoute.POST(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.correctCount, 1, 'Whitespace and case variations must be handled gracefully');
    assert.strictEqual(data.score, 100);
  });

  console.log('\n--- CATEGORY 7: AI Generation Input Validation & Error Handling ---');

  await test('ADV 7.1: Missing or blank topic rejected with 400 Bad Request', async () => {
    setSessionUser({ id: 'usr_owner_1' });
    const req = makeRequest('http://localhost:3000/api/ai/generate', {
      method: 'POST',
      body: { topic: '    ' },
    });
    const res = await aiRoute.POST(req);
    assert.strictEqual(res.status, 400);
  });

  await test('ADV 7.2: Unauthenticated AI generation rejected with 401 Unauthorized', async () => {
    setSessionUser(null);
    const req = makeRequest('http://localhost:3000/api/ai/generate', {
      method: 'POST',
      body: { topic: 'Business Vocabulary' },
    });
    const res = await aiRoute.POST(req);
    assert.strictEqual(res.status, 401);
  });

  await test('ADV 7.3: AI Rate limit / Quota exhaustion error mapped to HTTP 429', async () => {
    setSessionUser({ id: 'usr_owner_1' });
    mockGeminiBehavior = 'quota'; // Triggers RESOURCE_EXHAUSTED / 429
    const req = makeRequest('http://localhost:3000/api/ai/generate', {
      method: 'POST',
      body: { topic: 'Business Vocabulary' },
    });
    const res = await aiRoute.POST(req);
    assert.strictEqual(res.status, 429, `Expected HTTP 429 for quota exhaustion, got ${res.status}`);
  });

  await test('ADV 7.4: Missing GEMINI_API_KEY returns HTTP 500 with configuration notice', async () => {
    setSessionUser({ id: 'usr_owner_1' });
    delete process.env.GEMINI_API_KEY;
    const req = makeRequest('http://localhost:3000/api/ai/generate', {
      method: 'POST',
      body: { topic: 'Business Vocabulary' },
    });
    const res = await aiRoute.POST(req);
    assert.strictEqual(res.status, 500);
    const data = await res.json();
    assert.ok(data.message.includes('GEMINI_API_KEY'), 'Should advise setting GEMINI_API_KEY');
  });

  console.log('\n================================================================');
  console.log(`  RESULTS: ${passed} Passed, ${failed} Failed out of ${passed + failed} Tests`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAdversarialProbes().catch((err) => {
  console.error('Fatal probe runner error:', err);
  process.exit(1);
});
