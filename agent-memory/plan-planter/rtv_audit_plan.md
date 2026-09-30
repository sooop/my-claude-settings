---
name: RTV Performance & Bug Audit Plan
description: Comprehensive audit plan of RTV page identifying 7 Critical, 16 High, 18 Medium, and 10 Low priority issues with execution roadmap
type: project
---

RTV(inventory return) page and modals comprehensive audit plan created on 2026-05-18. 

- **Severity breakdown**: 7 Critical (race conditions, modal state, N+1), 16 High (render side-effects, memo, virtualization), 18 Medium (UX, robustness, timezone), 10 Low (refactoring)
- **Execution priority**: CR-1~7 bundled first (search race, effects unification, modal reset, abort propagation, N+1 parallelization, memoization), then H-1~4 (render side-effects). H-5/6 require virtualization/pagination policy decision.
- **File location**: `C:\Projects\tx-front-react\src\app\inventory\rtv\.docs\rtv-performance-bug-audit.md`

Key recommendations:
- Use `requestIdRef`/`AbortController` for all async operations
- Unify mount-only effects to prevent warehouse preference race with auto-search
- Force remount detail modal with `key={form.shipping_out_no ?? 'new'}` to reset child state
- Memoize `isDirty`/`canSubmit` calculations
- Separate column definitions from state to avoid thrashing
- Stabilize callbacks with `useCallback`
