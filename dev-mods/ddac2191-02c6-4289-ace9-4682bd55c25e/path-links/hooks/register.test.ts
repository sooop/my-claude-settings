import { test, expect } from 'claude-code/testing'
import { linkify, parseRelHref, resolveRel } from './register'

test('백틱 경로와 본문 경로를 file 링크로 바꾼다', () => {
  const out = linkify('계획: `C:\\Users\\sooop\\.claude\\plans\\a b.md` 와 C:\\x\\y.md.')
  expect(out).toContain('(file:///C:/Users/sooop/.claude/plans/a%20b.md)')
  expect(out).toContain('[C:\\x\\y.md](file:///C:/x/y.md).')
})

test('코드 펜스는 건드리지 않는다', () => {
  const t = '```\nC:\\x\\y.md\n```'
  expect(linkify(t)).toBe(t)
})

const R = 'https://rel.path-links.invalid/'

test('상대경로 md/txt/csv/tsv 를 링크로 바꾼다', () => {
  expect(linkify('문서 docs/operations/spec-sync.md 참고')).toBe(
    `문서 [docs/operations/spec-sync.md](${R}docs/operations/spec-sync.md) 참고`
  )
  expect(linkify('`data/a.csv`')).toBe(`[\`data/a.csv\`](${R}data/a.csv)`)
  expect(linkify('x/a.tsv, y/b.txt.')).toContain(`[y/b.txt](${R}y/b.txt).`)
})

test('줄 번호를 보존한다', () => {
  const out = linkify('docs/a.md:12:3')
  expect(out).toBe(`[docs/a.md:12:3](${R}docs/a.md?line=12&col=3)`)
  expect(parseRelHref(`${R}docs/a.md?line=12&col=3`)).toEqual({
    rel: 'docs/a.md',
    line: '12',
    col: '3',
  })
})

test('다른 확장자·슬래시 없는 이름·URL 은 건드리지 않는다', () => {
  for (const t of ['src/app/x.tsx', 'README.md', 'https://a.com/docs/x.md', '/usr/x/y.md']) {
    expect(linkify(t)).toBe(t)
  }
})

test('절대경로 링크 안 조각을 다시 링크하지 않는다', () => {
  expect(linkify('C:\\x\\y\\z.md')).toBe('[C:\\x\\y\\z.md](file:///C:/x/y/z.md)')
})

test('cwd 기준으로 .. 를 정규화한다', () => {
  expect(resolveRel('C:\\p\\q', 'docs/a.md')).toBe('C:\\p\\q\\docs\\a.md')
  expect(resolveRel('C:\\p\\q', '../a.md')).toBe('C:\\p\\a.md')
})
