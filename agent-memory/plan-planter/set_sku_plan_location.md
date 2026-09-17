---
name: SET SKU 계획 저장 위치
description: set-sku-nested-origami 계획이 inventory 라우트 아래 .docs에 저장됨
type: reference
---

SET SKU 관리 페이지 구현 + inventory 라우트 재배치 계획이 저장된 위치:

**Absolute path**: `C:\Projects\tx-front-react\src\app\inventory\.docs\set-sku-nested-origami.md`

**Relative path**: `src/app/inventory/.docs/set-sku-nested-origami.md`

이 계획은 다음 두 기능을 다룬다:
1. `set-skus` 페이지를 React 네이티브로 신규 작성 (dynamic-sets 패턴 답습)
2. 라우트 재배치: `src/app/inventory/` 신설, dynamic-sets 이동 포함

Phase별 8단계로 진행되며, 각 Phase 후 멈춤 및 사용자 승인 필요.
