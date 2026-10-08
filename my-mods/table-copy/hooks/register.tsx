import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Table } from '../types'
import { findTables, serialize } from './tables'
import type { Format } from './tables'

const tables = atom({ plugin: 'table-copy', key: 'tables' } as const, [])

async function copy(
  $: EngineInterface,
  text: string,
  name: string,
  label: string,
): Promise<string> {
  const result = await $.ui.copy({ text })
  const message = result.isCopied
    ? `${name}을(를) ${label}로 복사했습니다`
    : `복사 실패: ${result.reason}`
  $.ui.toast(message)
  return message
}

export const register: Register = (on, options) => {
  const format: Format = options.format === 'csv' ? 'csv' : 'tsv'
  const label = format.toUpperCase()

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'copy-table',
      description: `마지막 응답의 표를 ${label}로 복사 (/copy-table [번호|all])`,
    })

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const found: Table[] = findTables(e.answer)
      await update($, tables, () => found)    }

    return next(e)
  })

  on('command.run', { command: 'copy-table' }, async ($, e) => {
    const list = await read($, tables)
    if (list.length === 0) {
      return { text: '마지막 응답에 표가 없습니다.' }
    }

    const arg = e.args.trim().toLowerCase()
    if (arg === 'all') {
      const text = list.map(t => serialize(t, format)).join('\n\n')
      return { text: await copy($, text, `표 ${list.length}개`, label) }
    }

    const n = arg === '' ? 1 : Number(arg)
    const table = Number.isInteger(n) ? list[n - 1] : undefined
    if (table === undefined) {
      return { text: `표 번호는 1~${list.length} 또는 all 입니다.` }
    }

    return { text: await copy($, serialize(table, format), `표 ${n}`, label) }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, tables)
    if (list.length === 0 || e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box>
        <Text dimColor>표 복사({label}): </Text>
        {list.map((table, i) => (
          <Box>
            <Button
              key={`copy:${i}`}
              label={list.length === 1 ? '복사' : `표 ${i + 1}`}
              onPress={() => {
                void copy($, serialize(table, format), `표 ${i + 1}`, label)
              }}
            />
            <Text> </Text>
          </Box>
        ))}
      </Box>
    )
  })
}
