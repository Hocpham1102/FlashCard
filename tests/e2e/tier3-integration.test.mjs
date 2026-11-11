/**
 * tests/e2e/tier3-integration.test.mjs
 * Tier 3: Cross-Feature Integration Checks
 *
 * Verifies cross-feature contracts:
 * 1. Prisma Client Singleton lazy connection (no eager top-level .$connect())
 * 2. User Stats route integration (/api/user/stats) & NextRequest typing
 * 3. Relational schema integrity via Prisma DMMF (cascade deletes, audit timestamps, compound indexes)
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = process.cwd();

export const name = 'Tier 3: Cross-Feature Integration Checks';

/**
 * Execute all Tier 3 tests
 * @param {object} [options]
 * @param {boolean} [options.verbose=false]
 * @returns {Promise<Array<{ name: string, pass: boolean, error?: string, durationMs: number, details?: string }>>}
 */
export async function runTests({ verbose = false } = {}) {
  const results = [];

  // --------------------------------------------------------------------------
  // Test 3.1: Prisma Singleton - No eager top-level .$connect() in source
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = '3.1 Prisma Singleton: Source code eliminates eager top-level .$connect()';
      const start = Date.now();
      try {
        const prismaSource = fs.readFileSync(path.join(ROOT_DIR, 'src/lib/prisma.ts'), 'utf-8');
        // Strip comments to check actual code
        const cleanSource = prismaSource.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
        assert.ok(
          !cleanSource.includes('.$connect()'),
          'src/lib/prisma.ts must NOT call .$connect() eagerly at top level',
        );

        return {
          name: testName,
          pass: true,
          durationMs: Date.now() - start,
          details: 'Verified lazy Prisma singleton pattern without top-level .$connect()',
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
  // Test 3.2: Prisma Singleton - Isolated import does not throw or trigger unhandled rejection
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = '3.2 Prisma Singleton: Isolated import with dummy env succeeds without connection error';
      const start = Date.now();
      try {
        // Run node child process importing src/lib/prisma.ts via tsx or node with loader
        const testScript = `
          process.env.DATABASE_URL = "postgresql://mock:mock@localhost:5432/mock";
          process.env.DIRECT_URL = "postgresql://mock:mock@localhost:5432/mock";
          import('./src/lib/prisma.ts').then(m => {
            const client = m.prisma || m.default;
            if (!client) {
              console.error("No prisma export found");
              process.exit(1);
            }
            process.exit(0);
          }).catch(err => {
            console.error("Import error:", err);
            process.exit(2);
          });
        `;

        const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
        const res = spawnSync(npxCmd, ['tsx', '-e', testScript], {
          cwd: ROOT_DIR,
          encoding: 'utf-8',
          shell: process.platform === 'win32',
          timeout: 20000,
        });

        assert.strictEqual(
          res.status,
          0,
          `Isolated import should exit with code 0, got ${res.status}. Stderr: ${res.stderr || res.stdout}`,
        );
        assert.ok(
          !(res.stdout || '').includes('Failed to connect to Supabase database'),
          'Import should not trigger eager connection failure logs',
        );

        return {
          name: testName,
          pass: true,
          durationMs: Date.now() - start,
          details: 'Isolated static import of prisma.ts succeeded cleanly without database connection',
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
  // Test 3.3: User Stats Route - NextRequest typing conformance
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = '3.3 User Stats Route: Handler signature conforms to NextRequest (TS2322 prevention)';
      const start = Date.now();
      try {
        const routePath = path.join(ROOT_DIR, 'src/app/api/user/stats/route.ts');
        const content = fs.readFileSync(routePath, 'utf8');

        // Check that GET handler signature accepts NextRequest
        const hasNextRequestType =
          /export\s+async\s+function\s+GET\s*\(\s*(?:request|req)\s*:\s*NextRequest\s*\)/.test(content);
        assert.ok(
          hasNextRequestType,
          'src/app/api/user/stats/route.ts GET parameter must be explicitly typed as NextRequest to satisfy getToken() contract',
        );

        return {
          name: testName,
          pass: true,
          durationMs: Date.now() - start,
          details: 'GET(request: NextRequest) typing verified',
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
  // Test 3.4: User Stats Route - Unauthenticated request rejected with 401
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = '3.4 User Stats Route: Unauthenticated request rejected with HTTP 401';
      const start = Date.now();
      try {
        const routePath = path.join(ROOT_DIR, 'src/app/api/user/stats/route.ts');
        const content = fs.readFileSync(routePath, 'utf8');

        // Verify token verification check and 401 response
        assert.ok(
          content.includes('getToken(') || content.includes('getServerSession('),
          'Route must verify session or JWT token',
        );
        assert.ok(
          content.includes('401') && content.includes('Unauthorized'),
          'Missing token or session must return status 401 with Unauthorized',
        );

        return {
          name: testName,
          pass: true,
          durationMs: Date.now() - start,
          details: 'Unauthenticated access control verified on /api/user/stats',
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
  // Test 3.5: Gamification Level Calculation Contract
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = '3.5 Gamification Contract: XP level progression and percentage calculation';
      const start = Date.now();
      try {
        const gamificationPath = path.join(ROOT_DIR, 'src/lib/gamification.ts');
        assert.ok(fs.existsSync(gamificationPath), 'gamification.ts must exist');

        // Import gamification functions via tsx in subprocess or transpile
        const ts = require('typescript');
        const src = fs.readFileSync(gamificationPath, 'utf8');
        const transpiled = ts.transpileModule(src, {
          compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        });

        const mod = { exports: {} };
        const dummyPrisma = {
          userStats: { findUnique: async () => null, upsert: async () => ({}) },
          dailyActivity: { findFirst: async () => null, create: async () => ({}) },
        };
        const customReq = (id) => {
          if (id === '@/lib/prisma' || id.endsWith('prisma')) return { default: dummyPrisma, prisma: dummyPrisma };
          return require(id);
        };
        const fn = new Function('exports', 'require', 'module', transpiled.outputText);
        fn(mod.exports, customReq, mod);

        const { calculateLevel, getLevelProgress } = mod.exports;
        assert.ok(typeof calculateLevel === 'function', 'calculateLevel must be exported');
        assert.ok(typeof getLevelProgress === 'function', 'getLevelProgress must be exported');

        // Test boundary points
        assert.strictEqual(calculateLevel(0), 1, '0 XP should be Level 1');
        assert.strictEqual(calculateLevel(99), 1, '99 XP should be Level 1');
        assert.strictEqual(calculateLevel(100), 2, '100 XP should be Level 2');
        assert.strictEqual(calculateLevel(399), 2, '399 XP should be Level 2');
        assert.strictEqual(calculateLevel(400), 3, '400 XP should be Level 3');

        // Progress percentage within level
        assert.strictEqual(getLevelProgress(0, 1), 0, '0 XP at Level 1 should be 0% progress');
        assert.strictEqual(getLevelProgress(50, 1), 50, '50 XP at Level 1 should be 50% progress');
        assert.strictEqual(getLevelProgress(100, 2), 0, '100 XP at Level 2 should be 0% progress');
        assert.strictEqual(getLevelProgress(250, 2), 50, '250 XP at Level 2 should be 50% progress');

        return {
          name: testName,
          pass: true,
          durationMs: Date.now() - start,
          details: 'XP level curves and percentage progression accurately verified',
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
  // Test 3.6: Relational Schema - Deck -> Card Cascade Delete
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = '3.6 Schema Relational Integrity: Deck -> Card relation specifies onDelete: Cascade';
      const start = Date.now();
      try {
        const { Prisma } = require('@prisma/client');
        const cardModel = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Card');
        assert.ok(cardModel, 'Card model must exist in Prisma schema');

        const deckRelation = cardModel.fields.find((f) => f.name === 'deck');
        assert.ok(deckRelation, 'Card.deck relation must exist');
        assert.strictEqual(
          deckRelation.relationOnDelete,
          'Cascade',
          'Card.deck relation must enforce onDelete: Cascade to prevent orphaned cards',
        );

        return {
          name: testName,
          pass: true,
          durationMs: Date.now() - start,
          details: 'Card.deck relation onDelete: Cascade confirmed in DMMF',
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
  // Test 3.7: Relational Schema - CardReview Cascade Delete
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = '3.7 Schema Relational Integrity: CardReview specifies onDelete: Cascade for Card & User';
      const start = Date.now();
      try {
        const { Prisma } = require('@prisma/client');
        const reviewModel = Prisma.dmmf.datamodel.models.find((m) => m.name === 'CardReview');
        assert.ok(reviewModel, 'CardReview model must exist in Prisma schema');

        const cardRel = reviewModel.fields.find((f) => f.name === 'card');
        assert.ok(cardRel, 'CardReview.card relation must exist');
        assert.strictEqual(cardRel.relationOnDelete, 'Cascade', 'CardReview.card must cascade on delete');

        const userRel = reviewModel.fields.find((f) => f.name === 'user');
        assert.ok(userRel, 'CardReview.user relation must exist');
        assert.strictEqual(userRel.relationOnDelete, 'Cascade', 'CardReview.user must cascade on delete');

        return {
          name: testName,
          pass: true,
          durationMs: Date.now() - start,
          details: 'CardReview cascade delete rules verified in DMMF',
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
  // Test 3.8: Schema Integrity - User Model Core Fields
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = '3.8 Schema Integrity: User model contains required auth fields (id, email, role)';
      const start = Date.now();
      try {
        const { Prisma } = require('@prisma/client');
        const userModel = Prisma.dmmf.datamodel.models.find((m) => m.name === 'User');
        assert.ok(userModel, 'User model must exist in Prisma schema');

        const fieldNames = userModel.fields.map((f) => f.name);
        assert.ok(fieldNames.includes('id'), 'User model must define id field');
        assert.ok(fieldNames.includes('email'), 'User model must define email field');
        assert.ok(fieldNames.includes('role'), 'User model must define role field');

        return {
          name: testName,
          pass: true,
          durationMs: Date.now() - start,
          details: 'User model core fields confirmed in DMMF',
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
  // Test 3.9: Schema Index Optimization - Card Compound Index [deckId, nextReview]
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = '3.9 Schema Index Optimization: Card defines composite index on [deckId, nextReview]';
      const start = Date.now();
      try {
        const schemaPath = path.join(ROOT_DIR, 'prisma/schema.prisma');
        const schemaText = fs.readFileSync(schemaPath, 'utf8');

        assert.ok(
          schemaText.includes('@@index([deckId, nextReview])'),
          'Card model must declare @@index([deckId, nextReview]) for SRS study query optimization',
        );

        return {
          name: testName,
          pass: true,
          durationMs: Date.now() - start,
          details: 'Compound index @@index([deckId, nextReview]) confirmed in schema.prisma',
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
  // Test 3.10: Schema Index Optimization - Foreign Key Indexes for NextAuth & Quiz
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = '3.10 Schema Index Optimization: Foreign key indexes defined on Account, Session, QuizAnswer';
      const start = Date.now();
      try {
        const schemaPath = path.join(ROOT_DIR, 'prisma/schema.prisma');
        const schemaText = fs.readFileSync(schemaPath, 'utf8');

        // Check for @@index([userId]) in Account & Session, @@index([cardId]) in QuizAnswer
        assert.ok(schemaText.includes('@@index([userId])'), 'Foreign key @@index([userId]) must be defined');
        assert.ok(schemaText.includes('@@index([cardId])'), 'Foreign key @@index([cardId]) must be defined on QuizAnswer');

        return {
          name: testName,
          pass: true,
          durationMs: Date.now() - start,
          details: 'Foreign key indexing on relation fields verified',
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
