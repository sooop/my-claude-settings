import { expect, test } from 'claude-code/testing'

const props = (agentId?: string) => ({
  hasSurvey: false,
  isWorking: false,
  maxRows: 5,
  bodyColumns: 100,
  scroll: { offset: 0, bodyRows: 5 },
  view: agentId === undefined ? {} : { agentId },
})

test('메인 화면에서는 표시하지 않고, 에이전트 화면에서는 이름·모델·effort 를 표시한다', async ($, on) => {
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: { model: 'claude-sonnet-5-5', input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 48500, cache_creation_input_tokens: 0 } }
  })
  // 엔진 기본 밴드(빈 상자) 대역
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  // 서브에이전트 a1 의 요청 한 번 → model/effort 수집
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'claude-sonnet-5-5', effort: 'high', messageCount: 1, agentId: 'a1' })
  for await (const _ of stream) {
  }
  await stream.result

  for (const surface of ['terminal', 'desktop'] as const) {
    const main = await $.ui.mount({ plugin: 'agent-view-band', surface, component: 'AbovePrompt', props: props() })
    expect(await main.find({ type: 'Text', text: /sonnet/ })).toBeUndefined()
    await main.unmount()

    const ui = await $.ui.mount({ plugin: 'agent-view-band', surface, component: 'AbovePrompt', props: props('a1') })
    expect(await ui.find({ type: 'Text', text: /^agent$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^sonnet$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^●$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /high/ })).toBeUndefined()
    await ui.unmount()
  }
})
