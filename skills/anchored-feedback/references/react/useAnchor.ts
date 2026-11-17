// 이 프로젝트에서 실행 검증하지 않음 — 처음 적용할 때 타입체크와 테스트로 확인할 것
import { useCallback, useRef } from 'react'
import { register, type AnchorRole } from './anchors'

/**
 * ref callback 훅. 요소가 마운트되면 등록하고 언마운트·id 변경 시 해제한다.
 *   const ref = useAnchor('query.save', 'trigger')
 *   <button ref={ref}>저장</button>
 * 반환 ref 는 id·role 이 바뀔 때만 새로 만들어진다(렌더마다 재등록되지 않는다).
 */
export function useAnchor<T extends HTMLElement = HTMLElement>(
  id: string,
  role: AnchorRole = 'trigger',
) {
  const off = useRef<(() => void) | null>(null)
  return useCallback(
    (el: T | null) => {
      off.current?.()
      off.current = el ? register(id, role, el) : null
    },
    [id, role],
  )
}
