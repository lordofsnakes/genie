---
phase: 8
slug: identity-wiring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (api), jest (web — via next test) |
| **Config file** | `apps/api/vitest.config.ts`, `apps/web/jest.config.js` |
| **Quick run command** | `cd apps/api && npx vitest run src/routes/verify.test.ts` |
| **Full suite command** | `cd apps/api && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npx vitest run src/routes/verify.test.ts`
- **After every plan wave:** Run `cd apps/api && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | WRID-01 | unit | `cd apps/api && npx vitest run src/routes/verify.test.ts` | ✅ | ⬜ pending |
| 08-01-02 | 01 | 1 | WRID-02 | unit | `cd apps/api && npx vitest run src/routes/verify.test.ts` | ✅ | ⬜ pending |
| 08-02-01 | 02 | 1 | WRID-03 | grep | `grep -n 'redirect' apps/web/middleware.ts` | ✅ | ⬜ pending |
| 08-02-02 | 02 | 1 | WRID-04 | grep | `grep -n 'isVerified' apps/web/src/components/Verify/index.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| World ID verification modal opens and completes | WRID-01 | Requires World App simulator | Open app, tap verify, complete IDKit flow |
| Redirect to landing for unauthenticated user | WRID-03 | Requires browser | Visit /chat without auth, expect redirect to / |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
