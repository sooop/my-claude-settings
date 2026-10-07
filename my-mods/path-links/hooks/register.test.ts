import { test, expect } from 'claude-code/testing'
import {
  DEFAULT_EXTS,
  buildByName,
  buildEditorArgv,
  findInIndex,
  fromHref,
  linkify,
  parseExts,
  resolveRel,
  toToolMarkdown,
  toolText,
  type LinkCfg,
} from './register'

const exts = parseExts(DEFAULT_EXTS)
// 프로젝트(C:\p)에 이 파일들이 있는 상황
const idx = {
  cwd: 'C:\\p',
  byName: buildByName([
    'README.md',
    'package.json',
    'src/app/x.tsx',
    'docs/operations/spec-sync.md',
    'docs/a.md',
    'data/a.csv',
    'x/b.txt',
    'x/a.tsv',
    'hooks/stop.sh',
  ]),
}
const locate = (rel: string) => {
  const hit = findInIndex(idx, rel)[0]
  return hit === undefined ? undefined : resolveRel(idx.cwd, hit)
}
const cfg: LinkCfg = { exts, locate }
const noLocate: LinkCfg = { exts }

test('백틱 경로와 본문 절대경로를 file 링크로 바꾼다', () => {
  const out = linkify('계획: `C:\\Users\\sooop\\.claude\\plans\\a b.md` 와 C:\\x\\y.md.', noLocate)
  expect(out).toContain('(file:///C:/Users/sooop/.claude/plans/a%20b.md)')
  // 라벨의 역슬래시는 마크다운 이스케이프로 먹히지 않게 겹쳐 쓴다
  expect(out).toContain('[C:\\\\x\\\\y.md](file:///C:/x/y.md).')
})

test('코드 펜스는 건드리지 않는다', () => {
  const t = '```\nC:\\x\\y.md\n```'
  expect(linkify(t, cfg)).toBe(t)
})

test('상대경로·파일명은 프로젝트에서 찾아 절대 file 주소로 링크한다', () => {
  expect(linkify('hooks/stop.sh 참고', cfg)).toBe('[hooks/stop.sh](file:///C:/p/hooks/stop.sh) 참고')
  expect(linkify('`data/a.csv`', cfg)).toBe('[`data/a.csv`](file:///C:/p/data/a.csv)')
  // 파일명만 → 인덱스의 실제 위치
  expect(linkify('x.tsx 와 stop.sh', cfg)).toBe(
    '[x.tsx](file:///C:/p/src/app/x.tsx) 와 [stop.sh](file:///C:/p/hooks/stop.sh)'
  )
  expect(linkify('README.md', cfg)).toBe('[README.md](file:///C:/p/README.md)')
})

test('프로젝트에 없는 이름·인덱스 없음은 링크하지 않는다 (https 가짜 주소를 만들지 않는다)', () => {
  expect(linkify('Node.js, foo.json, docs/none.md', cfg)).toBe('Node.js, foo.json, docs/none.md')
  expect(linkify('README.md hooks/stop.sh', noLocate)).toBe('README.md hooks/stop.sh')
  expect(linkify('hooks/stop.sh', cfg)).not.toContain('https://')
})

test('확장자 목록을 설정하면 그 확장자만 링크한다', () => {
  const only: LinkCfg = { exts: parseExts('.MD, txt'), locate }
  expect(linkify('docs/a.md x/b.txt src/app/x.tsx', only)).toBe(
    '[docs/a.md](file:///C:/p/docs/a.md) [x/b.txt](file:///C:/p/x/b.txt) src/app/x.tsx'
  )
})

test('줄·열은 #L12C3 프래그먼트로 싣고 되돌릴 수 있다', () => {
  expect(linkify('docs/a.md:12:3', cfg)).toBe('[docs/a.md:12:3](file:///C:/p/docs/a.md#L12C3)')
  expect(linkify('package.json:7', cfg)).toBe('[package.json:7](file:///C:/p/package.json#L7)')
  expect(fromHref('file:///C:/p/docs/a.md#L12C3')).toEqual({
    path: 'C:\\p\\docs\\a.md',
    line: '12',
    col: '3',
  })
  expect(fromHref('file:///C:/p/a%20b%23c.md')).toEqual({
    path: 'C:\\p\\a b#c.md',
    line: undefined,
    col: undefined,
  })
})

test('URL·절대경로 조각·이미 링크인 것은 다시 링크하지 않는다', () => {
  for (const t of ['https://a.com/docs/x.md', '/usr/x/y.md', '[a](docs/a.md)', 'user@a.md']) {
    expect(linkify(t, cfg)).toBe(t)
  }
  expect(linkify('C:\\x\\y\\z.md', cfg)).toBe('[C:\\\\x\\\\y\\\\z.md](file:///C:/x/y/z.md)')
})

test('인덱스 검색은 접미 경로·파일명으로 찾고 얕은 순서로 돌려준다', () => {
  const i2 = {
    cwd: 'C:\\p',
    byName: buildByName(['a/b/x.md', 'x.md', 'docs/x.md', 'src/app/y.tsx']),
  }
  expect(findInIndex(i2, 'x.md')).toEqual(['x.md', 'docs/x.md', 'a/b/x.md'])
  expect(findInIndex(i2, 'app/y.tsx')).toEqual(['src/app/y.tsx'])
  expect(findInIndex(i2, '../docs/X.md')).toEqual(['docs/x.md'])
  expect(findInIndex(i2, 'nope.md')).toEqual([])
})

test('cwd 기준으로 .. 를 정규화한다', () => {
  expect(resolveRel('C:\\p\\q', 'docs/a.md')).toBe('C:\\p\\q\\docs\\a.md')
  expect(resolveRel('C:\\p\\q', '../a.md')).toBe('C:\\p\\a.md')
})

test('ToolResult: Glob/Grep 은 항상, Bash 는 열 정렬이 없을 때만 대상이다', () => {
  expect(toolText('Glob', { filenames: ['a/x.md', 'b/y.md'] })).toBe('a/x.md\nb/y.md')
  expect(toolText('Grep', { content: 'src/a.ts:3:hit' })).toBe('src/a.ts:3:hit')
  expect(toolText('Bash', { stdout: 'docs/a.md\ndocs/b.md\n' })).toBe('docs/a.md\ndocs/b.md')
  expect(toolText('Bash', { stdout: 'drwx  2 a  b\n' })).toBeUndefined()
  expect(toolText('Bash', { stdout: '  indented a/b.md' })).toBeUndefined()
  expect(toolText('Read', { x: 1 })).toBeUndefined()
  expect(toolText('Glob', { filenames: Array.from({ length: 80 }, (_, i) => `a/${i}.md`) })).toBeUndefined()
})

test('ToolResult 마크다운: 링크 밖 문법은 이스케이프하고 줄바꿈을 보존한다', () => {
  const md = toToolMarkdown(linkify('# a_b *x*\ndocs/a.md', cfg))
  expect(md).toBe('\\# a\\_b \\*x\\*  \n[docs/a.md](file:///C:/p/docs/a.md)')
})

test('편집기 실행 인자: cmd start 를 거치고, 줄 인자는 줄 번호가 있을 때만 붙는다', () => {
  const ed = 'C:\e\notepad3.exe'
  expect(buildEditorArgv(ed, '/n /o', '/g {line},{col}', 'C:\p\a.md')).toEqual([
    'cmd.exe', '/c', 'start', '', ed, '/n', '/o', 'C:\p\a.md',
  ])
  expect(buildEditorArgv(ed, '/n /o', '/g {line},{col}', 'C:\p\a.md', '12', '3')).toEqual([
    'cmd.exe', '/c', 'start', '', ed, '/n', '/o', '/g', '12,3', 'C:\p\a.md',
  ])
  // 열 번호가 없으면 1, 인자 없는 편집기도 가능
  expect(buildEditorArgv(ed, '', '-l{line}', 'C:\p\a.md', '7')).toEqual([
    'cmd.exe', '/c', 'start', '', ed, '-l7', 'C:\p\a.md',
  ])
})
