import { test, expect } from 'claude-code/testing'
import { linkify } from './register'

test('백틱 경로와 본문 경로를 file 링크로 바꾼다', () => {
  const out = linkify('계획: `C:\\Users\\sooop\\.claude\\plans\\a b.md` 와 C:\\x\\y.md.')
  expect(out).toContain('(file:///C:/Users/sooop/.claude/plans/a%20b.md)')
  expect(out).toContain('[C:\\x\\y.md](file:///C:/x/y.md).')
})

test('코드 펜스는 건드리지 않는다', () => {
  const t = '```\nC:\\x\\y.md\n```'
  expect(linkify(t)).toBe(t)
})
