---
name: 계획 파일 저장 패턴
description: 계획 파일을 기능별 .docs/ 폴더에 식별 가능한 파일명으로 저장
type: feedback
---

계획 파일은 항상 해당 기능의 `src/app/[route]/.docs/` 폴더에 저장한다.

**Format:**
- 메타데이터: `**Date**: YYYY-MM-DD`, `**Target Route**: src/app/[route]`, `**Status**: Draft`
- 파일명: 기능/주제를 명확하게 반영한 소문자 하이픈 구분 형식 (예: `group-flat-view-implementation.md`)
- 타겟 폴더는 `fd`로 미리 확인하고, 없으면 `mkdir` 생성

**Why:** 계획이 해당 작업과 동일 디렉토리에 있어야 구현 중 참조하기 쉽고, 프로젝트 구조상 관리가 명확하다.

**How to apply:** 
- `계획 파일:` 명시 또는 `C:\Users\sooop\.claude\plans\` 에서 최신 파일 감지
- 계획 내용을 읽고 주요 주제 추출
- 타겟 라우트 매칭 → `.docs` 폴더 확인 → 파일 작성
- 완료 후 절대경로로 보고
