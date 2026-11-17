// 스프링 물리(감쇠 조화 진동자)와 연출용 이징의 공통 모듈. DOM 에 의존하지 않는다(시험에서 직접 import).
// 주의: erasable 문법만 쓴다(Node 타입 스트리핑).

export interface SpringSpec {
  /** 강성: 클수록 빠르게 목표로 간다 */
  k: number;
  /** 감쇠: 작을수록 출렁인다 */
  c: number;
  m?: number;
}

/** 성격이 다른 스프링 프리셋. 모든 모션이 이 중에서 고른다 */
export const SPRING = {
  /** 팝오버·메뉴가 자라남: 빠르게 도착해 한 번 살짝 넘친다 */
  pop: { k: 620, c: 30 },
  /** 선택·체크·배지: 통통 튄다 */
  bouncy: { k: 420, c: 19 },
  /** 쪽 재정렬·FLIP: 부드럽게 미끄러지고 거의 넘치지 않는다 */
  glide: { k: 260, c: 27 },
  /** 서랍·모드 전환: 넘침 없이 묵직하다 */
  heavy: { k: 210, c: 29 },
  /** 눌림 복귀·작은 반응 */
  snappy: { k: 700, c: 38 },
} as const satisfies Record<string, SpringSpec>;

export type SpringName = keyof typeof SPRING;

/** 단위 계단 응답 x(t) (t 초). 0 에서 시작해 1 로 수렴하며 감쇠가 약하면 1 을 넘는다 */
export function stepResponse(s: SpringSpec, t: number): number {
  const m = s.m ?? 1;
  const w0 = Math.sqrt(s.k / m);
  const z = s.c / (2 * Math.sqrt(s.k * m));
  if (t <= 0) return 0;
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
  }
  if (z === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  const r = w0 * Math.sqrt(z * z - 1);
  const a = -z * w0 + r;
  const b = -z * w0 - r;
  return 1 - (b * Math.exp(a * t) - a * Math.exp(b * t)) / (b - a);
}

/** 목표에서 0.2% 이내로 들어와 머무는 시각(초) */
export function settleTime(s: SpringSpec, eps = 0.002): number {
  const dt = 1 / 240;
  let last = 0;
  for (let t = 0; t < 4; t += dt) if (Math.abs(stepResponse(s, t) - 1) > eps) last = t;
  return last + dt;
}

export interface SolvedSpring {
  /** 0..1 로 정규화된 진행도 → 스프링 응답(1 을 넘을 수 있다) */
  fn: (p: number) => number;
  /** ms */
  duration: number;
  /** CSS/WAAPI easing 문자열 linear(...) */
  css: string;
}

const cache = new Map<string, SolvedSpring>();

export function solveSpring(s: SpringSpec): SolvedSpring {
  const key = `${s.k}/${s.c}/${s.m ?? 1}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const T = settleTime(s);
  const fn = (p: number) => (p <= 0 ? 0 : p >= 1 ? 1 : stepResponse(s, p * T));
  const N = 48;
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) pts.push((i === N ? 1 : stepResponse(s, (i / N) * T)).toFixed(4).replace(/\.?0+$/, '') || '0');
  const out = { fn, duration: Math.round(T * 1000), css: `linear(${pts.join(', ')})` };
  cache.set(key, out);
  return out;
}

/** 연출된 베지어 이징(CSS 토큰과 같은 값) */
export const EASE = {
  out: 'cubic-bezier(0.22, 1, 0.36, 1)',
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  in: 'cubic-bezier(0.5, 0, 0.75, 0)',
  /** 빨려 들어가는 느낌: 느리게 출발해 급격히 가속 */
  suck: 'cubic-bezier(0.55, 0, 0.85, 0.35)',
} as const;

/** 시간 토큰(ms) */
export const DUR = { instant: 90, fast: 140, base: 200, slow: 320, page: 520 } as const;

export const cubicOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const cubicIn = (t: number) => t * t * t;
