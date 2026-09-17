---
name: Notices Performance Audit Plan Planted
description: Performance/antipattern audit for notices and main dashboard pages planted to src/app/notices/.docs/
type: project
---

Performance audit plan for `/main` and `/notices` routes (including `/notices/[nid]`) was planted on 2026-05-21.

**File**: `src/app/notices/.docs/performance-audit-notices-main.md`

**Coverage**: 
- 4 HIGH priority issues (race conditions, cache control, XSS)
- 7 MEDIUM priority issues (multiple SP calls, unmemoized renders, serial awaits)
- 7 LOW priority issues (code smell, antipatterns)

**Key HIGH issues**:
- H1: `useHomeDashboard` race condition with AbortController
- H2: Infinite retry in `enrichHomeQxMoneySettleFields`
- H3: Missing Cache-Control headers in `/api/main/cards/*` routes
- H4: XSS vulnerability in `NoticeListTable.tsx` dangerouslySetInnerHTML

This audit is a static-analysis snapshot ready for implementation in separate PRs (HIGH priority first).
