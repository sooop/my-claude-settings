---
name: anchored-feedback
description: 오류·실패·알림·토스트 UI 를 새로 만들거나 기존 토스트/alert 를 바꿀 때, 어디에 어떻게 보여줄지 결정하는 기준과 참조 구현(Svelte 5·React) 위치. 토스트, 오류 표시, 에러 피드백, 알림 UI, snackbar, inline error, 실패 메시지 위치, 토스트 제거·전환 작업에 사용한다.
---

## 앵커 기반 오류·알림 피드백

원칙 하나: **오류는 "화면에 남아 있는 가장 가까운 것"에 붙인다.** 하단 중앙 토스트나 백드롭 모달에 던지지 않는다. 근거 시안은 claude.ai/design 의 `Error Feedback Concepts.dc.html`, 참조 구현은 jq-playground 의 `src/lib/ui/feedback/`(실측 테스트 포함, 이 스킬의 `references/svelte5/` 에 복사본).

### 결정 순서 (위에서부터 첫 번째로 화면에 남아 있는 것)

1. **원인 위치** — 토큰·줄·필드(`cause`). 위치 칩(`3:14`)과 함께 그 자리에 표시.
2. **대상 객체** — 영향받은 패널(`panel`). 상단 배너 또는 하단 상태줄, 패널당 한 줄.
3. **실행한 트리거** — 항상 보이는 버튼(`trigger`). 버튼에 빨간 점 + 꼬리 달린 비모달 팝오버.
4. **작업 트레이** — 좌하단 칩. 대상도 트리거도 남지 않을 때만.

호출자는 우선순위 목록 `anchors: ['query.cause', 'query.panel', 'query.save']` 만 넘기고, `resolve` 가 화면에 남은 첫 요소를 고른다(요소가 사라지면 자동 해제 — 언마운트·`display:none`).

### 형태별 규칙

- **백드롭 없음, 비모달.** 화면 모서리 고정 토스트 금지. 바깥 클릭·Escape 로 닫히는 팝오버.
- **반복은 합친다.** 같은 `key` 는 새로 쌓지 않고 `×N`, 시각 갱신, 짧은 흔들림. 패널당 한 줄·한 개.
- **해제.** error/warn 은 시간으로 닫지 않는다. 같은 동작의 성공(`clear(key)`)·해당 패널 입력(`clearScope(prefix)`)·사용자 × 로만. 트리거의 빨간 점은 팝오버를 닫아도 다음 성공까지 남는다. 트레이는 성공/info 칩만 몇 초 뒤 사라지고 실패 칩은 확인·재시도까지 남는다.
- **안심 문구(`reassure`).** 무엇이 유지됐는지 함께 말한다("쿼리 내용은 편집기에 그대로 있습니다").
- **복구 동작(`actions`).** 가능하면 붙인다 — "다시 시도", "원문으로 열기", "설정 다시 열기"(이전 값 그대로 복원).
- **닫히는 UI 에서 시작된 동작**(메뉴, 다이얼로그, 드롭 영역)은 오류가 도착하기 전에 UI 가 사라진다. 메뉴로 실행해도 같은 상시 버튼에 붙이고, 메뉴·다이얼로그 요소 자체를 앵커로 쓰지 않는다.
- **성공 확인은 누른 버튼 위에서.** 라벨 위 오버레이 "✓ 복사됨" 1.5초, 레이아웃 불변(`ok(anchorId, label)`). 버튼이 사라지면 패널 배너나 트레이 칩.
- **낡은 결과는 비우지 않는다.** 입력이 잘못돼 결과가 오래되면 마지막 성공 결과를 흐리게 유지하고 "갱신 안 됨"을 표시.
- **부분 성공은 한 묶음.** 여러 파일 처리 등은 실패만 펼치고 성공은 한 줄로 접는다. 실패 항목 때문에 기존 데이터를 덮어쓰지 않는다.
- **접근성.** error 는 `role="alert"`, 나머지는 `aria-live="polite"`(`role="status"`). 색만으로 구분하지 않는다(아이콘·문구).

### API (Svelte·React 공통 의미)

- `anchor(id, role)` / `useAnchor(id, role)` 등록. 역할은 `cause | panel | trigger`
- `resolve(ids)` 화면에 남은 첫 앵커 or `null`
- `report({ key, kind, title, detail?, reassure?, loc?, anchors, actions?, clearOn? })`
- `ok(anchorId, label)` 성공 확인, `clear(key)`, `clearScope(prefix)`, `dismiss(key)`(팝오버만 접음, 점은 유지), `reroute(key)`(렌더러 내부용)
- 배치 3종 `panel/trigger/tray` 는 `report` 가 앵커 역할로 결정한다
- 렌더러: `FeedbackHost`(팝오버 + 트레이, 앱 최상단 1개), `PanelNotice`(패널마다)
- 순수 유틸 `errorPosition`: `parseErrorPosition(message, text?)` 로 오류 문자열에서 줄·열·오프셋 추출
- 버튼 표식은 데이터 속성 `data-fb-error`/`data-fb-ok` 를 CSS 로 그린다(`feedback.css`)

### 앵커 id 작명

- `scope.name` 꼴: `query.save`, `output.copy`, `files.import`. 패널은 `scope.panel`(`PanelNotice scope="query"` 가 자동 부여).
- `report` 의 `key` 도 같은 꼴(`scope.action`). `clearScope('run.')` 처럼 접두사로 묶어 지울 수 있게 짓는다.
- 같은 동작은 항상 같은 key — 합치기와 해제의 단위다.

### 기존 토스트 전환 절차

1. **호출처 전수 표.** `rg "toast|snackbar|alert\("` 로 모든 호출을 모아 표로 만든다: 메시지 / kind / 트리거 / 그 시점에 남아 있는 앵커 후보.
2. **4순위 분류.** 각 호출을 결정 순서의 어느 단계에 붙일지 정한다. 메뉴·다이얼로그 발 호출은 상시 버튼으로 돌린다.
3. **실패를 삼키는 함수 점검.** 저장·내보내기·복사처럼 내부에서 예외를 `catch` 로 삼키는 함수는 호출자가 성공으로 오인한다 → 반환값/throw 로 바꾼 뒤 변환한다.
4. **인프라 이식 후 호출처 변환.** 프레임워크 참조 구현을 이식하고(`references/svelte5/README.md`), 호출처를 하나씩 `report`/`ok`/`clear` 로 바꾼다. 마지막에 구 토스트 모듈을 삭제하고 `rg` 잔존 0건을 확인한다.

### 프레임워크별 이식

- **Svelte 5**: `references/svelte5/` — 복사해서 경로만 조정. `README.md` 에 CSS 변수 목록과 단계. 버튼에 `{@attach anchor('query.save')}`.
- **React**: `references/react/` — `anchors.ts`·`errorPosition.ts`·`feedback.css` 는 svelte5 와 동일 복사. `feedback.ts`(외부 스토어 + `useSyncExternalStore`), `useAnchor`(ref callback), `FeedbackHost.tsx`, `PanelNotice.tsx`, 스타일 `feedback-components.css`. 스크래치 폴더에서 `tsc --strict` 통과·vitest 17건 통과를 확인했지만 실제 앱에서는 실행하지 않았다. 처음 적용할 때 타입체크와 테스트로 다시 확인한다.
- 그 밖(Vue 등): `anchors.ts` 와 `errorPosition.ts` 는 프레임워크 무관이라 그대로 쓰고, 컨트롤러·렌더러만 해당 반응성 모델로 옮긴다. 테스트(`feedback.test.ts`)는 그대로 재사용 가능.

### 흔한 함정

- 저장 함수가 예외를 삼켜 호출자가 "저장했습니다"를 띄움(jq-playground `saveSavedQuery`).
- 실패 메시지를 성공 kind 로 보냄(빈 데이터 내보내기).
- 모달 위에서 팝오버가 가려짐 — `--z-feedback` 가 모달보다 낮음.
- 같은 오류가 자동 실행마다 쌓임 — key 를 고정하고 성공 시 `clear`.
- 메뉴 항목·다이얼로그 요소를 앵커로 등록 — 오류 도착 전에 사라져 트레이로 샌다.
- error 에 시간제 해제(`clearOn: 숫자`)를 걸어 사용자가 읽기 전에 사라짐.

### 검증

점검표는 `references/checklist.md`(앵커 부착, Host 장착, 토큰·z-index, 호출처 분류표, 실패 삼키는 함수, 모달 위 z-index, 테마 양쪽, 테스트 항목). 테스트는 가짜 요소로 `register` 를 직접 호출해 node 환경에서 돈다.
