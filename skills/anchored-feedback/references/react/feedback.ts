// 이 프로젝트에서 실행 검증하지 않음 — 처음 적용할 때 타입체크와 테스트로 확인할 것
/**
 * 피드백 컨트롤러(React 판). svelte5/feedback.svelte.ts 와 같은 의미 — 상태만 rune 대신 외부 스토어다.
 * 렌더러는 `useFeedback()`(useSyncExternalStore)으로 구독한다. items 는 항상 새 배열로 교체한다(불변).
 *
 * 배치: panel(PanelNotice) / trigger(팝오버, error 는 버튼에 빨간 점) / tray(좌하단 칩).
 * 합치기: 같은 key 는 count·at·seq 만 올린다. error·warn 은 시간으로 닫지 않는다.
 */
import { useSyncExternalStore } from 'react'
import { resolve, setMark, type Resolved } from './anchors'

export type FeedbackKind = 'error' | 'warn' | 'info'
export type FeedbackPlacement = 'panel' | 'trigger' | 'tray'
export type ClearOn = 'input' | 'success' | 'manual' | number

export interface FeedbackAction {
  label: string
  run: () => void
}

export interface FeedbackReport {
  key: string
  kind: FeedbackKind
  title: string
  detail?: string
  reassure?: string
  loc?: string
  anchors: string[]
  actions?: FeedbackAction[]
  clearOn?: ClearOn
}

export interface FeedbackItem extends Omit<FeedbackReport, 'clearOn'> {
  count: number
  at: number
  /** 반복될 때마다 증가 — 렌더러가 `key={seq}` 로 흔들림 애니메이션을 다시 건다 */
  seq: number
  placement: FeedbackPlacement
  anchorId: string | null
  open: boolean
  clearOn: ClearOn
}

const OK_MS = 1500
const TRAY_INFO_MS = 4000
const TRIGGER_WARN_MS = 6000

type Listener = () => void

class FeedbackController {
  #items: FeedbackItem[] = []
  #seq = 0
  #timers = new Map<string, ReturnType<typeof setTimeout>>()
  #okTimers = new Map<string, ReturnType<typeof setTimeout>>()
  #marked = new Set<string>()
  #listeners = new Set<Listener>()

  /** useSyncExternalStore 용 */
  subscribe = (l: Listener): (() => void) => {
    this.#listeners.add(l)
    return () => void this.#listeners.delete(l)
  }
  getSnapshot = (): FeedbackItem[] => this.#items

  get items(): FeedbackItem[] {
    return this.#items
  }

  #set(items: FeedbackItem[]): void {
    this.#items = items
    for (const l of this.#listeners) l()
  }

  report(r: FeedbackReport): void {
    const found = resolve(r.anchors)
    const placement = placementOf(found)
    const prev = this.#items.find((i) => i.key === r.key)
    const item: FeedbackItem = {
      ...r,
      count: (prev?.count ?? 0) + 1,
      at: Date.now(),
      seq: ++this.#seq,
      placement,
      anchorId: found?.id ?? null,
      open: placement === 'trigger' || (placement === 'tray' && r.kind === 'error'),
      clearOn: r.clearOn ?? defaultClearOn(r.kind, placement),
    }
    this.#set(
      prev ? this.#items.map((i) => (i.key === r.key ? item : i)) : [...this.#items, item],
    )
    this.#arm(item)
    this.#syncMarks()
  }

  /** 성공을 트리거 버튼에서 확인시킨다. 버튼이 없으면 트레이 칩으로 대신한다. */
  ok(anchorId: string, label = '완료'): void {
    if (resolve([anchorId])) {
      setMark(anchorId, 'ok', label)
      clearTimeout(this.#okTimers.get(anchorId))
      this.#okTimers.set(
        anchorId,
        setTimeout(() => {
          this.#okTimers.delete(anchorId)
          setMark(anchorId, 'ok', null)
        }, OK_MS),
      )
      return
    }
    this.report({ key: `ok:${anchorId}`, kind: 'info', title: label, anchors: [], clearOn: 2500 })
  }

  clear(key: string): void {
    if (!this.#items.some((i) => i.key === key)) return
    this.#disarm(key)
    this.#set(this.#items.filter((i) => i.key !== key))
    this.#syncMarks()
  }

  clearScope(prefix: string): void {
    const gone = this.#items.filter((i) => i.key.startsWith(prefix))
    if (!gone.length) return
    for (const i of gone) this.#disarm(i.key)
    this.#set(this.#items.filter((i) => !i.key.startsWith(prefix)))
    this.#syncMarks()
  }

  /** 팝오버·상세만 접는다. 항목과 버튼의 점은 남는다. */
  dismiss(key: string): void {
    this.#set(this.#items.map((i) => (i.key === key ? { ...i, open: false } : i)))
  }

  toggle(key: string): void {
    this.#set(this.#items.map((i) => (i.key === key ? { ...i, open: !i.open } : i)))
  }

  /** 앵커가 사라졌을 때(팝오버 렌더러가 발견) 다시 정한다. */
  reroute(key: string): void {
    const cur = this.#items.find((i) => i.key === key)
    if (!cur) return
    const found = resolve(cur.anchors)
    const placement = placementOf(found)
    if (placement === cur.placement && (found?.id ?? null) === cur.anchorId) return
    const next: FeedbackItem = {
      ...cur,
      placement,
      anchorId: found?.id ?? null,
      open: cur.open || placement === 'tray',
    }
    this.#set(this.#items.map((i) => (i.key === key ? next : i)))
    this.#arm(next)
    this.#syncMarks()
  }

  get(key: string): FeedbackItem | undefined {
    return this.#items.find((i) => i.key === key)
  }

  /** 패널(`scope.panel` 앵커)에 붙은 항목, 가장 최근 발생 순 */
  forPanel(scope: string, items: FeedbackItem[] = this.#items): FeedbackItem[] {
    return items
      .filter((i) => i.placement === 'panel' && i.anchorId === `${scope}.panel`)
      .sort((a, b) => b.at - a.at)
  }

  get tray(): FeedbackItem[] {
    return trayOf(this.#items)
  }

  get popovers(): FeedbackItem[] {
    return popoversOf(this.#items)
  }

  #arm(item: FeedbackItem): void {
    this.#disarm(item.key)
    const ms = typeof item.clearOn === 'number' ? item.clearOn : null
    if (ms === null) return
    this.#timers.set(
      item.key,
      setTimeout(() => this.clear(item.key), ms),
    )
  }

  #disarm(key: string): void {
    const t = this.#timers.get(key)
    if (t !== undefined) clearTimeout(t)
    this.#timers.delete(key)
  }

  #syncMarks(): void {
    const want = new Set<string>()
    for (const i of this.#items) {
      if (i.kind === 'error' && i.placement === 'trigger' && i.anchorId) want.add(i.anchorId)
    }
    for (const id of this.#marked) if (!want.has(id)) setMark(id, 'error', null)
    for (const id of want) if (!this.#marked.has(id)) setMark(id, 'error', '1')
    this.#marked = want
  }
}

const trayOf = (items: FeedbackItem[]) => items.filter((i) => i.placement === 'tray')
const popoversOf = (items: FeedbackItem[]) =>
  items.filter((i) => i.placement === 'trigger' && i.open)

function placementOf(found: Resolved | null): FeedbackPlacement {
  if (!found) return 'tray'
  return found.role === 'panel' ? 'panel' : 'trigger'
}

function defaultClearOn(kind: FeedbackKind, placement: FeedbackPlacement): ClearOn {
  if (kind === 'error') return 'manual'
  if (placement === 'tray' && kind === 'info') return TRAY_INFO_MS
  if (placement === 'trigger' && kind === 'warn') return TRIGGER_WARN_MS
  return kind === 'info' ? 'input' : 'manual'
}

export const feedback = new FeedbackController()

/** 컴포넌트에서 항목 목록을 구독한다. 파생 값(tray·popovers·forPanel)은 렌더 안에서 계산한다. */
export function useFeedback() {
  const items = useSyncExternalStore(feedback.subscribe, feedback.getSnapshot, feedback.getSnapshot)
  return {
    items,
    tray: trayOf(items),
    popovers: popoversOf(items),
    forPanel: (scope: string) => feedback.forPanel(scope, items),
  }
}
