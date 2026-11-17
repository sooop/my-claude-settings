// 보기 ↔ 정리 전환: 옛 화면의 쪽 썸네일이 새 화면의 같은 쪽 자리로 이어지는 공유 요소 전환.
// View Transitions 는 전환하는 동안 실제 화면이 입력을 받지 못해(누르기가 문서 루트로 간다) 쓰지 않는다.
// 대신 옛 썸네일의 비트맵을 복사한 비행체를 화면 위(position: fixed)에 띄워 새 자리로 스프링으로 옮긴다:
// 실제 화면은 바로 조작할 수 있고, 새 칸은 비행체가 내려앉을 때까지만 가려 둔다. 지원 여부와 무관하게 같은 모양이다.
import { EASE, reduced, springOf } from './index';

interface Snap {
  i: number;
  r: DOMRect;
  canvas: HTMLCanvasElement | null;
}

const MAX = 16;

/** 지금 화면에 보이는 쪽 썸네일의 자리와 비트맵(전환 직전에 부른다) */
export function captureThumbs(): Snap[] {
  if (reduced()) return [];
  const out: Snap[] = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  for (const el of document.querySelectorAll<HTMLElement>('[data-thumb]')) {
    const f = el.querySelector<HTMLElement>('.frame');
    if (!f) continue;
    const r = f.getBoundingClientRect();
    if (r.width < 4 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    // 옛 화면은 곧 사라지고 그때 캔버스가 비워지므로, 비트맵은 지금 복사해 둔다
    out.push({ i: Number(el.dataset.thumb), r, canvas: copy(el.querySelector('canvas'), r.width) });
    if (out.length >= MAX) break;
  }
  return out;
}

function copy(src: HTMLCanvasElement | null, w: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.style.cssText = 'display:block;width:100%;height:100%;';
  if (src && src.width > 0 && src.height > 0) {
    const k = Math.min(1, ((w * (window.devicePixelRatio || 1)) * 1.2) / src.width);
    cv.width = Math.max(1, Math.round(src.width * k));
    cv.height = Math.max(1, Math.round(src.height * k));
    cv.getContext('2d')?.drawImage(src, 0, 0, cv.width, cv.height);
  }
  return cv;
}

/** 새 화면이 그려진 뒤: 같은 번호의 새 칸 자리로 비행체를 옮긴다. 새 칸은 내려앉는 동안 가려 둔다 */
export function landThumbs(snaps: Snap[]) {
  if (!snaps.length) return;
  const layer = document.createElement('div');
  layer.setAttribute('data-flyer-layer', '');
  layer.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:70;pointer-events:none;';
  document.body.appendChild(layer);
  const sp = springOf('heavy');
  let left = 0;
  const done = () => {
    if (--left === 0) layer.remove();
  };
  snaps.forEach((s, n) => {
    const dest = document.querySelector<HTMLElement>(`[data-thumb="${s.i}"] .frame`);
    const el = document.createElement('div');
    el.setAttribute('data-flyer', '');
    const w0 = s.r.width;
    const h0 = s.r.height;
    el.style.cssText = `position:absolute;left:0;top:0;width:${w0}px;height:${h0}px;border-radius:4px;overflow:hidden;background:#fff;border:1px solid var(--border);box-shadow:var(--shadow-2);transform-origin:50% 50%;will-change:transform;`;
    if (s.canvas) el.appendChild(s.canvas);
    layer.appendChild(el);
    left++;
    const tf = (r: { x: number; y: number; width: number; height: number }, k: number) => `translate(${r.x + r.width / 2 - w0 / 2}px, ${r.y + r.height / 2 - h0 / 2}px) scale(${k})`;
    const a = { x: s.r.left, y: s.r.top, width: w0, height: h0 };
    if (!dest) {
      // 새 화면에 같은 쪽이 없으면(창 밖) 제자리에서 줄어들며 사라진다
      const x = el.animate([{ transform: tf(a, 1), opacity: 1 }, { transform: tf(a, 0.85), opacity: 0 }], { duration: 220, easing: EASE.in, fill: 'forwards' });
      x.onfinish = () => {
        el.remove();
        done();
      };
      return;
    }
    const b = dest.getBoundingClientRect();
    dest.style.opacity = '0';
    const anim = el.animate([{ transform: tf(a, 1) }, { transform: tf({ x: b.left, y: b.top, width: b.width, height: b.height }, b.width / w0) }], {
      duration: sp.duration,
      delay: Math.min(n * 14, 100),
      easing: sp.css,
      fill: 'forwards',
    });
    anim.onfinish = () => {
      // 비행체를 걷고 실제 칸을 짧게 드러낸다(새 렌더가 이미 도착해 있으면 이어진다)
      dest.style.transition = 'opacity 140ms linear';
      dest.style.opacity = '';
      el.remove();
      setTimeout(() => (dest.style.transition = ''), 200);
      done();
    };
  });
  // 안전장치: 어떤 이유로 끝나지 않아도 칸이 계속 가려져 있지 않게 한다
  setTimeout(() => {
    for (const s of snaps) {
      const d = document.querySelector<HTMLElement>(`[data-thumb="${s.i}"] .frame`);
      if (d) d.style.opacity = '';
    }
    layer.remove();
  }, 2500);
}
