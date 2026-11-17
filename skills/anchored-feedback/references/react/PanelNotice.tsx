// 이 프로젝트에서 실행 검증하지 않음 — 처음 적용할 때 타입체크와 테스트로 확인할 것
import { feedback, useFeedback } from './feedback'
import { useAnchor } from './useAnchor'

interface Props {
  scope: string
  /** bottom=상태줄(패널 하단), top=배너(패널 상단) */
  placement?: 'top' | 'bottom'
}

/**
 * 패널 마크업 안에 한 번 둔다: `<PanelNotice scope="query" placement="bottom" />` → 앵커 `query.panel`.
 * 자기 루트가 앵커라서 항목이 없어도 요소는 남는다(높이 0). 가장 최근 항목 한 줄만 보여 준다.
 * 스타일은 feedback-components.css.
 */
export function PanelNotice({ scope, placement = 'bottom' }: Props) {
  const ref = useAnchor<HTMLDivElement>(`${scope}.panel`, 'panel')
  const { forPanel } = useFeedback()
  const items = forPanel(scope)
  const item = items[0]
  return (
    <div className={`fb-notice ${placement}`} ref={ref}>
      {item && (
        <div
          className={`fb-notice-line fb-${item.kind}`}
          role={item.kind === 'error' ? 'alert' : 'status'}
        >
          {item.loc && <span className="fb-loc">{item.loc}</span>}
          <span className="fb-msg">
            {item.title}
            {item.detail && <span className="fb-detail"> — {item.detail}</span>}
          </span>
          {item.count > 1 && (
            <span key={item.seq} className="fb-cnt">
              {item.count}회
            </span>
          )}
          <span className="fb-grow" />
          {(item.actions ?? []).map((a, i) => (
            <button key={a.label} className={i === 0 ? 'fb-act primary' : 'fb-act'} onClick={a.run}>
              {a.label}
            </button>
          ))}
          {items.length > 1 && <span className="fb-more">외 {items.length - 1}건</span>}
          <button className="fb-x" aria-label="닫기" onClick={() => feedback.clear(item.key)}>
            ×
          </button>
        </div>
      )}
    </div>
  )
}
