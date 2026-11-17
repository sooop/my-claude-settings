// 쪽 구조 조작(순서 바꾸기·삭제·복제·회전·되돌리기·보내기)의 FLIP 연출.
// 쪽 구조가 바뀌면 문서 화면이 통째로 다시 만들어지고 비트맵도 새로 그린다. 그래서 칸을 직접 움직이지 않고,
// 조작 직전 "보이는 쪽"의 비트맵을 복사한 비행체(flyer)를 격자 위에 띄워 옛 자리에서 새 자리로 스프링으로 옮긴다.
// 비행체는 조작이 끝나길 기다리지 않고 바로 출발한다(목적지는 쪽 크기·배열 산술로 미리 안다). 실제 칸은 비행체가 내려앉고
// 새 렌더가 도착할 때까지 가려 두었다가 부드럽게 넘겨 준다. transform/opacity 만 움직이고, 화면에 보이는 쪽만 다룬다.
import type { PageSize } from '../../engine/adapter';
import { recordPlan, type Plan, type PlanEntry } from './plan';
export { duplicatePlan, invertPlan, noteState, planFor, removePlan, reorderPlan, rotatePlan } from './plan';
export type { Plan, PlanEntry } from './plan';
import { EASE, pulse, reduced, springOf } from './index';
import type { ScreenRect } from './drag-ghost';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---------- 호스트(격자·썸네일 패널)가 구현하는 면 ----------
export interface PageHost {
  /** 비행체를 얹는 층: 내용 좌표계의 원점에 놓인 position:absolute 요소 */
  layer(): HTMLElement | null;
  sizes(): PageSize[];
  /** 주어진 쪽 크기 배열에서 idx 번 쪽 얼굴의 내용 좌표 사각형 */
  frameRect(idx: number, sizes: PageSize[]): Rect;
  /** 보이는 내용 좌표 띠 */
  viewport(): { top: number; bottom: number };
  canvas(idx: number): HTMLCanvasElement | null;
  checked(idx: number): boolean;
  setHolding(on: boolean): void;
}

let host: PageHost | null = null;
export function registerHost(h: PageHost): () => void {
  host = h;
  return () => {
    if (host === h) {
      finish();
      host = null;
    }
  };
}

interface Flyer {
  el: HTMLDivElement;
  anim: Animation | null;
  /** 내려앉는 자리의 조작 후 쪽 번호(사라지는 쪽은 null) */
  to: number | null;
}
interface Active {
  flyers: Flyer[];
  layer: HTMLElement;
  h: PageHost;
  landed: boolean;
  updated: boolean;
  updatedAt: number;
  timer: number;
  settle: number;
  t0: number;
}
let active: Active | null = null;

const MAX_FLYERS = 70;
const MARGIN = 40;

/** 진행 중인 연출을 즉시 끝낸다(연속 조작 시 이어받기) */
export function finish() {
  const a = active;
  if (!a) return;
  active = null;
  clearTimeout(a.timer);
  clearTimeout(a.settle);
  for (const f of a.flyers) {
    f.anim?.cancel();
    f.el.remove();
  }
  a.h.setHolding(false);
}

/** 호스트가 문서 화면이 다시 만들어졌음을 알린다 */
export function notifyUpdated() {
  const a = active;
  if (!a || a.updated) return;
  a.updated = true;
  a.updatedAt = performance.now();
  maybeRelease();
}

function maybeRelease() {
  const a = active;
  if (!a || !a.landed || !a.updated) return;
  // 비행체가 덮고 있는 새 칸이 모두 그려진 뒤에 넘겨 준다. 그려지기 전에 넘기면 쪽이 빈 칸으로 사라졌다가 다시 나타난다
  // (그린 장수로 세면 같은 문서의 본문 뷰어가 그린 것까지 세어져 너무 일찍 넘긴다). 오래 걸리면 기다리지 않는다.
  const drawn = a.flyers.every((f) => {
    if (f.to == null) return true;
    const cv = a.h.canvas(f.to);
    return !cv || cv.width > 0;
  });
  if (!drawn && performance.now() - a.updatedAt < 2000) {
    clearTimeout(a.settle);
    a.settle = window.setTimeout(maybeRelease, 40);
    return;
  }
  const cur = a;
  active = null;
  clearTimeout(cur.timer);
  cur.h.setHolding(false);
  for (const f of cur.flyers) {
    const x = f.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'linear', fill: 'forwards' });
    x.onfinish = () => f.el.remove();
  }
}

function copyCanvas(src: HTMLCanvasElement | null, w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.style.cssText = 'display:block;width:100%;height:100%;';
  if (src && src.width > 0 && src.height > 0) {
    const dpr = window.devicePixelRatio || 1;
    const k = Math.min(1, (w * dpr * 1.1) / src.width);
    cv.width = Math.max(1, Math.round(src.width * k));
    cv.height = Math.max(1, Math.round(src.height * k));
    cv.getContext('2d')?.drawImage(src, 0, 0, cv.width, cv.height);
  }
  return cv;
}

function makeFlyer(layer: HTMLElement, w0: number, h0: number, src: HTMLCanvasElement | null, checked: boolean, lifted: boolean, animated = true): HTMLDivElement {
  const el = document.createElement('div');
  el.setAttribute('data-flyer', '');
  el.style.cssText = `position:absolute;left:0;top:0;width:${w0}px;height:${h0}px;transform-origin:50% 50%;border-radius:4px;overflow:hidden;background:#fff;border:1px solid var(--border);box-shadow:${lifted ? 'var(--shadow-2)' : 'none'};pointer-events:none;${animated ? 'will-change:transform;' : ''}z-index:${lifted ? 3 : 1};${checked ? 'outline:3px solid var(--fg);' : ''}`;
  el.appendChild(copyCanvas(src, w0, h0));
  layer.appendChild(el);
  return el;
}

const tf = (r: Rect, w0: number, h0: number, rot: number, s: number) => `translate(${r.x + r.w / 2 - w0 / 2}px, ${r.y + r.h / 2 - h0 / 2}px) rotate(${rot}deg) scale(${s})`;

export interface RunOpts {
  /** 놓은 순간의 고스트 자리(화면 좌표): 옮긴 쪽의 비행체가 이 자리에서 출발한다. 키는 조작 전 번호 */
  starts?: Map<number, ScreenRect>;
}

/** 조작을 연출한다. 연출할 호스트가 없거나 모션 줄이기면 false(조작은 그대로 하면 된다) */
export function run(plan: Plan, o: RunOpts = {}, ctx?: { docKey: number; stateId: number }): boolean {
  if (ctx) recordPlan(ctx.docKey, ctx.stateId, plan);
  const h = host;
  if (!h || reduced()) return false;
  const layer = h.layer();
  if (!layer) return false;
  finish();

  const vp = h.viewport();
  const inView = (r: Rect) => r.y + r.h > vp.top - MARGIN && r.y < vp.bottom + MARGIN;
  const lr = layer.getBoundingClientRect();
  const sp = springOf('glide');

  // 출발·도착 사각형을 구해 보이는 것만 남긴다
  interface Job { e: PlanEntry; a: Rect | null; b: Rect | null; lifted: boolean; src: HTMLCanvasElement | null; checked: boolean }
  const jobs: Job[] = [];
  for (const e of plan.entries) {
    let a: Rect | null = null;
    let b: Rect | null = null;
    let src: HTMLCanvasElement | null = null;
    let checked = false;
    let lifted = false;
    const fromIdx = e.from ?? e.via ?? null;
    if (fromIdx != null) {
      const r0 = h.frameRect(fromIdx, plan.oldSizes);
      src = h.canvas(fromIdx);
      checked = h.checked(fromIdx);
      const st = e.from != null ? o.starts?.get(e.from) : undefined;
      if (st) {
        a = { x: st.x - lr.left, y: st.y - lr.top, w: st.w, h: st.h };
        lifted = true;
      } else if (inView(r0)) a = r0;
    }
    if (e.to != null) {
      const r1 = h.frameRect(e.to, plan.newSizes);
      if (inView(r1)) b = r1;
    }
    if (!a && !b) continue;
    if (e.from == null && !b) continue;
    if (e.to == null && plan.skipExit) continue;
    jobs.push({ e, a, b, lifted, src, checked });
  }
  if (!jobs.length) return false;
  jobs.sort((x, y) => (x.e.to ?? x.e.from ?? 0) - (y.e.to ?? y.e.from ?? 0));
  if (jobs.length > MAX_FLYERS) jobs.length = MAX_FLYERS;

  h.setHolding(true);
  const flyers: Flyer[] = [];
  let pending = 0;
  const act: Active = { flyers, layer, h, landed: false, updated: false, updatedAt: 0, timer: 0, settle: 0, t0: performance.now() };
  active = act;

  jobs.forEach((j, n) => {
    const base = j.a ?? j.b!;
    const w0 = base.w;
    const h0 = base.h;
    // 자리가 그대로인 쪽은 움직이지 않는 정지 비행체로 둔다(레이어·애니메이션을 만들지 않는다: 보이는 칸이 많아도 가볍다)
    const still = !!(j.a && j.b && !j.e.rot && !j.lifted && Math.abs(j.a.x - j.b.x) < 0.5 && Math.abs(j.a.y - j.b.y) < 0.5 && Math.abs(j.a.w - j.b.w) < 0.5 && Math.abs(j.a.h - j.b.h) < 0.5);
    const el = makeFlyer(layer, w0, h0, j.src, j.checked, j.lifted, !still);
    if (still) {
      el.style.transform = tf(j.b!, w0, h0, 0, 1);
      flyers.push({ el, anim: null, to: j.e.to });
      return;
    }
    const rot = j.e.rot ?? 0;
    const delay = j.lifted ? 0 : Math.min(n * 7, 90);
    const odd = Math.abs(rot / 90) % 2 === 1;
    const scaleTo = (r: Rect) => (odd ? r.h / w0 : r.w / w0);
    let frames: Keyframe[];
    if (j.a && j.b) {
      const s1 = scaleTo(j.b);
      frames = [
        { transform: tf(j.a, w0, h0, 0, 1) },
        { transform: tf(j.b, w0, h0, rot, s1) },
      ];
      // 이동·회전·크기는 두 키프레임 사이를 한 번에 보간한다(튕김은 스프링 이징 곡선에서 나온다)
    } else if (j.a && !j.b) {
      // 사라진다: 줄어들며 살짝 떠올라 흐려진다
      const out = { x: j.a.x, y: j.a.y - 10, w: j.a.w, h: j.a.h };
      frames = [
        { transform: tf(j.a, w0, h0, 0, 1), opacity: 1 },
        { transform: tf(out, w0, h0, 0, 0.55), opacity: 0 },
      ];
    } else {
      // 생긴다: 원본에서 갈라져 나오거나(via) 작게 시작해 자리를 잡는다
      const b = j.b!;
      const from = j.e.via != null && j.a ? j.a : { x: b.x + b.w * 0.1, y: b.y + b.h * 0.1, w: b.w * 0.8, h: b.h * 0.8 };
      frames = [
        { transform: tf(from, w0, h0, 0, j.a ? 1 : 0.8), opacity: j.a ? 1 : 0 },
        { transform: tf(b, w0, h0, 0, 1), opacity: 1 },
      ];
      if (j.a) el.style.zIndex = '0';
    }
    el.style.transform = String(frames[0].transform);
    const anim = el.animate(frames, {
      duration: j.e.to == null ? 240 : sp.duration,
      delay,
      easing: j.e.to == null ? EASE.in : sp.css,
      fill: 'forwards',
    });
    pending++;
    const done = () => {
      if (--pending === 0 && active === act) {
        act.landed = true;
        maybeRelease();
      }
    };
    anim.onfinish = done;
    anim.oncancel = () => {};
    flyers.push({ el, anim, to: j.b ? j.e.to : null });
  });

  if (pending === 0) act.landed = true; // 움직일 것이 하나도 없으면 새 화면만 기다린다

  // 연출이 끝나도 새 화면이 오지 않으면(조작 실패·지연) 5초 뒤 포기한다
  act.timer = window.setTimeout(() => {
    if (active === act) {
      act.updated = true;
      act.landed = true;
      maybeRelease();
    }
  }, 5000);
  return true;
}

/**
 * 고른 쪽이 대상 칸(탭·파일 목록 항목·새 파일 칸)으로 날아가 빨려 들어가고, 대상이 받는 반응(펄스)을 보인다.
 * 원본 쪽은 그대로 둔다(이동이면 쪽 삭제 연출이 따로 이어진다).
 */
export function flyToTarget(indices: number[], target: Element | null, from?: ScreenRect[]) {
  const h = host;
  if (!h || !target || reduced()) {
    pulse(target, 1);
    return;
  }
  const vp = h.viewport();
  const sizes = h.sizes();
  const lr = h.layer()?.getBoundingClientRect();
  if (!lr) return;
  const tr = target.getBoundingClientRect();
  const tx = tr.left + Math.min(tr.width / 2, 120);
  const ty = tr.top + tr.height / 2;
  const layer = document.createElement('div');
  layer.setAttribute('data-flyer-layer', '');
  layer.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:75;pointer-events:none;';
  document.body.appendChild(layer);
  const picks = indices.filter((i) => {
    const r = h.frameRect(i, sizes);
    return r.y + r.h > vp.top && r.y < vp.bottom;
  }).slice(0, 12);
  if (!picks.length) {
    layer.remove();
    pulse(target, 1);
    return;
  }
  let left = picks.length;
  picks.forEach((idx, n) => {
    const r0 = h.frameRect(idx, sizes);
    const a: Rect = from?.[Math.min(n, from.length - 1)] ?? { x: lr.left + r0.x, y: lr.top + r0.y, w: r0.w, h: r0.h };
    const el = makeFlyer(layer, a.w, a.h, h.canvas(idx), false, true);
    const mid: Rect = { x: a.x, y: a.y - 14, w: a.w, h: a.h };
    const end: Rect = { x: tx - 4, y: ty - 4, w: 8, h: 8 };
    const s1 = Math.max(0.04, Math.min(0.2, 28 / Math.max(a.w, a.h)));
    const rot = (n % 2 ? 1 : -1) * (4 + n * 2);
    const anim = el.animate(
      [
        { transform: tf(a, a.w, a.h, 0, 1), opacity: 1, offset: 0, easing: 'cubic-bezier(.2,.8,.3,1)' },
        { transform: tf(mid, a.w, a.h, rot * 0.5, 1.06), opacity: 1, offset: 0.22, easing: EASE.suck },
        { transform: tf(end, a.w, a.h, rot * 2, s1), opacity: 0.25, offset: 1 },
      ],
      { duration: 560, delay: n * 55, fill: 'forwards' },
    );
    anim.onfinish = () => {
      el.remove();
      if (n === 0) pulse(target, 1.6);
      if (--left === 0) layer.remove();
    };
  });
}

