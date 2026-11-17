/**
 * 앵커 레지스트리 — 오류·알림을 "어디에 붙일지" 정하기 위한 화면 요소 목록.
 *
 * 요소에 `{@attach anchor('query.save', 'trigger')}`를 붙이면 등록되고, 요소가 사라지면(언마운트·
 * `display:none`) 자동으로 후보에서 빠진다. `feedback.report({ anchors: [...] })`가 우선순위 목록을
 * 넘기면 `resolve`가 앞에서부터 화면에 남아 있는 첫 요소를 고른다. 하나도 없으면 `null` — 호출자는
 * 이를 작업 트레이로 보낸다.
 *
 * - `cause`   오류를 낸 토큰·필드 (1순위)
 * - `panel`   영향받은 패널. `PanelNotice`가 자기 루트에 붙인다 (2순위)
 * - `trigger` 동작을 실행한 상시 버튼 (3순위)
 *
 * 닫히는 UI(메뉴 항목, 다이얼로그 안의 요소)는 앵커로 쓰지 않는다. 오류가 도착하기 전에 사라진다.
 */

export type AnchorRole = 'cause' | 'panel' | 'trigger'

export interface Resolved {
  id: string
  role: AnchorRole
  el: HTMLElement
}

interface Entry {
  role: AnchorRole
  el: HTMLElement
}

/** 요소가 지금 화면에 있는가. 테스트에서 바꿔 끼울 수 있도록 분리했다. */
export type Probe = (el: HTMLElement) => boolean
export const defaultProbe: Probe = (el) => el.isConnected && el.getClientRects().length > 0

const registry = new Map<string, Entry[]>()

/** 요소에 붙은 표식. 나중에 등록되는 요소(리렌더로 교체된 버튼)에도 다시 적용한다. */
const marks = new Map<string, string>()
const markKey = (name: string, id: string) => `${name}\u0000${id}`

export type MarkName = 'error' | 'ok'

function applyMark(el: HTMLElement, name: MarkName, value: string | null): void {
  const attr = `data-fb-${name}`
  if (value === null) {
    el.removeAttribute(attr)
    return
  }
  // 표식은 ::before/::after 로 그려지므로 absolute 기준점이 필요하다.
  if (typeof getComputedStyle === 'function' && getComputedStyle(el).position === 'static') {
    el.style.position = 'relative'
  }
  el.setAttribute(attr, value)
}

export function register(id: string, role: AnchorRole, el: HTMLElement): () => void {
  const entry: Entry = { role, el }
  registry.set(id, [...(registry.get(id) ?? []), entry])
  for (const name of ['error', 'ok'] as const) {
    const v = marks.get(markKey(name, id))
    if (v !== undefined) applyMark(el, name, v)
  }
  return () => {
    const rest = (registry.get(id) ?? []).filter((e) => e !== entry)
    if (rest.length) registry.set(id, rest)
    else registry.delete(id)
  }
}

/** Svelte attachment. `<button {@attach anchor('output.copy')}>` */
export function anchor(id: string, role: AnchorRole = 'trigger') {
  return (el: HTMLElement) => register(id, role, el)
}

/** 같은 id 로 여러 요소가 등록됐으면 가장 나중 것(최근에 그려진 것)부터 본다. */
export function resolve(ids: readonly string[], probe: Probe = defaultProbe): Resolved | null {
  for (const id of ids) {
    const list = registry.get(id)
    if (!list) continue
    for (let i = list.length - 1; i >= 0; i--) {
      const { el, role } = list[i]
      if (probe(el)) return { id, role, el }
    }
  }
  return null
}

/** 해당 id 의 모든 요소에 `data-fb-<name>` 표식을 켜거나(value) 끈다(null). */
export function setMark(id: string, name: MarkName, value: string | null): void {
  const key = markKey(name, id)
  if (value === null) marks.delete(key)
  else marks.set(key, value)
  for (const { el } of registry.get(id) ?? []) applyMark(el, name, value)
}
