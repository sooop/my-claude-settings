// 이 프로젝트에서 실행 검증하지 않음 — 처음 적용할 때 타입체크와 테스트로 확인할 것
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { resolve } from './anchors'
import { feedback, useFeedback, type FeedbackItem } from './feedback'

/**
 * 앱 최상단에 한 번 둔다. 트리거 팝오버(항목마다)와 좌하단 칩 트레이를 그린다.
 * 위치 계산은 svelte5/FeedbackPopover.svelte 와 같다. 스타일은 feedback-components.css.
 */
export function FeedbackHost() {
  const { popovers, tray } = useFeedback()
  return (
    <>
      {popovers.map((item) => (
        <Popover key={item.key} item={item} />
      ))}
      {tray.length > 0 && (
        <div className="fb-tray">
          {tray.map(
            (item) =>
              item.open && (
                <div
                  key={item.key}
                  className={`fb-detail-box fb-${item.kind}`}
                  role={item.kind === 'error' ? 'alert' : 'status'}
                >
                  <Body item={item} onClose={() => feedback.dismiss(item.key)} />
                </div>
              ),
          )}
          <div className="fb-chips">
            {tray.map((item) => (
              <button
                key={item.key}
                className={`fb-chip fb-${item.kind}`}
                aria-expanded={item.open}
                onClick={() => feedback.toggle(item.key)}
              >
                <span className="fb-dot" />
                {item.title}
                {item.count > 1 ? ` ×${item.count}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function Body({ item, onClose }: { item: FeedbackItem; onClose: () => void }) {
  return (
    <>
      <div className="fb-head">
        <span className="fb-ic">{item.kind === 'info' ? 'i' : '!'}</span>
        <div className="fb-txt">
          <div className="fb-row">
            <b>{item.title}</b>
            {item.count > 1 && (
              <span key={item.seq} className="fb-cnt-pill">
                ×{item.count}
              </span>
            )}
          </div>
          {item.detail && <div className="fb-detail">{item.detail}</div>}
          {item.reassure && <div className="fb-reassure">{item.reassure}</div>}
        </div>
        <button className="fb-x" aria-label="닫기" onClick={onClose}>
          ×
        </button>
      </div>
      {item.actions?.length ? (
        <div className="fb-acts">
          {item.actions.map((a, i) => (
            <button
              key={a.label}
              className={i === 0 ? 'fb-act primary' : 'fb-act'}
              onClick={() => {
                a.run()
                onClose()
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  )
}

const GAP = 8
const MARGIN = 8

function Popover({ item }: { item: FeedbackItem }) {
  const pop = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState({ left: 0, top: 0, tail: 16, below: true, ready: false })

  function reposition(): void {
    const el = pop.current
    if (!el) return
    const found = item.anchorId ? resolve([item.anchorId]) : null
    if (!found) {
      feedback.reroute(item.key) // 버튼이 사라졌다 — 다른 앵커나 트레이로
      return
    }
    const r = found.el.getBoundingClientRect()
    const w = el.offsetWidth
    const h = el.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    // 앵커가 화면 오른쪽 절반이면 오른쪽 끝을 맞춰 안쪽으로 펼친다.
    const preferred = r.left + r.width / 2 > vw / 2 ? r.right - w : r.left
    const left = Math.max(MARGIN, Math.min(preferred, vw - w - MARGIN))
    const below = r.bottom + GAP + h <= vh - MARGIN || r.top - GAP - h < MARGIN
    const top = below ? r.bottom + GAP : r.top - GAP - h
    const tail = Math.max(12, Math.min(r.left + r.width / 2 - left - 5, w - 22))
    setPlace({ left, top, tail, below, ready: true })
  }

  // 반복 발생(seq)·앵커 변경 때마다 다시 잰다.
  useLayoutEffect(() => {
    reposition()
    const on = () => reposition()
    window.addEventListener('resize', on)
    window.addEventListener('scroll', on, true)
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('scroll', on, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.seq, item.anchorId])

  // 바깥 클릭·Escape 로 닫기(svelte5/dismiss.ts 와 같은 규약). 팝오버를 연 클릭은 첫 프레임 무시.
  useEffect(() => {
    let armed = false
    const raf = requestAnimationFrame(() => {
      armed = true
    })
    const close = () => feedback.dismiss(item.key)
    const onDown = (e: PointerEvent) => {
      if (!armed) return
      const t = e.target as Node
      const anchorEl = item.anchorId ? resolve([item.anchorId])?.el : null
      if (pop.current?.contains(t) || anchorEl?.contains(t)) return
      close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pop.current?.contains(document.activeElement)) close()
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [item.key, item.anchorId])

  const style: CSSProperties = {
    left: place.left,
    top: place.top,
    visibility: place.ready ? 'visible' : 'hidden',
  }
  return (
    <div
      ref={pop}
      className={`fb-pop fb-${item.kind}${place.below ? ' below' : ''}`}
      style={style}
      role={item.kind === 'error' ? 'alert' : 'status'}
    >
      <span className="fb-tail" style={{ left: place.tail }} />
      <Body item={item} onClose={() => feedback.dismiss(item.key)} />
    </div>
  )
}
