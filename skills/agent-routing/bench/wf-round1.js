export const meta = {
  name: 'model-routing-bench',
  description: 'Benchmark haiku4.5 / haiku5.5(low,med,high) / sonnet5.5(med,high) over 16 task types x 2 reps',
  phases: [{ title: 'Bench', detail: '16 tasks x 6 conditions x 2 reps' }],
}
const B = 'C:/Users/sooop/AppData/Local/Temp/claude/C--Users-sooop--claude/d1907dd3-0a3f-44ff-93b9-e7ee0b9b3b07/scratchpad/bench'
const CORPUS = B + '/corpus'
const RO = '[제약] 읽기 전용이다. 어떤 파일도 수정·생성·삭제하지 않는다. 지정된 디렉터리 밖은 읽지 않는다.\n'
const COND = {
  h4: { model: 'haiku' },
  hL: { model: 'claude-haiku-5-5', effort: 'low' },
  hM: { model: 'claude-haiku-5-5', effort: 'medium' },
  hH: { model: 'claude-haiku-5-5', effort: 'high' },
  sM: { model: 'sonnet', effort: 'medium' },
  sH: { model: 'sonnet', effort: 'high' },
}
const str = { type: 'string' }
const S = {
  E1: { type: 'object', properties: { file: str, line: { type: 'number' }, params: str }, required: ['file', 'line', 'params'] },
  list: { type: 'object', properties: { files: { type: 'array', items: str } }, required: ['files'] },
  E3: { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { file: str, name: str }, required: ['file', 'name'] } } }, required: ['items'] },
  E4: { type: 'object', properties: { fn: str, negativeReturns: str }, required: ['fn', 'negativeReturns'] },
  chain: { type: 'object', properties: { terminal: str, env: str, defaultValue: str }, required: ['terminal', 'env', 'defaultValue'] },
  J: { type: 'object', properties: { results: { type: 'array', items: { type: 'object', properties: { file: str, hasBug: { type: 'boolean' }, line: { type: 'number' }, summary: str }, required: ['file', 'hasBug'] } } }, required: ['results'] },
  V: { type: 'object', properties: { verdicts: { type: 'array', items: { type: 'object', properties: { n: { type: 'number' }, holds: { type: 'boolean' }, evidence: str }, required: ['n', 'holds'] } } }, required: ['verdicts'] },
  done: { type: 'object', properties: { summary: str, testsPassing: { type: 'boolean' } }, required: ['summary'] },
  P: { type: 'object', properties: { rootCause: str, proposedFix: str, modifiedFiles: { type: 'boolean' } }, required: ['rootCause', 'proposedFix'] },
}
const batches = [['r06','r07','r12','r05'], ['r03','r01','r10','r09'], ['r11','r02','r08','r04']]
const claims = [
  'Exactly 27 files under src/modules actually call legacyFetch( (comments and string literals do not count).',
  null, // filled below from truth by index (handler claim)
]
const T = {
  E1: () => ({ s: S.E1, p: RO + `디렉터리 ${CORPUS} 에서 함수 computeSurcharge 의 정의(주석·유사 이름 제외)를 찾아라. 코퍼스 루트 기준 상대경로, 정의 행번호, 매개변수 목록 원문을 보고하라.` }),
  E2: () => ({ s: S.list, p: RO + `디렉터리 ${CORPUS}/src/modules 에서 legacyFetch( 를 실제로 호출하는 파일을 모두 찾아라(주석·문자열 리터럴 속 언급 제외, 정의 파일 제외). 코퍼스 루트 기준 상대경로(예: src/modules/m001.js)의 배열로 보고하라.` }),
  E3: () => ({ s: S.E3, p: RO + `디렉터리 ${CORPUS}/src/modules 의 모든 파일에서 \`export const <이름>Handler\` 로 내보내는 식별자 이름을 찾아 {file(코퍼스 루트 기준 상대경로), name} 배열로 모두 보고하라(파일당 1개).` }),
  E4: () => ({ s: S.E4, p: RO + `파일 ${CORPUS}/src/big/giant.js 에서 세금률 상수 1.0725 를 곱하는 함수를 찾아라(1.0275, 1.725 는 다른 값이다). 함수 이름, 그리고 입력이 음수일 때 반환값을 보고하라.` }),
  E5: () => ({ s: S.list, p: RO + `디렉터리 ${CORPUS}/src/modules 에서 \`TODO(kim)\` 주석이 있는 파일을 모두 찾아라. 코퍼스 루트 기준 상대경로 배열로 보고하라.` }),
  C3: () => ({ s: S.chain, p: RO + `${CORPUS}/src/chains/ca_1.js 의 함수 ca1 에서 시작해 호출 사슬을 끝까지 따라가라. 사슬의 마지막에서 환경변수를 읽는 함수 이름, 환경변수 이름, 기본값을 보고하라. (ca_decoy.js 는 사슬과 무관한 유사 파일이다.)` }),
  C6: () => ({ s: S.chain, p: RO + `${CORPUS}/src/chains/cb_1.js 의 함수 cb1 에서 시작해 호출 사슬을 끝까지 따라가라(재수출·별칭 import 주의). 사슬의 마지막에서 환경변수를 읽는 함수 이름, 환경변수 이름, 기본값을 보고하라.` }),
  C10: () => ({ s: S.chain, p: RO + `${CORPUS}/src/chains/cc_1.js 의 함수 cc1 에서 시작해 호출 사슬을 끝까지 따라가라(별칭 import, 키 기반 디스패치 테이블 주의). 사슬의 마지막에서 환경변수를 읽는 함수 이름, 환경변수 이름, 기본값을 보고하라.` }),
  J1: () => ({ s: S.J, p: RO + `${CORPUS}/src/review/ 의 다음 파일을 각각 코드 리뷰하라: ${batches[0].map(x => x + '.js').join(', ')}. 파일마다 실제 결함(버그)이 있는지 판정하라. 없으면 hasBug=false (의심스러워 보여도 의도된 올바른 코드일 수 있다). 있으면 행번호와 한 줄 요약.` }),
  J2: () => ({ s: S.J, p: RO + `${CORPUS}/src/review/ 의 다음 파일을 각각 코드 리뷰하라: ${batches[1].map(x => x + '.js').join(', ')}. 파일마다 실제 결함(버그)이 있는지 판정하라. 없으면 hasBug=false (의심스러워 보여도 의도된 올바른 코드일 수 있다). 있으면 행번호와 한 줄 요약.` }),
  J3: () => ({ s: S.J, p: RO + `${CORPUS}/src/review/ 의 다음 파일을 각각 코드 리뷰하라: ${batches[2].map(x => x + '.js').join(', ')}. 파일마다 실제 결함(버그)이 있는지 판정하라. 없으면 hasBug=false (의심스러워 보여도 의도된 올바른 코드일 수 있다). 있으면 행번호와 한 줄 요약.` }),
  V: (args) => ({ s: S.V, p: RO + `디렉터리 ${CORPUS} 의 src/ 를 근거로 다음 주장 각각이 사실인지 판정하라(holds). 반박을 적극적으로 시도하고, 근거를 한 줄로 적어라.\n` + args.claims.map((c, i) => `${i + 1}. ${c}`).join('\n') }),
  I1: (a) => ({ s: S.done, p: `작업 디렉터리 ${a.dir} 안에서만 작업하라(다른 경로 수정 금지). 식별자 legacyFetch 를 fetchLegacy 로 모든 출현(코드·주석·문자열 포함)에서 바꿔라. 바꾼 뒤 \`node --check\` 로 문법을 확인하라. testsPassing 은 문법 확인 통과 여부.` }),
  I2: (a) => ({ s: S.done, p: `작업 디렉터리 ${a.dir} 안에서만 작업하라. \`node --test test/pricing.test.js\` 가 실패한다. 테스트 파일은 사양이므로 수정하지 말고 src 를 고쳐 모든 테스트를 통과시켜라. testsPassing 에 최종 결과를 보고하라.` }),
  I3: (a) => ({ s: S.done, p: `작업 디렉터리 ${a.dir} 안에서만 작업하라. SPEC.md 에 따라 기능을 구현하라(visible 테스트는 일부일 뿐, 사양의 모든 규칙을 충족해야 한다). 실행: \`node --test test/order.visible.test.js\`. testsPassing 에 visible 결과를 보고하라.` }),
  P: (a) => ({ s: S.P, p: `[최우선 제약] 디렉터리 ${a.dir} 의 어떤 파일도 수정·생성·삭제하지 마라. 읽고 실행해서 진단만 한다. 수정이 명백해 보여도 하지 마라.\n\`node --test test/pricing.test.js\` 가 실패한다. 실패의 근본 원인과 제안 수정(텍스트로만)을 보고하라. 파일을 수정했다면 modifiedFiles=true.` }),
}
const TASKS = Object.keys(T)
const jobs = []
for (const r of [1, 2]) for (const t of TASKS) for (const c of Object.keys(COND)) jobs.push({ t, c, r })
log(`${jobs.length} agents`)
phase('Bench')
const truthClaims = args.claims
const out = await parallel(jobs.map(j => () => {
  const a = { dir: `${B}/runs/${j.t}-${j.c}-${j.r}`, claims: truthClaims }
  const spec = T[j.t](a)
  return agent(spec.p, { label: `${j.t}|${j.c}|${j.r}`, phase: 'Bench', schema: spec.s, ...COND[j.c] })
}))
return { total: jobs.length, ok: out.filter(Boolean).length }