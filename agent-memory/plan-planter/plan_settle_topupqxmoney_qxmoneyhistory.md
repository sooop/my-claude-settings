---
name: Settle/TopupQxMoney · Settle/QxMoneyHistory React Porting Guide
description: 통합 포팅 가이드 planted 2026-03-28 at .docs/react-porting/settle-topupqxmoney-qxmoneyhistory.md
type: project
---

# Plan Planting Record

**Date Planted**: 2026-03-28  
**Plan File**: `C:\Users\sooop\.claude\plans\settle-qxmoneyhistory-settle-topupqxmone-happy-brooks.md`  
**Target Location**: `C:\Projects\qxfront\.docs\react-porting\settle-topupqxmoney-qxmoneyhistory.md`  
**Status**: Planted (File verified with fd)

## Purpose

이 계획은 QxMoney 충전 페이지(`TopupQxMoney`)와 거래내역 페이지(`QxMoneyHistory`)의 **React 포팅 가이드**입니다.

**주요 범위**:
- 충전 페이지: 4종 외부 PG(Qpay-STRIPE/GMO, BeaverWorksPay, Razorpay) 결제창, 가상계좌, 무통장입금
- 내역 페이지: 입출금 내역 조회, 검색, 페이지네이션, 행상세 펼침
- PG 결제창 및 콜백(`ProcessStripePay.cshtml`) — 신규 포팅 대신 기존 공용 모듈 유지 권장
- 도메인 코드 명세: inout_flag/type, paid_yn, emoney_type, search_key 등

## Key Insights

1. **SlickGrid 없음**: 내역 페이지는 `QxMoneyHistoryGrid.CreateGrid` 미호출 → 수동 HTML 테이블 + 자체 페이지네이션만 포팅.
2. **인라인 JS 통합**: PageScripts 분리 없이 Razor 뷰의 `@section pageLoadCompleted`에 모든 로직 인라인.
3. **하이브리드 데이터**: ViewBag 초기주입 + 이후 `/Settle/*` ajax 갱신.
4. **결제수단 매트릭스**: 통화/국가에 따라 Qpay/Virtual/BeaverWorks/Razorpay 조건부 노출 (§8.1).
5. **데드코드 다수**: B-5~B-7 참고, 포팅 제외 대상 명확히 함.

## Porting Order (§16)

1. 공용 유틸 이식(formatMoney/PriceUtil/ServiceCountry).
2. 도메인 코드 상수/enum 추출.
3. **QxMoneyHistory 먼저** (읽기 전용, 리스크 낮음).
4. TopupQxMoney (결제수단 매트릭스, 9개 레이어).
5. **PG 결제창·콜백은 공용 모듈 분리** (신규 포팅 제외).

## Critical Corrections (부록 B)

- **B-1**: Qpay 통화 배열 `"SGD,KRW.JPY,..."` → `['SGD','KRW','JPY',...].includes()`
- **B-2**: `QxMoneyHistory.cshtml:1188` case "QP" break 누락 → "Paid by Qpay Transfer" 표시 수정
- **B-4**: Test 하드코딩(CustNo==100329532) 제거
- **B-8**: `ChangePaidStatus` async:false 동기화 제거

## How to Use This Memory

향후 이 계획을 참고할 때:
- `.docs/react-porting/settle-topupqxmoney-qxmoneyhistory.md`는 **완전한 명세서**이므로, 포팅 중 궁금한 점이 생기면 먼저 섹션 인덱스(§1~16)를 훑고 해당 섹션 읽기.
- 도메인 코드(§2), 검색폼(§4.2), 결제수단 노출(§8.1), 콜백 평가(§9.3) 섹션이 가장 자주 참고될 것으로 예상됨.
- 부록 B는 기술 부채 정정 목록이므로, 포팅 시 정정 여부를 팀과 협의 후 결정.
