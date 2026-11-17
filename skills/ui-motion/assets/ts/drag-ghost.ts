// 쪽 드래그 고스트. 이미 그려진 썸네일 캔버스의 비트맵을 복사해 쓴다(재렌더 없음).
// 집으면 떠오르고(크기·그림자·기울기), 포인터를 스프링으로 따라오며 속도에 따라 기울고, 여러 쪽이면 최대 4장이 부채꼴로 겹치고 개수 배지가 튀어 나온다.
// 놓으면 drop() 이 현재 모습을 넘겨주고(쪽 이동 연출이 이어받는다), 취소하면 원래 자리로 되돌아간다.
import { animate, reduced } from './index';

export interface GhostCard {
  canvas: HTMLCanvasElement | null;
}
export interface ScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface GhostOpts {
  cards: GhostCard[];
  /** 옮기는 쪽 수(배지) */
  count: number;
  pointer: { x: number; y: number };
  /** 집은 쪽의 화면 위 사각형 */
  origin: ScreenRect;
  label: string;
}

const MAX_CARDS = 4;
const MAX_DIM = 300;
/** 부채꼴: 카드마다 [기울기(deg), x, y] (화면 px 기준) */
const FAN: [number, number, number][] = [
  [0, 0, 0],
  [5.5, 9, 6],
  [-4.5, -8, 11],
  [10, 17, 15],
];

interface Chan {
  v: number;
  vel: number;
  to: number;
  k: number;
  c: number;
}
const chan = (v: number, k: number, c: number): Chan => ({ v, vel: 0, to: v, k, c });
function step(ch: Chan, dt: number) {
  const f = -ch.k * (ch.v - ch.to) - ch.c * ch.vel;
  ch.vel += f * dt;
  ch.v += ch.vel * dt;
}

export class DragGhost {
  readonly el: HTMLDivElement;
  private stack: HTMLDivElement;
  private badge: HTMLSpanElement | null = null;
  /** 배지를 옮기는 껍데기(위치는 transform 만으로 바꿔 레이아웃·래스터를 일으키지 않는다) */
  private badgeBox: HTMLDivElement | null = null;
  private cap: HTMLSpanElement;
  private cards: HTMLDivElement[] = [];
  private shadow: HTMLDivElement;
  private w: number;
  private h: number;
  private gx: number;
  private gy: number;
  private rest: number;
  private x: Chan;
  private y: Chan;
  private sc: Chan;
  private rot: Chan;
  private raf = 0;
  private last = 0;
  private alive = true;
  private n: number;
  private origin: ScreenRect;
  private rm = reduced();
  private tabMode = false;

  constructor(o: GhostOpts) {
    this.origin = o.origin;
    // 요소는 처음부터 줄인 크기로 만든다(큰 썸네일의 전체 크기 레이어를 만들지 않는다). 집은 순간에는 변환 배율 1/k 로 원래 크기를 보인다
    const k = Math.min(1, MAX_DIM / Math.max(o.origin.w, o.origin.h));
    this.w = o.origin.w * k;
    this.h = o.origin.h * k;
    this.n = Math.min(MAX_CARDS, o.cards.length);
    this.rest = k;
    this.gx = Math.max(0, Math.min(o.origin.w, o.pointer.x - o.origin.x)) * k;
    this.gy = Math.max(0, Math.min(o.origin.h, o.pointer.y - o.origin.y)) * k;

    const el = (this.el = document.createElement('div'));
    el.className = 'pg-ghost';
    el.setAttribute('data-testid', 'drag-ghost');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:80;pointer-events:none;will-change:transform;';

    const stack = (this.stack = document.createElement('div'));
    stack.style.cssText = `position:absolute;left:${-this.gx}px;top:${-this.gy}px;width:${this.w}px;height:${this.h}px;transform-origin:${this.gx}px ${this.gy}px;will-change:transform;`;
    const sh = (this.shadow = document.createElement('div'));
    sh.style.cssText = 'position:absolute;inset:0;border-radius:4px;box-shadow:var(--shadow-ghost);opacity:0;';
    stack.appendChild(sh);
    // 뒤 카드부터 쌓는다(DOM 뒤쪽이 위): 맨 위가 집은 쪽
    for (let i = this.n - 1; i >= 0; i--) {
      const c = document.createElement('div');
      c.style.cssText = `position:absolute;inset:0;border-radius:4px;overflow:hidden;background:var(--page-bg);border:1px solid color-mix(in srgb, var(--fg) 18%, transparent);transform-origin:50% 50%;`;
      const src = o.cards[i]?.canvas;
      const cv = document.createElement('canvas');
      cv.style.cssText = 'display:block;width:100%;height:100%;';
      if (src && src.width > 0 && src.height > 0) {
        const dpr = window.devicePixelRatio || 1;
        const kk = Math.min(1, (this.w * dpr * 1.1) / src.width);
        cv.width = Math.max(1, Math.round(src.width * kk));
        cv.height = Math.max(1, Math.round(src.height * kk));
        cv.getContext('2d')?.drawImage(src, 0, 0, cv.width, cv.height);
      }
      c.appendChild(cv);
      stack.appendChild(c);
      this.cards[i] = c;
    }
    el.appendChild(stack);

    if (o.count > 1) {
      const box = (this.badgeBox = document.createElement('div'));
      box.style.cssText = 'position:absolute;left:0;top:0;will-change:transform;';
      const b = (this.badge = document.createElement('span'));
      b.textContent = String(o.count);
      b.style.cssText =
        'display:grid;place-items:center;min-width:26px;height:26px;padding:0 7px;border-radius:13px;font:600 13px/1 var(--font-sans);font-variant-numeric:tabular-nums;background:var(--accent);color:var(--accent-fg);box-shadow:0 0 0 2px var(--bg),var(--shadow-2);transform:scale(0);';
      box.appendChild(b);
      el.appendChild(box);
    }
    const cap = (this.cap = document.createElement('span'));
    cap.textContent = o.label;
    cap.style.cssText =
      'position:absolute;left:0;top:0;padding:3px 9px;border-radius:var(--r-pill);white-space:nowrap;font:500 12px/1.4 var(--font-sans);background:var(--accent);color:var(--accent-fg);box-shadow:var(--shadow-2);opacity:0;';
    el.appendChild(cap);
    document.body.appendChild(el);

    // 스프링 채널: 위치는 집은 쪽 자리에서 출발해 포인터를 따라온다
    this.x = chan(o.origin.x + this.gx / k, 520, 36);
    this.y = chan(o.origin.y + this.gy / k, 520, 36);
    this.sc = chan(1 / k, 360, 22);
    this.rot = chan(0, 300, 20);
    this.x.to = o.pointer.x;
    this.y.to = o.pointer.y;
    this.sc.to = 1.045;
    this.rot.to = this.n > 1 ? 0 : -2.5;
    this.paint();
    this.last = performance.now();

    if (this.rm) {
      this.x.v = this.x.to;
      this.y.v = this.y.to;
      this.sc.v = this.sc.to;
      this.shadow.style.opacity = '1';
      cap.style.opacity = '1';
      if (this.badge) this.badge.style.transform = 'scale(1)';
    } else {
      animate(sh, [{ opacity: 0 }, { opacity: 1 }], { spring: 'pop' });
      animate(cap, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 90 });
      // 부채꼴: 뒤 카드가 차례로 벌어진다
      for (let i = 1; i < this.n; i++) {
        const [r, tx, ty] = FAN[i];
        const s = 1.045;
        animate(this.cards[i], [{ transform: 'none' }, { transform: `translate(${tx / s}px,${ty / s}px) rotate(${r}deg)` }], { spring: 'bouncy', delay: 40 * i, fill: 'forwards' });
      }
      if (this.badge) {
        const b = this.badge;
        animate(b, [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { spring: 'bouncy', delay: 90, fill: 'forwards' });
      }
    }
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (t: number) => {
    if (!this.alive) return;
    const dt = Math.min(0.05, Math.max(0.001, (t - this.last) / 1000));
    this.last = t;
    this.integrate(dt);
    // 기울기: 가로 속도에 비례(오른쪽으로 빠르면 시계 방향으로 눕는다)
    if (!this.rm && !this.parked) this.rot.to = Math.max(-13, Math.min(13, this.x.vel * 0.011)) + (this.n > 1 ? 0 : -2.5);
    this.paint();
    this.raf = requestAnimationFrame(this.tick);
  };
  private parked = false;

  private integrate(dt: number) {
    let rem = dt;
    while (rem > 0) {
      const h = Math.min(rem, 1 / 120);
      step(this.x, h);
      step(this.y, h);
      step(this.sc, h);
      step(this.rot, h);
      rem -= h;
    }
  }

  private paint() {
    this.el.style.transform = `translate3d(${this.x.v}px,${this.y.v}px,0) rotate(${this.rot.v}deg)`;
    const s = this.sc.v;
    this.stack.style.transform = `scale(${s})`;
    // 설명 띠: 쪽 아래 가운데
    this.cap.style.transform = `translate(${(this.w / 2 - this.gx) * s}px, ${(this.h - this.gy) * s + 12}px) translateX(-50%)`;
    if (this.badgeBox) {
      // 집은 쪽의 오른쪽 위 모서리(크기 변화에 따라가되 배지 자체는 커지지 않는다)
      this.badgeBox.style.transform = `translate(${(this.w - this.gx) * s - 13}px, ${-this.gy * s - 13}px)`;
    }
  }

  move(x: number, y: number) {
    if (this.parked) return;
    this.x.to = x;
    this.y.to = y;
    if (this.rm) {
      this.x.v = x;
      this.y.v = y;
      this.paint();
    }
  }

  setLabel(text: string) {
    if (this.cap.textContent !== text) this.cap.textContent = text;
  }

  /** 다른 파일 위로 올라가면 작아지며 투명해진다(복사 대상임을 보여 준다) */
  setTabMode(on: boolean) {
    if (on === this.tabMode) return;
    this.tabMode = on;
    this.sc.to = on ? 0.5 : 1.045;
    this.stack.style.opacity = on ? '0.9' : '1';
    if (this.rm) this.sc.v = this.sc.to;
  }

  /** 화면 위 현재 사각형(집은 쪽 기준)과 부채꼴 카드별 사각형 */
  rects(): ScreenRect[] {
    const s = this.sc.v;
    const base: ScreenRect = { x: this.x.v - this.gx * s, y: this.y.v - this.gy * s, w: this.w * s, h: this.h * s };
    return Array.from({ length: this.n }, (_, i) => ({ ...base, x: base.x + FAN[i][1], y: base.y + FAN[i][2] }));
  }

  /** 놓았다: 현재 모습을 돌려주고 즉시 걷어 낸다(이어지는 쪽 이동 연출이 이 자리에서 출발한다) */
  release(): ScreenRect[] {
    const r = this.rects();
    this.destroy();
    return r;
  }

  /** 취소: 집었던 자리로 스프링으로 되돌아간 뒤 사라진다 */
  cancel(): Promise<void> {
    if (!this.alive) return Promise.resolve();
    this.parked = true;
    this.x.k = 460;
    this.y.k = 460;
    this.x.to = this.origin.x + this.gx / this.rest;
    this.y.to = this.origin.y + this.gy / this.rest;
    this.sc.to = 1 / this.rest;
    this.rot.to = 0;
    this.cap.getAnimations().forEach((a) => a.cancel());
    this.cap.style.opacity = '0';
    for (let i = 1; i < this.n; i++) {
      const cur = getComputedStyle(this.cards[i]).transform;
      this.cards[i].getAnimations().forEach((a) => a.cancel());
      animate(this.cards[i], [{ transform: cur === 'none' ? 'none' : cur }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'forwards' });
    }
    if (this.rm) {
      this.destroy();
      return Promise.resolve();
    }
    return new Promise((res) => {
      const t0 = performance.now();
      const chk = () => {
        if (!this.alive) return res();
        const near = Math.abs(this.x.v - this.x.to) < 1.2 && Math.abs(this.y.v - this.y.to) < 1.2 && Math.abs(this.x.vel) < 20 && Math.abs(this.y.vel) < 20;
        if (near || performance.now() - t0 > 650) {
          const a = this.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 110, fill: 'forwards' });
          a.onfinish = () => {
            this.destroy();
            res();
          };
        } else requestAnimationFrame(chk);
      };
      requestAnimationFrame(chk);
    });
  }

  destroy() {
    if (!this.alive) return;
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.el.remove();
  }
}
