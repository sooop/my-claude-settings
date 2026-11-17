import { describe, expect, it } from 'vitest'
import {
  formatPos,
  lineColToOffset,
  offsetToLineCol,
  parseErrorPosition,
} from '../src/lib/ui/feedback/errorPosition'

describe('parseErrorPosition', () => {
  it('jq: 줄만 있는 메시지', () => {
    const m =
      "jq: error: syntax error, unexpected INVALID_CHARACTER (Unix shell quoting issues?) at <top-level>, line 3:"
    expect(parseErrorPosition(m)).toEqual({ line: 3 })
  })

  it('Chrome: (line N column M)', () => {
    const m = `Unexpected token ']', "{"a": 1]" is not valid JSON (line 3 column 14)`
    expect(parseErrorPosition(m)).toEqual({ line: 3, col: 14 })
  })

  it('Firefox: at line N column M of the JSON data', () => {
    const m = 'JSON.parse: expected \',\' or \'}\' after property value at line 2 column 5 of the JSON data'
    expect(parseErrorPosition(m)).toEqual({ line: 2, col: 5 })
  })

  it('at position N — 텍스트가 없으면 오프셋만', () => {
    expect(parseErrorPosition('Unexpected token ] in JSON at position 12')).toEqual({ offset: 12 })
  })

  it('at position N — 텍스트가 있으면 줄·열로 환산', () => {
    const text = 'ab\ncd\nef]'
    expect(parseErrorPosition('Unexpected token ] in JSON at position 8', text)).toEqual({
      line: 3,
      col: 3,
      offset: 8,
    })
  })

  it('줄·열 + 텍스트면 오프셋을 채운다', () => {
    expect(parseErrorPosition('at line 2 column 2', 'ab\ncd')).toEqual({ line: 2, col: 2, offset: 4 })
  })

  it('위치 정보가 없으면 null', () => {
    expect(parseErrorPosition('JSON Parse error: Unexpected identifier "x"')).toBeNull()
    expect(parseErrorPosition('')).toBeNull()
  })
})

describe('offset ↔ line/col', () => {
  const text = 'abc\nde\n\nfgh'
  it('왕복이 일치한다', () => {
    for (let o = 0; o <= text.length; o++) {
      const { line, col } = offsetToLineCol(text, o)
      expect(lineColToOffset(text, line, col)).toBe(o)
    }
  })
  it('범위를 넘으면 줄 끝·텍스트 끝으로 고정한다', () => {
    expect(lineColToOffset(text, 2, 99)).toBe(6)
    expect(lineColToOffset(text, 99, 1)).toBe(text.length)
  })
})

describe('formatPos', () => {
  it('줄·열 / 줄만 / 없음', () => {
    expect(formatPos({ line: 3, col: 14 })).toBe('3:14')
    expect(formatPos({ line: 3 })).toBe('3행')
    expect(formatPos({ offset: 4 })).toBe('')
    expect(formatPos(null)).toBe('')
  })
})
