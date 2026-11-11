import fs from 'node:fs';
import path from 'node:path';

const files = [
  'tests/e2e/runner.mjs',
  'tests/e2e/helpers/exec.mjs',
  'tests/e2e/tier1-commands.test.mjs',
  'tests/e2e/tier2-security.test.mjs',
  'tests/e2e/tier3-integration.test.mjs',
  'tests/e2e/tier4-workflow.test.mjs'
];

const suspiciousPatterns = [
  { name: 'assert(true)', regex: /assert\s*\(\s*true\s*[,)]/g },
  { name: 'assert.ok(true)', regex: /assert\.ok\s*\(\s*true\s*[,)]/g },
  { name: 'assert.strictEqual(true, true)', regex: /assert\.(?:strictEqual|equal)\s*\(\s*true\s*,\s*true\s*[,)]/g },
  { name: 'assert.equal(1, 1)', regex: /assert\.(?:strictEqual|equal)\s*\(\s*1\s*,\s*1\s*[,)]/g },
  { name: 'assert.equal(0, 0)', regex: /assert\.(?:strictEqual|equal)\s*\(\s*0\s*,\s*0\s*[,)]/g },
  { name: 'tautology assert(x, x)', regex: /assert\.(?:strictEqual|equal)\s*\(\s*([a-zA-Z0-9_]+)\s*,\s*\1\s*[,)]/g },
  { name: 'hardcoded pass: true literal', regex: /return\s*\{\s*name[^}]*pass\s*:\s*true\s*[,}]/g },
  { name: 'pass = true literal assignment', regex: /\bpass\s*=\s*true\b/g }
];

console.log('=== STATIC INTEGRITY PATTERN AUDIT ===');
let totalHits = 0;
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const { name, regex } of suspiciousPatterns) {
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(content)) !== null) {
      const lineNum = content.slice(0, match.index).split('\n').length;
      console.log(`[HIT] ${file}:${lineNum} [${name}]: "${match[0].trim()}"`);
      totalHits++;
    }
  }
}
console.log('Total suspicious pattern hits:', totalHits);
