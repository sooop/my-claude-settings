import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { register, resolve, setMark, type AnchorRole } from '../src/lib/ui/feedback/anchors'
import { feedback } from '../src/lib/ui/feedback/feedback.svelte'

/** node 환경용 가짜 요소. `visible=false`면 화면에서 사라진 것(display:none·언마운트)으로 본다. */
function fakeEl(visible = true) {
  const attrs = new Map<string, string>()
  const el = {
    visible,
    isConnected: true,
    getClientRects: () => (el.visible ? [{}] : []),
    setAttribute: (k: string, v: string) => void attrs.set(k, v),
    removeAttribute: (k: string) => void attrs.delete(k),
    attrs,
  }
  return el as unknown as HTMLElement & { visible: boolean; attrs: Map<string, string> }
}

const cleanups: (() => void)[] = []
function mount(id: string, role: AnchorRole, visible = true) {
  const el = fakeEl(visible)
  cleanups.push(register(id, role, el))
  return el
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  feedback.clearScope('')
  for (const c of cleanups.splice(0)) c()
  vi.useRealTimers()
})

describe('anchors.resolve', () => {
  it('우선순위 순서대로 화면에 남아 있는 첫 요소를 고른다', () => {
    mount('cause', 'cause', false)
    const panel = mount('x.panel', 'panel')
    mount('x.btn', 'trigger')
    const r = resolve(['cause', 'x.panel', 'x.btn'])
    expect(r?.id).toBe('x.panel')
    expect(r?.el).toBe(panel)
  })

  it('하나도 없으면 null', () => {
    mount('a', 'trigger', false)
    expect(resolve(['a', 'missing'])).toBeNull()
  })

  it('등록을 풀면 후보에서 빠진다', () => {
    const el = fakeEl()
    const off = register('gone', 'trigger', el)
    expect(resolve(['gone'])).not.toBeNull()
    off()
    expect(resolve(['gone'])).toBeNull()
  })

  it('나중에 등록된 요소에도 표식을 다시 적용한다', () => {
    setMark('late', 'error', '1')
    const el = mount('late', 'trigger')
    expect(el.attrs.get('data-fb-error')).toBe('1')
    setMark('late', 'error', null)
    expect(el.attrs.has('data-fb-error')).toBe(false)
  })
})

describe('feedback.report', () => {
  it('앵커 역할에 따라 배치가 정해진다', () => {
    mount('p.panel', 'panel')
    mount('b.btn', 'trigger')
    feedback.report({ key: 'a', kind: 'error', title: 't', anchors: ['p.panel'] })
    feedback.report({ key: 'b', kind: 'error', title: 't', anchors: ['b.btn'] })
    feedback.report({ key: 'c', kind: 'error', title: 't', anchors: ['none'] })
    expect(feedback.get('a')?.placement).toBe('panel')
    expect(feedback.get('b')?.placement).toBe('trigger')
    expect(feedback.get('c')?.placement).toBe('tray')
  })

  it('같은 key 는 새 항목을 쌓지 않고 count 만 올린다', () => {
    mount('p.panel', 'panel')
    for (let i = 0; i < 3; i++) {
      feedback.report({ key: 'run.query', kind: 'error', title: '구문 오류', anchors: ['p.panel'] })
    }
    expect(feedback.items).toHaveLength(1)
    expect(feedback.get('run.query')?.count).toBe(3)
    expect(feedback.forPanel('p')).toHaveLength(1)
  })

  it('반복될 때마다 seq 가 늘어 흔들림 신호가 된다', () => {
    feedback.report({ key: 'k', kind: 'error', title: 't', anchors: [] })
    const a = feedback.get('k')!.seq
    feedback.report({ key: 'k', kind: 'error', title: 't', anchors: [] })
    expect(feedback.get('k')!.seq).toBeGreaterThan(a)
  })

  it('error 는 시간이 지나도 사라지지 않는다', () => {
    feedback.report({ key: 'e', kind: 'error', title: 't', anchors: [] })
    vi.advanceTimersByTime(60_000)
    expect(feedback.get('e')).toBeDefined()
  })

  it('트레이의 info 는 4초 뒤 사라진다', () => {
    feedback.report({ key: 'i', kind: 'info', title: 't', anchors: [] })
    vi.advanceTimersByTime(3999)
    expect(feedback.get('i')).toBeDefined()
    vi.advanceTimersByTime(2)
    expect(feedback.get('i')).toBeUndefined()
  })

  it('clearOn 에 숫자를 주면 그 시간 뒤 사라진다', () => {
    feedback.report({ key: 'm', kind: 'warn', title: 't', anchors: [], clearOn: 500 })
    vi.advanceTimersByTime(501)
    expect(feedback.get('m')).toBeUndefined()
  })
})

describe('clear · clearScope', () => {
  it('clearScope 는 접두사가 같은 key 만 지운다', () => {
    feedback.report({ key: 'run.query', kind: 'error', title: 't', anchors: [] })
    feedback.report({ key: 'run.input', kind: 'error', title: 't', anchors: [] })
    feedback.report({ key: 'save', kind: 'error', title: 't', anchors: [] })
    feedback.clearScope('run.')
    expect(feedback.items.map((i) => i.key)).toEqual(['save'])
  })
})

describe('트리거 버튼 표식', () => {
  it('error 는 팝오버를 닫아도 점이 남고, clear 하면 꺼진다', () => {
    const btn = mount('q.save', 'trigger')
    feedback.report({ key: 'q.save', kind: 'error', title: 't', anchors: ['q.save'] })
    expect(btn.attrs.get('data-fb-error')).toBe('1')
    expect(feedback.popovers).toHaveLength(1)

    feedback.dismiss('q.save')
    expect(feedback.popovers).toHaveLength(0)
    expect(btn.attrs.get('data-fb-error')).toBe('1')

    feedback.clear('q.save')
    expect(btn.attrs.has('data-fb-error')).toBe(false)
  })

  it('같은 버튼에 error 가 둘이면 마지막이 사라질 때까지 점을 유지한다', () => {
    const btn = mount('b', 'trigger')
    feedback.report({ key: 'one', kind: 'error', title: 't', anchors: ['b'] })
    feedback.report({ key: 'two', kind: 'error', title: 't', anchors: ['b'] })
    feedback.clear('one')
    expect(btn.attrs.has('data-fb-error')).toBe(true)
    feedback.clear('two')
    expect(btn.attrs.has('data-fb-error')).toBe(false)
  })

  it('dismiss 한 팝오버는 같은 key 가 다시 오면 다시 열린다', () => {
    mount('b', 'trigger')
    feedback.report({ key: 'k', kind: 'error', title: 't', anchors: ['b'] })
    feedback.dismiss('k')
    feedback.report({ key: 'k', kind: 'error', title: 't', anchors: ['b'] })
    expect(feedback.popovers).toHaveLength(1)
  })

  it('앵커가 사라지면 reroute 가 트레이로 옮기고 점을 끈다', () => {
    const btn = mount('b', 'trigger')
    feedback.report({ key: 'k', kind: 'error', title: 't', anchors: ['b'] })
    btn.visible = false
    feedback.reroute('k')
    expect(feedback.get('k')?.placement).toBe('tray')
    expect(btn.attrs.has('data-fb-error')).toBe(false)
  })
})

describe('feedback.ok', () => {
  it('버튼이 있으면 표식을 1.5초 켰다 끈다', () => {
    const btn = mount('out.copy', 'trigger')
    feedback.ok('out.copy', '복사됨')
    expect(btn.attrs.get('data-fb-ok')).toBe('복사됨')
    vi.advanceTimersByTime(1501)
    expect(btn.attrs.has('data-fb-ok')).toBe(false)
    expect(feedback.items).toHaveLength(0)
  })

  it('버튼이 없으면 트레이 칩으로 대신한다', () => {
    feedback.ok('nobody', '변환됨')
    expect(feedback.tray.map((i) => i.title)).toEqual(['변환됨'])
    vi.advanceTimersByTime(2501)
    expect(feedback.tray).toHaveLength(0)
  })
})
