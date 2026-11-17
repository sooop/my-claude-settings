// (ui-motion 스킬 판: md-works 의 src/lib/motion.ts 에 '닫힘은 빠르게' 정책을 반영했다)
// 애니메이션 정책의 단일 출처: 패널·툴팁·모달·팝오버의 나타남/사라짐과, 자동 변경을 알리는 flash.
// 값은 모션 프로토타입에서 정한 것이다. 빌드 옵션(__ANIM__)이 꺼져 있거나 설정에서 껐으면 모든 효과가 길이 0 이다.
import { settings } from './store.svelte';

export const MOTION = {
  tooltip: { ms: 120, y: 2 },
  popover: { ms: 260, y: 4, scale: 0.95 },
  modal: { ms: 400, scale: 0.95, backdropDelay: 110 },
  panel: { ms: 220, x: 40 },
  toast: { ms: 200, y: 8 },
  list: { ms: 220 },
  flash: { ms: 900, alpha: 0.17, ring: 1 },
  insert: { appearMs: 260, gapMs: 0 },
  remove: { holdMs: 600, fadeMs: 190 },
  /** 닫힘: 열림보다 짧고(ease-in) 덜 움직인다. 종류별 길이(ms) */
  exit: { tooltip: 90, popover: 120, modal: 130, backdrop: 140, panel: 170, toast: 130, overlay: 120, slide: 200 },
  bounce: 0.4,
};

/** 빌드 옵션과 사용자 설정이 모두 켜져 있는가 */
export const animOn = () => __ANIM__ && settings.animations;
/** OS 의 '동작 줄이기': 이동·확대·스프링 없이 페이드만 한다 */
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- 이징 ----
/** cubic-bezier 와 같은 곡선 */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t: number) => ((ax * t + bx) * t + cx) * t;
  const Y = (t: number) => ((ay * t + by) * t + cy) * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 20; i++) {
      const d = X(t) - x;
      if (Math.abs(d) < 1e-5) break;
      if (d > 0) hi = t; else lo = t;
      t = (lo + hi) / 2;
    }
    return Y(t);
  };
}
/** 강한 ease-out: cubic-bezier(.2,.8,.2,1) */
export const easeOut = bezier(0.2, 0.8, 0.2, 1);

/** 감쇠 스프링의 단위 계단 응답(0→1, 1 을 넘었다 안착). 정규화 시간 t∈[0,1] */
export function spring(bounce = MOTION.bounce) {
  const z = Math.max(0.35, 1 - bounce), w0 = 6.4 / z, wd = w0 * Math.sqrt(1 - z * z);
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
  };
}
const springEase = spring();

// ---- 나타남/사라짐 (Svelte transition) ----
type Dir = { direction: 'in' | 'out' | 'both' };
type Fx = { delay?: number; duration: number; easing?: (t: number) => number; css: (t: number, u: number) => string };
const NONE: Fx = { duration: 0, css: () => '' };
const easeIn = (t: number) => t * t * t;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** 요소가 이미 가진 transform(위치 잡기용 등)을 보존하며 덧붙인다 */
function baseTransform(node: Element) {
  const t = getComputedStyle(node).transform;
  return t === 'none' ? '' : t + ' ';
}

interface Mv { ms: number; x?: number; y?: number; scale?: number; delayIn?: number; spring?: boolean; outMs?: number; outY?: number; outScale?: number }
function mover(node: Element, mv: Mv, { direction }: Dir): Fx {
  if (!animOn()) return NONE;
  const out = direction === 'out';
  const red = reduced();
  const base = baseTransform(node);
  const x = mv.x ?? 0, y = out ? (mv.outY ?? mv.y ?? 0) : (mv.y ?? 0), scale = out ? (mv.outScale ?? mv.scale ?? 1) : (mv.scale ?? 1);
  return {
    delay: out ? 0 : (mv.delayIn ?? 0),
    duration: out ? (red ? 90 : (mv.outMs ?? mv.ms)) : mv.ms,
    easing: out ? easeIn : mv.spring && !red && scale !== 1 ? springEase : easeOut,
    css: (t, u) => {
      if (red) return `opacity:${Math.min(1, t)}`;
      const s = 1 - (1 - scale) * u;
      return `opacity:${Math.min(1, t)};transform:${base}translate(${x * u}px,${y * u}px) scale(${s})`;
    },
  };
}

export const tipFx = (n: Element, _: unknown, o: Dir) => mover(n, { ms: MOTION.tooltip.ms, y: -MOTION.tooltip.y, outMs: MOTION.exit.tooltip }, o);
/** 팝오버·메뉴·컨텍스트 메뉴 */
export const popFx = (n: Element, _: unknown, o: Dir) => mover(n, { ms: MOTION.popover.ms, y: -MOTION.popover.y, scale: MOTION.popover.scale, spring: true, outMs: MOTION.exit.popover, outY: -3, outScale: 0.96 }, o);
/** 모달 본체 */
export const modalFx = (n: Element, _: unknown, o: Dir) => mover(n, { ms: MOTION.modal.ms, scale: MOTION.modal.scale, spring: true, outMs: MOTION.exit.modal, outScale: 0.97 }, o);
/** 모달 배경(딤): 나타날 때만 지연한다 */
export const backdropFx = (n: Element, _: unknown, o: Dir) => mover(n, { ms: MOTION.modal.ms, delayIn: MOTION.modal.backdropDelay, outMs: MOTION.exit.backdrop }, o);
/** 패널·시트. side: 어느 쪽에서 들어오는지 */
export function panelFx(n: Element, p: { side?: 'left' | 'right' | 'bottom' } | undefined, o: Dir) {
  const d = MOTION.panel.x, side = p?.side ?? 'right';
  return mover(n, { ms: MOTION.panel.ms, outMs: MOTION.exit.panel, x: side === 'left' ? -d : side === 'right' ? d : 0, y: side === 'bottom' ? d : 0 }, o);
}
/** 하위 목록·서브메뉴가 열리고 닫힐 때 높이가 펼쳐지는 슬라이드(폴더 접기·펼치기, 메뉴의 하위 항목) */
export function slideFx(node: Element, _?: unknown, { direction }: Dir = { direction: 'both' }): Fx {
  if (!animOn()) return NONE;
  const st = getComputedStyle(node), red = reduced();
  const h = (node as HTMLElement).offsetHeight;
  const pt = parseFloat(st.paddingTop), pb = parseFloat(st.paddingBottom), mt = parseFloat(st.marginTop), mb = parseFloat(st.marginBottom);
  return {
    duration: direction === 'out' ? MOTION.exit.slide : MOTION.panel.ms,
    easing: direction === 'out' ? easeInOut : easeOut,
    css: (t) => red
      ? `opacity:${t}`
      : `overflow:hidden;opacity:${Math.min(1, t * 1.4)};height:${t * h}px;padding-top:${t * pt}px;padding-bottom:${t * pb}px;margin-top:${t * mt}px;margin-bottom:${t * mb}px`,
  };
}
export const toastFx = (n: Element, _: unknown, o: Dir) => mover(n, { ms: MOTION.toast.ms, y: MOTION.toast.y, outMs: MOTION.exit.toast, outY: 4 }, o);
/** 화면 전체를 덮는 안내(파일 놓기 등): 살짝 커지며 나타난다 */
export const overlayFx = (n: Element, _: unknown, o: Dir) => mover(n, { ms: MOTION.list.ms, scale: 0.985, outMs: MOTION.exit.overlay }, o);

// ---- 목록 항목(카드)의 들고 남: flash 없이 흐려지며 나타나고 사라진다. 보기 전환·검색처럼 여러 장이 한꺼번에 바뀔 때 쓴다 ----
/** 이 수를 넘는 목록은 항목마다 위치를 재는 비용이 커서 효과를 끈다 */
export const LIST_FX_MAX = 80;
/** `{#each}` 항목에 transition:listFx 로 붙인다(자리 이동은 animate:flip 이 맡는다). off 이면 길이 0 */
export function listFx(_node: Element, p: { off?: boolean } | undefined, { direction }: Dir): Fx {
  if (!animOn() || p?.off) return NONE;
  const out = direction === 'out', red = reduced();
  return {
    duration: Math.round(out ? MOTION.list.ms * 0.75 : MOTION.list.ms),
    easing: easeOut,
    // animate:flip 이 같은 요소의 transform 을 쓰므로 겹치지 않게 개별 속성(scale·translate)으로 움직인다
    css: (t, u) => red ? `opacity:${t}` : `opacity:${t};scale:${1 - 0.04 * u};translate:0 ${out ? 0 : -6 * u}px`,
  };
}
/** animate:flip 의 인자: 다른 항목이 빠지거나 끼어들 때 남은 항목이 미끄러져 자리를 잡는다 */
export const flipFx = (off = false) => ({ duration: animOn() && !reduced() && !off ? MOTION.list.ms : 0, easing: easeOut });

// ---- 삽입·삭제 (flash 와 순서가 있는 효과) ----
export type FlashKind = 'info' | 'success' | 'accent' | 'warn' | 'danger';
const tint = (kind: FlashKind, a: number) => {
  const bg = `color-mix(in srgb,var(--fx-${kind}) ${(a * 100).toFixed(1)}%,transparent)`;
  return `background-image:linear-gradient(${bg},${bg});box-shadow:0 0 0 ${MOTION.flash.ring}px color-mix(in srgb,var(--fx-${kind}) ${Math.min(100, a * 400).toFixed(1)}%,transparent);`;
};
/** 잠시 유지한 뒤 사라지는 곡선: 0→1 (12%) → 유지(35%) → 0 */
const hold = (p: number) => (p < 0.12 ? p / 0.12 : p < 0.35 ? 1 : 1 - (p - 0.35) / 0.65);

/** 삽입: ① 요소가 펼쳐지며 나타남 → ② 간격 → ③ success flash. `{#each}` 항목에 in:insertFx 로 붙인다 */
export function insertFx(node: Element, p?: { collapse?: boolean }, _o?: Dir): Fx {
  if (!animOn()) return NONE;
  const { appearMs, gapMs } = MOTION.insert, f = MOTION.flash.ms;
  const total = appearMs + gapMs + f, red = reduced();
  const h = (node as HTMLElement).scrollHeight;
  return {
    duration: total,
    easing: (t) => t, // 구간별로 직접 계산한다
    css: (t) => {
      const ms = t * total;
      const e = easeOut(Math.min(1, ms / appearMs));
      const flashP = Math.max(0, (ms - appearMs - gapMs) / f);
      const fl = ms > appearMs + gapMs ? hold(flashP) * MOTION.flash.alpha : 0;
      let css = `opacity:${e};`;
      if (!red) css += `transform:translateY(${(1 - e) * -4}px);`;
      if (p?.collapse && !red) css += `max-height:${e * h}px;overflow:hidden;`;
      if (fl > 0.002) css += tint('success', fl);
      return css;
    },
  };
}

/** 삭제: ① danger flash 로 대상을 알림 → ② fade-off. `{#each}` 항목에 out:removeFx 로 붙인다 */
export function removeFx(node: Element, p?: { collapse?: boolean }, _o?: Dir): Fx {
  if (!animOn()) return NONE;
  const { holdMs, fadeMs } = MOTION.remove, total = holdMs + fadeMs, red = reduced();
  const h = (node as HTMLElement).scrollHeight;
  return {
    duration: total,
    easing: (t) => t,
    // out 의 t 는 1→0 이다: 경과 시간 = (1-t)*total
    css: (t) => {
      const ms = (1 - t) * total;
      if (ms < holdMs) return tint('danger', Math.min(1, ms / (holdMs * 0.2)) * MOTION.flash.alpha);
      const e = easeOut((ms - holdMs) / fadeMs);
      let css = `opacity:${1 - e};${tint('danger', MOTION.flash.alpha * (1 - e))}`;
      if (!red) css += `transform:translateX(${e * 8}px);`;
      if (p?.collapse && !red) css += `max-height:${(1 - e) * h}px;overflow:hidden;`;
      return css;
    },
  };
}

// ---- flash (제자리에서 자동으로 바뀐 영역 알림) ----
/** 사용자 조작으로 UI·콘텐츠가 자동으로 바뀌었을 때 쓰는 액션 유형 → 의미색 */
export const FLASH_ACTION = {
  convert: 'info', // 구조 변환(목록↔표, 선택 영역→표)
  insert: 'success', // 삽입·생성·붙여넣기
  tidy: 'accent', // 자동 정리·보정(서식 정리, 정렬)
  conflict: 'warn', // 충돌·경고
  remove: 'danger', // 삭제·되돌림
} as const satisfies Record<string, FlashKind>;
export type FlashAction = keyof typeof FLASH_ACTION;

/**
 * target 영역(요소 또는 화면 좌표 사각형)에 의미색 flash 를 한 번 띄운다. 요소를 건드리지 않고 위에 겹치는 상자를 쓰므로
 * ProseMirror 가 다시 그리는 DOM 에도 안전하다. 끝나면 상자를 치운다.
 */
export function flash(target: Element | DOMRect | null | undefined, action: FlashAction | FlashKind = 'convert'): Promise<void> {
  if (!target || !animOn()) return Promise.resolve();
  const kind = (action in FLASH_ACTION ? FLASH_ACTION[action as FlashAction] : action) as FlashKind;
  const r = target instanceof Element ? target.getBoundingClientRect() : target;
  if (!r.width && !r.height) return Promise.resolve();
  const box = document.createElement('div');
  const col = `var(--fx-${kind})`, pct = (MOTION.flash.alpha * 100).toFixed(1);
  Object.assign(box.style, {
    position: 'fixed', pointerEvents: 'none', zIndex: '95', borderRadius: '8px',
    left: `${r.left - 3}px`, top: `${r.top - 3}px`, width: `${r.width + 6}px`, height: `${r.height + 6}px`,
    background: `color-mix(in srgb, ${col} ${pct}%, transparent)`,
    boxShadow: `0 0 0 ${MOTION.flash.ring}px color-mix(in srgb, ${col} 70%, transparent)`,
  });
  document.body.appendChild(box);
  const frames: Keyframe[] = reduced()
    ? [{ opacity: 0 }, { opacity: 0.6, offset: 0.3 }, { opacity: 0 }]
    : [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.35 }, { opacity: 0, offset: 1 }];
  const done = () => box.remove();
  return box.animate(frames, { duration: MOTION.flash.ms, easing: 'ease-out' }).finished.then(done, done).then(() => undefined);
}

// ---- Svelte 밖(JS 로 만든 DOM)의 팝오버 ----
/** JS 가 만든 메뉴(표 메뉴 등)에 popFx 와 같은 나타남/사라짐을 Web Animations 로 재생한다. 사라짐이 끝나면 resolve */
export function playPop(el: HTMLElement, dir: 'in' | 'out'): Promise<void> {
  if (!animOn()) return Promise.resolve();
  const out = dir === 'out', red = reduced();
  const ease = out ? easeIn : !red ? springEase : easeOut, { ms } = MOTION.popover;
  const y = out ? 3 : MOTION.popover.y, scale = out ? 0.96 : MOTION.popover.scale;
  const frames: Keyframe[] = [];
  for (let i = 0; i <= 24; i++) {
    const e = ease(i / 24), u = 1 - e, o = Math.min(1, e);
    frames.push(red ? { opacity: out ? 1 - o : o } : { opacity: out ? 1 - o : o, transform: `translateY(${out ? -y * e : -y * u}px) scale(${out ? 1 - (1 - scale) * e : 1 - (1 - scale) * u})` });
  }
  return el.animate(frames, { duration: out ? (red ? 90 : MOTION.exit.popover) : ms, easing: 'linear' }).finished.then(() => undefined, () => undefined);
}

// ---- 끌어서 놓기: 고스트가 놓은 자리로 날아가 앉는다 ----
export interface FlyRect { left: number; top: number; width: number; height: number }
/**
 * 끌던 항목의 고스트(복제본)를 놓은 위치(from)에서 들어갈 자리(to)로 날려 보낸 뒤 치운다. 원래 있던 자리에서는 출발하지 않는다.
 * into 이면 폴더 안으로 들어가는 것이라 폴더 행 쪽으로 줄어들며 사라진다. 끝나면 resolve
 */
export function flyGhost(el: HTMLElement, from: FlyRect, to: FlyRect, into = false): Promise<void> {
  const done = () => { el.remove(); };
  if (!animOn()) { done(); return Promise.resolve(); }
  const red = reduced();
  Object.assign(el.style, { position: 'fixed', margin: '0', left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, zIndex: '120', pointerEvents: 'none', transformOrigin: 'top left' });
  document.body.appendChild(el);
  const dx = to.left - from.left, dy = to.top - from.top;
  const frames: Keyframe[] = red
    ? [{ opacity: 1 }, { opacity: 0 }]
    : [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(${into ? 0.6 : 1})`, opacity: into ? 0 : 1 },
      ];
  return el.animate(frames, { duration: MOTION.popover.ms, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' }).finished.then(done, done).then(() => undefined);
}
