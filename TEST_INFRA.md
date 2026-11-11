# FlashCard Test Infrastructure & Architecture Guide

## 1. Philosophy & Design Principles

The FlashCard test suite is built following the **Dual Track Requirement-Driven Acceptance Architecture**. It acts as an independent, opaque-box verification oracle designed to test system integrity, security boundaries, and core workflows without facade mocks or fabricated results.

### Key Tenets
1. **Opaque-Box & Requirement-Driven**: Tests assert against authoritative behavioral contracts specified in `ORIGINAL_REQUEST.md` and `PROJECT.md`, never bending to match broken intermediate implementation states.
2. **Zero-Facade Integrity**: No test is written to trivially pass. If an endpoint lacks authorization or leaks confidential data, the test explicitly fails, capturing forensic diagnostics.
3. **Cross-Platform Process Safety (Windows & POSIX)**:
   - Node 20+ on Windows introduces security restrictions (CVE-2024-27980) that reject spawning `.cmd` binaries without `shell: true` with `EINVAL`.
   - The test infrastructure encapsulates process execution in `tests/e2e/helpers/exec.mjs`, handling direct binary resolution, shell requirements, stream multiplexing (preventing silent stderr errors), and process tree termination (`taskkill /pid <pid> /f /t`) on timeouts.
4. **Offline & Hermetic Determinism**:
   - Tests do not require a live Supabase PostgreSQL connection or external Google OAuth credentials to execute.
   - Tiers 1 through 4 leverage Prisma AST/DMMF analysis, sandboxed route compilation via TypeScript transpilation, and in-memory transactional mock stores to achieve 100% deterministic local and CI verification.

---

## 2. Infrastructure Architecture & File Layout

```text
FlashCard/
├── tests/
│   └── e2e/
│       ├── helpers/
│       │   └── exec.mjs                  # Process spawn & cross-platform execution helper
│       ├── runner.mjs                    # Central CLI entrypoint & formatted ANSI reporter
│       ├── tier1-commands.test.mjs       # Tier 1: Core Command Acceptance Checks
│       ├── tier2-security.test.mjs       # Tier 2: Boundary & Security Vulnerability Checks
│       ├── tier3-integration.test.mjs    # Tier 3: Cross-Feature Integration Checks
│       └── tier4-workflow.test.mjs       # Tier 4: SM-2 SRS Study Workflow Checks
├── TEST_INFRA.md                         # This architecture and infrastructure manual
└── TEST_READY.md                         # Suite readiness, summary, and verification report
```

### Component Breakdown

| Component | Path | Responsibility |
|-----------|------|----------------|
| **Execution Helper** | `tests/e2e/helpers/exec.mjs` | Spawns child processes cross-platform, provides fallback database/auth env vars, combines stdout/stderr streams, and terminates full process trees on timeout. |
| **Central Test Runner** | `tests/e2e/runner.mjs` | CLI driver supporting `--tier=<1..4>`, `--bail`, `--verbose`, tracks elapsed time and assertion counts, and produces ANSI-colored diagnostic summaries. |
| **Tier 1 Suite** | `tests/e2e/tier1-commands.test.mjs` | Validates TypeScript static compilation (`tsc --noEmit`), ESLint clean code (`next lint --max-warnings 0`), Prisma schema validity (`prisma validate`), configuration integrity (`next.config.mjs`), and production build generation (`next build`). |
| **Tier 2 Suite** | `tests/e2e/tier2-security.test.mjs` | Sandboxes and compiles Next.js App Router handlers in-memory against a mock database and session context to verify IDOR protection, private deck confidentiality, quiz answer striping, server-side grading, and anti-replay guards. |
| **Tier 3 Suite** | `tests/e2e/tier3-integration.test.mjs` | Verifies lazy Prisma client initialization (no eager top-level connection attempts), NextRequest typing on `/api/user/stats`, gamification XP/level curves, and Prisma schema DMMF cascade/indexing rules. |
| **Tier 4 Suite** | `tests/e2e/tier4-workflow.test.mjs` | Verifies full SuperMemo SM-2 spaced repetition study loop: card default states, due cards query filtering, rating calculations (0, 3, 5), immediate due exclusion, multi-day repetition growth, mature card lapses, and EF clamping at 1.30. |

---

## 3. Four-Tier Methodology & Feature Inventory Mapping

| Tier | Category | Tests | Target Features / Requirements | Pass Criteria |
|:----:|----------|:-----:|-------------------------------|---------------|
| **1** | Core Command Acceptance | 5 | Acceptance Criteria (R1, R2); Features 1, 2, 3, 4 | Exit code 0 across `tsc`, `lint`, `prisma validate`, `next build`, and no error-masking flags in `next.config.mjs`. |
| **2** | Boundary & Security | 22 | Features 11, 12, 13, 14, 15 | Strict rejection of unauthenticated (401) and unauthorized (403) access, 0% leakage of `correctAnswer`/`isCorrect`, server-side grading, and rejection of completed quiz submissions (400). |
| **3** | Cross-Feature Integration | 10 | Features 1, 6, 7, 8 | Silent isolated import of `prisma.ts`, `NextRequest` typing for TS2322 prevention, `onDelete: Cascade` on deck/card relations, `User` audit timestamps, and compound indexing `[deckId, nextReview]`. |
| **4** | SRS Study Workflow | 12 | Features 17, 18; `sm2.ts` Algorithm | Accurate mathematical calculation of `easeFactor`, `interval`, and `repetitions` across SM-2 ratings, immediate due card exclusion, and exponential interval expansion. |
| **Total** | **All Tiers** | **49** | **Full System Surface** | **Comprehensive system verification** |

---

## 4. Test Execution & CLI Commands

### Central Runner Commands
```powershell
# Run the entire test suite across all 4 tiers
node tests/e2e/runner.mjs

# Run specific tier(s)
node tests/e2e/runner.mjs --tier=1
node tests/e2e/runner.mjs --tier=2
node tests/e2e/runner.mjs --tier=3
node tests/e2e/runner.mjs --tier=4
node tests/e2e/runner.mjs --tier=3,4

# Run with verbose diagnostic logs
node tests/e2e/runner.mjs --verbose

# Run with immediate halt on first failure
node tests/e2e/runner.mjs --bail
```

### Standalone Tier Execution
Each test suite file is independently executable via Node:
```powershell
node tests/e2e/tier1-commands.test.mjs
node tests/e2e/tier2-security.test.mjs
node tests/e2e/tier3-integration.test.mjs
node tests/e2e/tier4-workflow.test.mjs
```

---

## 5. Security & Boundary Verification Matrix (Tier 2)

The 22 security assertions in Tier 2 execute within an isolated in-memory route compilation environment:

| Test ID | Route Target | Method | Threat / Vulnerability Under Test | Auth State | Expected Status |
|:-------:|--------------|:------:|----------------------------------|:----------:|:---------------:|
| 2.1 | `/api/cards/[id]` | PUT | Unauthenticated card modification | None | 401 Unauthorized |
| 2.2 | `/api/cards/[id]` | PUT | Non-existent card modification | Owner | 404 Not Found |
| 2.3 | `/api/cards/[id]` | PUT | IDOR: Attacker modifies owner's card | Attacker | 403 Forbidden |
| 2.4 | `/api/cards/[id]` | PUT | Authorized card update | Owner | 200 OK |
| 2.5 | `/api/cards/[id]` | DELETE | Unauthenticated card deletion | None | 401 Unauthorized |
| 2.6 | `/api/cards/[id]` | DELETE | Non-existent card deletion | Owner | 404 Not Found |
| 2.7 | `/api/cards/[id]` | DELETE | IDOR: Attacker deletes owner's card | Attacker | 403 Forbidden |
| 2.8 | `/api/cards/[id]` | DELETE | Authorized deletion (decrements cardCount) | Owner | 200 OK |
| 2.9 | `/api/decks/[id]/cards` | GET | Unauthenticated access to private deck | None | 401 Unauthorized |
| 2.10 | `/api/decks/[id]/cards` | GET | IDOR: Attacker accesses private deck | Attacker | 403 Forbidden |
| 2.11 | `/api/decks/[id]/cards` | GET | Open access to public deck | None | 200 OK |
| 2.12 | `/api/decks/[id]/cards` | GET | Non-existent deck lookup | Owner | 404 Not Found |
| 2.13 | `/api/decks/[id]/cards` | POST | Unauthenticated card creation | None | 401 Unauthorized |
| 2.14 | `/api/decks/[id]/cards` | POST | IDOR: Attacker inserts card into owner's deck | Attacker | 403 Forbidden |
| 2.15 | `/api/decks/[id]/cards` | POST | Input validation: Missing front/back text | Owner | 400 Bad Request |
| 2.16 | `/api/decks/[id]/cards` | POST | Authorized creation (increments cardCount) | Owner | 201 Created |
| 2.17 | `/api/cards/[id]/review` | POST | Unauthenticated study review | None | 401 Unauthorized |
| 2.18 | `/api/cards/[id]/review` | POST | Non-existent card review | Owner | 404 Not Found |
| 2.19 | `/api/cards/[id]/review` | POST | IDOR: Attacker submits review for owner's card | Attacker | 403 Forbidden |
| 2.20 | `/api/quiz/generate` | POST | Answer leakage (`correctAnswer`, `isCorrect`) | Owner | 200 OK (0% Leakage) |
| 2.21 | `/api/quiz/submit` | POST | Client spoofed grade (`isCorrect: true`) | Owner | 200 OK (DB Evaluated) |
| 2.22 | `/api/quiz/submit` | POST | Anti-replay: Resubmitting completed session | Owner | 400 Bad Request |

---

## 6. Troubleshooting & Operational Notes

1. **Windows File Locks During `next build`**:
   - If a build process is killed abruptly on Windows, `.next/trace` or `.next/server` might remain temporarily locked by background OS indexing or lingering processes.
   - Resolution: Delete the `.next` directory using `Remove-Item -Recurse -Force .next` or ensure prior tasks have finished before re-running Tier 1.
2. **Prisma Environment Variable Resolution**:
   - `prisma validate` requires `DATABASE_URL` and `DIRECT_URL`.
   - The test runner supplies safe fallback dummy connection strings (`postgresql://postgres:postgres@localhost:5432/flashcard?schema=public`) if not present in `.env`.
3. **CommonJS Transpilation Interop**:
   - Next.js route handlers compiled with `typescript.transpileModule` require `__esModule: true` in mock module exports to correctly resolve `default` imports.
