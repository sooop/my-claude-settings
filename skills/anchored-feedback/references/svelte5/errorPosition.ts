/**
 * 오류 메시지에서 위치(줄·열·오프셋)를 뽑는다.
 *
 * 지원하는 형식:
 * - jq:      `... at <top-level>, line 3:`        (줄만)
 * - Chrome:  `... (line 3 column 14)`, `... at position 42`
 * - Firefox: `... at line 3 column 14 of the JSON data`
 * 위치가 없는 메시지(Safari 의 `JSON Parse error: ...`)는 `null` — 상태줄은 메시지만 보여 준다.
 */

export interface ErrorPos {
  /** 1부터 */
  line?: number
  /** 1부터. jq 처럼 줄만 아는 경우 없음 */
  col?: number
  /** 0부터. `text`를 줬을 때만 채워진다(줄·열 → 오프셋 또는 그 반대) */
  offset?: number
}

export function parseErrorPosition(message: string, text?: string): ErrorPos | null {
  const lc = /\bline (\d+)(?:,?\s*col(?:umn)?\s+(\d+))?/i.exec(message)
  if (lc) {
    const pos: ErrorPos = { line: Number(lc[1]) }
    if (lc[2]) pos.col = Number(lc[2])
    if (text !== undefined) pos.offset = lineColToOffset(text, pos.line!, pos.col ?? 1)
    return pos
  }
  const at = /\bposition (\d+)/i.exec(message)
  if (at) {
    const offset = Number(at[1])
    if (text === undefined) return { offset }
    return { ...offsetToLineCol(text, offset), offset }
  }
  return null
}

export function offsetToLineCol(text: string, offset: number): { line: number; col: number } {
  const end = Math.max(0, Math.min(offset, text.length))
  let line = 1
  let lineStart = 0
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 10) {
      line++
      lineStart = i + 1
    }
  }
  return { line, col: end - lineStart + 1 }
}

/** 줄·열(1부터) → 오프셋. 범위를 넘으면 텍스트 끝(또는 그 줄의 끝)으로 고정한다. */
export function lineColToOffset(text: string, line: number, col: number): number {
  let start = 0
  for (let l = 1; l < line; l++) {
    const nl = text.indexOf('\n', start)
    if (nl === -1) return text.length
    start = nl + 1
  }
  const nl = text.indexOf('\n', start)
  const end = nl === -1 ? text.length : nl
  return Math.min(start + Math.max(0, col - 1), end)
}

/** `3:14` 또는 `3행`. 줄 정보가 없으면 빈 문자열. */
export function formatPos(pos: ErrorPos | null): string {
  if (!pos?.line) return ''
  return pos.col ? `${pos.line}:${pos.col}` : `${pos.line}행`
}
