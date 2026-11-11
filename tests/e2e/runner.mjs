#!/usr/bin/env node
/**
 * FlashCard Acceptance & E2E Test Runner
 * Central CLI entrypoint for running test suites across Tiers 1-4.
 *
 * Usage:
 *   node tests/e2e/runner.mjs [options]
 *
 * Options:
 *   -t, --tier <tiers>   Run specific tier(s), e.g. --tier=1, --tier=1,2 (default: 1,2,3,4)
 *   -v, --verbose        Display detailed command outputs and logs
 *   --bail               Abort suite immediately upon first test failure
 *   -h, --help           Show help information
 */

import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color escape codes
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const cliOptions = {
  tier: { type: 'string', short: 't' },
  verbose: { type: 'boolean', short: 'v', default: false },
  bail: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
};

let flags;
try {
  const parsed = parseArgs({ options: cliOptions, allowPositionals: true });
  flags = parsed.values;
} catch (err) {
  console.error(`${ANSI.red}CLI Error:${ANSI.reset} ${err.message}`);
  process.exit(1);
}

if (flags.help) {
  console.log(`
${ANSI.bold}${ANSI.cyan}FlashCard Acceptance & E2E Test Runner${ANSI.reset}

${ANSI.bold}Usage:${ANSI.reset}
  node tests/e2e/runner.mjs [options]

${ANSI.bold}Options:${ANSI.reset}
  -t, --tier <tiers>   Run specific tier(s), e.g. --tier=1, --tier=2,3 (default: 1,2,3,4)
  -v, --verbose        Display detailed command outputs and diagnostic logs
  --bail               Halt test run immediately upon first failure
  -h, --help           Show this help message

${ANSI.bold}Tiers:${ANSI.reset}
  Tier 1: Core Command Acceptance (tsc, lint, prisma validate, build flags, next build)
  Tier 2: Boundary & Security Vulnerability Checks (IDOR, quiz leakage, anti-replay)
  Tier 3: Cross-Feature Integration Checks (Prisma lazy singleton, user stats, DMMF relations)
  Tier 4: SM-2 Spaced Repetition Workflow Checks (due cards query, interval progression)
`);
  process.exit(0);
}

const requestedTiers = flags.tier
  ? flags.tier
      .split(',')
      .map((t) => parseInt(t.trim(), 10))
      .filter((t) => !isNaN(t) && t >= 1 && t <= 4)
  : [1, 2, 3, 4];

if (requestedTiers.length === 0) {
  console.error(`${ANSI.red}Error:${ANSI.reset} No valid tiers specified. Use --tier=1, 2, 3, or 4.`);
  process.exit(1);
}

console.log(`${ANSI.bold}${ANSI.cyan}═`.repeat(75) + ANSI.reset);
console.log(`${ANSI.bold}${ANSI.cyan}  FLASHCARD E2E ACCEPTANCE TEST SUITE${ANSI.reset}`);
console.log(`  ${ANSI.dim}Tiers selected: [${requestedTiers.join(', ')}] | Verbose: ${flags.verbose} | Bail: ${flags.bail}${ANSI.reset}`);
console.log(`${ANSI.bold}${ANSI.cyan}═`.repeat(75) + ANSI.reset);

const tierFileMap = {
  1: { file: './tier1-commands.test.mjs', defaultName: 'Tier 1: Core Command Acceptance' },
  2: { file: './tier2-security.test.mjs', defaultName: 'Tier 2: Boundary & Security Vulnerability Checks' },
  3: { file: './tier3-integration.test.mjs', defaultName: 'Tier 3: Cross-Feature Integration Checks' },
  4: { file: './tier4-workflow.test.mjs', defaultName: 'Tier 4: SM-2 SRS Study Workflow Checks' },
};

let totalPassed = 0;
let totalFailed = 0;
const suiteStartTime = Date.now();
const allResults = [];

for (const tierNum of requestedTiers) {
  const meta = tierFileMap[tierNum];
  let tierModule;

  try {
    tierModule = await import(meta.file);
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      console.log(`\n${ANSI.yellow}[Tier ${tierNum}] Test suite file (${meta.file}) not found - skipping.${ANSI.reset}`);
      continue;
    }
    console.error(`\n${ANSI.red}[Tier ${tierNum}] Error importing ${meta.file}:${ANSI.reset}`, err);
    process.exit(1);
  }

  const suiteName = tierModule.name || meta.defaultName;
  console.log(`\n${ANSI.bold}${ANSI.cyan}▶ ${suiteName}${ANSI.reset}`);

  let tierResults = [];
  try {
    tierResults = await tierModule.runTests({ verbose: flags.verbose });
  } catch (err) {
    console.error(`  ${ANSI.red}✗ Unhandled error running tier ${tierNum}:${ANSI.reset}`, err);
    tierResults = [
      {
        name: `Tier ${tierNum} Execution Failure`,
        pass: false,
        error: err.stack || err.message,
        durationMs: 0,
      },
    ];
  }

  for (const r of tierResults) {
    allResults.push({ ...r, tier: tierNum });
    const durationStr = `${ANSI.dim}(${r.durationMs || 0}ms)${ANSI.reset}`;

    if (r.pass) {
      totalPassed++;
      console.log(`  ${ANSI.green}✓ PASS:${ANSI.reset} ${r.name} ${durationStr}`);
      if (flags.verbose && r.details) {
        console.log(`    ${ANSI.gray}${r.details.split('\n').join('\n    ')}${ANSI.reset}`);
      }
    } else {
      totalFailed++;
      console.log(`  ${ANSI.red}✗ FAIL:${ANSI.reset} ${r.name} ${durationStr}`);
      if (r.error) {
        const errorLines = String(r.error)
          .split('\n')
          .map((line) => `    ${ANSI.red}${line}${ANSI.reset}`)
          .join('\n');
        console.log(errorLines);
      }
      if (flags.bail) {
        console.log(`\n${ANSI.yellow}[Bail enabled: stopping run after failure]${ANSI.reset}`);
        break;
      }
    }
  }

  if (flags.bail && totalFailed > 0) {
    break;
  }
}

const totalDurationMs = Date.now() - suiteStartTime;
const totalCount = totalPassed + totalFailed;

console.log('\n' + `${ANSI.bold}${ANSI.cyan}═`.repeat(75) + ANSI.reset);
console.log(`${ANSI.bold}TEST SUITE EXECUTION SUMMARY${ANSI.reset}`);
console.log(`  Total Tests : ${totalCount}`);
console.log(`  Passed      : ${ANSI.green}${totalPassed}${ANSI.reset}`);
console.log(`  Failed      : ${totalFailed > 0 ? ANSI.red : ANSI.reset}${totalFailed}${ANSI.reset}`);
console.log(`  Duration    : ${(totalDurationMs / 1000).toFixed(2)}s`);
console.log(`${ANSI.bold}${ANSI.cyan}═`.repeat(75) + ANSI.reset);

if (totalFailed > 0) {
  console.log(`${ANSI.bold}${ANSI.red}RESULT: FAILED (${totalFailed} test(s) failed)${ANSI.reset}\n`);
  process.exit(1);
} else {
  console.log(`${ANSI.bold}${ANSI.green}RESULT: ALL TESTS PASSED (${totalPassed}/${totalCount})${ANSI.reset}\n`);
  process.exit(0);
}
