export const MESSAGE_LIMIT = 4096
export const CAPTION_LIMIT = 1024

export type Update = {
  update_id: number
  channel_post?: Post
  message?: Post
}

export type Post = {
  date: number
  text?: string
  caption?: string
  document?: { file_id: string; file_name?: string; file_size?: number; mime_type?: string }
  photo?: { file_id: string; file_size?: number; width: number; height: number }[]
  chat: { id: number }
  author_signature?: string
}

export type Payload =
  | { kind: 'message'; text: string }
  | { kind: 'document'; text: string; filename: string; caption: string }

/** 4096자 이하는 메시지, 초과분은 문서로 첨부한다. */
export function plan(text: string, filename = 'message.md'): Payload {
  if (text.length <= MESSAGE_LIMIT) {
    return { kind: 'message', text }
  }
  const first = text.trim().split('\n')[0] ?? ''
  const caption = first.slice(0, CAPTION_LIMIT - 1)
  return { kind: 'document', text, filename, caption }
}

/** 텍스트만 담는 multipart/form-data 본문 (HTTP body 가 문자열이라 텍스트 파일 전용). */
export function multipart(
  boundary: string,
  fields: Record<string, string>,
  file: { name: string; filename: string; content: string },
): string {
  const parts = Object.entries(fields).map(
    ([k, v]) =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`,
  )
  const name = file.filename.replace(/["\r\n]/g, '_')
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${name}"\r\n` +
      `Content-Type: text/plain; charset=utf-8\r\n\r\n${file.content}\r\n`,
  )
  return parts.join('') + `--${boundary}--\r\n`
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function parseArgs(args: string): { mode: 'text' | 'last' | 'file'; value: string } {
  const a = args.trim()
  if (a === 'last') {
    return { mode: 'last', value: '' }
  }
  if (a.startsWith('@')) {
    return { mode: 'file', value: a.slice(1).trim().replace(/^"(.*)"$/, '$1') }
  }
  return { mode: 'text', value: a }
}

export type File = { fileId: string; name: string; size: number; mime: string }
export type Item = { stamp: string; text: string; file?: File }

const TEXT_EXT = /\.(txt|log|md|json|jsonl|csv|tsv|ya?ml|xml|ini|toml|sql|ts|tsx|js|jsx|py|sh|html|css)$/i

export function isTextLike(a: Pick<File, 'name' | 'mime'>): boolean {
  return a.mime.startsWith('text/') || TEXT_EXT.test(a.name)
}

/** 해당 chat 의 메시지를 오래된 순으로 모은다. 사진은 가장 큰 해상도를 고른다. */
export function items(updates: readonly Update[], chatId: string): Item[] {
  const out: Item[] = []
  for (const u of updates) {
    const p = u.channel_post ?? u.message
    if (p === undefined || String(p.chat.id) !== chatId) {
      continue
    }
    const d = new Date(p.date * 1000)
    const stamp = `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    const text = p.text ?? p.caption ?? ''
    if (p.document !== undefined) {
      const f = p.document
      out.push({ stamp, text, file: { fileId: f.file_id, name: f.file_name ?? `file-${u.update_id}`, size: f.file_size ?? 0, mime: f.mime_type ?? '' } })
    } else if (p.photo !== undefined && p.photo.length > 0) {
      const f = p.photo[p.photo.length - 1]!
      out.push({ stamp, text, file: { fileId: f.file_id, name: `photo-${u.update_id}.jpg`, size: f.file_size ?? 0, mime: 'image/jpeg' } })
    } else if (text !== '') {
      out.push({ stamp, text })
    }
  }
  return out
}

export function safeName(name: string): string {
  return name.replace(/[\/:*?"<>|\r\n]/g, '_').slice(-120)
}

/** 긴 로그는 앞 일부와 뒤쪽(최근) 위주로 줄인다. */
export function clip(text: string, max = 30000): string {
  if (text.length <= max) {
    return text
  }
  return `${text.slice(0, 5000)}
... (${text.length - 25000}자 생략) ...
${text.slice(-20000)}`
}

export type Range = { from: number; to: number }

export const MAX_SPAN = 20

/** `` → 1:1, `N` → 1:N, `A:B`(또는 `A-B`) → A..B. 1 이 가장 최근. */
export function parseRange(arg: string): Range | { error: string } {
  const a = arg.trim()
  if (a === '') {
    return { from: 1, to: 1 }
  }
  const m = /^(\d+)(?:[:-](\d+))?$/.exec(a)
  if (m === null) {
    return { error: '형식: /tg-get [N | A:B] [--ai]  (1=가장 최근, 예: 3 → 1:3, 2:5 → 2~5번째)' }
  }
  const x = Number(m[1])
  const y = m[2] === undefined ? undefined : Number(m[2])
  const [from, to] = y === undefined ? [1, x] : x <= y ? [x, y] : [y, x]
  if (x < 1 || (y !== undefined && y < 1)) {
    return { error: '번호는 1 이상입니다.' }
  }
  if (to - from + 1 > MAX_SPAN) {
    return { error: `한 번에 ${MAX_SPAN}개까지만 조회합니다.` }
  }
  return { from, to }
}

/** `name` 이 이미 있으면 `name (1).ext`, `name (2).ext` ... 로 비어 있는 이름을 찾는다. */
export async function uniqueName(name: string, isTaken: (candidate: string) => Promise<boolean>): Promise<string> {
  if (!(await isTaken(name))) {
    return name
  }
  const dot = name.lastIndexOf('.')
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, '']
  for (let i = 1; i < 1000; i++) {
    const candidate = `${stem} (${i})${ext}`
    if (!(await isTaken(candidate))) {
      return candidate
    }
  }
  return `${stem} (${Date.now()})${ext}`
}
