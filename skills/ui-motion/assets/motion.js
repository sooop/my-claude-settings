/* ui-motion: 나타남/사라짐, 삽입·삭제, flash, 목록 자리 이동, 끌어 놓기. 의존성 없는 한 파일이며 window.Motion 을 만든다.
 * 값은 motion.css 와 같은 정책을 따른다. <html data-anim="off"> 이면 모든 효과가 즉시 끝나고,
 * OS 의 '동작 줄이기'가 켜져 있으면 이동·확대·스프링 없이 페이드만 한다.
 * transform 대신 개별 속성(translate·scale)을 움직이므로, 위치를 잡는 데 쓴 기존 transform 과 겹치지 않는다. */
(function (g) {
  'use strict';

  const MOTION = {
    tooltip: { ms: 120, y: 2 },
    popover: { ms: 260, y: 4, scale: 0.95 },
    modal: { ms: 400, scale: 0.95, backdropDelay: 110 },
    panel: { ms: 220, x: 40 },
    toast: { ms: 200, y: 8 },
    list: { ms: 220 },
    flash: { ms: 900, alpha: 0.17, ring: 1 },
    insert: { appearMs: 260 },
    remove: { holdMs: 600, fadeMs: 190 },
    drag: { threshold: 4, liftMs: 130, liftScale: 1.02 },
    bounce: 0.4,
  };
  /** 이 수를 넘는 목록은 항목마다 위치를 재는 비용이 커서 자리 이동 효과를 끈다 */
  const LIST_FX_MAX = 80;
  const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
  const EASE_IN = 'cubic-bezier(0.32, 0, 0.67, 0)'; // 닫힘: 머뭇거림 없이 가속하며 빠진다
  const EASE_IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)'; // 접힘

  const on = () => document.documentElement.dataset.anim !== 'off';
  const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** 감쇠 스프링의 단위 계단 응답(0→1, 1 을 살짝 넘었다 안착). t 는 0~1 */
  function spring(bounce) {
    const z = Math.max(0.35, 1 - (bounce == null ? MOTION.bounce : bounce)), w0 = 6.4 / z, wd = w0 * Math.sqrt(1 - z * z);
    return (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t)));
  }
  const springEase = spring();

  // ---- 나타남/사라짐 ----
  const P = MOTION;
  const KINDS = {
    // out*: 닫힘은 열림보다 짧고(ease-in), 덜 움직인다. 닫기는 사용자가 이미 다음 일로 넘어간 뒤다
    tip: { ms: P.tooltip.ms, y: -P.tooltip.y, outMs: 90 },
    pop: { ms: P.popover.ms, y: -P.popover.y, scale: P.popover.scale, spring: true, outMs: 120, outY: -3, outScale: 0.96 },
    modal: { ms: P.modal.ms, scale: P.modal.scale, spring: true, outMs: 130, outScale: 0.97 },
    backdrop: { ms: P.modal.ms, delayIn: P.modal.backdropDelay, outMs: 140 },
    'panel-right': { ms: P.panel.ms, x: P.panel.x, outMs: 170 },
    'panel-left': { ms: P.panel.ms, x: -P.panel.x, outMs: 170 },
    'panel-bottom': { ms: P.panel.ms, y: P.panel.x, outMs: 170 },
    toast: { ms: P.toast.ms, y: P.toast.y, outMs: 130, outY: 4 },
    overlay: { ms: P.list.ms, scale: 0.985, outMs: 120 },
    list: { ms: P.list.ms, outMs: P.list.ms * 0.75, y: -6, scale: 0.96, outStill: true },
  };

  function framesOf(k, out) {
    const red = reduced(), x = k.x || 0;
    const y = out ? (k.outStill ? 0 : k.outY != null ? k.outY : k.y || 0) : k.y || 0;
    const s = out && k.outScale != null ? k.outScale : k.scale == null ? 1 : k.scale;
    // e: 다 나타난 상태까지의 진행도(스프링은 1 을 넘는다)
    const at = (e) => {
      const u = 1 - e, f = { opacity: Math.max(0, Math.min(1, e)) };
      if (!red) { f.translate = `${x * u}px ${y * u}px`; f.scale = String(1 - (1 - s) * u); }
      return f;
    };
    // 스프링은 나타날 때만, 크기가 변하는 요소에만 쓴다. 사라질 때는 튀지 않는다
    if (k.spring && !out && !red && s !== 1) {
      const frames = [];
      for (let i = 0; i <= 24; i++) frames.push(at(springEase(i / 24)));
      return { frames, easing: 'linear' };
    }
    return { frames: out ? [at(1), at(0)] : [at(0), at(1)], easing: out ? EASE_IN : EASE };
  }

  // 요소(와 가상 요소)마다 진행 중인 효과를 하나만 둔다: 닫히는 도중 다시 열면 앞의 것을 거둔다
  const running = new WeakMap();
  function play(el, kind, out, pseudo) {
    const k = typeof kind === 'string' ? KINDS[kind] : kind;
    if (!el || !k) return Promise.resolve(false);
    const key = pseudo || '';
    let slot = running.get(el);
    if (!slot) running.set(el, (slot = {}));
    if (slot[key]) slot[key].cancel();
    if (!on()) return Promise.resolve(true);
    const f = framesOf(k, out);
    const opt = { duration: out && reduced() ? 90 : Math.round(out && k.outMs ? k.outMs : k.ms), delay: out ? 0 : k.delayIn || 0, easing: f.easing, fill: out ? 'forwards' : 'backwards' };
    if (pseudo) opt.pseudoElement = pseudo;
    const a = (slot[key] = el.animate(f.frames, opt));
    // 끝까지 재생했으면 true, 도중에 다른 효과로 바뀌었으면 false
    return a.finished.then(() => true, () => false);
  }
  const release = (el, pseudo) => { const s = running.get(el); const a = s && s[pseudo || '']; if (a) { a.cancel(); s[pseudo || ''] = null; } };

  /** 이미 화면에 넣은(보이게 한) 요소를 kind 에 맞게 나타낸다. kind: tip·pop·modal·backdrop·panel-right·panel-left·panel-bottom·toast·overlay·list */
  function enter(el, kind) { return play(el, kind, false).then((ok) => { if (ok) release(el); }); }
  /**
   * 요소를 kind 에 맞게 사라지게 한 뒤 치운다. after 를 생략하면 DOM 에서 제거하고, 함수를 주면 그것을 부른다(예: () => (el.hidden = true)).
   * 사라지는 도중 enter 가 다시 불리면 after 는 실행되지 않는다.
   */
  function leave(el, kind, after) {
    return play(el, kind, true).then((ok) => {
      if (!ok) return;
      if (typeof after === 'function') after(); else if (el) el.remove();
      release(el);
    });
  }

  // ---- <dialog>: 본체는 스프링으로 커지고, 배경(딤)은 조금 늦게 따라 나타난다 ----
  const bound = new WeakSet();
  const dialog = {
    open(d) {
      if (d.open) return Promise.resolve();
      if (!bound.has(d)) {
        bound.add(d);
        // Esc 는 브라우저가 즉시 닫아 버리므로 가로채서 같은 사라짐 효과를 거친다
        d.addEventListener('cancel', (e) => { e.preventDefault(); dialog.close(d); });
        // 배경(대화상자 바깥)을 누르면 닫는다
        d.addEventListener('click', (e) => { if (e.target === d && d.dataset.moStatic == null) dialog.close(d); });
      }
      d.showModal();
      play(d, 'backdrop', false, '::backdrop').then((ok) => { if (ok) release(d, '::backdrop'); });
      return enter(d, 'modal');
    },
    close(d, value) {
      if (!d.open) return Promise.resolve();
      play(d, 'backdrop', true, '::backdrop');
      return play(d, 'modal', true).then((ok) => {
        if (!ok) return;
        d.close(value);
        release(d); release(d, '::backdrop');
      });
    },
  };

  // ---- 높이가 펼쳐지는 슬라이드: 접기·펼치기, 하위 메뉴, 안내 줄 ----
  /** open 이면 el.hidden 을 풀고 펼치고, 아니면 접은 뒤 el.hidden = true 로 둔다 */
  function slide(el, open) {
    if (open) el.hidden = false;
    release(el);
    if (!on()) { if (!open) el.hidden = true; return Promise.resolve(); }
    const st = getComputedStyle(el), h = el.offsetHeight, red = reduced();
    const full = red ? { opacity: 1 } : { boxSizing: 'border-box', overflow: 'hidden', opacity: 1, height: `${h}px`, paddingTop: st.paddingTop, paddingBottom: st.paddingBottom, marginTop: st.marginTop, marginBottom: st.marginBottom };
    const none = red ? { opacity: 0 } : { boxSizing: 'border-box', overflow: 'hidden', opacity: 0, height: '0px', paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px' };
    let slot = running.get(el);
    if (!slot) running.set(el, (slot = {}));
    const a = (slot[''] = el.animate(open ? [none, full] : [full, none], { duration: open ? MOTION.panel.ms : 200, easing: open ? EASE : EASE_IN_OUT, fill: open ? 'none' : 'forwards' }));
    return a.finished.then(() => { if (!open) el.hidden = true; release(el); }, () => undefined);
  }

  // ---- flash: 제자리에서 자동으로 바뀐 영역을 의미색으로 한 번 알린다 ----
  /** 사용자 조작으로 UI·콘텐츠가 자동으로 바뀌었을 때의 액션 유형 → 의미색 */
  const FLASH_ACTION = { convert: 'info', insert: 'success', tidy: 'accent', conflict: 'warn', remove: 'danger' };
  function tintBox(r, kind) {
    const box = document.createElement('div'), col = `var(--fx-${kind})`;
    Object.assign(box.style, {
      position: 'fixed', pointerEvents: 'none', zIndex: '95', borderRadius: '8px', opacity: '0',
      left: `${r.left - 3}px`, top: `${r.top - 3}px`, width: `${r.width + 6}px`, height: `${r.height + 6}px`,
      background: `color-mix(in srgb, ${col} ${(MOTION.flash.alpha * 100).toFixed(1)}%, transparent)`,
      boxShadow: `0 0 0 ${MOTION.flash.ring}px color-mix(in srgb, ${col} 70%, transparent)`,
    });
    document.body.appendChild(box);
    return box;
  }
  /** target(요소 또는 화면 좌표 사각형) 위에 상자를 겹쳐 띄운다. 요소 자체는 건드리지 않으므로 다시 그려지는 DOM 에도 안전하다 */
  function flash(target, action) {
    if (!target || !on()) return Promise.resolve();
    const kind = FLASH_ACTION[action] || action || 'info';
    const r = target instanceof Element ? target.getBoundingClientRect() : target;
    if (!r.width && !r.height) return Promise.resolve();
    const box = tintBox(r, kind);
    const frames = reduced()
      ? [{ opacity: 0 }, { opacity: 0.6, offset: 0.3 }, { opacity: 0 }]
      : [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.35 }, { opacity: 0, offset: 1 }];
    const done = () => box.remove();
    return box.animate(frames, { duration: MOTION.flash.ms, easing: 'ease-out' }).finished.then(done, done);
  }

  // ---- 삽입·삭제: flash 와 순서가 있는 효과 ----
  /** 이미 DOM 에 넣은 새 항목: ① 살짝 내려오며 나타남 → ② success flash */
  function insert(el) {
    if (!el || !on()) return Promise.resolve();
    const frames = reduced() ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, translate: '0 -4px' }, { opacity: 1, translate: '0 0' }];
    return el.animate(frames, { duration: MOTION.insert.appearMs, easing: EASE }).finished.then(() => flash(el, 'insert'), () => undefined);
  }
  /** 항목 삭제: ① danger flash 로 무엇이 지워지는지 알림 → ② 옆으로 밀리며 흐려지고 자리가 접힘 → DOM 에서 제거 */
  function remove(el) {
    if (!el) return Promise.resolve();
    if (!on()) { el.remove(); return Promise.resolve(); }
    const { holdMs, fadeMs } = MOTION.remove, total = holdMs + fadeMs, red = reduced();
    const box = tintBox(el.getBoundingClientRect(), 'danger'), st = getComputedStyle(el), h = el.offsetHeight;
    box.animate([{ opacity: 0, offset: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: holdMs / total }, { opacity: 0, offset: 1 }], { duration: total, fill: 'forwards' });
    const from = red ? { opacity: 1 } : { opacity: 1, translate: '0 0', boxSizing: 'border-box', overflow: 'hidden', height: `${h}px`, paddingTop: st.paddingTop, paddingBottom: st.paddingBottom, marginTop: st.marginTop, marginBottom: st.marginBottom };
    const to = red ? { opacity: 0 } : { opacity: 0, translate: '8px 0', boxSizing: 'border-box', overflow: 'hidden', height: '0px', paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px' };
    const done = () => { el.remove(); box.remove(); };
    return el.animate([from, to], { delay: holdMs, duration: fadeMs, easing: EASE, fill: 'forwards' }).finished.then(done, done);
  }

  // ---- 목록 자리 이동(FLIP): 다른 항목이 빠지거나 끼어들 때 남은 항목이 미끄러져 자리를 잡는다 ----
  /**
   * mutate 가 container 의 자식 순서·구성을 바꾸는 동안, 남아 있는 자식들을 이전 자리에서 새 자리로 미끄러뜨린다.
   * 기본은 220ms ease-out(목록 행). 카드·썸네일처럼 큰 물체가 멀리 움직이면 springName 에 'glide' 를 준다
   */
  function flip(container, mutate, skip, springName) {
    const off = !on() || reduced() || container.children.length > LIST_FX_MAX;
    const first = new Map();
    if (!off) for (const k of container.children) first.set(k, k.getBoundingClientRect());
    mutate();
    if (off) return;
    const sp = springName ? springOf(springName) : null;
    for (const k of container.children) {
      const a = first.get(k);
      if (!a || k === skip) continue;
      const b = k.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
      if (!(a.width || a.height) || !(b.width || b.height)) continue; // 숨겨져 있었거나 숨겨진 것은 미끄러뜨리지 않는다
      if (dx || dy) k.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], sp ? { duration: sp.duration, easing: sp.css } : { duration: MOTION.list.ms, easing: EASE });
    }
  }

  // ---- 끌어 놓기 ----
  /** 끌기 모양(고스트): 행을 복제하고 그림자를 준다. 여러 개를 끌면 개수 배지를 단다 */
  function ghostOf(el, count) {
    const c = el.cloneNode(true);
    c.removeAttribute('id');
    c.classList.add('mo-ghost');
    if (count > 1) {
      const b = document.createElement('span');
      b.className = 'mo-ghost-badge';
      b.textContent = String(count);
      c.style.position = 'relative';
      c.appendChild(b);
    }
    return c;
  }
  /**
   * 고스트를 놓은 위치(from)에서 들어갈 자리(to)로 날려 보낸 뒤 치운다. 원래 있던 자리에서 출발시키지 않는다.
   * into 이면 폴더 같은 그릇 안으로 들어가는 것이라 그쪽으로 줄어들며 사라진다.
   */
  function flyGhost(el, from, to, into) {
    const done = () => { el.remove(); };
    if (!on()) { done(); return Promise.resolve(); }
    Object.assign(el.style, { position: 'fixed', margin: '0', left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, zIndex: '120', pointerEvents: 'none', transformOrigin: 'top left', boxSizing: 'border-box' });
    if (!el.isConnected) document.body.appendChild(el);
    const dx = to.left - from.left, dy = to.top - from.top;
    const frames = reduced()
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [{ transform: 'translate(0, 0) scale(1)', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(${into ? 0.6 : 1})`, opacity: into ? 0 : 1 }];
    return el.animate(frames, { duration: MOTION.popover.ms, easing: EASE, fill: 'forwards' }).finished.then(done, done);
  }

  // ---- 성격별 스프링(감쇠 조화 진동자). 큰 물체의 이동·받는 반응·서랍처럼 ease-out 하나로는 무게가 표현되지 않는 곳에 쓴다 ----
  const SPRING = {
    /** 떠 있는 표면이 자라남: 빠르게 도착해 한 번 살짝 넘친다 */
    pop: { k: 620, c: 30 },
    /** 선택·체크·배지·받는 반응: 통통 튄다 */
    bouncy: { k: 420, c: 19 },
    /** 큰 물체의 자리 이동(카드·썸네일 재정렬, 선택 표시): 부드럽게 미끄러지고 거의 넘치지 않는다 */
    glide: { k: 260, c: 27 },
    /** 서랍·화면 전환: 넘침 없이 묵직하다 */
    heavy: { k: 210, c: 29 },
    /** 눌림 복귀·작은 반응 */
    snappy: { k: 700, c: 38 },
  };
  /** 단위 계단 응답 x(t) (t 초) */
  function stepResponse(s, t) {
    const m = s.m || 1, w0 = Math.sqrt(s.k / m), z = s.c / (2 * Math.sqrt(s.k * m));
    if (t <= 0) return 0;
    if (z < 1) {
      const wd = w0 * Math.sqrt(1 - z * z);
      return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
    }
    if (z === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    const r = w0 * Math.sqrt(z * z - 1), a = -z * w0 + r, b = -z * w0 - r;
    return 1 - (b * Math.exp(a * t) - a * Math.exp(b * t)) / (b - a);
  }
  const solved = new Map();
  /** 프리셋 이름이나 { k, c } → { duration(ms), css(linear() 이징 문자열), fn(0..1 → 응답) }. 길이는 스프링이 가라앉는 시간에서 나온다 */
  function springOf(spec) {
    const s = typeof spec === 'string' ? SPRING[spec] : spec, key = `${s.k}/${s.c}/${s.m || 1}`;
    if (solved.has(key)) return solved.get(key);
    let last = 0;
    for (let t = 0; t < 4; t += 1 / 240) if (Math.abs(stepResponse(s, t) - 1) > 0.002) last = t;
    const T = last + 1 / 240, pts = [];
    for (let i = 0; i <= 48; i++) pts.push(i === 48 ? '1' : String(+stepResponse(s, (i / 48) * T).toFixed(4)));
    const out = { duration: Math.round(T * 1000), css: `linear(${pts.join(', ')})`, fn: (p) => (p <= 0 ? 0 : p >= 1 ? 1 : stepResponse(s, p * T)) };
    solved.set(key, out);
    return out;
  }
  const EASE_SUCK = 'cubic-bezier(0.55, 0, 0.85, 0.35)'; // 빨려 들어감: 느리게 출발해 급격히 가속

  /** 받는 반응: 무언가를 받은 대상(놓인 폴더·탭, 값이 바뀐 배지)이 한 번 튕기고 고리가 퍼진다 */
  const pulsing = new WeakMap();
  function pulse(el, strength) {
    if (!el || !on()) return;
    const old = pulsing.get(el);
    if (old) for (const a of old) a.cancel();
    const sp = springOf('bouncy'), s = 1 + 0.05 * (strength || 1), anims = [];
    if (!reduced()) anims.push(el.animate([{ scale: '1' }, { scale: String(s), offset: 0.35 }, { scale: '1' }], { duration: sp.duration, easing: sp.css }));
    anims.push(el.animate([{ boxShadow: '0 0 0 0 color-mix(in srgb, currentColor 35%, transparent)' }, { boxShadow: '0 0 0 10px transparent' }], { duration: sp.duration, easing: EASE }));
    pulsing.set(el, anims);
  }

  // ---- 스프링 고스트: 집으면 떠오르고, 포인터를 스프링으로 따라오며 속도에 따라 기울고, 여러 개면 부채꼴로 겹친다 ----
  /** 부채꼴: 카드마다 [기울기(deg), x, y] */
  const FAN = [[0, 0, 0], [5.5, 9, 6], [-4.5, -8, 11], [10, 17, 15]];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const chan = (v, k, c) => ({ v, vel: 0, to: v, k, c });
  const stepChan = (ch, dt) => { ch.vel += (-ch.k * (ch.v - ch.to) - ch.c * ch.vel) * dt; ch.v += ch.vel * dt; };

  /**
   * o.items: 끄는 요소들(첫 번째가 집은 것, 최대 4장이 보인다), o.count: 개수 배지(2 이상일 때), o.pointer: { x, y }, o.label: 설명 띠.
   * move(x, y) 로 포인터를 알리고, 끝낼 때 land(rect)·into(target)·cancel() 중 하나를 부른다(모두 Promise).
   * 위치는 transform 만으로 바꾼다. 요소는 호출 시점의 모습으로 복제하므로, 원본에 자리표시 스타일을 주기 전에 만든다.
   */
  function dragGhost(o) {
    const items = o.items.slice(0, FAN.length), n = items.length, count = o.count || o.items.length;
    const r = items[0].getBoundingClientRect(), w = r.width, h = r.height, wide = w > 320;
    const gx = clamp(o.pointer.x - r.left, 0, w), gy = clamp(o.pointer.y - r.top, 0, h);
    const still = !on() || reduced();
    // 넓은 행은 조금만 기울어도 끝이 크게 움직이므로 기울기와 떠오르는 배율을 줄인다
    const liftTo = wide ? 1.02 : 1.045, restRot = n > 1 ? 0 : wide ? -0.8 : -2.5, maxTilt = wide ? 2.5 : 13;
    const mk = (tag, cls, css) => { const e = document.createElement(tag); if (cls) e.className = cls; if (css) e.style.cssText = css; return e; };

    const el = mk('div', 'mo-drag-ghost', 'position:fixed;left:0;top:0;width:0;height:0;z-index:120;pointer-events:none;will-change:transform;');
    el.setAttribute('aria-hidden', 'true');
    const stack = mk('div', '', `position:absolute;left:${-gx}px;top:${-gy}px;width:${w}px;height:${h}px;transform-origin:${gx}px ${gy}px;will-change:transform;`);
    const shadow = mk('div', 'mo-ghost-shadow');
    stack.appendChild(shadow);
    const cards = [];
    // 뒤 카드부터 쌓는다(DOM 뒤쪽이 위): 맨 위가 집은 것
    for (let i = n - 1; i >= 0; i--) {
      const c = items[i].cloneNode(true);
      c.removeAttribute('id');
      c.classList.add('mo-ghost-card');
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      stack.appendChild(c);
      cards[i] = c;
    }
    el.appendChild(stack);
    let badge = null, badgeBox = null;
    if (count > 1) {
      badgeBox = mk('div', '', 'position:absolute;left:0;top:0;will-change:transform;');
      badge = mk('span', 'mo-ghost-badge');
      badge.textContent = String(count);
      badgeBox.appendChild(badge);
      el.appendChild(badgeBox);
    }
    const cap = mk('span', 'mo-ghost-cap');
    cap.textContent = o.label || '';
    el.appendChild(cap);
    document.body.appendChild(el);

    const x = chan(o.pointer.x, 520, 36), y = chan(o.pointer.y, 520, 36), sc = chan(1, 360, 22), rot = chan(0, 300, 20);
    sc.to = liftTo;
    rot.to = restRot;
    let alive = true, parked = false, raf = 0, last = performance.now(), inside = false;

    const paint = () => {
      const s = sc.v;
      el.style.transform = `translate3d(${x.v}px,${y.v}px,0) rotate(${rot.v}deg)`;
      stack.style.transform = `scale(${s})`;
      cap.style.transform = `translate(${(w / 2 - gx) * s}px, ${(h - gy) * s + 10}px) translateX(-50%)`; // 아래 가운데
      if (badgeBox) badgeBox.style.transform = `translate(${(w - gx) * s - 11}px, ${-gy * s - 11}px)`; // 오른쪽 위 모서리. 배지 자체는 커지지 않는다
    };
    const destroy = () => { if (!alive) return; alive = false; cancelAnimationFrame(raf); el.remove(); };
    const tick = (t) => {
      if (!alive) return;
      let rem = clamp((t - last) / 1000, 0.001, 0.05);
      last = t;
      while (rem > 0) { const d = Math.min(rem, 1 / 120); stepChan(x, d); stepChan(y, d); stepChan(sc, d); stepChan(rot, d); rem -= d; }
      // 기울기: 가로 속도에 비례(오른쪽으로 빠르면 시계 방향으로 눕는다)
      if (!parked) rot.to = clamp(x.vel * 0.011, -maxTilt, maxTilt) + restRot;
      paint();
      raf = requestAnimationFrame(tick);
    };

    if (still) {
      sc.v = sc.to; rot.to = rot.v = 0;
      for (let i = 1; i < n; i++) cards[i].style.transform = `translate(${FAN[i][1]}px,${FAN[i][2]}px) rotate(${FAN[i][0]}deg)`;
    } else {
      const pop = springOf('pop'), bn = springOf('bouncy');
      shadow.animate([{ opacity: 0 }, { opacity: 1 }], { duration: pop.duration, easing: pop.css, fill: 'backwards' });
      cap.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 90, fill: 'backwards' });
      // 부채꼴: 뒤 카드가 차례로 벌어진다
      for (let i = 1; i < n; i++) cards[i].animate([{ transform: 'none' }, { transform: `translate(${FAN[i][1]}px,${FAN[i][2]}px) rotate(${FAN[i][0]}deg)` }], { duration: bn.duration, easing: bn.css, delay: 40 * i, fill: 'both' });
      if (badge) badge.animate([{ scale: '0' }, { scale: '1' }], { duration: bn.duration, easing: bn.css, delay: 90, fill: 'backwards' });
      raf = requestAnimationFrame(tick);
    }
    paint();

    /** 목표 지점으로 스프링으로 가라앉은 뒤 사라진다 */
    function settle(t) {
      if (!alive) return Promise.resolve();
      parked = true;
      for (const a of cap.getAnimations()) a.cancel();
      cap.style.opacity = '0';
      if (still) { destroy(); return Promise.resolve(); }
      x.k = y.k = 460;
      x.to = t.x; y.to = t.y; sc.to = t.scale == null ? 1 : t.scale; rot.to = 0;
      for (let i = 1; i < n; i++) {
        const cur = getComputedStyle(cards[i]).transform;
        for (const a of cards[i].getAnimations()) a.cancel();
        cards[i].animate([{ transform: cur }, { transform: 'none' }], { duration: 260, easing: EASE, fill: 'forwards' });
      }
      if (t.fade) el.animate([{ opacity: 1 }, { opacity: 0.15 }], { duration: 320, easing: EASE_SUCK, fill: 'forwards' });
      return new Promise((res) => {
        const t0 = performance.now(), end = () => { clearTimeout(guard); destroy(); res(); };
        // 안전장치: 탭이 가려져 프레임이 돌지 않아도 끝난다
        const guard = setTimeout(end, 900);
        const chk = () => {
          if (!alive) return res();
          const near = Math.abs(x.v - x.to) < 1.2 && Math.abs(y.v - y.to) < 1.2 && Math.abs(x.vel) < 20 && Math.abs(y.vel) < 20;
          if (near || performance.now() - t0 > 650) end(); else requestAnimationFrame(chk);
        };
        requestAnimationFrame(chk);
      });
    }

    return {
      el,
      move(px, py) { if (parked) return; x.to = px; y.to = py; if (still) { x.v = px; y.v = py; paint(); } },
      setLabel(text) { if (cap.textContent !== text) cap.textContent = text; },
      /** 바깥 대상 위에 올라가면 작아진다(그 안으로 들어갈 것임을 보여 준다) */
      setInto(v) { if (v === inside) return; inside = v; sc.to = v ? 0.5 : liftTo; stack.style.opacity = v ? '0.9' : ''; if (still) { sc.v = sc.to; paint(); } },
      /** 지금 화면 위의 사각형(집은 것 기준) */
      rect() { const s = sc.v; return { left: x.v - gx * s, top: y.v - gy * s, width: w * s, height: h * s }; },
      /** 놓았다: rect(들어갈 자리의 화면 사각형)에 내려앉는다 */
      land(rect) { return settle({ x: rect.left + gx, y: rect.top + gy }); },
      /** 대상 안으로 빨려 들어가고, 대상이 받는 반응을 보인다 */
      into(target) {
        const tr = target.getBoundingClientRect();
        return settle({ x: tr.left + Math.min(tr.width / 2, 120), y: tr.top + tr.height / 2, scale: clamp(28 / Math.max(w, h), 0.04, 0.2), fade: true }).then(() => pulse(target, 1.6));
      },
      /** 취소: 집었던 자리(지금 원본이 있는 자리)로 되돌아간다 */
      cancel(home) { const b = (home || items[0]).getBoundingClientRect(); return settle({ x: b.left + gx, y: b.top + gy }); },
      destroy,
    };
  }

  function scrollParent(el) {
    for (let p = el; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const oy = getComputedStyle(p).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
    }
    return document.scrollingElement || document.documentElement;
  }

  /**
   * 세로 목록을 끌어서 순서를 바꾼다(포인터 이벤트라 마우스·터치·펜 공통).
   * 집으면 스프링 고스트가 떠올라 포인터를 따라가고, 끌던 항목은 빈 슬롯이 되어 놓일 자리를 보여 주며, 이웃은 미끄러져 비킨다.
   * 놓으면 고스트가 놓은 지점에서 슬롯으로 내려앉는다. 가장자리에서는 목록이 저절로 스크롤된다.
   * Esc·포인터 유실(창 포커스 이동, 탭 숨김, 놓는 신호를 놓침)은 취소이며 고스트가 원래 자리로 돌아간다. Alt+↑/↓ 는 키보드로 한 칸 이동.
   *
   * opts.handle      손잡이 선택자(없으면 항목 전체)
   * opts.group(item) 함께 끌 요소들(선택된 항목들). 집은 것 외에는 목록에서 잠시 빠지고 고스트에 겹쳐 보인다
   * opts.label(items, target) 고스트 아래 설명 띠의 글(빈 문자열이면 숨김). 결과를 슬롯만으로 알 수 없을 때만 쓴다
   * opts.onMove({ item, items, from, to }) 순서가 실제로 바뀌었을 때
   * opts.onDropInto({ items, target }) 목록 밖의 [data-mo-drop] 요소 위에 놓았을 때. 고스트가 대상으로 빨려 들어간 뒤 불린다
   * 되돌리는 함수를 돌려준다.
   */
  function sortable(list, opts) {
    opts = opts || {};
    list.classList.add('mo-sortable');
    if (!opts.handle) list.classList.add('mo-sortable-whole');
    const itemOf = (t) => { let n = t; while (n && n.parentElement !== list) n = n.parentElement; return n; };
    const indexOf = (n) => Array.prototype.indexOf.call(list.children, n);
    let busy = false; // 한 번에 하나: 내려앉는 동안 새 끌기를 받지 않는다

    function onDown(e) {
      if (e.button || busy) return;
      const item = itemOf(e.target);
      if (!item) return;
      if (opts.handle ? !e.target.closest(opts.handle) : e.target.closest('input, textarea, select, button, a, [contenteditable]')) return;
      const start = { x: e.clientX, y: e.clientY }, pid = e.pointerId, from = indexOf(item);
      let ghost = null, group = [item], homes = [], before0 = [], pt = start, edgeV = 0, raf = 0, scroller = null, over = null;

      const nextOutside = () => { let nx = item.nextElementSibling; while (nx && group.includes(nx)) nx = nx.nextElementSibling; return nx; };
      // 이웃의 가운데를 넘으면 슬롯을 옮긴다. 미끄러지는 중인 화면 위치가 아니라 레이아웃상의 자리로 판정해야 왔다 갔다 하지 않는다
      const reorder = () => {
        const base = list.getBoundingClientRect().top + list.clientTop - list.scrollTop;
        let before = null;
        for (const s of list.children) {
          if (group.includes(s)) continue;
          if (pt.y < base + s.offsetTop + s.offsetHeight / 2) { before = s; break; }
        }
        if (before !== nextOutside()) flip(list, () => list.insertBefore(item, before), item);
      };
      const label = () => (opts.label ? opts.label(group, over) || '' : '');
      const begin = () => {
        const sel = opts.group ? opts.group(item) : null;
        if (sel && sel.length > 1 && sel.includes(item)) group = [item].concat(sel.filter((s) => s !== item && s.parentElement === list));
        before0 = Array.from(list.children);
        homes = before0.filter((c) => group.includes(c)).map((c) => [c, c.nextElementSibling]); // 문서 순서
        ghost = dragGhost({ items: group, count: group.length, pointer: pt, label: label() }); // 자리표시 스타일을 주기 전에 복제한다
        if (getComputedStyle(list).position === 'static') list.style.position = 'relative';
        flip(list, () => { for (const c of group) c.classList.add(c === item ? 'mo-slot' : 'mo-drag-away'); }, item);
        document.documentElement.classList.add('mo-dragging');
        scroller = scrollParent(list);
        busy = true;
        loop();
      };
      // 가장자리 자동 스크롤: 포인터가 멈춰 있어도 계속 굴러야 하므로 프레임마다 돈다
      const loop = () => {
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (!ghost) return;
          if (edgeV) { scroller.scrollTop += edgeV * 14; reorder(); }
          loop();
        });
      };
      const update = () => {
        ghost.move(pt.x, pt.y);
        let t = null;
        if (opts.onDropInto) {
          const hit = document.elementFromPoint(pt.x, pt.y);
          t = hit && hit.closest('[data-mo-drop]');
          if (t && group.some((c) => c.contains(t))) t = null;
        }
        if (t !== over) {
          if (over) over.classList.remove('mo-drop-over');
          over = t;
          if (over) over.classList.add('mo-drop-over');
          ghost.setInto(!!over);
          ghost.setLabel(label());
        }
        const whole = scroller === document.scrollingElement || scroller === document.documentElement;
        const sr = whole ? { top: 0, bottom: window.innerHeight } : scroller.getBoundingClientRect();
        edgeV = over ? 0 : pt.y < sr.top + 48 ? -1 : pt.y > sr.bottom - 48 ? 1 : 0;
        if (!over) reorder();
      };
      const onMove = (ev) => {
        if (ev.pointerId !== pid) return;
        // 눌려 있어야 할 단추가 이미 떼어졌다(창 밖에서 놓아 신호를 놓친 경우)
        if (ev.pointerType === 'mouse' && ev.buttons === 0) { finish('cancel'); return; }
        pt = { x: ev.clientX, y: ev.clientY };
        if (!ghost) {
          if (Math.hypot(pt.x - start.x, pt.y - start.y) < MOTION.drag.threshold) return;
          begin();
        }
        ev.preventDefault();
        update();
      };
      const restore = () => flip(list, () => {
        for (const [c, nx] of homes.slice().reverse()) list.insertBefore(c, nx);
        for (const c of group) c.classList.remove('mo-drag-away');
      }, item);
      const finish = (mode) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('keydown', onKey, true);
        window.removeEventListener('blur', onCancel);
        document.removeEventListener('visibilitychange', onVis);
        cancelAnimationFrame(raf);
        if (!ghost) return;
        // 끌기 끝의 click 이 항목을 누른 것으로 처리되지 않게 한 번 막는다
        const stop = (c) => { c.stopPropagation(); c.preventDefault(); };
        list.addEventListener('click', stop, { capture: true, once: true });
        setTimeout(() => list.removeEventListener('click', stop, true), 0);
        document.documentElement.classList.remove('mo-dragging');
        const g = ghost, target = mode === 'drop' ? over : null;
        ghost = null;
        if (over) over.classList.remove('mo-drop-over');
        over = null;
        const done = () => { item.classList.remove('mo-slot'); busy = false; };
        if (target) {
          // 바깥 대상에 놓았다: 목록은 원래대로 두고, 고스트가 대상으로 빨려 들어간 뒤 호출자가 결과를 반영한다
          restore();
          g.into(target).then(() => { opts.onDropInto({ items: homes.map((h) => h[0]), target }); done(); });
        } else if (mode === 'cancel') {
          restore();
          g.cancel(item).then(done);
        } else {
          // 묶음은 원래의 상대 순서대로 슬롯 자리에 모인다
          const order = homes.map((h) => h[0]), ref = nextOutside();
          flip(list, () => { for (const c of order) { c.classList.remove('mo-drag-away'); list.insertBefore(c, ref); } }, item);
          for (const c of order) if (c !== item) play(c, 'list', false).then((ok) => { if (ok) release(c); });
          g.land(item.getBoundingClientRect()).then(() => {
            done();
            const now = Array.from(list.children);
            if (opts.onMove && now.some((c, i) => c !== before0[i])) opts.onMove({ item, items: order, from, to: indexOf(item) });
          });
        }
      };
      const onUp = (ev) => { if (ev.pointerId === pid) finish('drop'); };
      const onCancel = () => finish('cancel');
      const onVis = () => { if (document.visibilityState === 'hidden') finish('cancel'); };
      const onKey = (k) => { if (k.key === 'Escape' && ghost) { k.preventDefault(); k.stopPropagation(); finish('cancel'); } };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('keydown', onKey, true);
      window.addEventListener('blur', onCancel);
      document.addEventListener('visibilitychange', onVis);
    }
    function onKeyDown(e) {
      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || busy) return;
      const item = itemOf(e.target);
      if (!item) return;
      const from = indexOf(item), up = e.key === 'ArrowUp';
      if (up ? !item.previousElementSibling : !item.nextElementSibling) return;
      const ref = up ? item.previousElementSibling : item.nextElementSibling.nextElementSibling;
      e.preventDefault();
      flip(list, () => list.insertBefore(item, ref));
      if (typeof item.focus === 'function') item.focus();
      if (opts.onMove) opts.onMove({ item, items: [item], from, to: indexOf(item) });
    }
    list.addEventListener('pointerdown', onDown);
    list.addEventListener('keydown', onKeyDown);
    return () => { list.removeEventListener('pointerdown', onDown); list.removeEventListener('keydown', onKeyDown); };
  }

  g.Motion = {
    MOTION, SPRING, LIST_FX_MAX, on, reduced, spring, springOf,
    enter, leave, dialog, slide, flash, FLASH_ACTION, insert, remove, flip, pulse,
    ghostOf, flyGhost, dragGhost, sortable,
  };
})(typeof window !== 'undefined' ? window : globalThis);
