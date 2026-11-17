# 부품별 규칙과 코드 조각

만들려는 부품의 절만 읽는다. 코드 조각은 실제 프로젝트에서 가져온 참고용이다. 이름과 프레임워크는 프로젝트에 맞춰 바꾼다. 토큰 이름은 [foundations.md](foundations.md) 를 따른다.

- [모달](#모달) · [서랍](#서랍) · [메뉴와 팝오버](#메뉴와-팝오버) · [툴팁](#툴팁) · [토스트](#토스트) · [확인창](#확인창)
- [단추](#단추) · [스위치](#스위치) · [탭](#탭) · [선택 막대](#선택-막대) · [그 자리 이름 변경](#그-자리-이름-변경)
- [데이터 표](#데이터-표) · [분할선](#분할선) · [접이식 패널](#접이식-패널) · [파일 드롭 영역](#파일-드롭-영역)
- [진행 표시와 직렬 실행](#진행-표시와-직렬-실행) · [오류 상자](#오류-상자) · [축소 미리보기](#축소-미리보기) · [지연 로딩](#지연-로딩)

## 모달

모달이 해야 할 일은 다섯 가지이고, 한 곳에 구현해서 모든 창이 쓴다.

1. 스택: 열린 창을 쌓아 두고 Esc·Tab 은 맨 위만 처리한다.
2. 포커스 가두기: Tab 이 창의 양 끝에서 반대쪽으로 돈다.
3. 포커스 복귀: 닫히면 열기 직전의 요소로 돌아간다.
4. 배경 막기: 맨 위 창 밖을 `inert` 로 만든다. 토스트·툴팁·컨텍스트 메뉴는 제외한다.
5. 바깥 클릭: 누름과 뗌이 둘 다 배경일 때만 닫는다.

판정은 DOM 과 떼어 순수 함수로 두면 단위 테스트가 된다.

```ts
/** Tab 이 창 밖으로 나가지 않게 가장자리에서만 되돌린다.
 *  반환: 옮길 순번 / -1 은 포커스 가능 요소가 없으니 창 자신에 머문다 / null 은 기본 동작에 맡긴다 */
export function trapTarget(count: number, active: number, shift: boolean): number | null {
  if (count <= 0) return -1;
  if (active < 0 || active >= count) return shift ? count - 1 : 0;
  if (!shift && active === count - 1) return 0;
  if (shift && active === 0) return count - 1;
  return null;
}

/** 입력창에서 글자를 끌다가 창 밖에서 놓으면 click 의 대상이 배경이 된다. 그때 pointerdown 은 창 안이었으므로 닫지 않는다 */
export function createBackdropGuard() {
  let downOnBackdrop = false;
  return {
    down(onBackdrop: boolean) { downOnBackdrop = onBackdrop; },
    click(onBackdrop: boolean) { const ok = downOnBackdrop && onBackdrop; downOnBackdrop = false; return ok; },
  };
}

/** 아래에 있던 창이 닫히는 경우나, 그사이 다른 곳이 포커스를 가져간 경우는 건드리지 않는다 */
export function shouldRestoreFocus(s: { wasTop: boolean; focusNowhere: boolean; focusInsideClosed: boolean; openerAlive: boolean }) {
  return s.wasTop && s.openerAlive && (s.focusNowhere || s.focusInsideClosed);
}

export const FOCUSABLE_SELECTOR = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])', 'select:not([disabled])', 'textarea:not([disabled])',
  '[contenteditable=""]', '[contenteditable="true"]', '[tabindex]:not([tabindex="-1"])', 'summary',
].join(',');
```

배경 막기는 맨 위 창에서 `body` 까지 올라가며 각 단계의 형제에 `inert` 를 건다. 조상에는 걸지 않는다. 직접 건 요소만 기억해 두었다가 푼다.

```ts
let cur = top.node;
while (cur.parentElement && cur !== document.body) {
  for (const sib of cur.parentElement.children) {
    if (sib === cur || sib.inert || sib.matches('.toasts, .tip, .ctx-menu, [data-modal-safe]')) continue;
    sib.inert = true; inerted.add(sib);
  }
  cur = cur.parentElement;
}
```

Esc 처리에서 지킬 것: `e.defaultPrevented` 이면 건너뛴다(안쪽에서 이미 처리했다). `e.isComposing || e.keyCode === 229` 이면 건너뛴다. `canClose()` 가 거짓이면 무시한다.

창이 받는 옵션은 이 정도면 충분하다.

```ts
interface ModalOptions {
  onClose: () => void;            // Esc·바깥 클릭. 실제로 닫을지는 여기서 정한다(입력 유실 확인 등)
  onEscape?: () => void;          // Esc 만 따로(선택부터 풀고 그다음에 닫기)
  canClose?: () => boolean;       // 처리 중에는 false
  focus?: string | (() => HTMLElement | null);  // 열릴 때 포커스를 줄 곳. 생략하면 X 단추를 뺀 첫 요소
}
```

창의 틀(Svelte 예).

```svelte
<div class="overlay" transition:backdropFx use:modal={{ onClose: requestClose, canClose: () => !busy, focus: 'input' }}>
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="x-title" transition:modalFx>
    <div class="dlg-head"><h2 id="x-title">제목</h2><ModalClose onclick={requestClose} disabled={!!busy} /></div>
    <!-- 본문 -->
    <div class="actions">
      <button onclick={requestClose} disabled={!!busy}>취소</button>
      <button class="primary" onclick={run} disabled={!!busy}>{busy ? '처리하는 중…' : '실행'}</button>
    </div>
  </div>
</div>
```

입력 유실 확인은 닫는 길 네 개(X, Esc, 바깥 클릭, 취소)가 한 함수를 거치게 한다.

```ts
async function requestClose() {
  if (asking) return;
  if (text.trim() && text !== startText) { asking = true; const ok = await confirmDiscard(); asking = false; if (!ok) return; }
  close();
}
```

단축키 도움말처럼 단순한 창은 네이티브 `<dialog>` 가 낫다. `showModal()` 이 Esc·포커스 복귀·배경 막기를 맡고, 바깥 클릭만 `e.target === dialog` 로 직접 닫는다.

## 서랍

옆에서 밀려 나오는 패널이다. 이력, 참고 자료, 설정처럼 작업 화면을 보면서 쓰는 부가 기능에 쓴다. 모달의 규칙(포커스 가두기·복귀, 배경 `inert`, Esc)을 그대로 따른다.

- 폭은 `min(420px, 100vw)`. 좁은 화면에서는 전체 폭이 된다.
- 여는 단추에 `aria-expanded` 와 `aria-controls` 를 준다. 개수 배지는 `99+` 에서 멈춘다.
- 여러 기능을 담으면 서랍 안에 탭을 둔다.
- 닫혀 있는 동안에는 내용을 그리지 않는다.

```js
function open() {
  lastFocus = document.activeElement;
  drawer.hidden = backdrop.hidden = false;
  app.inert = true;
  requestAnimationFrame(() => { drawer.classList.add('open'); backdrop.classList.add('open'); });  // hidden 해제 뒤 한 프레임
  search.focus({ preventScroll: true });
}
function close() {
  drawer.classList.remove('open'); backdrop.classList.remove('open');
  app.inert = false;
  setTimeout(() => { if (!isOpen) { drawer.hidden = backdrop.hidden = true; list.textContent = ''; } }, 260);  // 퇴장이 끝난 뒤
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
}
```

```css
.drawer { position: fixed; inset: 0 0 0 auto; width: min(420px, 100vw); transform: translateX(104%);
  transition: transform var(--dur-2) var(--ease-out); padding-bottom: env(safe-area-inset-bottom); }
.drawer.open { transform: none; }
```

이 조각은 Tab 을 서랍 안에 가두지 않는다. 위 모달 절의 `trapTarget` 을 붙여야 한다.

이력 서랍의 구성.

- 항목 제목은 내용에서 뽑은 미리보기다(태그를 걷어 낸 본문 앞부분). 부가 정보는 `시각 · 줄 수 · 크기` 로 잇는다.
- 검색은 공백으로 나눈 낱말이 모두 들어간 항목을 찾고 일치 부분을 `<mark>` 로 강조한다. 제목에 일치가 없으면 본문에서 일치 주변을 잘라 보여 준다.
- "이력이 없습니다"와 "일치하는 이력이 없습니다"를 구분한다.
- 한 번에 40개쯤 그리고 "더 보기 (남은 수)" 로 잇는다.
- 한 건 삭제는 바로 실행하고 되돌리기를 준다. 전체 삭제는 하단 줄이 확인 줄로 바뀌고 포커스가 취소에 간다.
- 보관 한도를 두고, 처음 정리가 일어났을 때 알린다.
- 불러오면 지금 입력을 먼저 보존한다.

참고 자료 서랍의 구성.

- 열면 검색창에 포커스가 간다. 검색하면 분류 없는 평면 결과로 바뀐다.
- 항목은 접혀 있고 펼치면 예제와 "넣기"(주 단추) / "복사" 가 나온다. 넣기는 기존 내용을 덮어쓰지 않고 뒤에 붙인다.
- 문맥 도움말: 편집기에서 F1 을 누르면 커서 아래 낱말로 서랍을 연다. 일치하는 항목이 있으면 펼쳐서 보이고, 없으면 낱말을 검색어로 넣는다.

## 메뉴와 팝오버

- 화면 전체에 호스트 하나를 두고 우클릭, 길게 누르기, 메뉴 키(Shift+F10), ⋯ 단추가 모두 같은 함수로 연다: `openMenuAt(x, y, items, from)`. `from` 은 닫을 때 포커스를 돌려줄 요소다.
- 열면 첫 항목에 포커스. ↑↓ 순환, Home/End, 비활성 항목 건너뛰기. Esc 는 닫고 `from` 으로 복귀. Tab 은 `preventDefault` 후 닫는다. 하위 메뉴는 →/Enter 로 열고 ← 로 닫는다.
- 스크롤, 창 크기 변경, 창 blur, 바깥 `pointerdown`(capture)에서 닫는다.
- 위치는 화면 안으로 당긴다: `Math.max(pad, Math.min(x, innerWidth - w - pad))`. 아래 공간이 모자라면 위로 뒤집는다. 폭은 `max-width: min(280px, calc(100vw - 16px))`.
- 항목 순서: 만들기 → 이름 변경 → 이동… → 내보내기 → 위험 동작. 묶음 사이에 구분선을 두고, 긴 메뉴는 작은 소제목으로 묶는다. 위험 항목은 맨 아래에 위험색으로 둔다.
- 여러 개를 고른 상태면 라벨에 개수를 넣는다("3개 이동…").
- 비활성 항목에는 이유를 옆에 적는다("현재 위치").
- 길게 누르기: 500ms, 10px 넘게 움직이면 취소, 직후의 click 은 삼킨다. 키보드나 터치로 연 직후 브라우저가 뒤따라 보내는 `contextmenu` 는 잠깐(600ms) 무시한다. iOS 에서는 `-webkit-touch-callout: none` 으로 기본 메뉴를 막는다.
- 팝오버 안의 줄은 아이콘 + 제목 + 작은 설명 구성이다. 아이콘은 보조 색, 선택된 줄과 위험 줄만 글자색을 따른다.
- 화면 아래쪽에 있는 드롭다운은 위로 연다.

## 툴팁

네이티브 `title` 대신 공용 툴팁을 쓴다. `title` 은 지연과 모양을 정할 수 없고 터치·키보드에서 보이지 않는다.

- 내용은 `제목`, `설명 줄`, `단축키` 로 나눈다. 단축키는 키 모양으로 그린다.
- 표시 지연은 약 400ms. 툴팁 하나를 닫은 직후 다른 요소로 옮기면 지연 없이 띄운다.
- 터치에서는 띄우지 않는다. 키보드 포커스는 `:focus-visible` 일 때만 띄운다. 누르면 닫는다. Esc 로 닫는다.
- 촘촘한 목록의 행: 지연을 800ms 로 늘리고 "직후 즉시 표시"를 끈다. 마우스가 지나가는 행마다 연달아 뜨지 않게 한다.
- Ctrl/Shift 를 누른 채 들어오면 띄우지 않는다. 여러 개를 고르는 중이다.
- 끌고 있는 동안에는 띄우지 않는다.
- 툴팁에는 행동 안내를 길게 쓰지 않는다. 화면에 보이는 것을 되풀이하지 않는다.

```ts
type TipContent = string | { title: string; lines?: string[]; kbd?: string; delay?: number; warm?: boolean; quiet?: () => boolean };
// <button use:tip={{ title: '닫기', kbd: 'Esc' }}>
// <li use:tip={{ title: name, delay: 800, warm: false, quiet: () => selecting }}>
```

## 토스트

- 바탕은 본문 글자색, 글자는 바탕색으로 뒤집는다. 어느 테마에서도 화면과 구분된다.
- 긴 문구는 `overflow-wrap: anywhere` 로 꺾는다. 폭은 `max-width: min(420px, calc(100vw - 32px))`.
- 머무는 시간: 정보 약 2.5초, 오류 약 4초, 동작 단추가 있으면 8초. 동시에 3개까지.
- 마우스를 올린 동안은 사라지지 않는다. 누르면 닫힌다.
- 오류는 아이콘을 붙이고 `role="alert"` 를 준다. 컨테이너는 `aria-live="polite"`.
- 동작 단추("되돌리기")는 누르면 실행하고 닫는다. 토스트의 눌러서 닫기로 번지지 않게 전파를 막는다.
- 항목이 빠지면 남은 토스트가 미끄러져 자리를 잡는다.

```svelte
<div class="toast" class:error={t.kind === 'error'} role={t.kind === 'error' ? 'alert' : undefined}
  onclick={() => dismiss(t.id)} onpointerenter={() => hold(t.id)} onpointerleave={() => release(t.id, t.action ? 8000 : 2000)}>
  {#if t.kind === 'error'}<CircleAlert size={16} />{/if}<span>{t.text}</span>
  {#if t.action}<button class="toast-action" onclick={(e) => { e.stopPropagation(); dismiss(t.id); t.action.run(); }}>{t.action.label}</button>{/if}
</div>
```

```css
.toast .toast-action { border: 1px solid color-mix(in srgb, currentColor 55%, transparent); background: transparent; color: inherit; font-weight: 600; }
.toast .toast-action:hover { background: color-mix(in srgb, currentColor 18%, transparent); }
```

## 확인창

`confirm(message, okLabel, danger)` 형태의 함수 하나로 띄운다.

- 단추는 왼쪽이 취소, 오른쪽이 확정이다. 확정 라벨은 동사다.
- 위험하지 않은 확인은 포커스를 확정에 둔다. `danger` 이면 확정 단추를 위험색으로 채우고 포커스를 취소에 둔다.
- 다른 창 위에서 뜨므로 가장 높은 층에 둔다.
- 문구는 `white-space: pre-wrap; overflow-wrap: anywhere`.

```ts
const confirmPair = buttons.length === 2 && buttons[0] === '취소';
// 되돌릴 수 없는 동작은 Enter 한 번으로 실행되지 않게 취소에 둔다
btns[confirmPair && !danger ? btns.length - 1 : 0].focus();
```

## 단추

| 종류 | 모양 | 쓰임 |
|---|---|---|
| 주 단추 | 강조색 채움, 굵은 글자 | 화면의 주 동작 하나 |
| 기본 | 테두리 + 얕은 그림자 | 보조 동작 |
| 투명 | 배경·테두리 없음, 호버에서 배경 | 상단 바, 덜 중요한 동작. 열려 있으면(`aria-expanded`) 배경을 남긴다 |
| 아이콘 | 정사각, 투명 | 도구 모음. 켜진 상태(`aria-pressed`)는 강조색 옅은 배경 |
| 위험 | 평소 중립 또는 위험색 글자, 호버에서 위험색 배경·테두리 | 삭제·비우기 |
| 위험 확정 | 위험색 채움 | 확인 단계의 확정 단추만 |

- 크기는 기본 32px 와 작은 것 28px 두 가지다.
- 묶음 선택(둘 중 하나, 셋 중 하나)은 붙어 있는 단추 묶음으로 만들고 선택된 쪽에 강조색 옅은 배경과 테두리를 준다.
- 진행 중에는 단추 안에 스피너를 넣고 `aria-busy` 를 준다. 끝나면 사용자가 누른 경우에만 잠깐 체크로 바꾼다.
- 개수 배지는 단추 안 오른쪽에 `tabular-nums` 로 둔다.
- 좁은 화면에서 라벨이 있는 단추는 아이콘만 남길 수 있다. 그때 `aria-label` 이 있어야 한다.

## 스위치

켜짐/꺼짐 하나를 뜻하는 설정에 쓴다. 여러 항목 중 고르는 목록은 체크박스로 둔다.

- 라벨 전체를 눌러도 바뀐다.
- 라벨이 옆 칸에 따로 있으면 스위치만 그리고 `aria-label` 로 이름을 준다.
- 손잡이는 spring 으로 움직이고, 누르고 있는 동안 조금 늘어난다.
- 바뀐 값을 받는 콜백을 둔다: `onchange(checked)`. `toggleX()` 대신 `setX(value)` 를 부르게 된다.

```svelte
<button type="button" class="swl" role="switch" aria-checked={checked} aria-label={children ? undefined : label} {disabled} onclick={toggle}>
  <span class="track"><span class="knob"></span></span>
  {#if children}<span class="lbl">{@render children()}</span>{/if}
</button>
```

```css
.track { position: relative; flex: none; width: 34px; height: 20px; border-radius: 10px; border: 1px solid var(--border-strong); background: var(--border);
  transition: background-color var(--dur-2) var(--ease-out), border-color var(--dur-2) var(--ease-out); }
.knob { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.3);
  transition: transform var(--dur-2) var(--ease-spring), width var(--dur-1) var(--ease-out); }
.swl[aria-checked='true'] .track { background: var(--primary); border-color: var(--primary); }
.swl[aria-checked='true'] .knob { transform: translateX(14px); }
.swl:active:not(:disabled) .knob { width: 18px; }
.swl[aria-checked='true']:active:not(:disabled) .knob { transform: translateX(10px); }
.swl:focus-visible .track { outline: 2px solid var(--accent); outline-offset: 1px; }
```

프레임워크가 없으면 네이티브 체크박스를 시각적으로 숨기고 형제 요소를 트랙으로 그린다. `input:focus-visible + .track` 에 링을 건다.

## 탭

화면을 바꾸는 탭(패널 탭)과 문서를 여는 탭(문서 탭)은 규칙이 다르다.

공통.

- `role="tablist"` / `tab` / `tabpanel`, `aria-selected`, `aria-controls`. 활성 탭만 `tabindex="0"`. ←→ 로 이동하고 Home/End 로 양 끝에 간다.
- 숨은 패널은 `hidden` 으로 둔다.

패널 탭.

- 선택 표시는 밑줄이다. 밑줄은 가운데에서 펼쳐지거나 탭 사이를 미끄러진다.
- 탭에 확인이 필요한 일이 있으면 점 배지(`aria-hidden`)와 화면 밖 글자("확인 필요")를 함께 둔다.
- 패널 내용이 바뀔 때는 투명도만 짧게 바꾼다.

문서 탭.

- 선택 표시는 배경과 네 변 테두리다.
- 넘치면 스크롤바를 숨긴 가로 스크롤로 두고, 활성 탭이 가려지면 보이는 곳으로 끌어온다.
- 제목은 내용에서 자동으로 만든다(첫 줄의 앞부분). 사용자가 붙인 이름이 있으면 그것이 우선이다. 폭에 상한을 두고 줄임표로 자른다.
- 더블 클릭이나 F2 로 이름을 바꾼다.
- 닫기는 확인 없이 하고, 방금 닫은 탭을 다시 여는 단축키를 둔다. 마지막 탭은 닫지 않고 비운다.
- 탭마다 커서, 스크롤 위치, 실행 취소 내역을 따로 기억한다.
- 탭 목록, 이름, 활성 탭을 저장해서 새로 고침 뒤에 되살린다.

```css
.tabs { display: flex; gap: 2px; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.tabs::-webkit-scrollbar { display: none; }
.tab-item { flex: none; display: inline-flex; align-items: center; max-width: 200px; height: 28px;
  border: 1px solid transparent; border-radius: 8px; color: var(--muted); }
.tab-item.active { background: var(--bg); border-color: var(--border-strong); color: var(--text); }
.tab-title { display: block; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

```js
// 활성 탭이 바뀌면 보이는 곳으로
tabsEl.querySelector(`[data-tab-id="${id}"]`)?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
```

## 선택 막대

여러 개를 고르면 목록 위에 나타나는 일괄 작업 막대다. 선택 규칙과 함께 앱 전체에서 같은 것을 쓴다.

- `role="toolbar"`, `aria-label="선택한 항목 일괄 작업"`. 펼쳐지며 나타난다.
- 구성: `N개 선택` · 빈 칸 · 아이콘+라벨 단추들 · 위험 단추 · 선택 해제(X).
- 고른 행은 강조색 윤곽과 옅은 배경으로 표시한다. 지금 열린 행(배경만)과 구분된다.
- 터치용 선택 모드를 켜면 행마다 체크박스가 나타나고 행을 누르는 것이 고르기가 된다. Esc 로 끈다.

```css
.selbar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 0 8px; padding: 6px 8px; font-size: 12px;
  background: var(--accent-soft); border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent); border-radius: 8px; }
.selbar .spacer { flex: 1; }
.selbar button.danger:hover:not(:disabled) { color: var(--danger); border-color: var(--danger); }
@media (max-width: 720px) { .selbar > button:not(.icon-btn) { padding: 6px 10px; } }
```

## 그 자리 이름 변경

- 시작하면 입력에 포커스를 주고 전체를 선택한다.
- Enter 와 바깥 클릭은 확정, Esc 는 취소다. 한글 조합 중의 Enter 는 무시한다. Esc 는 전파를 막아 바깥 창이 닫히지 않게 한다.
- 값이 비었거나 그대로면 취소로 처리한다.
- 키보드로 끝냈을 때만 원래 행으로 포커스를 돌린다.

```ts
function finish(ok: boolean, byKey = false) {
  if (done) return; done = true;
  const v = draft.trim();
  if (ok && v && v !== value) onCommit(v, byKey); else onCancel(byKey);
}
function onKey(e: KeyboardEvent) {
  if (e.isComposing) return;
  if (e.key === 'Enter') { e.preventDefault(); finish(true, true); }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false, true); }
}
```

단일 클릭과 더블 클릭이 다른 뜻이면(단일 클릭은 펼치기, 더블 클릭은 이름 변경) 단일 클릭 동작을 약 220ms 미루고 더블 클릭이 오면 취소한다.

## 데이터 표

```css
table.grid { border-collapse: separate; border-spacing: 0; font: 12.5px/1.45 var(--font-code); min-width: 100%; }
.grid th, .grid td { padding: 4px 10px; border-bottom: 1px solid var(--border); border-right: 1px solid var(--border);
  white-space: nowrap; max-width: 420px; overflow: hidden; text-overflow: ellipsis; text-align: left; }
.grid th { position: sticky; top: 0; z-index: 1; background: var(--surface); font-weight: 600; }
.grid td.rn, .grid th.rn { text-align: right; color: var(--muted); background: var(--surface-2); position: sticky; left: 0; z-index: 2; }
.grid th.rn { z-index: 3; }
.grid td.num { text-align: right; font-variant-numeric: tabular-nums; }
.grid td.null { color: var(--muted); font-style: italic; }
.grid tbody tr:hover td:not(.rn) { background: var(--surface-2); }
```

- 머리글은 위에, 행 번호 열은 왼쪽에 고정한다. 모서리 칸의 층이 가장 높다. 고정된 칸의 테두리가 따라오려면 `border-collapse: separate` 여야 한다.
- 숫자는 오른쪽, 글자는 왼쪽으로 맞춘다.
- 값이 없음(NULL)은 빈 문자열과 구분되게 흐린 기울임 글자로 적는다. 이진 데이터는 크기로 적는다.
- 긴 칸은 폭 상한에서 줄임표로 자른다. 전체 값을 보는 경로(펼치기, 복사)를 따로 둔다.
- 행이 많으면 표시 상한을 고르게 하고, 상한에 닿았으면 그렇다고 적는다.
- 표 위의 줄에 `행 수 · 걸린 시간` 을 적고, 복사와 내려받기 단추를 둔다. 복사는 탭 구분, CSV 는 스프레드시트가 한글을 읽도록 BOM 을 붙인다.
- 결과가 여럿이면 칩으로 전환한다. 칩에 종류와 행 수를 적고 오류인 칩은 위험색으로 둔다. 하나뿐이면 칩을 숨긴다.
- 표를 문자열로 조립해 넣는다면 모든 값이 이스케이프를 거쳐야 한다.

## 분할선

두 영역의 크기를 조절하는 손잡이다.

```html
<div class="splitter" role="separator" aria-orientation="horizontal" aria-label="편집기 높이 조절" tabindex="0"></div>
```

```css
.splitter { flex: none; height: 9px; cursor: row-resize; position: relative; touch-action: none; }
.splitter::before { content: ''; position: absolute; left: 0; right: 0; top: 4px; height: 1px; background: var(--border-strong); }
.splitter:hover::before, .splitter.drag::before, .splitter:focus-visible::before { background: var(--accent); height: 3px; top: 3px; }
```

- 보이는 선은 1px 이고 잡히는 영역은 9px 쯤이다.
- `setPointerCapture` 로 끈다. 마우스와 터치가 같은 코드다.
- 방향키로 조금씩 움직인다. 더블 클릭은 기본 비율로 되돌린다.
- 최소·최대를 정한다. 창 크기가 바뀌어도 한쪽이 사라지지 않게 한다.
- 끌기가 끝날 때 크기를 저장한다.
- 영역 안에 `iframe` 이 있으면 끄는 동안 `pointer-events: none` 을 건다. 그러지 않으면 `iframe` 이 포인터를 가져가 끌기가 끊긴다. `user-select: none` 도 건다.
- 누르고 움직이지 않았으면(4px 미만) 클릭으로 본다. 클릭에 접기를 걸 수 있다. 접힌 영역에는 `inert` 를 건다.
- 좁은 화면에서는 숨기고 고정 높이로 쓴다.

## 접이식 패널

높이를 모르는 내용을 펼치고 접는다. 접힌 내용은 Tab 순서에서 빠져야 한다.

```css
.panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--dur-2) var(--ease-out); }
.panel[data-open='true'] { grid-template-rows: 1fr; }
.panel > .inner { min-height: 0; overflow: hidden; visibility: hidden; transition: visibility 0s linear var(--dur-2); }
.panel[data-open='true'] > .inner { visibility: visible; transition-delay: 0s; }
```

- 여는 단추에 `aria-expanded` 를 준다. 화살표 아이콘은 90도 돈다.
- 설정 묶음이면 접힌 상태에서 켜진 항목을 칩으로 요약한다.
- 열림 상태를 저장한다.
- 입력이 있을 때만 보이는 힌트 줄(단축키 안내)도 같은 방식으로 펼친다.

## 파일 드롭 영역

```js
const hasFiles = (e) => !!e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
export function bindDropZone(el, onFiles) {
  let depth = 0;                                           // 자식 요소를 지날 때의 깜빡임 방지
  const mark = (on) => el.toggleAttribute('data-dragover', on);
  el.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.stopPropagation(); depth++; mark(true); });
  el.addEventListener('dragover',  (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; });
  el.addEventListener('dragleave', (e) => { if (!hasFiles(e)) return; if (!(depth = Math.max(0, depth - 1))) mark(false); });
  el.addEventListener('drop', (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.stopPropagation(); depth = 0; mark(false);
    const files = [...e.dataTransfer.files]; if (files.length) onFiles(files); });   // await 전에 복사해 둔다
}
// 영역 밖에 놓았을 때 브라우저가 파일로 이동하지 않게
window.addEventListener('dragover', (e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'none'; } });
window.addEventListener('drop', (e) => { if (hasFiles(e)) e.preventDefault(); });
```

- 안내는 점선 테두리와 반투명 바탕 위에 제목 한 줄("여기에 놓아 새 문서 만들기")과 받는 형식을 적은 보조 줄로 구성한다. 안내 층에는 `pointer-events: none` 을 준다.
- 형식은 확장자나 MIME 으로 거른다. 알 수 없으면 읽어 보고 판단한다.
- 크기 상한을 읽기 전에 확인하고, 넘으면 상한을 알려 준다("최대 2MB").
- 여러 개를 놓았는데 일부만 받았으면 무엇을 열었는지 알린다.
- 파일 선택 입력은 처리 뒤 `value = ''` 로 비운다. 같은 파일을 다시 고를 수 있다.

## 진행 표시와 직렬 실행

```js
function setBusy(busy) {
  clearTimeout(busyTimer);
  if (busy) busyTimer = setTimeout(() => {              // 금방 끝나면 아예 띄우지 않는다
    btn.dataset.state = 'busy'; btn.setAttribute('aria-busy', 'true'); progress.classList.add('active');
  }, 150);
  else { delete btn.dataset.state; btn.removeAttribute('aria-busy'); progress.classList.remove('active'); }
}
async function run() {
  if (state.busy) { state.queued = true; return; }       // 실행 중이면 표시만 해 둔다
  state.busy = true; setBusy(true);
  try { /* … */ } finally { state.busy = false; setBusy(false); }
  if (state.queued) { state.queued = false; run(); }     // 끝난 뒤 최신 입력으로 한 번만
}
```

- 진행 표시는 실행 단추 안의 스피너와 결과 영역 위쪽의 얇은 막대다. 결과 영역을 가리지 않는다.
- 오래 걸리는 일에는 취소 단추를 둔다. 실행 단추가 비활성이 되는 동안 그 자리에 나타난다.
- 건수를 알 수 있으면 `(3/12)` 처럼 적는다.
- 요청에 번호를 매기거나 `AbortController` 를 써서 늦게 온 이전 응답을 버린다.

결과가 낡았는지는 입력과 모든 설정을 묶은 값을 실행 때의 값과 비교해서 안다.

```js
const currentKey = () => JSON.stringify([input.value, options]);
const stale = hasResult && currentKey() !== lastRunKey;   // 참이면 "입력이 바뀜" 표시 + 실행 단추 강조
```

## 오류 상자

사용자가 고쳐야 하는 오류를 풀어 쓴다. 오류를 해석하는 함수가 `{ title, detail, suggestion, range }` 를 돌려주고 상자가 그것을 그린다.

1. 제목: 무엇이 잘못됐는지. `'x' 열을 찾을 수 없습니다`
2. 설명: 왜 그런지.
3. 제안: 어떻게 고치는지. 비슷한 이름이 있으면 후보로 낸다(`'y' 를 찾으셨나요?`). 강조색 굵은 글자로 쓴다.
4. 문제의 문장: 오류 자리만 표시해서 보인다.
5. 맨 아래 작은 글자로 원문 오류와 "편집기에서 보기" 단추.

```css
.err-box { margin: 12px; padding: 10px 12px; border: 1px solid var(--danger-border); border-radius: 8px; background: var(--danger-bg); color: var(--danger); }
```

상자에는 `role="alert"` 를 준다. 같은 오류를 편집기 안에 물결 밑줄로도 표시한다. 오류와 경고는 색과 함께 선 모양이나 아이콘으로도 구분한다.

```css
.diag-error { text-decoration: underline wavy var(--danger); text-underline-offset: 3px; text-decoration-skip-ink: none; }
```

밑줄의 메시지를 호버에만 두면 키보드와 터치로 읽을 수 없다. 오류 상자나 목록에 같은 내용이 있어야 한다.

## 축소 미리보기

정해진 폭으로 그려야 하는 내용(메일, 인쇄물)을 좁은 패널에 보일 때 쓴다.

- 실제 폭으로 그린 뒤 `transform: scale()` 로 줄인다. 폭을 줄여서 그리면 내용의 반응형 규칙이 달라져 실제와 다르게 보인다.
- 배율은 `Math.min(1, available / renderWidth)`. 높이는 `height / scale` 로 보정한다. `ResizeObserver` 로 다시 계산한다.
- 숨은 탭에 있을 때(폭이 0)는 계산을 건너뛴다.
- 지금 폭과 배율을 배지로 보인다(`600px · 80%`).
- 미리보기 바탕은 페이지 바탕과 구분되게 한다.
- `iframe` 에는 `title` 을 준다.

## 지연 로딩

가끔 여는 큰 화면(설정, 이력, 통계)은 열 때 받는다.

- 받는 동안 열림 상태를 유지하고, 받지 못하면 토스트로 알리고 열림 상태를 되돌린다.
- 한 번 받은 뒤에는 계속 붙여 둔다. 닫힘 애니메이션이 끊기지 않는다.
- 그 화면이 맡던 백그라운드 일(예약 작업 시작)은 화면 밖으로 옮긴다. 열지 않아도 돌아야 한다.
