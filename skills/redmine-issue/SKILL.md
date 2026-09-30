---
name: redmine-issue
description: Creates, resolves, or closes Redmine issues for this project. Create sets the assignee to "me" (the Redmine user owning the configured API key). Resolve/close commits pending work if needed, posts a CKEditor HTML summary note, sets progress (done_ratio) to 100%, and moves status to Resolved or Closed respectively. Use when the user asks to create/register a Redmine issue, resolve/close a Redmine issue after implementation, run /redmine-issue, or says "레드마인 이슈 만들어줘", "커밋 후 레드마인 이슈 resolved로", "이 이슈 닫아줘/closed로".
disable-model-invocation: true
---

# Redmine 이슈 생성·해결·닫기 (create / resolve / close)

하나의 스킬이 이슈 **생성(create)**, **해결 처리(resolve)**, **닫기(close)** 세 동작을 담당한다.
해결·닫기는 항상 "커밋 → 코멘트 → 상태 변경 → 진척도 100%"를 함께 수행한다.

## 0. 동작(action) 판단

| 사용자 표현 | action | 목표 상태 |
|---|---|---|
| "이슈 만들어줘", "등록해줘", "레드마인에 올려줘" (아직 없는 이슈) | `create` | (생성 시 상태 미지정이면 기본값, 보통 New) |
| "해결", "resolved로", "끝났으니 레드마인 반영" | `resolve` | **Resolved** |
| "닫아줘", "닫습니다", "closed로" | `close` | **Closed** |

애매하면(예: "레드마인 이슈 처리해줘") 대화 맥락(이슈가 이미 존재하는지, 방금 구현이 끝났는지)으로 판단하고, 그래도 불명확하면 사용자에게 확인한다.

---

## A. 공통 — 이슈 번호/신규 여부 확정

- **`create`**: 이슈 번호가 없다 — 새로 만든다 (B절로).
- **`resolve`/`close`**:
  - 사용자가 URL·`#번호`·숫자로 명시 → 그 번호 = **직접 주입**
  - 번호 없음 → 세션에서 이미 다룬 Redmine 이슈 번호 사용
  - 둘 다 없음 → 사용자에게 번호 요청

추출 예: `2769`, `#2769`, `https://issues.tracxlogis.com/issues/2769`

### 직접 주입된 경우 — `redmine_get_issue`로 관련성 확인 (resolve/close만 해당)

**이슈 번호를 사용자가 직접 명시**했다면 `redmine_get_issue`(`issue_id`, 필요 시 `include_journals: true`)로 내용을 읽고 **작업 내용과 관련이 있는지** 확인한다.

- 관련 있음 → 계속
- 관련 없음·불명확 → **중단**하고 사용자에게 확인 (잘못된 이슈에 Resolved/Closed 금지)

세션에서 이미 같은 번호로 작업한 경우에도, **사용자가 이번 턴에 번호를 다시 명시했다면** 조회·관련성 확인을 수행한다.

---

## B. `create` — 이슈 생성

### 체크리스트
```
- [ ] 1. project/tracker/subject/description 확정 (필요 시 사용자에게 확인)
- [ ] 2. redmine_whoami 로 "나"(현재 API 키 소유자)의 user id 조회
- [ ] 3. redmine_create_issue 호출 — assigned_to_id = 조회한 내 id
- [ ] 4. 결과 보고 (이슈 URL, 번호, 담당자)
```

### 1. 이슈 필드

- `project`: 미지정 시 사용자에게 확인(대화 맥락상의 프로젝트 사용; DB/SP 이슈면 `AGENTS.md`가 가리키는 `DataBase` — 단 그 경우는 이 스킬이 아니라 DB/SP 전용 절차를 따른다).
- `tracker`: 일반 개발 이슈는 보통 `개발`/`기능`/`버그` 등 — 사용자 표현에서 유추, 애매하면 확인.
- `subject`/`description`: `description`은 **CKEditor HTML**로 작성한다. → 포맷 규칙: [redmine-issue-format.mdc](mdc:.cursor/rules/redmine-issue-format.mdc), `AGENTS.md` "일반 Redmine 이슈 등록 본문 포맷". Markdown·Textile(`##`, `h2.`, `- item`) 금지.

### 2. 담당자 = 나 (git 계정 기준)

**항상 `redmine_whoami`를 먼저 호출**해 현재 설정된 API 키가 속한 Redmine 사용자의 `id`를 얻고, 그 값을 `assigned_to_id`로 넘긴다. 담당자를 하드코딩하거나 이름으로 추측하지 않는다 — API 키가 곧 "나"이므로 매번 조회해서 쓴다.

`redmine_whoami`가 안 보이는(MCP 서버가 아직 재시작 전이라 신규 도구가 로드되지 않은) 환경이면:
1. `GET /users/current.json` (`../redmine-db-notify/.redmine.json`의 `url`/`apiKey` 사용)을 직접 호출해 `id`를 얻는다.
2. 그래도 안 되면 사용자에게 담당자로 지정할 Redmine user id를 물어본다 — **임의의 다른 사용자로 넘겨짚지 않는다.**

### 3. 생성 호출

```text
redmine_create_issue({
  project: "<project>",
  tracker: "<tracker>",
  subject: "<subject>",
  description: "<h2>...</h2>...",
  assigned_to_id: <whoami로 얻은 id>
})
```

### 4. 완료 보고

이슈 URL, 번호, 담당자(내 이름)를 사용자에게 전달한다.

---

## C. `resolve` / `close` — 해결·닫기 공통 절차

### 체크리스트
```
- [ ] 1. 이슈 번호 확정 (A절)
- [ ] 2. (직접 주입 시) 관련성 확인 (A절)
- [ ] 3. 미커밋 변경사항 있으면 커밋
- [ ] 4. 커밋 내용 → CKEditor HTML 노트(작업 요약) 작성
- [ ] 5. 이슈에 노트 등록 + 상태 변경(Resolved 또는 Closed) + 진척도 100%
- [ ] 6. 결과 보고 (이슈 URL, 커밋 해시, 상태, 진척도)
```

### 1. 미커밋 변경사항 커밋

`git status`로 확인한다. 변경이 있으면 커밋한다.

- **커밋 메시지는 한국어** — `[타입] 변경 내용 요약` (프로젝트 `git-commit-rule.mdc`)
- `.env`, API 키, `.mcp.json` 등 민감·로컬 전용 파일은 제외
- 사용자가 "커밋만 하지 마"라고 한 경우는 제외

```text
git status
git diff
git log -3 --oneline
git add <관련 파일>
git commit -m "[수정] ... (#<issue_no>)"
```

여러 커밋이 있으면 **이번 작업에 해당하는 커밋(들)**을 노트에 모두 기재한다. 이미 전부 커밋된 상태(추가 변경 없음)라면 이 단계는 건너뛰고 최근 관련 커밋만 노트에 인용한다.

### 2. CKEditor HTML 노트(작업 요약) 작성

Markdown·Textile 금지, HTML만 사용. → 포맷 규칙: [redmine-issue-format.mdc](mdc:.cursor/rules/redmine-issue-format.mdc)

```html
<h2>작업 개요</h2>
<p>이슈 요구사항 대비 변경 요약 (1~2문장) — 무엇을 왜 했는지 간략히.</p>

<h2>커밋</h2>
<ul>
  <li><code>&lt;full-or-short-hash&gt;</code> — <code>[타입] 커밋 제목</code></li>
  <li>브랜치: <code>&lt;branch-name&gt;</code></li>
</ul>

<h2>주요 변경</h2>
<ul>
  <li><code>path/to/file.ts</code> — 변경 요약</li>
</ul>

<h2>검증</h2>
<ul>
  <li>수행한 검증 (예: <code>npm run build</code>, 수동 시나리오)</li>
</ul>
```

`git show <hash> --stat` 및 diff로 **주요 변경**·**검증**을 채운다. "간략히 정리"가 목적이므로 각 섹션은 핵심만 — 장황한 서술 금지.

### 3. 목표 상태 결정

| action | 목표 상태 | 의미 |
|---|---|---|
| `resolve` (해결) | **Resolved** | 구현은 끝났고 검수/배포 확인 대기 |
| `close` (닫기) | **Closed** | 더 손댈 것 없이 완전히 종료 |

`status_id`는 하드코딩하지 말고 `redmine_list_statuses`로 **이름이 일치하는 ID**를 조회한다.
(참고: 운영 인스턴스에서 흔히 Resolved=3, Closed=5 — 매번 조회해서 확정할 것)

### 4. 이슈 업데이트 (노트 + 상태 + 진척도 100%)

**해결·닫기는 항상 진척도(`done_ratio`)를 100으로 함께 반영한다.**

#### API 우선순위

1. MCP `redmine_update_issue` — `issue_id`, `notes`(HTML), `status_id`, `done_ratio: 100`을 **한 번의 호출**로 함께 반영.
2. `redmine_update_issue`에 `done_ratio` 파라미터가 없는(MCP 서버가 아직 재시작 전이라 스키마가 구버전인) 경우:
   - `notes`+`status_id`까지는 MCP로 반영하고,
   - `done_ratio`만 `../redmine-db-notify/.redmine.json`의 `url`/`apiKey`로 직접 `PUT /issues/<id>.json` (`{"issue": {"done_ratio": 100}}`) 호출해 보정한다. 임시 스크립트/JSON 파일은 작업 후 삭제.
3. MCP 자체가 불가하면 세 필드(`status_id`, `notes`, `done_ratio`)를 **한 번의 REST PUT**으로 합쳐 보낸다.

#### MCP 예시

```text
redmine_update_issue({
  issue_id: <number>,
  notes: "<h2>작업 개요</h2>...",
  status_id: <resolved_or_closed_id>,
  done_ratio: 100
})
```

#### curl 폴백 (Windows)

PowerShell JSON 이스케이프 오류를 피하기 위해 **임시 JSON 파일** + `curl.exe --data-binary @file` 사용.

```powershell
# 본문만 — API 키는 .redmine.json 에서 읽기, 출력 금지
curl.exe -s -w "\nHTTP_CODE:%{http_code}" -X PUT `
  -H "X-Redmine-API-Key: <key>" -H "Content-Type: application/json" `
  --data-binary "@.tmp-redmine-note.json" `
  "https://issues.tracxlogis.com/issues/<id>.json"
```

`HTTP_CODE:204` 또는 `200`이면 성공. 임시 JSON은 작업 후 삭제.

### 5. 완료 보고

사용자에게 다음을 전달한다.

- 이슈 URL
- 반영한 커밋 해시·제목 (해당하는 경우)
- Redmine 상태 (`Resolved` 또는 `Closed`) · 진척도(`100%`)
- 관련성 확인을 건너뛴 경우·사용자 확인이 필요했던 경우 그 사유

---

## 금지·주의

| 항목 | 규칙 |
|------|------|
| DB/SP 등록 | `notify.mjs` / `redmine_db_apply` 사용 금지 (일반 개발 이슈) |
| 이슈 본문 `description` | resolve/close 시 기본적으로 **건드리지 않음** — `notes`(저널)만 추가 |
| 담당자 지정 | `create` 시 반드시 `redmine_whoami`로 조회한 값 사용, 임의 추측 금지 |
| API 키 | 로그·응답에 노출 금지 |
| 무관한 이슈 | 관련성 미확인 시 Resolved/Closed 처리 금지 |
| 상태 이름→ID | `resolve`=Resolved, `close`=Closed — 이름으로 매번 조회, 숫자 하드코딩 금지 |

## 참고

- Redmine API·HTML 규칙: `AGENTS.md`, `.cursor/rules/redmine-issue-format.mdc`
- MCP 서버: `redmine-db-notify` (`../redmine-db-notify/README.md`) — `redmine_whoami`(담당자용 내 user id 조회), `redmine_create_issue`/`redmine_update_issue`의 `done_ratio` 파라미터는 MCP 서버 프로세스 재시작 후 반영된다(도구 스키마가 세션 시작 시 로드되므로).
