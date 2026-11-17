// 쪽 끌기 세션: 썸네일 패널(Thumbnails)과 정리 격자(PageGrid)가 함께 쓰는 포인터 제스처 수명 관리.
// 누름 → 문턱 → 끌기 → 놓기·취소, 가장자리 자동 스크롤, 고스트, 포인터를 잃었을 때의 중단을 한 곳에서 맡는다.
// 칸 배치에 따른 삽입 자리 계산은 호출한 컴포넌트가 hooks 로 채운다.
import { DragGhost, type ScreenRect } from './motion/drag-ghost';

export interface Pt {
  x: number;
  y: number;
}
export interface Press extends Pt {
  index: number;
  handle: boolean;
  id: number;
  mouse: boolean;
}

// ---------- 전역 제스처 잠금 ----------
// 누르고 있거나 끄는 동안에는 App 의 구조를 바꾸는 단축키(Ctrl+Z·W·Tab, G, Delete 등)를 무시해야 한다.
const holders = new Set<object>();
export const holdGesture = (owner: object) => void holders.add(owner);
export const releaseGesture = (owner: object) => void holders.delete(owner);
/** 쪽 끌기·영역 선택 같은 포인터 제스처가 진행 중인가 */
export const gestureActive = () => holders.size > 0;

/**
 * 포인터를 잃었을 때(창 포커스 이동·탭 숨김) 부르는 콜백을 건다. 해제 함수를 돌려준다.
 * pointermove 의 buttons===0 검사는 각 이동 처리에서 buttonsLost 로 한다.
 */
export function watchPointerLoss(onLost: () => void): () => void {
  const vis = () => {
    if (document.visibilityState === 'hidden') onLost();
  };
  window.addEventListener('blur', onLost);
  document.addEventListener('visibilitychange', vis);
  return () => {
    window.removeEventListener('blur', onLost);
    document.removeEventListener('visibilitychange', vis);
  };
}
/** 눌려 있어야 할 포인터가 이미 떼어졌는가(놓는 신호를 놓친 경우) */
export const buttonsLost = (e: PointerEvent) => e.buttons === 0 && e.type === 'pointermove';

export interface DragHooks<S> {
  scroller(): HTMLElement | undefined;
  /** 문서 상태 식별값(gen·stateId). 누른 뒤 바뀌면 끌기를 버린다 */
  token(): string;
  /** 가장자리 자동 스크롤 한 틱의 px */
  edgeStep: number;
  /** 문턱을 넘었다: 끌기 상태를 만들고 끄는 쪽 목록을 돌려준다. null 이면 시작하지 않는다 */
  begin(press: Press, pt: Pt): number[] | null;
  /** 시작 직후 고스트 설명 */
  label(): string;
  /** 포인터 이동·가장자리 스크롤 틱마다: 삽입 자리·대상 갱신, edgeV 설정, 고스트 이동 */
  update(): void;
  /** 놓는 순간의 삽입 자리·대상(끝내기 전에 읽는다) */
  snapshot(): S;
  /** 놓았다(오래된 상태면 부르지 않는다) */
  drop(moving: number[], grabbed: number, rects: ScreenRect[], snap: S): void;
  /** 끌기를 시작했다가 끝났다(놓음·취소). 파괴 중에는 부르지 않는다 */
  ended(): void;
  /** 끌기 상태를 비운다 */
  clear(): void;
  /** 취소로 되돌아가는 동안 자리표시로 둘 쪽들(없으면 []) */
  returning(m: number[]): void;
  /** 문턱을 넘기 전에 누름이 끝났거나 끌기가 시작됐다(길게 누르기 타이머 정리 등) */
  onDragStart?(): void;
}

type EndMode = 'drop' | 'cancel' | 'abort';

export class DragSession<S> {
  press: Press | null = null;
  active = false;
  pt: Pt = { x: 0, y: 0 };
  edgeV = 0;
  /** Shift 를 누르고 있는가: 다른 파일 위에 놓을 때 복사 대신 이동한다 */
  shift = false;
  ghost: DragGhost | null = null;
  private moving: number[] = [];
  private startToken = '';
  private edgeRaf = 0;
  private unwatch: (() => void) | null = null;
  private clickGuard = false;
  private hooks: DragHooks<S>;
  private disposed = false;
  private retSeq = 0;

  constructor(hooks: DragHooks<S>) {
    this.hooks = hooks;
  }

  /** 끌기 직후의 click 이 쪽 선택으로 처리되지 않게 한다 */
  get justDragged() {
    return this.clickGuard;
  }
  suppressClick() {
    this.clickGuard = true;
    setTimeout(() => (this.clickGuard = false), 0);
  }

  /** 포인터를 눌렀다 */
  start(e: PointerEvent, index: number, handle: boolean) {
    if (this.press || this.disposed) return;
    if (e.pointerType === 'mouse' ? e.button !== 0 : !handle) return;
    this.press = { x: e.clientX, y: e.clientY, index, handle, id: e.pointerId, mouse: e.pointerType === 'mouse' };
    this.startToken = this.hooks.token();
    this.pt = { x: e.clientX, y: e.clientY };
    this.shift = e.shiftKey;
    holdGesture(this);
    window.addEventListener('keyup', this.onKeyUp, true);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onCancel);
    window.addEventListener('keydown', this.onKey, true);
    this.unwatch = watchPointerLoss(this.onCancel);
  }

  /** 문서 상태(gen·stateId)가 바뀌었다: 누르고 있던 것을 버린다 */
  tokenChanged() {
    if (this.press && this.hooks.token() !== this.startToken) this.end('abort');
  }

  private onMove = (e: PointerEvent) => {
    const p = this.press;
    if (!p || e.pointerId !== p.id) return;
    if (buttonsLost(e)) {
      this.end('cancel');
      return;
    }
    this.pt = { x: e.clientX, y: e.clientY };
    this.shift = e.shiftKey;
    if (!this.active) {
      if (!p.handle && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 5) return;
      this.hooks.onDragStart?.();
      const moving = this.hooks.begin(p, this.pt);
      if (!moving) {
        this.end('abort');
        return;
      }
      this.moving = moving;
      this.active = true;
      this.startGhost(moving, p.index);
      this.edgeLoop();
    }
    e.preventDefault();
    this.hooks.update();
  };

  private startGhost(moving: number[], grabbed: number) {
    this.ghost?.destroy();
    this.ghost = null;
    const sc = this.hooks.scroller();
    const f = sc?.querySelector<HTMLElement>(`[data-thumb="${grabbed}"] .frame`);
    if (!sc || !f) return;
    const r = f.getBoundingClientRect();
    const order = [grabbed, ...moving.filter((m) => m !== grabbed)];
    this.ghost = new DragGhost({
      cards: order.slice(0, 4).map((i) => ({ canvas: sc.querySelector<HTMLCanvasElement>(`[data-thumb="${i}"] canvas`) })),
      count: moving.length,
      pointer: this.pt,
      origin: { x: r.left, y: r.top, w: r.width, h: r.height },
      label: this.hooks.label(),
    });
  }

  /** 포인터 아래의 끌어놓기 대상 요소(마우스만) */
  dropElement(): HTMLElement | null {
    if (!this.press?.mouse) return null;
    return document.elementFromPoint(this.pt.x, this.pt.y)?.closest('[data-droppable]') as HTMLElement | null;
  }

  private edgeLoop() {
    if (this.edgeRaf) return;
    const tick = () => {
      this.edgeRaf = 0;
      if (!this.active) return;
      const sc = this.hooks.scroller();
      if (this.edgeV && sc) {
        sc.scrollTop += this.edgeV * this.hooks.edgeStep;
        this.hooks.update();
      }
      this.edgeRaf = requestAnimationFrame(tick);
    };
    this.edgeRaf = requestAnimationFrame(tick);
  }

  private onUp = (e: PointerEvent) => {
    const p = this.press;
    if (!p || e.pointerId !== p.id) return;
    if (!this.active) {
      this.end('drop');
      return;
    }
    // 놓기 직전에 문서 상태가 바뀌었다면(끄는 사이 되돌리기 등) 처음 집은 번호로 옮기지 않는다
    const stale = this.hooks.token() !== this.startToken;
    if (stale) {
      this.suppressClick();
      this.end('abort');
      return;
    }
    this.shift = e.shiftKey;
    this.hooks.update();
    this.suppressClick();
    const snap = this.hooks.snapshot();
    const moving = this.moving;
    const rects = this.ghost?.release() ?? [];
    this.end('drop');
    this.hooks.drop(moving, p.index, rects, snap);
  };

  private onCancel = () => {
    if (this.press) this.end('cancel');
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.active) {
      e.stopPropagation();
      this.suppressClick();
      this.end('cancel');
    } else if (e.key === 'Shift') this.setShift(true);
  };
  private onKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Shift') this.setShift(false);
  };
  /** 끄는 중에 Shift 를 누르거나 떼면 고스트 설명(복사 ↔ 이동)을 바로 바꾼다 */
  private setShift(on: boolean) {
    if (this.shift === on) return;
    this.shift = on;
    if (this.active) this.hooks.update();
  }

  /** 끌기를 끝낸다. 취소면 고스트가 원래 자리로 되돌아가고, 중단(abort)이면 바로 사라진다 */
  private end(mode: EndMode) {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onCancel);
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('keyup', this.onKeyUp, true);
    this.unwatch?.();
    this.unwatch = null;
    if (this.edgeRaf) cancelAnimationFrame(this.edgeRaf);
    this.edgeRaf = 0;
    this.edgeV = 0;
    const was = this.active;
    const moving = this.moving;
    this.press = null;
    this.active = false;
    this.moving = [];
    releaseGesture(this);
    if (was) this.hooks.ended();
    const g = this.ghost;
    this.ghost = null;
    if (g && mode === 'cancel') {
      const seq = ++this.retSeq;
      this.hooks.returning(moving);
      void g.cancel().then(() => {
        if (seq === this.retSeq && !this.disposed) this.hooks.returning([]);
      });
    } else g?.destroy();
    if (was) this.hooks.clear();
  }

  /** 컴포넌트가 사라진다: 부모 상태를 건드리지 않고 정리만 한다 */
  dispose() {
    this.disposed = true;
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onCancel);
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('keyup', this.onKeyUp, true);
    this.unwatch?.();
    this.unwatch = null;
    if (this.edgeRaf) cancelAnimationFrame(this.edgeRaf);
    this.edgeRaf = 0;
    this.ghost?.destroy();
    this.ghost = null;
    this.press = null;
    this.active = false;
    releaseGesture(this);
  }
}
