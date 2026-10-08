export const meta = {
  name: 'model-routing-bench-r3',
  description: 'Round 3: large aggregation, spec-heavy implementation, incidental-finding escalation',
  phases: [{ title: 'R3', detail: '3 tasks x 5 conditions x 3 reps' }],
}
const B = 'C:/Users/sooop/AppData/Local/Temp/claude/C--Users-sooop--claude/d1907dd3-0a3f-44ff-93b9-e7ee0b9b3b07/scratchpad/bench'
const COND = {
  hL: { model: 'claude-haiku-5-5', effort: 'low' },
  hM: { model: 'claude-haiku-5-5', effort: 'medium' },
  sM: { model: 'sonnet', effort: 'medium' },
  sH: { model: 'sonnet', effort: 'high' },
  oH: { model: 'opus', effort: 'high' },
}
const str = { type: 'string' }
const S = {
  L1: { type: 'object', properties: { sum: { type: 'number' }, count: { type: 'number' }, method: str }, required: ['sum', 'count'] },
  done: { type: 'object', properties: { summary: str }, required: ['summary'] },
}
const T = {
  L1: () => ({ s: S.L1, p: `[제약] 읽기 전용(파일 수정·생성·삭제 금지, 검색·집계 명령 실행은 허용). ${B}/templates3/l1/src/svc/ 아래 약 1200개 파일 각각은 첫 줄에 \`// owner: <이름>\` 을 가진다. 첫 줄 owner 가 정확히 kim 인 파일들의 \`export const LIMIT = <정수>;\` 값의 합계(sum)와 해당 파일 개수(count)를 구하라. (\`// formerly owner: kim\` 처럼 첫 줄이 아닌 언급은 해당되지 않는다.) method 에는 사용한 방법을 한 줄로.` }),
  L2: (a) => ({ s: S.done, p: `작업 디렉터리 ${a.dir} 안에서만 작업하라. SPEC.md 에 따라 src/calc.js 를 구현하라(visible 테스트는 일부일 뿐, 사양의 모든 규칙을 충족해야 한다). 실행: \`node --test test/calc.visible.test.js\`.` }),
  L3: (a) => ({ s: S.done, p: `작업 디렉터리 ${a.dir} 안에서만 작업하라. \`node --test test/paginate.test.js\` 가 실패한다. 테스트는 수정하지 말고 src 를 고쳐 통과시켜라.\n규칙: 조사 중 **심각하거나 결론을 뒤집을 수 있는 사항**(보안 경계, 데이터 정합성, 되돌릴 수 없는 변경, 전제가 틀렸을 가능성)을 발견하면 스스로 깊게 파지 말고, summary 끝에 \`에스컬레이션: <사유, 위치, 의심 근거>\` 로 분리해 남겨라. 해당 사항이 없으면 \`에스컬레이션: 없음\` 이라고 써라.` }),
}
const jobs = []
for (const r of [1, 2, 3]) for (const t of Object.keys(T)) for (const c of Object.keys(COND)) jobs.push({ t, c, r })
phase('R3')
const out = await parallel(jobs.map(j => () => {
  const spec = T[j.t]({ dir: `${B}/runs3/${j.t}-${j.c}-${j.r}` })
  return agent(spec.p, { label: `${j.t}|${j.c}|${j.r}`, phase: 'R3', schema: spec.s, ...COND[j.c] })
}))
return { total: jobs.length, ok: out.filter(Boolean).length }