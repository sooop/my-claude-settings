/**
 * 피드백 컨트롤러 — `dialog/dialog.svelte.ts`와 같은 문체의 모듈 싱글턴. 옛 토스트를 대체한다.
 *
 * 오류·경고·안내를 "원인에 가장 가까운, 화면에 남아 있는 곳"에 붙인다. 호출자는 우선순위가 있는
 * 앵커 id 목록을 넘기고, 어디에 그릴지는 `anchors.resolve`가 정한다.
 *
 *   feedback.report({ key: 'query.save', kind: 'error', title: '저장하지 못했습니다',
 *     anchors: ['query.save'], reassure: '쿼리 내용은 편집기에 그대로 있습니다.' })
 *   feedback.ok('output.copy', '복사됨')     // 성공은 누른 버튼에서 확인
 *   feedback.clear('query.save')            // 같은 동작이 성공하면 해제
 *
 * 배치(placement)
 * - `panel`   앵커가 panel 역할 → `<PanelNotice scope>`가 그린다 (상태줄·배너)
 * - `trigger` 앵커가 trigger/cause 역할 → `<FeedbackHost>`가 꼬리 달린 팝오버로 그린다.
 *             error 는 닫아도 버튼의 빨간 점이 남는다.
 * - `tray`    남은 앵커가 없음 → 좌하단 칩. error 는 확인할 때까지 남는다.
 *
 * 합치기: 같은 `key`가 다시 오면 새 항목을 만들지 않고 `count`·`at`·`seq`만 올린다(흔들림 신호).
 * 해제: error·warn 은 시간으로 사라지지 않는다. 같은 key 의 성공(`clear`)·입력(`clearScope`)·
 * 사용자가 × 로 닫을 때만. `clearOn`에 ms 를 주면 그 시간 뒤 사라진다.
 */
import { resolve, setMark, type Resolved } from './anchors'

export type FeedbackKind = 'error' | 'warn' | 'info'
export type FeedbackPlacement = 'panel' | 'trigger' | 'tray'
/** 'input'·'success'·'manual'은 해제 시점을 문서화할 뿐 타이머를 걸지 않는다. 숫자는 ms. */
export type ClearOn = 'input' | 'success' | 'manual' | number

export interface FeedbackAction {
  label: string
  run: () => void
}

export interface FeedbackReport {
  /** 합치기·해제의 단위. 같은 동작의 같은 실패는 같은 key. `scope.name` 꼴을 권한다 */
  key: string
  kind: FeedbackKind
  title: string
  detail?: string
  /** 무엇이 유지되었는지("쿼리 내용은 편집기에 그대로 있습니다") — 다시 입력할 필요가 없음을 밝힌다 */
  reassure?: string
  /** `3:14` 같은 위치 칩 */
  loc?: string
  /** 우선순위 순서. 앞에서부터 화면에 남아 있는 첫 요소를 고른다. 비우면 곧바로 트레이 */
  anchors: string[]
  actions?: FeedbackAction[]
  clearOn?: ClearOn
}

export interface FeedbackItem extends Omit<FeedbackReport, 'clearOn'> {
  count: number
  /** 마지막 발생 시각(ms) */
  at: number
  /** 반복될 때마다 증가 — 렌더러가 `{#key seq}`로 흔들림 애니메이션을 다시 건다 */
  seq: number
  placement: FeedbackPlacement
  anchorId: string | null
  /** 팝오버·트레이 상세가 펼쳐져 있는가. × 로 닫아도 항목(과 버튼의 점)은 남는다 */
  open: boolean
  clearOn: ClearOn
}

const OK_MS = 1500
const TRAY_INFO_MS = 4000
const TRIGGER_WARN_MS = 6000

class FeedbackController {
  items = $state<FeedbackItem[]>([])
  #seq = 0
  #timers = new Map<string, ReturnType<typeof setTimeout>>()
  #okTimers = new Map<string, ReturnType<typeof setTimeout>>()
  /** 빨간 점을 켜 둔 앵커 id */
  #marked = new Set<string>()

  report(r: FeedbackReport): void {
    const found = resolve(r.anchors)
    const placement = placementOf(found)
    const prev = this.items.find((i) => i.key === r.key)
    const item: FeedbackItem = {
      ...r,
      count: (prev?.count ?? 0) + 1,
      at: Date.now(),
      seq: ++this.#seq,
      placement,
      anchorId: found?.id ?? null,
      // 트레이는 오류만 한 번 펼쳐 보여 준다. 반복돼도 다시 펼친다(새 시도의 결과이므로).
      open: placement === 'trigger' || (placement === 'tray' && r.kind === 'error'),
      clearOn: r.clearOn ?? defaultClearOn(r.kind, placement),
    }
    this.items = prev
      ? this.items.map((i) => (i.key === r.key ? item : i))
      : [...this.items, item]
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

  /** 항목을 없앤다. 버튼의 점도 같은 앵커의 마지막 error 가 사라지면 꺼진다. */
  clear(key: string): void {
    if (!this.items.some((i) => i.key === key)) return
    this.#disarm(key)
    this.items = this.items.filter((i) => i.key !== key)
    this.#syncMarks()
  }

  /** `prefix`로 시작하는 key 를 모두 없앤다. 실행 성공·입력 시 `clearScope('run.')`. */
  clearScope(prefix: string): void {
    const gone = this.items.filter((i) => i.key.startsWith(prefix))
    if (!gone.length) return
    for (const i of gone) this.#disarm(i.key)
    this.items = this.items.filter((i) => !i.key.startsWith(prefix))
    this.#syncMarks()
  }

  /** 팝오버·상세만 접는다. 항목과 버튼의 점은 남는다. */
  dismiss(key: string): void {
    this.items = this.items.map((i) => (i.key === key ? { ...i, open: false } : i))
  }

  toggle(key: string): void {
    this.items = this.items.map((i) => (i.key === key ? { ...i, open: !i.open } : i))
  }

  /** 앵커가 사라졌을 때(팝오버 렌더러가 발견) 다시 정한다. */
  reroute(key: string): void {
    const cur = this.items.find((i) => i.key === key)
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
    this.items = this.items.map((i) => (i.key === key ? next : i))
    this.#arm(next)
    this.#syncMarks()
  }

  get(key: string): FeedbackItem | undefined {
    return this.items.find((i) => i.key === key)
  }

  /** 패널(`scope.panel` 앵커)에 붙은 항목, 가장 최근 발생 순 */
  forPanel(scope: string): FeedbackItem[] {
    return this.items
      .filter((i) => i.placement === 'panel' && i.anchorId === `${scope}.panel`)
      .sort((a, b) => b.at - a.at)
  }

  /** 앵커에 붙지 못하고 트레이로 온 항목 */
  get tray(): FeedbackItem[] {
    return this.items.filter((i) => i.placement === 'tray')
  }

  get popovers(): FeedbackItem[] {
    return this.items.filter((i) => i.placement === 'trigger' && i.open)
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
    for (const i of this.items) {
      if (i.kind === 'error' && i.placement === 'trigger' && i.anchorId) want.add(i.anchorId)
    }
    for (const id of this.#marked) if (!want.has(id)) setMark(id, 'error', null)
    for (const id of want) if (!this.#marked.has(id)) setMark(id, 'error', '1')
    this.#marked = want
  }
}

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
