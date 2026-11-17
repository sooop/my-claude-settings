# Svelte 5 참조 구현

jq-playground 의 `src/lib/ui/feedback/` 를 그대로 복사한 것이다(`cp`, 수정 없음). 테스트 2개(`feedback.test.ts`, `error-position.test.ts`)는 원래 `tests/` 에 있고 import 경로가 `../src/lib/ui/feedback/…` 이므로 옮길 때 조정한다.

## 파일

- `anchors.ts` 앵커 레지스트리(프레임워크 무관) + `anchor()` attachment
- `feedback.svelte.ts` 컨트롤러(rune 싱글턴). `report/ok/clear/clearScope/dismiss/toggle/reroute`
- `FeedbackHost.svelte` 팝오버 + 좌하단 트레이. `FeedbackPopover.svelte`, `FeedbackBody.svelte` 가 쓴다
- `PanelNotice.svelte` 패널 상태줄/배너
- `errorPosition.ts` 오류 문자열 → 줄·열·오프셋(순수 함수, `parseErrorPosition`·`formatPos`)
- `dismiss.ts` `dismissable` attachment(바깥 클릭·Escape). FeedbackPopover 가 `../dismiss` 로 import — 이 프로젝트 전용 의존이라 같이 복사했다
- `feedback.css` `.fb-error/.fb-warn/.fb-info` 색 변수 + `[data-fb-error]`/`[data-fb-ok]` 버튼 표식. 전역 CSS 에 붙여 넣는다

## 필요한 CSS 변수

`--bg-raised --border-soft --border-strong --text --text-dim --text-faint --accent --accent-soft --accent-line --danger --danger-soft --danger-line --ok --bg-hover --shadow-pop --ease --font-mono --z-feedback`

- `--z-feedback` 는 모달·다이얼로그 z-index 보다 커야 한다(jq-playground 는 1500). 모달 위에서 팝오버가 가려지는 함정을 막는다.
- 라이트·다크 테마 양쪽에 `--danger*`, `--ok`, `--shadow-pop` 이 정의돼 있어야 한다.

## 이식

1. 폴더를 `src/lib/ui/feedback/` 로 복사하고, `FeedbackPopover.svelte` 의 `import { dismissable } from '../dismiss'` 경로를 맞춘다(`dismiss.ts` 를 `src/lib/ui/` 에 두거나 import 수정).
2. `feedback.css` 내용을 전역 CSS 에 붙이고 위 변수를 정의한다.
3. `App.svelte` 최상단에 `<FeedbackHost />` 를 한 번 둔다.
4. 오류가 붙을 패널마다 `<PanelNotice scope="query" placement="bottom" />`(앵커 `query.panel`).
5. 동작을 실행하는 상시 버튼에 `{@attach anchor('query.save', 'trigger')}`. 원인 위치 요소는 `'cause'`.
6. 호출: `feedback.report({ key, kind, title, anchors: ['query.cause', 'query.panel', 'query.save'], reassure, actions })`, 성공은 `feedback.clear(key)` + `feedback.ok('query.save', '저장됨')`.
7. 테스트(vitest, node 환경)는 가짜 요소로 `register` 를 직접 호출하므로 DOM 없이 돈다.
