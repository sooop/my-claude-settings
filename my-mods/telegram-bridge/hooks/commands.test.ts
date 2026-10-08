import { test, expect } from 'claude-code/testing'

const options = { botToken: 'TOKEN', chatId: '-100' }

const updates = {
  ok: true,
  result: [
    { update_id: 1, channel_post: { date: 1700000000, chat: { id: -100 }, text: '에러 발생' } },
    {
      update_id: 2,
      channel_post: { date: 1700000100, chat: { id: -100 }, caption: '로그', document: { file_id: 'F', file_name: 'e.log', file_size: 5, mime_type: 'text/plain' } },
    },
  ],
}

type Reply = { status: number; ok: boolean; headers: Record<string, string>; text: string }
const reply = (ok: boolean, body: unknown): { value: Reply } => ({
  value: { status: ok ? 200 : 404, ok, headers: {}, text: JSON.stringify(body) },
})

function fakeApi(on: any, sent: string[]) {
  on('http.fetch', async (_$: unknown, e: { url: string }) => {
    sent.push(e.url)
    if (e.url.includes('/getUpdates')) {
      return reply(true, updates)
    }
    if (e.url.includes('/sendMessage')) {
      return reply(true, { ok: true })
    }
    return reply(false, { ok: false, description: 'nope' })
  })
}

test('/tg-get 인자 없으면 가장 최근(첨부)', { options }, async ($, on) => {
  const sent: string[] = []
  fakeApi(on, sent)
  const r = await $.command.run({ command: 'tg-get', args: '' })
  expect(sent.some(u => u.includes('/getFile'))).toBe(true)
  expect(r.context).toBeUndefined()
})

test('/tg-get 2 는 1:2 범위 (첨부 + 이전 텍스트)', { options }, async ($, on) => {
  const sent: string[] = []
  fakeApi(on, sent)
  const r = await $.command.run({ command: 'tg-get', args: '2' })
  expect(r.text).toContain('#2')
  expect(r.text).toContain('에러 발생')
  expect(r.text).toContain('#1')
  expect(r.context).toBeUndefined()
  const ai = await $.command.run({ command: 'tg-get', args: '2:2 --ai' })
  expect(ai.context?.[0]).toContain('<telegram-data>')
})

test('/tg-send 는 sendMessage 호출', { options }, async ($, on) => {
  const sent: string[] = []
  fakeApi(on, sent)
  const r = await $.command.run({ command: 'tg-send', args: 'hello' })
  expect(r.text).toContain('전송했습니다')
  expect(sent.some(u => u.includes('/sendMessage'))).toBe(true)
})

test('tg_send 도구는 text 를 sendMessage 로 보낸다', { options }, async ($, on) => {
  const sent: string[] = []
  fakeApi(on, sent)
  const r = await $.tool.call({ tool: 'mcp__telegram-bridge__tg_send', text: 'hi' })
  expect(String(r.result)).toContain('전송했습니다')
  expect(sent.some(u => u.includes('/sendMessage'))).toBe(true)
})

test('tg_send 도구는 file/text 둘 다 없으면 안내', { options }, async ($, on) => {
  fakeApi(on, [])
  const r = await $.tool.call({ tool: 'mcp__telegram-bridge__tg_send' })
  expect(String(r.result)).toContain('필요합니다')
})

test('tg_send 도구는 민감 파일을 deny', { options }, async ($, on) => {
  const sent: string[] = []
  fakeApi(on, sent)
  const r = await $.tool.call({ tool: 'mcp__telegram-bridge__tg_send', file: '/proj/.env' })
  expect(r.deny).toContain('전송 차단')
  expect(sent.length).toBe(0)
})

test('tg_send 도구는 링크가 가리키는 실제 경로로 민감 파일을 deny', { options }, async ($, on) => {
  const sent: string[] = []
  fakeApi(on, sent)
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: 0, isLink: true, realPath: 'C:/p/.env' } }))
  const r = await $.tool.call({ tool: 'mcp__telegram-bridge__tg_send', file: '/proj/report.md' })
  expect(r.deny).toContain('전송 차단')
  expect(sent.length).toBe(0)
})

test('tg_send 도구는 없는 파일이면 안내', { options }, async ($, on) => {
  fakeApi(on, [])
  on('fs.stat', async () => { throw new Error('ENOENT') })
  const r = await $.tool.call({ tool: 'mcp__telegram-bridge__tg_send', file: '/proj/none.md' })
  expect(String(r.result)).toContain('찾을 수 없습니다')
})
