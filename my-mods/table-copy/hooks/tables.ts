export type Table = string[][]
export type Format = 'tsv' | 'csv'

const DELIMITER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/
const BS = String.fromCharCode(92)
const FENCE = /^\s*(```|~~~)/

const splitRow = (line: string): string[] => {
  let body = line.trim()
  if (body.startsWith('|')) body = body.slice(1)
  if (body.endsWith('|') && !body.endsWith(BS + '|')) body = body.slice(0, -1)
  const cells: string[] = []
  let cell = ''
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (ch === BS && body[i + 1] === '|') {
      cell += '|'
      i++
    } else if (ch === '|') {
      cells.push(cell)
      cell = ''
    } else {
      cell += ch
    }
  }
  cells.push(cell)
  return cells.map(clean)
}

const clean = (cell: string): string =>
  cell
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .trim()

/** 마크다운 텍스트의 GFM 표를 모두 찾아 행렬로 돌려준다 (코드 펜스 안은 건너뜀). */
export const findTables = (text: string): Table[] => {
  const lines = text.split(/\r?\n/)
  const tables: Table[] = []
  let isFenced = false
  for (let i = 0; i < lines.length; i++) {
    if (FENCE.test(lines[i])) {
      isFenced = !isFenced
      continue
    }
    if (isFenced || !lines[i].includes('|')) continue
    const next = lines[i + 1]
    if (next === undefined || !next.includes('|') || !DELIMITER.test(next)) continue
    const rows = [splitRow(lines[i])]
    let j = i + 2
    while (j < lines.length && lines[j].trim() !== '' && lines[j].includes('|')) {
      rows.push(splitRow(lines[j]))
      j++
    }
    tables.push(rows)
    i = j - 1
  }
  return tables
}

const csvCell = (cell: string): string =>
  /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell

export const serialize = (table: Table, format: Format): string =>
  table
    .map(row =>
      format === 'csv'
        ? row.map(csvCell).join(',')
        : row.map(cell => cell.replace(/[\t\r\n]+/g, ' ')).join('\t'),
    )
    .join('\n')
