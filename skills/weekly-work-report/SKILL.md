---
name: weekly-work-report
description: 지정 기간(기본 지난 한 주)의 커밋과 Redmine 이슈(Front Dev·TLPS Dev, 작성자=본인)를 조사해 주간 업무 보고서 표(제목·진행율·시작일·목표일·반영일·작업번호·담당·기획/요청·내용정리)를 만든다. Use when asked "주간 보고서", "지난 주 한 일 표로", "업무 보고서 표", "10월 23일~30일 한 일 정리", weekly work report.
---

# 주간 업무 보고서 표

기간 안에 한 일을 Redmine 이슈 기준으로 표 한 장에 정리한다. 요청에 기간이 없으면 지난 한 주(오늘 기준 7일)로 보고 한 줄로 확인한다.

## 출력 표 (열 순서 고정)

| 제목 | 진행율 | 시작일 | 목표일 | 반영일 | 작업번호 | 담당 | 기획/요청 | 내용정리 |

- **제목**: 이슈 subject 그대로. TLPS Dev 이슈는 끝에 `(TLPS)` 를 붙인다.
- **진행율**: 기본 `100%`. 대부분의 작업이 당일 완료되므로 Redmine `done_ratio` 가 0 이어도 100% 로 쓴다(사용자 확정). 100% 가 아닌 것은 사용자가 따로 말한 건만.
- **시작일**: 이슈 `start_date`(없으면 `created_on` 날짜). `MM-DD`.
- **목표일**: `due_date`. 비어 있으면 `-`.
- **반영일**: Closed 이슈는 `closed_on` 날짜. Resolved·New 는 `- (상태명)`. Redmine 에 반영일 필드가 없어 종료일로 대신한다는 점을 표 아래에 밝힌다.
- **작업번호**: `#이슈번호`.
- **담당**: 본인 이름(권봉수). **기획/요청**: `자체`.
- **내용정리**: 이슈 description 의 요약 + 같은 이슈 번호의 커밋 내용을 합쳐 한 줄(2문장 이내). 내부 경로·SP 이름은 꼭 필요한 것만.

## 조사 절차

1. **커밋**: `git log --since="<시작> 00:00" --until="<종료+1일> 00:00" --author=sooop --format="%h|%ad|%s" --date=short`. 제목 끝 `(#번호)` 로 이슈와 연결한다. 번호 없는 커밋은 표에 넣지 말고 표 아래에 따로 나열한다. 머지 커밋은 무시한다.
2. **Redmine 이슈**: MCP `redmine_list_issues` 는 작성자 필터·날짜·설명이 없어 쓰지 않는다. `../redmine-db-notify/.redmine.json` 의 `apiKey`·`url` 로 REST 를 직접 호출한다(**키는 출력하지 않는다** — 셸 변수로만 쓴다).
   ```bash
   cd /c/projects/redmine-db-notify
   K=$(jq -r .apiKey .redmine.json); U=$(jq -r .url .redmine.json)
   for p in 12 7; do   # 12=Front Dev, 7=TLPS Dev
     curl -s -H "X-Redmine-API-Key: $K" \
       "$U/issues.json?author_id=9&project_id=$p&status_id=*&subproject_id=!*&updated_on=%3E%3D<시작일>&limit=100&sort=id" > "$SCRATCH/p$p.json"
   done
   ```
   `author_id=9` 는 본인(`redmine_whoami` 의 id). 100건 초과면 `offset` 으로 이어 받는다. 결과는 스크래치패드에 저장하고 `jq` 로 필요한 필드만 뽑는다.
3. **기간 필터**: `start_date`(또는 `created_on`)가 기간 안인 이슈만 표에 넣는다. 기간 이전에 시작해 기간 중 일괄 종료된 이슈는 제외하고, 건수와 번호 범위를 표 아래에 밝힌다. 사용자가 포함하라고 하면 넣는다.
4. **설명 추출**: `jq -r '.issues[]|"#\(.id) | \(.description|gsub("<[^>]*>";" ")|gsub("[ \\n\\r\\t]+";" ")|.[0:170])"'`. 정규식에 `\s` 를 쓰면 jq 가 컴파일 오류를 내므로 `[ \\n\\r\\t]` 로 쓴다.

## 정렬·형식

- 정렬은 Front Dev → TLPS Dev, 각 그룹 안에서 시작일·이슈번호 오름차순.
- 마크다운 표 하나로 출력. 셀 안의 `|` 는 `\|` 로 이스케이프. 날짜는 연도 없이 `MM-DD`(연도는 표 위 한 줄에 적는다).
- 표 아래에 확인 사항을 짧게: 반영일 대용 정의, 제외한 이슈, 이슈 번호 없는 커밋.

## 하지 않는 것

- 이슈를 만들거나 수정하지 않는다(읽기 전용).
- 목표일·반영일을 추측해 채우지 않는다.
- 완료되지 않은 이슈(New)를 완료로 쓰지 않는다 — 진행율만 100% 규칙을 따르고 반영일은 `-` 로 둔다.
