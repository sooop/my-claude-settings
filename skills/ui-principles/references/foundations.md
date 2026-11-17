# 기초: 토큰·테마·글꼴·모션

새 프로젝트를 시작하거나 흩어진 값을 토큰으로 정리할 때 쓰는 출발점이다. 값은 예시이고 구성이 요점이다. 프로젝트에 이미 토큰이 있으면 그 이름을 쓴다.

## 색 토큰의 구성

색에는 생김새가 아니라 역할로 이름을 붙인다. 필요한 역할은 다음과 같다.

| 역할 | 토큰 예 | 쓰임 |
|---|---|---|
| 바탕 | `--bg` `--surface` `--surface-2` | 페이지, 카드·패널, 그 안에서 한 단계 들어간 면(편집기 줄번호 칸, 옵션 묶음) |
| 글자 | `--text` `--muted` | 본문, 보조 글자. 비활성 글자가 따로 필요하면 한 단계 더 |
| 선 | `--border` `--border-strong` | 구획선, 입력창·단추 테두리 |
| 상호작용 배경 | `--hover` `--selected` | 호버, 지금 열린 항목 |
| 강조 | `--accent` `--accent-soft` | 포커스 링·밑줄·선택 윤곽, 선택 배경 |
| 주 단추 | `--primary` `--on-primary` | 채운 단추의 배경과 그 위의 글자 |
| 위험 | `--danger` `--danger-bg` `--danger-border` | 글자색, 오류 상자의 배경과 테두리 |
| 의미색 | `--success` `--warn` `--info` | 상태 표시. 배경으로도 쓰면 `-bg` 짝을 둔다 |
| 기타 | `--mark-bg` `--shadow-1` `--shadow` `--ring` | 검색 일치, 그림자 두 단계, 포커스 링 |

지켜야 할 것은 세 가지다.

- **글자로 쓰는 강조색과 면으로 쓰는 강조색을 나눈다.** 면으로는 괜찮은 색이 글자로는 대비가 모자란다. `--accent`(면·링)와 `--primary` 또는 `--accent-text`(글자·채운 단추)를 따로 두고, 글자 쪽은 배경과 4.5:1 이상인지 확인한다.
- **채운 면 위의 글자는 `--on-*` 토큰으로 둔다.** 다크 테마에서는 채운 단추가 밝아지므로 그 위의 글자가 어두운 색으로 바뀐다. `#fff` 를 직접 쓰면 다크에서 틀린다.
- 다크 테마는 같은 이름에 다른 값을 준다. 그림자와 반투명 값(`--ring`, `--mark-bg`)도 다크 값을 따로 정한다.

```css
:root {
  --bg: #faf9f5; --surface: #f5f4ed; --surface-2: #f0eee6;
  --text: #141413; --muted: #6b6a64;
  --border: #e8e6dc; --border-strong: #cfcdc2;
  --hover: #efede4; --selected: #e8e6dc;
  --accent: #d97757; --accent-soft: #f3dcd2;
  --primary: #b45434; --on-primary: #ffffff;
  --danger: #b3261e;
  /* 그림자: 가까운 윤곽 + 넓게 퍼지는 층을 겹친다. -1 은 카드·호버, 기본은 떠 있는 패널 */
  --shadow-1: 0 1px 2px rgba(20,20,19,.06), 0 3px 10px -3px rgba(20,20,19,.12);
  --shadow: 0 1px 2px rgba(20,20,19,.06), 0 10px 28px -8px rgba(20,20,19,.22);
  --ring: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
  --mark-bg: rgba(255, 200, 0, .45);
  color-scheme: light;
}
```

토큰에서 파생하는 값은 `color-mix` 로 만든다.

```css
.row.picked { background: color-mix(in srgb, var(--accent) 16%, transparent); box-shadow: inset 0 0 0 2px var(--accent); }
.notice.error { background: color-mix(in srgb, var(--danger) 10%, transparent); }
.toast .action { border: 1px solid color-mix(in srgb, currentColor 55%, transparent); }
```

## 테마: 자동·라이트·다크

세 상태를 지원한다. 시스템 설정을 따르는 것이 기본이고 사용자가 고르면 그 값을 저장한다. 첫 화면이 그려지기 전에 `<head>` 의 인라인 스크립트로 정해야 밝은 화면이 번쩍이지 않는다.

```html
<script>(function(){var t='system';try{t=localStorage.getItem('theme')||'system'}catch(e){}
if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
document.documentElement.setAttribute('data-theme',t)})()</script>
```

```css
:root[data-theme='dark'] { --bg: #262624; --surface: #2e2e2b; --text: #f0eee6; /* … */ color-scheme: dark; }
```

스크립트가 `data-theme` 를 항상 정하면 다크 값을 한 번만 쓰면 된다. `@media (prefers-color-scheme: dark)` 와 `[data-theme='dark']` 양쪽에 같은 값을 복사하는 방식은 한쪽만 고치는 실수가 생긴다.

## 글꼴

```css
:root {
  --font: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI',
          'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif;
  --font-code: 'Geist Mono', 'JetBrains Mono', 'Cascadia Mono', ui-monospace, SFMono-Regular, Menlo, Consolas,
               'Liberation Mono', 'D2Coding', 'Malgun Gothic', 'Apple SD Gothic Neo', monospace;
  --code-size: 13px; --code-lh: 20px;
}
```

- **고정폭 스택에 비례폭 글꼴을 중간에 넣지 않는다.** 첫 글꼴이 없는 환경에서 비례폭으로 떨어지면 코드 정렬이 깨진다. 한글 글꼴은 고정폭 목록 뒤에 둔다.
- 글자 크기는 서너 단계로 정한다(예: 11 / 12 / 13 / 15px). 도구형 앱의 본문은 13~14px 이다.
- 숫자가 늘어서거나 바뀌는 곳에는 `font-variant-numeric: tabular-nums` 를 준다.
- 코드와 입력의 크기는 토큰 하나로 두고 터치에서 올린다.

```css
@media (pointer: coarse), (max-width: 720px) {
  :root { --code-size: 16px; --code-lh: 24px; }
  input, textarea, select { font-size: 16px; }   /* iOS 입력 확대 방지 */
  .icon-btn { width: 36px; height: 36px; }
  .btn { min-height: 36px; }
}
```

## 포커스 링과 기본 상태

```css
button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible,
a:focus-visible, [tabindex='0']:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

/* 입력창: 테두리 강조 + 바깥 링 */
.field input:focus, .field textarea:focus { outline: none; border-color: var(--accent); box-shadow: var(--ring); }
/* 아이콘과 입력을 감싼 틀은 focus-within 으로 */
.searchbox:focus-within { border-color: var(--accent); box-shadow: var(--ring); }

button:hover:not(:disabled) { background: var(--hover); }
button:disabled { opacity: .5; cursor: default; }

/* 눌림: 좁은 단추만. 넓은 행·메뉴 항목은 제외 */
@media (prefers-reduced-motion: no-preference) {
  .icon-btn:active:not(:disabled) { transform: scale(.92); }
  button.primary:active:not(:disabled) { transform: scale(.97); }
}

/* 스크롤바: 테마 색을 따르고, 좁은 패널 안에서는 가늘게 */
:root { scrollbar-color: var(--border-strong) transparent; }
.sidebar *, .dialog *, .popover { scrollbar-width: thin; }
```

확인창처럼 스크립트가 포커스를 준 단추는 마우스로 열었을 때 `:focus-visible` 이 켜지지 않는다. Enter 로 눌릴 단추를 알려야 하는 곳은 `:focus` 로 링을 그린다. 채운 단추는 같은 색의 링이 묻히므로 사이를 띄운 이중 링을 쓴다.

## 모서리·간격

모서리 반경은 크기에 맞춰 단계를 둔다. 작은 단추·목록 행 6px, 단추·입력·카드 8px, 팝오버·토스트 10px, 큰 패널·대화상자 12px. 칩과 배지는 `999px` 이다.

단추 높이는 기본 32px, 작은 것 28px 로 두고 터치에서 36px 로 올린다.

## 모션 토큰

```css
:root {
  --dur-1: 130ms;   /* 색·테두리·투명도 */
  --dur-2: 220ms;   /* 크기·위치 */
  --ease-out: cubic-bezier(.2, .8, .2, 1);
  --ease-spring: cubic-bezier(.34, 1.56, .64, 1);
}
/* 앱 설정으로 끄기: 길이 토큰만 0 으로. 전환이 이 변수를 쓰기만 하면 설정을 따른다 */
:root[data-anim='off'] { --dur-1: 0ms; --dur-2: 0ms; }
@media (prefers-reduced-motion: reduce) { :root { --ease-spring: var(--ease-out); } }

button { transition: background-color var(--dur-1) var(--ease-out), border-color var(--dur-1) var(--ease-out),
  color var(--dur-1) var(--ease-out), box-shadow var(--dur-1) var(--ease-out), transform var(--dur-1) var(--ease-out); }
```

`transition: all` 은 쓰지 않는다. 바뀌는 속성을 적는다.

줄임 모드를 한 번에 처리하려면 전역 규칙을 쓴다. 진행 신호는 예외로 남긴다.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; }
  .spinner, .progress.active::after { animation-duration: 1.2s !important; animation-iteration-count: infinite !important; }
}
```

`@keyframes` 애니메이션은 길이 토큰을 따르지 않으므로 끄기 설정과 줄임 모드에서 직접 꺼야 한다.

JS 로 구동하는 등장·퇴장(프레임워크의 transition 함수)은 길이와 거리를 표 하나에 모으고, 끄기 설정과 줄임 모드를 그 함수 안에서 확인한다.

```ts
export const MOTION = {
  tooltip: { ms: 120, y: 4 },
  popover: { ms: 180, y: 6, scale: 0.96 },
  modal:   { ms: 400, scale: 0.95, backdropDelay: 110 },
  panel:   { ms: 220, x: 40 },
  toast:   { ms: 200, y: 8 },
  list:    { ms: 220 },
};
/** 이 수를 넘는 목록은 항목마다 위치를 재는 비용이 커서 효과를 끈다 */
export const LIST_FX_MAX = 80;
```

자주 쓰는 CSS 기법 두 가지.

```css
/* 선택된 탭의 밑줄이 가운데에서 펼쳐진다 */
.tab::after { content: ''; position: absolute; left: 8px; right: 8px; bottom: -2px; height: 2px; background: var(--accent);
  transform: scaleX(0); opacity: 0; transition: transform var(--dur-2) var(--ease-out), opacity var(--dur-1) var(--ease-out); }
.tab.on::after { transform: scaleX(1); opacity: 1; }

/* display:none 으로 숨는 요소의 등장·퇴장을 CSS 만으로 */
.pop { opacity: 1; translate: 0 0; scale: 1;
  transition: opacity var(--dur-2) var(--ease-out), translate var(--dur-2) var(--ease-spring), scale var(--dur-2) var(--ease-spring),
    display var(--dur-2) allow-discrete;
  @starting-style { opacity: 0; translate: 0 -4px; scale: .95; } }
.pop[hidden] { display: none; opacity: 0; }
```

같은 애니메이션을 값이 바뀔 때마다 다시 재생하려면 클래스를 뗐다가 리플로우를 강제하고 다시 붙인다.

```js
el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
```

## 프로젝트 규칙 문서에 적어 둘 것

다음 작업자(사람이든 에이전트든)가 같은 결정을 다시 하지 않게 `AGENTS.md` 나 `CLAUDE.md` 에 적는다.

- 토큰이 정의된 파일과 "색은 변수만 쓴다"는 규칙.
- 공용 컴포넌트·함수의 이름과 쓰임.
- 좁은 화면 기준 폭.
- 아이콘 세트와 추가하는 방법.
- 테스트가 의존하는 식별자(`id`, `data-*`). 마크업을 고칠 때 유지해야 한다.
- 키·선택·포커스 판정처럼 DOM 없이 계산할 수 있는 규칙은 순수 함수로 떼어 단위 테스트를 둔다. 화면 테스트에는 좁은 폭 사례를 넣는다.
