// 쪽 구조 조작의 연출 계획(순수 함수): 조작 전 번호 → 조작 후 번호. DOM 에 의존하지 않는다(시험에서 직접 import).
// 주의: erasable 문법만 쓴다(Node 타입 스트리핑).
import type { PageSize } from '../../engine/adapter';

/** 쪽 하나의 이동: from 은 조작 전 번호, to 는 조작 후 번호(null 이면 사라지거나 새로 생긴다) */
export interface PlanEntry {
  from: number | null;
  to: number | null;
  /** 시계 방향으로 더 돌아가는 각도(도) */
  rot?: number;
  /** to 만 있을 때(복제): 갈라져 나오는 원본의 조작 전 번호 */
  via?: number;
}
export interface Plan {
  entries: PlanEntry[];
  oldSizes: PageSize[];
  newSizes: PageSize[];
  /** 보내기(이동·복사)로 대상 칸에 날아가는 연출을 쓰는가 */
  skipExit?: boolean;
}

const swapped = (s: PageSize): PageSize => ({ ...s, width: s.height, height: s.width });

export function reorderPlan(sizes: PageSize[], order: number[]): Plan {
  return { entries: order.map((from, to) => ({ from, to })), oldSizes: sizes, newSizes: order.map((o) => sizes[o]) };
}

export function removePlan(sizes: PageSize[], pages: number[]): Plan {
  const gone = new Set(pages);
  const entries: PlanEntry[] = [];
  const newSizes: PageSize[] = [];
  sizes.forEach((s, i) => {
    if (gone.has(i)) entries.push({ from: i, to: null });
    else {
      entries.push({ from: i, to: newSizes.length });
      newSizes.push(s);
    }
  });
  return { entries, oldSizes: sizes, newSizes };
}

export function duplicatePlan(sizes: PageSize[], list: number[], at: number): Plan {
  const k = list.length;
  const entries: PlanEntry[] = sizes.map((_, i) => ({ from: i, to: i >= at ? i + k : i }));
  list.forEach((src, j) => entries.push({ from: null, to: at + j, via: src }));
  const newSizes = [...sizes.slice(0, at), ...list.map((i) => sizes[i]), ...sizes.slice(at)];
  return { entries, oldSizes: sizes, newSizes };
}

export function rotatePlan(sizes: PageSize[], pages: number[], deg = 90): Plan {
  const r = new Set(pages);
  const odd = Math.abs(deg / 90) % 2 === 1;
  return {
    entries: sizes.map((_, i) => (r.has(i) ? { from: i, to: i, rot: deg } : { from: i, to: i })),
    oldSizes: sizes,
    newSizes: sizes.map((s, i) => (r.has(i) && odd ? swapped(s) : s)),
  };
}

/** 같은 조작을 거꾸로 되돌리는 연출 */
export function invertPlan(p: Plan): Plan {
  return {
    entries: p.entries.map((e) => ({ from: e.to, to: e.from, rot: e.rot ? -e.rot : undefined })),
    oldSizes: p.newSizes,
    newSizes: p.oldSizes,
  };
}

// ---------- 되돌리기·다시하기 연출 기록: 문서 상태 id 로 잇는다 ----------
const byBefore = new Map<number, Plan>();
const byAfter = new Map<number, Plan>();
let pendingRecord: { docKey: number; before: number; plan: Plan } | null = null;

export const planFor = (stateId: number, dir: 'undo' | 'redo', n: number): Plan | null => {
  const p = dir === 'undo' ? byAfter.get(stateId) : byBefore.get(stateId);
  if (!p) return null;
  const out = dir === 'undo' ? invertPlan(p) : p;
  return out.oldSizes.length === n ? out : null;
};

/** 문서 상태가 바뀌었음을 알린다(조작 뒤의 stateId 를 기록해 되돌리기가 같은 연출을 찾게 한다) */
export function noteState(docKey: number, stateId: number) {
  const r = pendingRecord;
  if (r && r.docKey === docKey && r.before !== stateId) {
    byAfter.set(stateId, r.plan);
    pendingRecord = null;
  }
}


/** 조작을 시작할 때 기록한다(before = 조작 전 문서 상태 id) */
export function recordPlan(docKey: number, before: number, plan: Plan) {
  byBefore.set(before, plan);
  pendingRecord = { docKey, before, plan };
}
