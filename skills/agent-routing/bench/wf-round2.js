export const meta = {
  name: 'model-routing-bench-r2',
  description: 'Round 2 (hard tasks): haiku5.5 low/med vs sonnet5.5 med/high vs opus high, 6 task types x 3 reps',
  phases: [{ title: 'Hard', detail: '6 tasks x 5 conditions x 3 reps' }],
}
const B = 'C:/Users/sooop/AppData/Local/Temp/claude/C--Users-sooop--claude/d1907dd3-0a3f-44ff-93b9-e7ee0b9b3b07/scratchpad/bench'
const RO = '[제약] 읽기 전용이다(검증용 node 실행은 허용). 어떤 파일도 수정·생성·삭제하지 않는다.\n'
const COND = {
  hL: { model: 'claude-haiku-5-5', effort: 'low' },
  hM: { model: 'claude-haiku-5-5', effort: 'medium' },
  sM: { model: 'sonnet', effort: 'medium' },
  sH: { model: 'sonnet', effort: 'high' },
  oH: { model: 'opus', effort: 'high' },
}
const str = { type: 'string' }
const S = {
  J: { type: 'object', properties: { results: { type: 'array', items: { type: 'object', properties: { file: str, hasBug: { type: 'boolean' }, summary: str }, required: ['file', 'hasBug'] } } }, required: ['results'] },
  V: { type: 'object', properties: { verdicts: { type: 'array', items: { type: 'object', properties: { n: { type: 'number' }, holds: { type: 'boolean' }, evidence: str }, required: ['n', 'holds'] } } }, required: ['verdicts'] },
  done: { type: 'object', properties: { summary: str, rootCauses: { type: 'array', items: str } }, required: ['summary'] },
}
const batches = args.batches
const T = {
  H1a: () => ({ s: S.J, p: RO + `${B}/templates2/h1/ 의 다음 파일을 각각 코드 리뷰하라: ${batches[0].map(x => x + '.js').join(', ')}. 파일마다 실제 결함(버그)이 있는지 판정하라. 없으면 hasBug=false (의심스러워 보이거나 낯설어 보여도 올바른 코드일 수 있다 — 근거 없이 버그로 판정하지 말 것). 있으면 hasBug=true 와 한 줄 요약.` }),
  H1b: () => ({ s: S.J, p: RO + `${B}/templates2/h1/ 의 다음 파일을 각각 코드 리뷰하라: ${batches[1].map(x => x + '.js').join(', ')}. 파일마다 실제 결함(버그)이 있는지 판정하라. 없으면 hasBug=false (의심스러워 보이거나 낯설어 보여도 올바른 코드일 수 있다 — 근거 없이 버그로 판정하지 말 것). 있으면 hasBug=true 와 한 줄 요약.` }),
  H2: (a) => ({ s: S.done, p: `작업 디렉터리 ${a.dir} 안에서만 작업하라. \`node --test test/calc.test.js\` 에서 여러 테스트가 실패한다. 테스트는 사양이므로 수정하지 말고 src 를 고쳐 모두 통과시켜라. rootCauses 에 찾은 독립적인 근본 원인을 각각 한 줄로 적어라.` }),
  H3: (a) => ({ s: S.done, p: `작업 디렉터리 ${a.dir} 안에서만 작업하라. SPEC.md 에 따라 src/duration.js 를 구현하라(visible 테스트는 일부일 뿐, 사양의 모든 규칙을 충족해야 한다). 실행: \`node --test test/duration.visible.test.js\`.` }),
  H4: () => ({ s: S.V, p: RO + `${B}/templates2/h4/src/util.js 의 함수에 대한 다음 주장 각각이 사실인지 판정하라(holds). 추측하지 말고 필요하면 node 로 직접 실행해 확인하라(package.json 이 있는 ${B}/templates2/h4 기준 ESM).\n` + args.claims.map((c, i) => `${i + 1}. ${c}`).join('\n') }),
  H5: (a) => ({ s: S.done, p: `작업 디렉터리 ${a.dir} 안에서만 작업하라. src/pricing.js 의 \`price(base, qty = 1)\` 를 객체 인자 \`price({ base, qty = 1 })\` 로 바꾸고, src/ 아래 모든 호출처를 새 시그니처에 맞게 고쳐라(bulkPrice 시그니처는 그대로). \`node check.js\` 의 출력(JSON)은 변경 전후 동일해야 한다. 주석·문서 속 언급은 건드리지 않아도 된다.` }),
}
const TASKS = Object.keys(T)
const jobs = []
for (const r of [1, 2, 3]) for (const t of TASKS) for (const c of Object.keys(COND)) jobs.push({ t, c, r })
log(`${jobs.length} agents`)
phase('Hard')
const out = await parallel(jobs.map(j => () => {
  const a = { dir: `${B}/runs2/${j.t}-${j.c}-${j.r}` }
  const spec = T[j.t](a)
  return agent(spec.p, { label: `${j.t}|${j.c}|${j.r}`, phase: 'Hard', schema: spec.s, ...COND[j.c] })
}))
return { total: jobs.length, ok: out.filter(Boolean).length }