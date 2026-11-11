/**
 * tests/e2e/tier1-commands.test.mjs
 * Tier 1: Core Command Acceptance Checks
 *
 * Verifies non-negotiable project acceptance criteria:
 * 1. Next.js configuration integrity (no build error masking)
 * 2. TypeScript compilation (tsc --noEmit) with 0 errors
 * 3. ESLint static analysis (next lint --max-warnings 0) with 0 errors and 0 warnings
 * 4. Prisma schema validation (prisma validate) with 0 errors
 * 5. Next.js production build (next build) generating valid build artifacts
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { execCommand } from './helpers/exec.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = process.cwd();

export const name = 'Tier 1: Core Command Acceptance Checks';

/**
 * Execute all Tier 1 tests
 * @param {object} [options]
 * @param {boolean} [options.verbose=false]
 * @returns {Promise<Array<{ name: string, pass: boolean, error?: string, durationMs: number, details?: string }>>}
 */
export async function runTests({ verbose = false } = {}) {
  const results = [];

  // --------------------------------------------------------------------------
  // Test 1.1: Next.js Configuration Hardening
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = '1.1 Next.js config disables ignoreBuildErrors and ignoreDuringBuilds';
      const start = Date.now();
      try {
        const configPath = path.join(ROOT_DIR, 'next.config.mjs');
        assert.ok(fs.existsSync(configPath), 'next.config.mjs must exist at project root');
        const content = fs.readFileSync(configPath, 'utf8');

        // Check for active (uncommented) ignore flags
        const hasIgnoreBuildErrors = /ignoreBuildErrors\s*:\s*true/.test(content);
        const hasIgnoreDuringBuilds = /ignoreDuringBuilds\s*:\s*true/.test(content);

        assert.equal(
          hasIgnoreBuildErrors,
          false,
          'next.config.mjs must not set ignoreBuildErrors: true (masking TypeScript compile errors)',
        );
        assert.equal(
          hasIgnoreDuringBuilds,
          false,
          'next.config.mjs must not set ignoreDuringBuilds: true (masking ESLint errors)',
        );

        return {
          name: testName,
          pass: true,
          durationMs: Date.now() - start,
          details: 'next.config.mjs contains clean production config without error-masking flags',
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
  // Test 1.2: TypeScript Compilation Check (tsc --noEmit)
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = '1.2 TypeScript compilation check (tsc --noEmit) with 0 errors';
      const tscPath = path.join(ROOT_DIR, 'node_modules/typescript/bin/tsc');
      const res = await execCommand(tscPath, ['--noEmit'], {
        useNode: true,
        timeout: 60000,
      });

      const hasTsErrors = /error TS\d+:/.test(res.combinedOutput);
      const pass = res.status === 0 && !hasTsErrors;

      return {
        name: testName,
        pass,
        error: pass
          ? null
          : `tsc exited with status ${res.status}. Output:\n${res.combinedOutput.slice(0, 1500)}`,
        durationMs: res.durationMs,
        details: pass ? 'Full TypeScript codebase compiles cleanly with 0 type errors' : undefined,
      };
    })(),
  );

  // --------------------------------------------------------------------------
  // Test 1.3: ESLint Static Analysis Check (next lint --max-warnings 0)
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = '1.3 ESLint static analysis check (next lint --max-warnings 0)';
      const nextBin = path.join(ROOT_DIR, 'node_modules/next/dist/bin/next');
      const res = await execCommand(nextBin, ['lint', '--max-warnings', '0'], {
        useNode: true,
        timeout: 60000,
      });

      const pass = res.status === 0;

      return {
        name: testName,
        pass,
        error: pass
          ? null
          : `next lint failed with status ${res.status}. Output:\n${res.combinedOutput.slice(0, 1500)}`,
        durationMs: res.durationMs,
        details: pass ? 'ESLint passed with 0 errors and 0 warnings' : undefined,
      };
    })(),
  );

  // --------------------------------------------------------------------------
  // Test 1.4: Prisma Schema Validation (prisma validate)
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = '1.4 Prisma schema validation (prisma validate) with 0 errors';
      const prismaBin = path.join(ROOT_DIR, 'node_modules/prisma/build/index.js');
      const res = await execCommand(prismaBin, ['validate'], {
        useNode: true,
        timeout: 30000,
      });

      const isValid = res.status === 0 && res.combinedOutput.includes('is valid');

      return {
        name: testName,
        pass: isValid,
        error: isValid
          ? null
          : `prisma validate failed with status ${res.status}. Output:\n${res.combinedOutput.slice(0, 800)}`,
        durationMs: res.durationMs,
        details: isValid ? 'Prisma schema definition is valid and contains no syntax or relational errors' : undefined,
      };
    })(),
  );

  // --------------------------------------------------------------------------
  // Test 1.5: Next.js Production Build (next build)
  // --------------------------------------------------------------------------
  results.push(
    await (async () => {
      const testName = '1.5 Next.js production build check (next build)';
      // Clean stale .next trace/cache files to prevent Windows EPERM lock collisions across runs
      try {
        const nextDir = path.join(ROOT_DIR, '.next');
        if (fs.existsSync(nextDir)) {
          fs.rmSync(nextDir, { recursive: true, force: true, maxRetries: 3 });
        }
      } catch {
        // Ignore removal error
      }

      const nextBin = path.join(ROOT_DIR, 'node_modules/next/dist/bin/next');
      const res = await execCommand(nextBin, ['build'], {
        useNode: true,
        timeout: 180000,
      });

      const buildIdPath = path.join(ROOT_DIR, '.next/BUILD_ID');
      const hasBuildId =
        fs.existsSync(buildIdPath) && fs.readFileSync(buildIdPath, 'utf8').trim().length > 0;
      const pass = res.status === 0 && hasBuildId;

      return {
        name: testName,
        pass,
        error: pass
          ? null
          : `next build failed with status ${res.status} (hasBuildId: ${hasBuildId}). Output:\n${res.combinedOutput.slice(-1500)}`,
        durationMs: res.durationMs,
        details: pass ? `Production build succeeded, generated BUILD_ID: ${fs.readFileSync(buildIdPath, 'utf8').trim()}` : undefined,
      };
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
