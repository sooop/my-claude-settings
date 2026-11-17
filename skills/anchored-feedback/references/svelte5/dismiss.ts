/**
 * 팝오버 닫기 규약 — Escape + 바깥 클릭.
 *
 * 앵커에 붙는 팝오버(열 관리·칼럼 필터·찾기 패널·jq 히스토리 메뉴·타이포그래피 팝오버)는 스크림이
 * 없으므로 "밖을 누르면 닫힌다"와 "Escape로 닫힌다"를 각자 구현해야 했고, 그래서 절반은 빠져
 * 있었다. 이 attachment 하나를 루트 요소에 붙이면 둘 다 갖는다.
 *
 * ```svelte
 * <div class="pop" {@attach dismissable(onClose)}>…</div>
 * ```
 *
 * - 바깥 클릭은 `pointerdown` 캡처 단계에서 본다. 팝오버를 연 그 클릭이 곧바로 닫기로 잡히지
 *   않도록 첫 프레임은 무시한다.
 * - `ignore`에 앵커 버튼을 넘기면 그 버튼을 다시 누를 때 "닫기 → 토글로 다시 열기"가 겹치지 않는다.
 * - Escape는 요소 안에서 눌렸을 때만(포커스가 안에 있을 때) 처리한다. 밖에서 누른 Escape는
 *   모드의 단축키 체인이 담당한다.
 */

export interface DismissOptions {
  /** 바깥 클릭으로 닫기 (기본 true) */
  outside?: boolean
  /** Escape로 닫기 (기본 true) */
  escape?: boolean
  /** 바깥으로 치지 않을 요소(앵커 버튼 등) */
  ignore?: () => (HTMLElement | null | undefined)[]
}

export function dismissable(onClose: () => void, opts: DismissOptions = {}) {
  const { outside = true, escape = true, ignore } = opts
  return (el: HTMLElement) => {
    let armed = false
    const arm = requestAnimationFrame(() => (armed = true))

    const onPointerDown = (e: PointerEvent): void => {
      if (!armed) return
      const t = e.target as Node | null
      if (!t || el.contains(t)) return
      for (const ig of ignore?.() ?? []) if (ig && ig.contains(t)) return
      onClose()
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }

    if (outside) document.addEventListener('pointerdown', onPointerDown, true)
    if (escape) el.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(arm)
      document.removeEventListener('pointerdown', onPointerDown, true)
      el.removeEventListener('keydown', onKeyDown)
    }
  }
}
