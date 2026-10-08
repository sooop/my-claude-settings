import { test, expect } from 'claude-code/testing'

import { multipart, parseArgs, plan } from './telegram'

test('4096자 이하는 메시지, 초과는 문서', () => {
  expect(plan('a'.repeat(4096)).kind).toBe('message')
  const p = plan('# 제목\n' + 'a'.repeat(5000))
  expect(p.kind).toBe('document')
  if (p.kind === 'document') {
    expect(p.caption).toBe('# 제목')
  }
})

test('인자 파싱', () => {
  expect(parseArgs('last').mode).toBe('last')
  expect(parseArgs('@"C:/a b/e.log"')).toEqual({ mode: 'file', value: 'C:/a b/e.log' })
  expect(parseArgs('빌드 실패')).toEqual({ mode: 'text', value: '빌드 실패' })
})

test('multipart 본문', () => {
  const body = multipart('B', { chat_id: '1' }, { name: 'document', filename: 'x.md', content: '본문' })
  expect(body).toContain('name="chat_id"\r\n\r\n1')
  expect(body).toContain('filename="x.md"')
  expect(body.endsWith('--B--\r\n')).toBe(true)
})

import { blockedReason, clip, isTextLike, items, parseRange, safeName, uniqueName } from './telegram'

test('첨부 수집: 문서·사진, 가장 큰 사진, 다른 chat 제외', () => {
  const ups = [
    { update_id: 1, channel_post: { date: 1, chat: { id: 1 }, document: { file_id: 'd', file_name: 'e.log', file_size: 3 } } },
    { update_id: 2, channel_post: { date: 2, chat: { id: 9 }, document: { file_id: 'x' } } },
    { update_id: 3, channel_post: { date: 3, chat: { id: 1 }, photo: [{ file_id: 's', width: 1, height: 1 }, { file_id: 'L', width: 9, height: 9 }] } },
  ]
  const a = items(ups, '1')
  expect(a.map(x => x.file?.fileId)).toEqual(['d', 'L'])
  expect(isTextLike(a[0]!.file!)).toBe(true)
  expect(isTextLike(a[1]!.file!)).toBe(false)
})

test('파일명 정리와 긴 로그 축약', () => {
  expect(safeName('a/b:c.log')).toBe('a_b_c.log')
  expect(clip('x'.repeat(100))).toHaveLength(100)
  expect(clip('x'.repeat(40000)).length).toBeLessThan(26000)
})

test('텍스트 메시지도 모으고 빈 메시지는 거른다', () => {
  const ups = [
    { update_id: 1, channel_post: { date: 1, chat: { id: 1 }, text: 'a' } },
    { update_id: 2, channel_post: { date: 2, chat: { id: 1 } } },
  ]
  expect(items(ups, '1').map(x => x.text)).toEqual(['a'])
})

test('범위 파싱: 빈값=1:1, N=1:N, A:B, 역순 보정, 오류', () => {
  expect(parseRange('')).toEqual({ from: 1, to: 1 })
  expect(parseRange('3')).toEqual({ from: 1, to: 3 })
  expect(parseRange('2:5')).toEqual({ from: 2, to: 5 })
  expect(parseRange('2-3')).toEqual({ from: 2, to: 3 })
  expect(parseRange('5:2')).toEqual({ from: 2, to: 5 })
  expect('error' in parseRange('abc')).toBe(true)
  expect('error' in parseRange('0')).toBe(true)
  expect('error' in parseRange('1:99')).toBe(true)
})

test('중복 파일명은 (1), (2) 로', async () => {
  const taken = new Set(['a.log', 'a (1).log', 'noext'])
  const isTaken = async (n: string) => taken.has(n)
  expect(await uniqueName('b.log', isTaken)).toBe('b.log')
  expect(await uniqueName('a.log', isTaken)).toBe('a (2).log')
  expect(await uniqueName('noext', isTaken)).toBe('noext (1)')
})

test('민감 파일 차단', () => {
  for (const p of ['C:\\p\\.env', '/a/.env.local', '/a/id_rsa', 'x/server.PEM', 'C:\\Users\\u\\.ssh\\config', '/h/.aws/credentials', '/a/secrets.json', '/a/../b.txt', '.claude/settings.local.json']) {
    expect(blockedReason(p)).toBeDefined()
  }
  for (const p of ['/a/report.md', 'C:\\p\\out\\result.png', '/a/environment.txt', '/a/keyboard.ts']) {
    expect(blockedReason(p)).toBeUndefined()
  }
})
