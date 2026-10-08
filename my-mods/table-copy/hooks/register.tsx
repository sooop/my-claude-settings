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

  // 한 턴은 도구 호출 사이마다 여러 메시지를 낼 수 있고, turn.complete 의 e.answer 는 그중 마지막 메시지뿐이다.
  // 그래서 단계(turn.step)마다 그 메시지의 표를 모아 두었다가 턴이 끝날 때 한 번에 반영한다.
  let currentTurn: string | undefined
  let collected: Table[] = []

  // turn.step 은 스트리밍 이벤트라 async generator 로 쓴다: 청크는 그대로 흘려보내고 끝난 결과만 읽는다.
  on('turn.step', async function* ($, e, next) {
    const response = yield* next(e)

    if (e.agentId === undefined) {
      if (e.turnId !== currentTurn) {
        currentTurn = e.turnId
        collected = []
      }
      collected = [...collected, ...findTables(response.answer)]
    }

    return response
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      // 단계 훅이 못 본 턴(재로드 직후 등)은 마지막 메시지만으로 대신한다.
      const found: Table[] = currentTurn === e.turnId ? collected : findTables(e.answer)
      await update($, tables, () => found)
    }

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

    // 공식 예제 구조: Button 을 Box 바로 아래에 key 와 함께 둔다(버튼마다 Box 로 감싸지 않는다).
    const buttons = list.flatMap((table, i) => [
      <Button
        key={`copy:${i}`}
        label={list.length === 1 ? '복사' : `표 ${i + 1}`}
        onPress={() => {
          void copy($, serialize(table, format), `표 ${i + 1}`, label)
        }}
      />,
      <Text key={`gap:${i}`}> </Text>,
    ])

    const all =
      list.length > 1
        ? [
            <Button
              key="copy:all"
              label="전체"
              onPress={() => {
                const text = list.map(t => serialize(t, format)).join('\n\n')
                void copy($, text, `표 ${list.length}개`, label)
              }}
            />,
          ]
        : []

    return (
      <Box>
        <Text dimColor>표 복사({label}): </Text>
        {buttons}
        {all}
      </Box>
    )
  })
}
