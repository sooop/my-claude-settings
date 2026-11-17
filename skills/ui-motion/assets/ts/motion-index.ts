// 앱 전체가 쓰는 모션 모듈: 모션 줄이기 판정, WAAPI 보조, Svelte 전환(팝오버·서랍·대화상자·탭), 액션.
// 스프링 수학은 spring.ts, 쪽 이동 연출은 page-flip.ts, 드래그 고스트는 drag-ghost.ts.
import type { Action } from 'svelte/action';
import { cubicIn, DUR, EASE, solveSpring, SPRING, type SpringName, type SpringSpec } from './spring';

export { DUR, EASE, SPRING, solveSpring, type SpringName, type SpringSpec };

const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
/** 이동·크기 모션을 쓰지 않는 환경인가(짧은 페이드만 남긴다) */
export const reduced = (): boolean => !!mq?.matches;

export const springOf = (s: SpringName | SpringSpec) => solveSpring(typeof s === 'string' ? SPRING[s] : s);

export interface AnimOpts {
  spring?: SpringName | SpringSpec;
  /** spring 이 없을 때 */
  easing?: string;
  duration?: number;
  delay?: number;
  fill?: FillMode;
}

/**
 * WAAPI 래퍼. 모션 줄이기에서는 transform 키프레임을 버리고 opacity 만 짧게 남긴다(없으면 아무것도 하지 않는다).
 * 끝난 애니메이션은 호출자가 cancel 할 수 있도록 그대로 돌려준다.
 */
export function animate(el: Element, frames: Keyframe[], o: AnimOpts = {}): Animation | null {
  if (!el.animate) return null;
  if (reduced()) {
    const op = frames.filter((f) => f.opacity != null).map((f) => ({ opacity: f.opacity }));
    if (op.length < 2) return null;
    return el.animate(op, { duration: 120, easing: 'linear', fill: o.fill ?? 'both', delay: Math.min(o.delay ?? 0, 60) });
  }
  const sp = o.spring ? springOf(o.spring) : null;
  return el.animate(frames, {
    duration: o.duration ?? sp?.duration ?? DUR.base,
    easing: sp ? sp.css : (o.easing ?? EASE.out),
    delay: o.delay ?? 0,
    fill: o.fill ?? 'both',
  });
}

// ---------- Svelte 전환 ----------
// 주의: 팝오버·서랍은 부모의 {#if} 가 켜고 끄므로 transition:fn|global 로 쓴다.

interface PopOpts {
  /** transform-origin: 앵커에 가까운 모서리 */
  origin?: string;
  /** 시작 크기 */
  from?: number;
  /** 시작할 때 앵커 쪽으로 치우친 거리(px) */
  y?: number;
}

/** 앵커 지점을 원점으로 자라나는 스프링(들어올 때) */
export function popIn(_n: Element, { origin = 'top left', from = 0.9, y = -6 }: PopOpts = {}) {
  if (reduced()) return { duration: 120, css: (t: number) => `opacity:${t}` };
  const sp = solveSpring(SPRING.pop);
  return {
    duration: sp.duration,
    easing: sp.fn,
    css: (t: number) => `transform-origin:${origin};opacity:${Math.min(1, t * 2.4)};transform:translateY(${(1 - t) * y}px) scale(${from + (1 - from) * t})`,
  };
}

/** 닫힐 때는 더 빠르게 접힌다 */
export function popOut(_n: Element, { origin = 'top left', from = 0.96, y = -3 }: PopOpts = {}) {
  if (reduced()) return { duration: 90, css: (t: number) => `opacity:${t}` };
  return {
    duration: 120,
    easing: cubicIn,
    css: (t: number) => `transform-origin:${origin};opacity:${t};transform:translateY(${(1 - t) * y}px) scale(${from + (1 - from) * t})`,
  };
}

/** 서랍: 오른쪽에서 묵직하게 미끄러져 들어온다 */
export function drawerIn(_n: Element, { dist = 340 }: { dist?: number } = {}) {
  if (reduced()) return { duration: 140, css: (t: number) => `opacity:${t}` };
  const sp = solveSpring(SPRING.heavy);
  return { duration: sp.duration, easing: sp.fn, css: (t: number) => `transform:translateX(${(1 - t) * dist}px)` };
}
export function drawerOut(_n: Element, { dist = 340 }: { dist?: number } = {}) {
  if (reduced()) return { duration: 100, css: (t: number) => `opacity:${t}` };
  return { duration: 170, easing: cubicIn, css: (t: number) => `transform:translateX(${(1 - t) * dist}px)` };
}

/** 서랍 뒤 배경 딤 */
export function scrimFade(_n: Element, { out = false }: { out?: boolean } = {}) {
  return { duration: out ? 140 : 240, css: (t: number) => `opacity:${t}` };
}

/** 안내 카드: 앵커 쪽에서 살짝 떠오르며 등장, 퇴장은 빠르게 */
export function noticeIn(_n: Element, { y = -8 }: { y?: number } = {}) {
  if (reduced()) return { duration: 120, css: (t: number) => `opacity:${t}` };
  const sp = solveSpring(SPRING.bouncy);
  return { duration: sp.duration, easing: sp.fn, css: (t: number) => `opacity:${Math.min(1, t * 3)};transform:translateY(${(1 - t) * y}px) scale(${0.94 + 0.06 * t})` };
}
export function noticeOut(_n: Element, { y = -4 }: { y?: number } = {}) {
  if (reduced()) return { duration: 90, css: (t: number) => `opacity:${t}` };
  return { duration: 130, easing: cubicIn, css: (t: number) => `opacity:${t};transform:translateY(${(1 - t) * y}px) scale(${0.97 + 0.03 * t})` };
}

/** 탭·파일 항목이 폭을 키우며 들어온다 / 줄어들며 사라진다(수평 스트립이라 폭만 건드린다) */
export function growIn(node: Element, { w = 240, minW = 0 }: { w?: number; minW?: number } = {}) {
  if (reduced()) return { duration: 120, css: (t: number) => `opacity:${t}` };
  const sp = solveSpring(SPRING.glide);
  void node;
  return {
    duration: sp.duration,
    easing: sp.fn,
    css: (t: number) => `overflow:hidden;opacity:${Math.min(1, Math.max(0, t * 2))};max-width:${Math.max(0, t) * w}px;min-width:${Math.max(0, t) * minW}px;transform:scale(${0.88 + 0.12 * Math.min(1, t)})`,
  };
}
export function shrinkOut(_n: Element, { w = 240, minW = 0 }: { w?: number; minW?: number } = {}) {
  if (reduced()) return { duration: 90, css: (t: number) => `opacity:${t}` };
  return { duration: 200, easing: EASE_IN_OUT_FN, css: (t: number) => `overflow:hidden;opacity:${t};max-width:${t * w}px;min-width:${t * minW}px;transform:scale(${0.88 + 0.12 * t})` };
}
const EASE_IN_OUT_FN = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** 세로 목록 항목(파일 목록·병합 목록)이 높이를 키우며 들어온다 */
export function slideDownIn(_n: Element, { h = 52 }: { h?: number } = {}) {
  if (reduced()) return { duration: 120, css: (t: number) => `opacity:${t}` };
  const sp = solveSpring(SPRING.glide);
  return { duration: sp.duration, easing: sp.fn, css: (t: number) => `overflow:hidden;opacity:${Math.min(1, t * 2)};max-height:${Math.max(0, t) * h}px;transform:scale(${0.94 + 0.06 * Math.min(1, t)})` };
}
export function slideUpOut(_n: Element, { h = 52 }: { h?: number } = {}) {
  if (reduced()) return { duration: 90, css: (t: number) => `opacity:${t}` };
  return { duration: 200, easing: EASE_IN_OUT_FN, css: (t: number) => `overflow:hidden;opacity:${t};max-height:${t * h}px;transform:scale(${0.94 + 0.06 * t})` };
}

// ---------- 액션 ----------

/** range 입력의 채움선 위치(--p)를 값에 맞춰 둔다. 값이 바뀔 때마다 param 으로 알린다 */
export const rangeFill: Action<HTMLInputElement, unknown> = (node) => {
  const set = () => {
    const min = Number(node.min || 0);
    const max = Number(node.max || 100);
    const v = Number(node.value);
    node.style.setProperty('--p', `${max > min ? ((v - min) / (max - min)) * 100 : 0}%`);
  };
  set();
  node.addEventListener('input', set);
  return {
    update: set,
    destroy: () => node.removeEventListener('input', set),
  };
};

/** 요소를 한 번 튕긴다(대상이 받는 반응). 같은 요소에 겹쳐 불려도 이전 것을 이어받는다 */
const pulsing = new WeakMap<Element, Animation>();
export function pulse(el: Element | null | undefined, strength = 1) {
  if (!el) return;
  pulsing.get(el)?.cancel();
  const s = 1 + 0.05 * strength;
  const a = animate(el, [{ transform: 'scale(1)' }, { transform: `scale(${s})`, offset: 0.35 }, { transform: 'scale(1)' }], { spring: 'bouncy', fill: 'none' });
  if (a) pulsing.set(el, a);
  el.setAttribute('data-pulse', '');
  setTimeout(() => el.removeAttribute('data-pulse'), 620);
}
