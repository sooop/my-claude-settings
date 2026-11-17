import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { AgentModel } from '../types'

// 서브에이전트 id → 마지막 요청에 쓰인 model/effort (turn.step 에서 수집)
const models = atom({ plugin: 'agent-view-band', key: 'models' } as const, {})

// statusline-command.sh · statusline-subagent.sh 와 같은 색 체계
const FAMILY_COLOR: Record<string, string> = {
  haiku: '#00afaf',
  sonnet: '#0087ff',
  opus: '#d75fd7',
  fable: '#d7af00',
}
const EFFORT_MARK: Record<string, { mark: string; color: string }> = {
  low: { mark: '○', color: '#af5f00' },
  medium: { mark: '●', color: '#00af00' },
  high: { mark: '●', color: '#ff8700' },
  xhigh: { mark: '●', color: '#af00ff' },
  max: { mark: '☺', color: '#ff0000' },
}

const family = (model: string): string => {
  const m = model.toLowerCase()
  return ['fable', 'opus', 'sonnet', 'haiku'].find(f => m.includes(f)) ?? model
}

let mainModel: string | undefined

// 서브에이전트 모델의 컨텍스트 창 크기: [1m] 표기 > 메인 세션과 같은 모델이면 세션 창 > 200k
const windowOf = async ($: { session: { usage: () => Promise<{ context: { window: number } }> } }, model: string): Promise<number> => {
  if (/1m/i.test(model)) {
    return 1_000_000
  }
  if (model === mainModel) {
    return $.session.usage().then(u => u.context.window, () => 200_000)
  }
  return 200_000
}

const fmtK = (n: number): string => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}k`)

export const register: Register = on => {
  // turn.step 은 스트리밍 이벤트라 async generator 로만 등록된다
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) {
      mainModel = e.model
    }
    const result = yield* next(e)
    const agentId = e.agentId
    if (agentId !== undefined) {
      const u = result.usage
      const prev = (await read($, models))[agentId]
      const entry: AgentModel = {
        model: e.model,
        effort: e.effort,
        // 다음 요청이 다시 보내는 프롬프트 토큰 = 서브에이전트 자신의 컨텍스트 사용량
        tokens: u ? u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens + u.output_tokens : prev?.tokens,
        window: prev?.window,
      }
      if (u && (entry.window === undefined || prev?.model !== e.model)) {
        entry.window = await windowOf($, e.model)
      }
      if (prev?.model !== entry.model || prev?.effort !== entry.effort || prev?.tokens !== entry.tokens || prev?.window !== entry.window) {
        await update($, models, all => ({ ...all, [agentId]: entry }))
      }
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const agentId = e.props.view.agentId
    if (agentId === undefined || e.props.hasSurvey) {
      return next(e)
    }

    // 목록 조회가 실패해도 모델 표시는 유지한다
    const info = await $.agent.list().then(list => list.find(a => a.id === agentId), () => undefined)
    const used = (await read($, models))[agentId]
    const name = info?.name ?? info?.type ?? 'agent'

    const { Box, Text } = $.ui.resolve(e)
    const fam = used ? family(used.model) : undefined
    const effort = used?.effort === undefined ? undefined : String(used.effort)
    const mark = effort === undefined ? undefined : EFFORT_MARK[effort]

    const line = (
      <Box key="agent-view">
        <Text>⚡ </Text>
        <Text bold>{name}</Text>
        <Text> </Text>
        {fam === undefined ? (
          <Text dimColor>(모델 확인 전)</Text>
        ) : (
          <Text color={FAMILY_COLOR[fam]}>{fam}</Text>
        )}
        {effort === undefined ? null : mark ? (
          <Text>
            (<Text color={mark.color}>{mark.mark}</Text>)
          </Text>
        ) : (
          <Text>({effort})</Text>
        )}
        {used?.tokens === undefined || !used.window ? null : (
          <Text dimColor>
            {' '}
            · ctx {Math.round((used.tokens / used.window) * 100)}% ({fmtK(used.tokens)}/{fmtK(used.window)})
          </Text>
        )}
        {info?.description ? <Text dimColor> · {info.description}</Text> : null}
      </Box>
    )

    // 다른 mod(table-copy 등)의 밴드가 가려지지 않도록 아래 결과와 함께 쌓는다
    const below = await next(e)
    return (
      <Box flexDirection="column">
        {line}
        {below}
      </Box>
    )
  })
}
