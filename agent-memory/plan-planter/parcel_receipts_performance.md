---
name: Parcel Receipts Performance Improvement Plan
description: billing/parcel-receipts 성능 최적화 계획 — 병렬 월별 로딩, IndexedDB 캐시, 2칼럼 레이아웃
type: project
---

**Plan Planted**: 2026-06-30  
**Location**: `src/app/billing/parcel-receipts/.docs/performance-improvement-plan.md`

## Summary

소포 수령증 페이지의 성능 개선 및 UX 통합 계획. 핵심 개선:
1. 초기 로딩 최적화: 연 단위 전체 조회(~5초+) → 최근 6개월 병렬 조회 + 백그라운드 나머지 월
2. IndexedDB 캐시 도입: 3일 TTL로 월별 데이터/미리보기/엑셀 캐시
3. UI 리뉴얼: 세로 스택 → 좌(목록)/우(미리보기) 2칼럼 레이아웃
4. 액션 통합: 좌측 [인쇄/미리보기] → 우측 패널 미리보기 표시 → 우측 [인쇄]

## Key Decisions
- 백엔드 무수정 (기존 `search_month` 파라미터 활용)
- 프론트 전용 병렬 호출 + stale-while-revalidate 패턴
- custNo를 page.tsx(서버)에서 주입해 캐시 격리

## Verification Checklist
- 타입/빌드 확인 (tsc-test)
- 로컬 HTTPS 인증 (legacy-cookie-test)
- 병렬 로딩 확인 (DevTools Network)
- 캐시 동작 확인 (IndexedDB, 3일 만료)
- 액션 통합 검증 (좌→우→인쇄 플로우)
- 레이아웃 반응형 확인 (lg+ 2칼럼, 모바일 스택)
