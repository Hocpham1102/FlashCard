# Handoff Report: E2E Tier 1 Command Acceptance Specification

**Module**: Tier 1 Core Command Acceptance Checks  
**State Folder**: `e:\GitHub\FlashCard\.agents\teamwork\spec_miner_e2e_tier1\`  
**Target Test Files**: `tests/e2e/runner.mjs`, `tests/e2e/tier1-commands.test.mjs`  
**Date**: 2026-11-10T13:28:00Z  

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | TypeScript | Static Type Checking (`tsc --noEmit`) | Compiles whole-project TypeScript AST without writing `.js` files to disk. | `node node_modules/typescript/bin/tsc --noEmit` or `npx tsc --noEmit` | Exit code 0, empty stdout/stderr | Exits with code 1 (invalid flags) or 2 (type errors); errors printed to `stdout` (`<file>(<line>,<col>): error TS<code>: <msg>`), `stderr` is empty | CLI probing & Node spawn testing |
| 2 | ESLint | Code Quality Analysis (`next lint` / `eslint`) | Runs ESLint rules (`next/core-web-vitals`, `next/typescript`) across project files. | `node node_modules/next/dist/bin/next lint` or `npm run lint` or `node node_modules/eslint/bin/eslint.js "src/**/*.{ts,tsx,js,jsx}"` | Exit code 0 on no errors. With `--max-warnings 0`, requires 0 warnings | Exits with code 1. When run via `next lint`, errors and warnings print to `stderr` (stdout empty). When run via direct `eslint`, output prints to `stdout` | CLI probing & Node spawn testing |
| 3 | Prisma | Schema AST Validation (`prisma validate`) | Validates Prisma models, relations, field attributes, and datasource configuration in `prisma/schema.prisma`. | `node node_modules/prisma/build/index.js validate` or `npx prisma validate`, with `DATABASE_URL` and `DIRECT_URL` | Exit code 0, stdout: `The schema at prisma\schema.prisma is valid 🚀` | Exits with code 1 if syntax invalid or if `DIRECT_URL` / `DATABASE_URL` missing (`Error code: P1012`); error printed to `stderr` | CLI probing & Node spawn testing |
| 4 | Next.js | Production Build (`next build` / `npm run build`) | Bundles client & server bundles, generates route manifests, collects page data, prerenders static pages into `.next/`. | `node node_modules/next/dist/bin/next build` or `npm run build`, with `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET` | Exit code 0, generated `.next/` directory, stdout contains compilation & route summary | Exits with code 1 if compilation fails. Non-fatal runtime database connection errors log to `stderr` during page collection if dummy credentials used | Background task CLI probing |
| 5 | Test Infra | Multi-Tier Test Runner (`runner.mjs`) | Unified CLI entrypoint discovering and executing test tiers with CLI flags, filtering, timeouts, and pass/fail reporting. | `node tests/e2e/runner.mjs [--tier=1] [--verbose] [--bail]` | Exit code 0 on full pass, non-zero on failure. Formatted terminal summary with duration & assertion counts | Catches command timeouts, child crashes, and assertion rejections, printing detailed diagnostic diffs | SCOPE.md & Architecture design |
| 6 | Test Infra | Cross-Platform Safe Command Execution (`execCommand`) | Spawns processes safely on Windows and POSIX, handling Windows `.cmd` execution, process tree timeouts, and env defaults. | Options: `{ command, args, cwd, env, timeout, shell, useNode }` | Object `{ status, signal, stdout, stderr, durationMs, timedOut }` | Catches `ENOENT`, `EINVAL`, and kills whole process tree (`taskkill /t /f` on Win32) on timeout | Windows Node 20 CLI probing |
| 7 | Next.js Config | Build Error Masking Detection | Verifies whether `next.config.mjs` disables `ignoreBuildErrors` and `ignoreDuringBuilds`. | File read of `next.config.mjs` | Boolean confirmation that both flags are false/removed | Fails Tier 1 if flags are `true`, preventing false positive build passes | Source audit of `next.config.mjs` |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Node.js `spawn` on Windows | `spawn('npx', ['tsc', '--version'])` without `shell: true` | Throws `Error: spawn npx ENOENT` because `npx` is `npx.cmd` on Windows. |
| 2 | Node.js `spawn` on Windows (Node 20+) | `spawn('npx.cmd', ['tsc', '--version'])` without `shell: true` | Throws `Error: spawnSync npx.cmd EINVAL` due to Node.js CVE-2024-27980 security protection blocking `.cmd` invocation without `shell: true`. |
| 3 | Cross-Platform Node Binary Direct Launch | `spawn(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'])` | Executes reliably without `shell: true` on both Windows and POSIX; avoids shell escaping and cleanly terminates without orphans. |
| 4 | Stream Output Divergence (TypeScript) | `tsc --noEmit` with type error (e.g. TS2352) | Exit code is `2` (or `1` under npx); errors are sent entirely to `stdout`. `stderr` is completely empty `""`. Checking `stderr` alone would miss all compile errors! |
| 5 | Stream Output Divergence (`next lint`) | `next lint` with lint errors | Exit code is `1`; lint error table is sent to `stderr`. `stdout` is empty. |
| 6 | Stream Output Divergence (direct `eslint`) | `eslint "src/**/*.{ts,tsx,js,jsx}"` with lint errors | Exit code is `1`; lint error table is sent to `stdout`. `stderr` is empty. |
| 7 | Prisma Schema `DIRECT_URL` Requirement | `prisma validate` with missing or empty `DIRECT_URL` | Exit code is `1`, fails with `Error code: P1012: error: Environment variable not found: DIRECT_URL.` even if `DATABASE_URL` is set. |
| 8 | Prisma Schema Connection Requirement | `prisma validate` with dummy connection URL `postgresql://mock:mock@localhost:5432/db` | Exit code is `0`. Schema AST passes without requiring a live PostgreSQL connection. |
| 9 | ESLint Warning Masking | `next lint` without `--max-warnings 0` when only warnings exist | Exit code is `0`. Warnings do not trigger a non-zero exit code unless `--max-warnings 0` is passed or output is parsed for `\d+ warnings`. |
| 10 | Next.js Static Page Data Collection | `next build` without `DATABASE_URL` in environment | `prisma.ts` eager `$connect()` logs 15 `PrismaClientInitializationError: P1012` errors to `stderr` during static page generation. Dummy database URL suppresses P1012. |
| 11 | Windows Process Tree Orphan on Timeout | Killing a `shell: true` spawned process with `child.kill('SIGTERM')` | Only kills the outer `cmd.exe` process, leaving `node.exe` running in the background. Requires `taskkill /pid <pid> /f /t` on Windows. |

---

## 5-Component Handoff Report

### 1. Observation
1. **Source Configuration Audit**:
   - `package.json` line 6-10:
     ```json
     "scripts": {
       "dev": "next dev",
       "build": "next build",
       "start": "next start -p $PORT",
       "lint": "next lint",
       "postinstall": "npx prisma generate"
     }
     ```
     `typecheck` script is currently absent from `package.json` (tracked in Milestone M1 Feature 3).
   - `tsconfig.json` lines 1-26: `compilerOptions.strict: true`, `noEmit: true`, `skipLibCheck: true`, `moduleResolution: "bundler"`. Target includes `next-env.d.ts`, `**/*.ts`, `**/*.tsx`.
   - `.eslintrc.json`:
     ```json
     { "extends": ["next/core-web-vitals", "next/typescript"] }
     ```
   - `next.config.mjs` lines 3-12:
     ```javascript
     eslint: { ignoreDuringBuilds: true },
     typescript: { ignoreBuildErrors: true }
     ```
     These flags currently bypass TypeScript and ESLint failures during `next build` (scheduled for removal in M1 Feature 4).
   - `prisma/schema.prisma` lines 5-9:
     ```prisma
     datasource db {
       provider  = "postgresql"
       url       = env("DATABASE_URL")
       directUrl = env("DIRECT_URL")
     }
     ```
     Requires both `DATABASE_URL` and `DIRECT_URL` environment variables.

2. **Live Execution Probing & Verbatim Behaviors**:
   - **TypeScript (`node_modules/typescript/bin/tsc --noEmit`)**:
     - Status: `2` (or `1` via `npx`).
     - Stdout: `src/app/api/decks/import/route.ts(118,10): error TS2352: Conversion of type 'ParsedCard' to type 'Record<string, string | undefined>' may be a mistake...`
     - Stderr: `""` (empty string).
     - Execution time: ~2.8s.
   - **ESLint (`node_modules/next/dist/bin/next lint`)**:
     - Status: `1`.
     - Stdout: `""` (empty string).
     - Stderr: Verbatim list of errors and warnings across `studyAudio.ts`, `UserAvatar.tsx`, and `study/page.tsx`.
     - Execution time: ~4.1s.
   - **Prisma Validate (`node_modules/prisma/build/index.js validate`)**:
     - Without env: Status `1`, stderr: `Error code: P1012: error: Environment variable not found: DIRECT_URL.`
     - With `DATABASE_URL="postgresql://user:pass@localhost:5432/flashcard"` and `DIRECT_URL="postgresql://user:pass@localhost:5432/flashcard"`: Status `0`, stdout: `Prisma schema loaded from prisma\schema.prisma\nThe schema at prisma\schema.prisma is valid 🚀`.
     - Execution time: ~0.9s.
   - **Next.js Build (`node_modules/next/dist/bin/next build`)**:
     - With dummy env (`DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`): Status `0`, generated 21 static pages into `.next/`, runtime ~28s.
   - **Windows Node 20 Spawn Probing**:
     - `spawnSync('npx', ['tsc', '--version'])` -> `error: ENOENT`.
     - `spawnSync('npx.cmd', ['tsc', '--version'])` -> `error: EINVAL` (CVE-2024-27980 guard).
     - `spawnSync('npx', ['tsc', '--version'], { shell: true })` -> Status `0`, stdout: `Version 5.9.3`.
     - `spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--version'])` -> Status `0`, stdout: `Version 5.9.3`.

---

### 2. Logic Chain
1. **Acceptance Criteria Mandate**:
   `ORIGINAL_REQUEST.md` stipulates four baseline non-negotiable checks:
   - TypeScript compilation check (`npx tsc --noEmit`) with 0 errors.
   - Linting check (`npm run lint`) with 0 errors.
   - Prisma schema validation (`npx prisma validate`) with 0 errors.
   - Production build check (`npm run build`) completed successfully.
2. **Execution Reliability on Windows**:
   - The developer environment is Windows running Node.js v20.19.0.
   - In Node 20+, calling `.cmd` files without `shell: true` triggers an immediate `EINVAL` exception.
   - Spawning via `shell: true` handles `npx` and `npm`, but if a process times out, `child.kill()` fails to terminate grandchild processes (`node.exe`).
   - By structuring the runner to support both (a) direct Node.js execution via `process.execPath` using local `node_modules` bin paths, and (b) shell execution with `taskkill /t /f` cleanup on Windows, we guarantee 100% test reliability on Windows without external dependencies.
3. **Stream Handling**:
   - `tsc` writes to `stdout`; `next lint` writes to `stderr`; `prisma validate` splits between `stdout` (success) and `stderr` (error).
   - Therefore, the test runner assertions must inspect combined stdout and stderr to prevent false negatives.
4. **Environment Isolation**:
   - `prisma validate` and `next build` require `DATABASE_URL` and `DIRECT_URL`.
   - The test runner must provide safe fallback dummy PostgreSQL URLs (e.g., `postgresql://postgres:postgres@localhost:5432/flashcard?schema=public`) in the child process `env` so that test execution is reproducible even if `.env` is unconfigured.
5. **Build Integrity Verification**:
   - Because `next.config.mjs` currently has `ignoreBuildErrors: true` and `ignoreDuringBuilds: true`, a naive `next build` would report exit code 0 even if TypeScript or ESLint were broken.
   - Tier 1 must explicitly assert that `next.config.mjs` does NOT enable `ignoreBuildErrors` or `ignoreDuringBuilds` in its production configuration.

---

### 3. Caveats
1. **Parallel Execution by Milestone M1/M2 Agents**:
   - During mining, Milestone M1 agent is actively modifying TypeScript and ESLint files (`src/app/api/decks/import/route.ts`, `src/lib/studyAudio.ts`).
   - The test specifications designed here test against the authoritative contract (0 errors, 0 warnings, exit code 0), which will pass once M1 and M2 conclude their remediation.
2. **Next.js Cache Invalidation**:
   - Running `next build` updates `.next/cache`. If running build tests repeatedly, clean builds can optionally wipe `.next` or test the existing build output.
3. **Database Connection During Build**:
   - When M2 refactors `src/lib/prisma.ts` to be lazy (Milestone M2 Feature 6), `next build` will no longer log `❌ Failed to connect to Supabase database` during page data collection. The test runner should tolerate non-fatal stderr logs as long as process exit code is 0 and build manifests exist.

---

### 4. Conclusion
Tier 1 Command Acceptance suite is fully specified and ready for implementation. The test architecture consists of:
1. `tests/e2e/runner.mjs`: Central CLI test runner supporting `--tier=1`, timeout management, ANSI summary, and exit code propagation.
2. `tests/e2e/helpers/exec.mjs`: Cross-platform command execution wrapper with Windows shell & process tree handling.
3. `tests/e2e/tier1-commands.test.mjs`: Test suite covering:
   - Test 1.1: `npx tsc --noEmit` & direct `tsc` compilation with 0 errors.
   - Test 1.2: `npm run lint` & `next lint --max-warnings 0` with 0 errors and 0 warnings.
   - Test 1.3: `npx prisma validate` with environment fallback asserting valid schema.
   - Test 1.4: `next.config.mjs` build flag integrity (no `ignoreBuildErrors` or `ignoreDuringBuilds`).
   - Test 1.5: `npm run build` production build generating valid `.next/BUILD_ID` and route manifests.

---

### 5. Verification Method

To independently verify all findings and test behaviors, run the following commands:

1. **Verify TypeScript CLI behavior**:
   ```powershell
   node -e "const { spawnSync } = require('child_process'); const res = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], { encoding: 'utf8' }); console.log('Status:', res.status, 'Stdout has errors:', res.stdout.includes('error TS'));"
   ```

2. **Verify ESLint CLI behavior & stderr redirection**:
   ```powershell
   node -e "const { spawnSync } = require('child_process'); const res = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'lint'], { encoding: 'utf8' }); console.log('Status:', res.status, 'Stderr has errors:', res.stderr.includes('Error:'));"
   ```

3. **Verify Prisma Validate with dummy connection string**:
   ```powershell
   node -e "const { spawnSync } = require('child_process'); const res = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'validate'], { encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgresql://mock:mock@localhost:5432/mock', DIRECT_URL: 'postgresql://mock:mock@localhost:5432/mock' } }); console.log('Status:', res.status, 'Output:', res.stdout.trim());"
   ```

4. **Verify Windows CVE-2024-27980 EINVAL behavior**:
   ```powershell
   node -e "const { spawnSync } = require('child_process'); const res = spawnSync('npx.cmd', ['--version'], { encoding: 'utf8' }); console.log('Error code:', res.error?.code);"
   # Outputs: Error code: EINVAL
   ```

---

## Detailed Test Runner Architecture Specification

### File: `tests/e2e/helpers/exec.mjs`
```javascript
import { spawn } from 'node:child_process';
import path from 'node:path';

/**
 * Execute a command cross-platform with robust output capture and timeout handling.
 */
export function execCommand(command, args = [], options = {}) {
  const {
    cwd = process.cwd(),
    env = {},
    timeout = 60000,
    shell = false,
    useNode = false,
  } = options;

  return new Promise((resolve) => {
    const mergedEnv = {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/flashcard?schema=public',
      DIRECT_URL: process.env.DIRECT_URL || 'postgresql://postgres:postgres@localhost:5432/flashcard?schema=public',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'flashcard-test-secret-at-least-32-chars-long-1234',
      ...env,
    };

    let executable = command;
    let finalArgs = [...args];
    let effectiveShell = shell;

    if (useNode) {
      executable = process.execPath;
      finalArgs = [command, ...args];
      effectiveShell = false;
    } else if (process.platform === 'win32' && !shell) {
      if (command === 'npm' || command === 'npx') {
        effectiveShell = true;
      }
    }

    const startTime = Date.now();
    let timedOut = false;
    let child;

    try {
      child = spawn(executable, finalArgs, {
        cwd,
        env: mergedEnv,
        shell: effectiveShell,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      return resolve({
        status: 1,
        stdout: '',
        stderr: err.message,
        durationMs: Date.now() - startTime,
        timedOut: false,
        error: err,
      });
    }

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform === 'win32') {
        try {
          const { spawnSync } = require('child_process');
          spawnSync('taskkill', ['/pid', child.pid.toString(), '/f', '/t']);
        } catch {
          child.kill('SIGKILL');
        }
      } else {
        child.kill('SIGKILL');
      }
    }, timeout);

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({
        status: code ?? (signal ? 1 : 0),
        signal,
        stdout,
        stderr,
        combinedOutput: (stdout || '') + '\n' + (stderr || ''),
        durationMs: Date.now() - startTime,
        timedOut,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        status: 1,
        stdout,
        stderr: stderr + '\n' + err.message,
        combinedOutput: stdout + '\n' + stderr + '\n' + err.message,
        durationMs: Date.now() - startTime,
        timedOut,
        error: err,
      });
    });
  });
}
```

### File: `tests/e2e/tier1-commands.test.mjs` Specification
```javascript
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execCommand } from './helpers/exec.mjs';

export const name = 'Tier 1: Core Command Acceptance Checks';

export async function runTests({ verbose = false } = {}) {
  const results = [];
  const root = process.cwd();

  // Test 1: Next.js Configuration Hardening (No build error masking)
  results.push(await (async () => {
    const testName = '1.1 Next.js config disables ignoreBuildErrors and ignoreDuringBuilds';
    const start = Date.now();
    try {
      const configPath = path.join(root, 'next.config.mjs');
      const content = fs.readFileSync(configPath, 'utf8');
      const hasIgnoreBuildErrors = /ignoreBuildErrors\s*:\s*true/.test(content);
      const hasIgnoreDuringBuilds = /ignoreDuringBuilds\s*:\s*true/.test(content);

      assert.equal(hasIgnoreBuildErrors, false, 'next.config.mjs must not set ignoreBuildErrors: true');
      assert.equal(hasIgnoreDuringBuilds, false, 'next.config.mjs must not set ignoreDuringBuilds: true');

      return { name: testName, pass: true, durationMs: Date.now() - start };
    } catch (err) {
      return { name: testName, pass: false, error: err.message, durationMs: Date.now() - start };
    }
  })());

  // Test 2: TypeScript Compilation Check (tsc --noEmit)
  results.push(await (async () => {
    const testName = '1.2 TypeScript compilation check (tsc --noEmit) with 0 errors';
    const res = await execCommand(path.join(root, 'node_modules/typescript/bin/tsc'), ['--noEmit'], {
      useNode: true,
      timeout: 60000,
    });
    const hasTsErrors = /error TS\d+:/.test(res.combinedOutput);
    const pass = res.status === 0 && !hasTsErrors;
    return {
      name: testName,
      pass,
      error: pass ? null : `tsc exited with code ${res.status}. Output:\n${res.combinedOutput.slice(0, 1000)}`,
      durationMs: res.durationMs,
    };
  })());

  // Test 3: ESLint Static Analysis (next lint)
  results.push(await (async () => {
    const testName = '1.3 ESLint static analysis check (next lint) with 0 errors and 0 warnings';
    const res = await execCommand(path.join(root, 'node_modules/next/dist/bin/next'), ['lint', '--max-warnings', '0'], {
      useNode: true,
      timeout: 60000,
    });
    const pass = res.status === 0;
    return {
      name: testName,
      pass,
      error: pass ? null : `lint failed with code ${res.status}. Output:\n${res.combinedOutput.slice(0, 1000)}`,
      durationMs: res.durationMs,
    };
  })());

  // Test 4: Prisma Schema Validation (prisma validate)
  results.push(await (async () => {
    const testName = '1.4 Prisma schema validation (prisma validate) with 0 errors';
    const res = await execCommand(path.join(root, 'node_modules/prisma/build/index.js'), ['validate'], {
      useNode: true,
      timeout: 30000,
    });
    const isValid = res.status === 0 && res.combinedOutput.includes('is valid');
    return {
      name: testName,
      pass: isValid,
      error: isValid ? null : `prisma validate failed with code ${res.status}. Output:\n${res.combinedOutput.slice(0, 500)}`,
      durationMs: res.durationMs,
    };
  })());

  // Test 5: Next.js Production Build (next build)
  results.push(await (async () => {
    const testName = '1.5 Next.js production build check (next build)';
    const res = await execCommand(path.join(root, 'node_modules/next/dist/bin/next'), ['build'], {
      useNode: true,
      timeout: 180000,
    });
    const buildIdPath = path.join(root, '.next/BUILD_ID');
    const hasBuildId = fs.existsSync(buildIdPath) && fs.readFileSync(buildIdPath, 'utf8').trim().length > 0;
    const pass = res.status === 0 && hasBuildId;
    return {
      name: testName,
      pass,
      error: pass ? null : `next build failed with code ${res.status} (hasBuildId: ${hasBuildId}). Output:\n${res.combinedOutput.slice(-1000)}`,
      durationMs: res.durationMs,
    };
  })());

  return results;
}
```

### File: `tests/e2e/runner.mjs` Specification
```javascript
#!/usr/bin/env node
import { parseArgs } from 'node:util';

const options = {
  tier: { type: 'string', short: 't' },
  verbose: { type: 'boolean', short: 'v', default: false },
  bail: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
};

const { values: flags } = parseArgs({ options, allowPositionals: true });

if (flags.help) {
  console.log(`
FlashCard E2E Test Runner
Usage: node tests/e2e/runner.mjs [options]

Options:
  -t, --tier <tiers>   Run specific tier(s), e.g. --tier=1 or --tier=1,2 (default: all)
  -v, --verbose        Display verbose output and command logs
  --bail               Halt on first test failure
  -h, --help           Show help
`);
  process.exit(0);
}

const requestedTiers = flags.tier
  ? flags.tier.split(',').map(t => parseInt(t.trim(), 10)).filter(Boolean)
  : [1, 2, 3, 4];

console.log('='.repeat(70));
console.log('FLASHCARD E2E ACCEPTANCE TEST SUITE');
console.log(`Executing Tier(s): ${requestedTiers.join(', ')}`);
console.log('='.repeat(70));

let totalPassed = 0;
let totalFailed = 0;
const allResults = [];

for (const tierNum of requestedTiers) {
  let tierModule;
  try {
    tierModule = await import(`./tier${tierNum}-commands.test.mjs`);
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      console.log(`\n[Tier ${tierNum}] (Test file not found - skipping)`);
      continue;
    }
    console.error(`Error loading tier ${tierNum}:`, err);
    process.exit(1);
  }

  console.log(`\n--- ${tierModule.name || `Tier ${tierNum}`} ---`);
  const tierResults = await tierModule.runTests({ verbose: flags.verbose });

  for (const r of tierResults) {
    allResults.push(r);
    if (r.pass) {
      totalPassed++;
      console.log(`  ✓ PASS: ${r.name} (${r.durationMs}ms)`);
    } else {
      totalFailed++;
      console.log(`  ✗ FAIL: ${r.name} (${r.durationMs}ms)`);
      if (r.error) {
        console.log(`    Reason: ${r.error.split('\n').join('\n    ')}`);
      }
      if (flags.bail) {
        console.log('\n[Bail enabled: stopping after first failure]');
        break;
      }
    }
  }

  if (flags.bail && totalFailed > 0) break;
}

console.log('\n' + '='.repeat(70));
console.log(`SUMMARY: ${totalPassed} passed, ${totalFailed} failed (Total: ${totalPassed + totalFailed})`);
console.log('='.repeat(70));

process.exit(totalFailed > 0 ? 1 : 0);
```
