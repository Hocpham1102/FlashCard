# Scope: Milestone 5 — Final Acceptance & Adversarial Hardening (Tier 1-5)

## Mission
Achieve 100% pass across all 49 E2E tests (Tiers 1-4), verify all Acceptance Criteria from ORIGINAL_REQUEST.md, and execute Phase 2 Adversarial Coverage Hardening (Tier 5) with white-box test gap analysis and forensic audit.

## Acceptance Criteria to Certify
- [x] Lệnh kiểm tra kiểu dữ liệu TypeScript (`npx tsc --noEmit`) hoàn thành thành công với 0 lỗi.
- [x] Lệnh kiểm tra mã nguồn (`npm run lint`) thực thi thành công không có lỗi nào.
- [x] Lệnh đóng gói/biên dịch (`npm run build`) hoàn tất thành công (21/21 static pages generated).
- [x] Kiểm tra tính hợp lệ của Prisma schema (`npx prisma validate`) hoàn thành thành công không có lỗi.
- [x] Mọi lỗi chức năng và vấn đề bảo mật/ổn định được xác định qua đợt rà soát đều được sửa đổi triệt để và xác minh qua kiểm thử hoặc kịch bản kiểm tra khách quan.

## Procedure
### Phase 1: Full E2E Suite Execution (Tiers 1-4)
- Execute `node tests/e2e/runner.mjs` verifying all 49 tests pass cleanly:
  - Tier 1: Core Commands (5 tests)
  - Tier 2: Boundary & Security (22 tests)
  - Tier 3: Cross-Feature Integration (10 tests)
  - Tier 4: SM-2 Study Workflow (12 tests)
### Phase 2: Adversarial Coverage Hardening (Tier 5)
- White-box analysis: Challengers inspect source files and generate adversarial test cases covering edge cases (e.g. invalid auth tokens, SQL injection defense in Prisma, extreme SM-2 quality inputs, concurrency).
- Reviewers verify.
- Forensic Auditor performs comprehensive repository-wide audit.
- Gate verification.

## Deliverables
- `handoff.md` and `GATE_STATUS.md` in state folder.
