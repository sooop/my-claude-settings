import { test, expect } from 'claude-code/testing'

import { findTables, serialize } from './tables'

const BS = String.fromCharCode(92)

const md = [
  'intro',
  '| 이름 | 값 |',
  '|---|:-:|',
  '| **a** | `x' + BS + '|y` |',
  '| b, "q" | 2 |',
  '',
  '```',
  '| no | table |',
  '|---|---|',
  '```',
  '| h |',
  '| - |',
  '| 1 |',
].join('\n')

test('finds tables, skips fences', () => {
  const t = findTables(md)
  expect(t.length).toBe(2)
  expect(t[0]).toEqual([['이름', '값'], ['a', 'x|y'], ['b, "q"', '2']])
  expect(t[1]).toEqual([['h'], ['1']])
})

test('serializes tsv and csv', () => {
  const [t] = findTables(md)
  expect(serialize(t, 'tsv')).toBe('이름\t값\na\tx|y\nb, "q"\t2')
  expect(serialize(t, 'csv')).toBe('이름,값\na,x|y\n"b, ""q""",2')
})
