#!/usr/bin/env node
/**
 * Redmine 이슈 등록·수정 도구 — 마크다운 본문을 CKEditor HTML 로 변환해 그대로 전송한다.
 *
 * ## 왜 이 도구가 있는가
 *
 * Redmine 은 `data-text-formatting="CKEditor"` 라서 API 로 보낸 Markdown/Textile 을 변환하지
 * 않는다. 그래서 본문을 HTML 로 만들어 보내야 하는데, 이때 두 가지 비용이 반복적으로 발생했다.
 *
 * 1. **이스케이프 실수** — 태그(`<h2>`)는 원시 문자로, 본문 텍스트의 `< > &` 는 엔티티로 보내야
 *    한다. 이 2층 구분을 손으로 하다 태그까지 `&lt;h2&gt;` 로 이스케이프하면, Redmine 은 받은
 *    문자열을 그대로 저장하므로 화면에 태그가 **글자로** 보인다. 조회 → 원시 HTML 재전송으로
 *    같은 본문을 두 번 보내는 왕복이 났다.
 * 2. **토큰** — 에이전트가 도구 파라미터에 HTML 을 직접 쓰면 태그 전체가 컨텍스트를 통과한다.
 *
 * 이 스크립트는 **변환과 전송을 한 번에** 해서 둘 다 없앤다. 마크다운만 파일로 쓰면 되고,
 * HTML 은 모델 컨텍스트를 거치지 않는다. 텍스트의 특수문자 이스케이프는 `marked` 가 한다.
 *
 * **변환만 하고 결과를 다시 읽어 MCP 도구에 넘기면 절감이 사라진다**(오히려 늘어난다).
 * 그래서 이 스크립트가 API 호출까지 책임진다.
 *
 * ## 의존성
 *
 * `marked` 를 **전역** 설치해 쓴다(`npm install -g marked`). 이 스크립트는 저장소 밖에 있으므로
 * 어떤 프로젝트의 `package.json` 도 건드리지 않는다. 전역 설치본을 찾지 못하면 무엇을 실행해야
 * 하는지 알려주고 종료한다.
 *
 * ## 사용법
 *
 *   node ~/.claude/tools/redmine-issue.mjs convert --body-file body.md
 *   node ~/.claude/tools/redmine-issue.mjs create --project "Front Dev" --tracker Bug \
 *        --subject "제목" --body-file body.md
 *   node ~/.claude/tools/redmine-issue.mjs update --issue 4576 --body-file body.md
 *   node ~/.claude/tools/redmine-issue.mjs note   --issue 4576 --body-file note.md \
 *        --status Resolved --done 100
 *
 * 공통 옵션: `--dry-run`(쓰기 호출 없이 변환·이름 해석까지만), `--config <path>`,
 * `--url`, `--api-key`, `--no-assign`(create 에서 담당자 지정 생략), `--quiet`.
 *
 * 설정은 `--config` → `REDMINE_URL`/`REDMINE_API_KEY` 환경변수 → cwd 에서 위로 올라가며 찾은
 * `redmine-db-notify/.redmine.json` 순서로 읽는다. **API 키는 어떤 경로로도 출력하지 않는다.**
 */

import { readFile, access } from 'node:fs/promises'
import { join, dirname, resolve, parse as parsePath } from 'node:path'
import { pathToFileURL } from 'node:url'
import { homedir } from 'node:os'

/* ────────────────────────────── marked 로딩 ────────────────────────────── */

/**
 * 전역 설치된 `marked` 를 찾아 로드한다.
 *
 * 전역 `node_modules` 는 Node 의 기본 해석 경로가 아니므로(ESM 은 `NODE_PATH` 도 무시한다)
 * 후보 경로를 직접 만들어 절대 파일 URL 로 import 한다. `npm root -g` 를 실행하지 않는다 —
 * Windows 에서 `npm` 은 `.cmd` 셸 래퍼라 spawn 이 불안정하고, 호출마다 수백 ms 가 든다.
 */
async function loadMarked() {
  const candidates = ['marked'] // 스크립트 옆에 node_modules 가 있으면 그것부터

  const globalRoots = []
  if (process.env.APPDATA) globalRoots.push(join(process.env.APPDATA, 'npm', 'node_modules'))
  globalRoots.push(join(homedir(), '.npm-global', 'lib', 'node_modules'))
  globalRoots.push('/usr/local/lib/node_modules')
  globalRoots.push('/usr/lib/node_modules')
  for (const root of globalRoots) {
    candidates.push(pathToFileURL(join(root, 'marked', 'lib', 'marked.esm.js')).href)
  }

  for (const candidate of candidates) {
    try {
      const mod = await import(candidate)
      if (mod?.marked) return mod.marked
    } catch {
      // 다음 후보로
    }
  }
  fail(
    'marked 를 찾을 수 없습니다. 전역으로 설치하세요:\n  npm install -g marked\n' +
      '(이 스크립트는 저장소 밖에 있어 프로젝트 의존성을 쓰지 않습니다.)'
  )
}

/* ────────────────────────────── HTML 정제 ────────────────────────────── */

/**
 * Redmine CKEditor 가 이슈 본문에서 다루는 태그만 남긴다.
 *
 * `marked` 는 CommonMark + GFM 을 모두 내보내므로 이슈 본문에 어울리지 않는 구조(h1, 이미지,
 * 체크박스 등)가 섞일 수 있다. 화이트리스트로 좁혀 두면 **어떤 마크다운을 넣어도 출력 태그
 * 집합이 고정**되고, 렌더가 깨지는 경우를 미리 없앨 수 있다.
 */
const ALLOWED_TAGS = new Set([
  'h2', 'h3', 'h4',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'strong', 'em', 'del',
  'code', 'pre',
  'a',
  'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
])

/** 태그별로 남길 속성 — 그 외는 전부 버린다(헤더 id, 스타일, 이벤트 핸들러 등). */
const ALLOWED_ATTRS = {
  a: ['href', 'title'],
  code: ['class'], // `language-*` 는 코드 하이라이트에 쓰이므로 남긴다
  th: ['align'],
  td: ['align'],
}

/** 이슈 본문에 h1 은 과하다(제목이 이미 있다). 한 단계씩 낮춘다. */
const TAG_REWRITE = { h1: 'h2', h5: 'h4', h6: 'h4' }

function sanitizeHtml(html) {
  return html.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^<>]*?)?)\s*(\/?)>/g, (_m, slash, rawName, rawAttrs, selfClose) => {
    const name = (TAG_REWRITE[rawName.toLowerCase()] ?? rawName.toLowerCase())
    if (!ALLOWED_TAGS.has(name)) return '' // 태그만 제거하고 내용은 남긴다
    if (slash) return `</${name}>`

    const allowed = ALLOWED_ATTRS[name] ?? []
    let attrs = ''
    if (allowed.length > 0 && rawAttrs) {
      for (const [, key, value] of rawAttrs.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) {
        if (!allowed.includes(key.toLowerCase())) continue
        // javascript: 같은 스킴은 링크에서 배제한다
        if (key.toLowerCase() === 'href' && /^\s*(javascript|data|vbscript):/i.test(value)) continue
        attrs += ` ${key.toLowerCase()}="${value}"`
      }
    }
    return `<${name}${attrs}${selfClose ? ' /' : ''}>`
  })
}

/**
 * 태그가 엔티티로 이스케이프된 채 전송되지 않았는지 확인한다.
 *
 * 이 스크립트 경로에서는 구조상 날 수 없는 오류지만, 남겨 두면 손으로 만든 HTML 을
 * `--html-file` 로 넣는 경우나 향후 변경에서 같은 실수를 다시 잡아 준다.
 */
function findEscapedTags(text) {
  const m = text.match(/&lt;\/?(h[1-6]|p|ul|ol|li|code|pre|strong|em|a|table|tr|td)&gt;/i)
  return m ? m[0] : null
}

async function markdownToCkeditorHtml(markdown) {
  const marked = await loadMarked()
  const raw = await marked.parse(markdown, { gfm: true, breaks: false, async: true })
  return sanitizeHtml(raw).replace(/\n{3,}/g, '\n\n').trim()
}

/* ────────────────────────────── 설정 ────────────────────────────── */

async function exists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

/**
 * `.redmine.json` 을 찾는다. cwd 에서 파일시스템 루트까지 올라가며 각 단계에서
 * `redmine-db-notify/.redmine.json` 과 `.redmine.json` 을 본다 — 프로젝트 루트에서 실행하면
 * 형제 디렉터리의 공용 설정(`../redmine-db-notify/.redmine.json`)이 잡힌다.
 */
async function findConfigPath(explicit) {
  if (explicit) {
    const p = resolve(explicit)
    if (!(await exists(p))) fail(`설정 파일을 찾을 수 없습니다: ${p}`)
    return p
  }
  let dir = process.cwd()
  const root = parsePath(dir).root
  while (true) {
    for (const rel of [join('redmine-db-notify', '.redmine.json'), '.redmine.json']) {
      const p = join(dir, rel)
      if (await exists(p)) return p
    }
    if (dir === root) return null
    dir = dirname(dir)
  }
}

async function loadConfig(args) {
  let url = args['url'] ?? process.env.REDMINE_URL ?? null
  let apiKey = args['api-key'] ?? process.env.REDMINE_API_KEY ?? null

  if (!url || !apiKey) {
    const configPath = await findConfigPath(args['config'])
    if (configPath) {
      const json = JSON.parse(await readFile(configPath, 'utf8'))
      url ??= json.url
      apiKey ??= json.apiKey
    }
  }
  if (!url || !apiKey) {
    fail(
      'Redmine 접속 정보를 찾을 수 없습니다.\n' +
        '  --config <.redmine.json 경로> 를 주거나, REDMINE_URL / REDMINE_API_KEY 를 설정하세요.'
    )
  }
  return { url: url.replace(/\/+$/, ''), apiKey }
}

/* ────────────────────────────── Redmine API ────────────────────────────── */

async function api({ url, apiKey }, method, path, body) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: {
      'X-Redmine-API-Key': apiKey,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  if (!res.ok) {
    // 응답 본문에 키가 실릴 일은 없지만, 길면 잘라 둔다
    fail(`Redmine API ${method} ${path} 실패 (HTTP ${res.status})\n${text.slice(0, 500)}`)
  }
  return text ? JSON.parse(text) : {}
}

/** 이름·identifier·숫자 중 무엇으로 주어져도 id 로 맞춘다(숫자 하드코딩을 피하기 위함). */
async function resolveNamed(cfg, kind, value) {
  if (value == null) return null
  if (/^\d+$/.test(String(value))) return Number(value)

  const specs = {
    project: { path: '/projects.json?limit=100', key: 'projects', match: (x, v) => eq(x.name, v) || eq(x.identifier, v) },
    tracker: { path: '/trackers.json', key: 'trackers', match: (x, v) => eq(x.name, v) },
    status: { path: '/issue_statuses.json', key: 'issue_statuses', match: (x, v) => eq(x.name, v) },
    priority: { path: '/enumerations/issue_priorities.json', key: 'issue_priorities', match: (x, v) => eq(x.name, v) },
  }
  const spec = specs[kind]
  const data = await api(cfg, 'GET', spec.path)
  const list = data[spec.key] ?? []
  const hit = list.find((x) => spec.match(x, value))
  if (!hit) {
    fail(`${kind} "${value}" 를 찾을 수 없습니다. 사용 가능: ${list.map((x) => x.name).join(', ')}`)
  }
  return hit.id
}

const eq = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase()

/* ────────────────────────────── 명령 ────────────────────────────── */

async function readBody(args) {
  if (args['body-file']) return markdownToCkeditorHtml(await readFile(resolve(args['body-file']), 'utf8'))
  if (args['html-file']) return (await readFile(resolve(args['html-file']), 'utf8')).trim()
  return null
}

async function cmdConvert(args) {
  const html = await readBody(args)
  if (html == null) fail('--body-file <마크다운 파일> 이 필요합니다.')
  process.stdout.write(html + '\n')
}

async function cmdCreate(args, cfg) {
  for (const required of ['project', 'tracker', 'subject']) {
    if (!args[required]) fail(`--${required} 가 필요합니다.`)
  }
  const description = await readBody(args)
  if (description == null) fail('--body-file <마크다운 파일> 이 필요합니다.')

  const issue = {
    project_id: await resolveNamed(cfg, 'project', args['project']),
    tracker_id: await resolveNamed(cfg, 'tracker', args['tracker']),
    subject: args['subject'],
    description,
  }
  if (args['status']) issue.status_id = await resolveNamed(cfg, 'status', args['status'])
  if (args['priority']) issue.priority_id = await resolveNamed(cfg, 'priority', args['priority'])

  // 담당자는 기본적으로 "나"(설정된 API 키의 소유자) — 스킬 규칙과 동일. --no-assign 으로 끈다.
  let assigneeName = null
  if (!args['no-assign']) {
    const me = await api(cfg, 'GET', '/users/current.json')
    issue.assigned_to_id = me.user.id
    assigneeName = `${me.user.lastname ?? ''}${me.user.firstname ?? ''}`.trim() || me.user.login
  }

  if (args['dry-run']) {
    report(args, `[dry-run] create project_id=${issue.project_id} tracker_id=${issue.tracker_id}` +
      (issue.assigned_to_id ? ` assigned_to_id=${issue.assigned_to_id}` : '') +
      `\n${description}`)
    return
  }

  const created = await api(cfg, 'POST', '/issues.json', { issue })
  const id = created.issue.id
  await verify(cfg, args, id, 'description')
  report(args, `#${id} ${cfg.url}/issues/${id}` + (assigneeName ? ` (담당자: ${assigneeName})` : ''))
}

async function cmdUpdate(args, cfg) {
  const id = requireIssueId(args)
  const description = await readBody(args)
  const issue = {}
  if (description != null) issue.description = description
  if (args['subject']) issue.subject = args['subject']
  if (args['status']) issue.status_id = await resolveNamed(cfg, 'status', args['status'])
  if (args['done'] != null) issue.done_ratio = Number(args['done'])
  if (Object.keys(issue).length === 0) fail('바꿀 것이 없습니다 — --body-file / --subject / --status / --done 중 하나를 주세요.')

  if (args['dry-run']) {
    report(args, `[dry-run] update #${id} keys=${Object.keys(issue).join(',')}` + (description ? `\n${description}` : ''))
    return
  }
  await api(cfg, 'PUT', `/issues/${id}.json`, { issue })
  if (description != null) await verify(cfg, args, id, 'description')
  report(args, `#${id} 수정 완료 (${Object.keys(issue).join(', ')}) ${cfg.url}/issues/${id}`)
}

async function cmdNote(args, cfg) {
  const id = requireIssueId(args)
  const notes = await readBody(args)
  if (notes == null) fail('--body-file <마크다운 파일> 이 필요합니다.')

  const issue = { notes }
  if (args['status']) issue.status_id = await resolveNamed(cfg, 'status', args['status'])
  if (args['done'] != null) issue.done_ratio = Number(args['done'])
  if (args['private']) issue.private_notes = true

  if (args['dry-run']) {
    report(args, `[dry-run] note #${id} keys=${Object.keys(issue).join(',')}\n${notes}`)
    return
  }
  await api(cfg, 'PUT', `/issues/${id}.json`, { issue })
  await verify(cfg, args, id, 'journal')
  report(args, `#${id} 코멘트 등록 완료 (${Object.keys(issue).join(', ')}) ${cfg.url}/issues/${id}`)
}

function requireIssueId(args) {
  const raw = args['issue']
  if (!raw) fail('--issue <번호> 가 필요합니다.')
  const m = String(raw).match(/(\d+)\s*$/)
  if (!m) fail(`이슈 번호를 해석할 수 없습니다: ${raw}`)
  return Number(m[1])
}

/**
 * 전송된 본문이 화면에서 태그로 렌더되는지(=엔티티로 굳지 않았는지) 확인한다.
 * 실패해도 이미 등록은 끝났으므로 경고 후 exit 1 — 사용자가 손으로 고칠 수 있게 사실을 알린다.
 */
async function verify(cfg, args, id, target) {
  const data = await api(cfg, 'GET', `/issues/${id}.json${target === 'journal' ? '?include=journals' : ''}`)
  const text =
    target === 'journal'
      ? (data.issue.journals ?? []).at(-1)?.notes ?? ''
      : data.issue.description ?? ''
  const escaped = findEscapedTags(text)
  if (escaped) {
    process.exitCode = 1
    process.stderr.write(
      `경고: 전송된 본문에 이스케이프된 태그(${escaped})가 남아 있습니다 — 화면에 태그가 글자로 보입니다.\n` +
        `      ${cfg.url}/issues/${id}\n`
    )
    return
  }
  if (!args['quiet']) process.stderr.write('verify: ok (원시 HTML 로 저장됨)\n')
}

/* ────────────────────────────── 엔트리 ────────────────────────────── */

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

function report(args, message) {
  if (!args['quiet']) process.stdout.write(message + '\n')
}

/** `--key value` 와 `--flag` 를 모두 받는 최소 파서(외부 의존성 없이). */
function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next != null && !next.startsWith('--')) {
      args[key] = next
      i += 1
    } else {
      args[key] = true
    }
  }
  return args
}

const USAGE = `사용법: node redmine-issue.mjs <convert|create|update|note> [옵션]

  convert --body-file <md>                                    변환 결과만 출력(등록 없음)
  create  --project <이름> --tracker <이름> --subject <제목> --body-file <md>
          [--priority <이름>] [--status <이름>] [--no-assign]
  update  --issue <번호> [--body-file <md>] [--subject <제목>] [--status <이름>] [--done <0-100>]
  note    --issue <번호> --body-file <md> [--status <이름>] [--done <0-100>] [--private]

공통: --dry-run  --config <.redmine.json>  --url <base>  --api-key <key>  --quiet
      --html-file <html>  (마크다운 대신 이미 만든 HTML 을 그대로 전송)

본문은 **마크다운**으로 쓴다. 태그·이스케이프는 이 스크립트가 처리한다.`

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  if (!command || ['-h', '--help', 'help'].includes(command)) {
    process.stdout.write(USAGE + '\n')
    return
  }
  const args = parseArgs(rest)

  if (command === 'convert') return cmdConvert(args)

  const cfg = await loadConfig(args)
  if (command === 'create') return cmdCreate(args, cfg)
  if (command === 'update') return cmdUpdate(args, cfg)
  if (command === 'note') return cmdNote(args, cfg)

  fail(`알 수 없는 명령: ${command}\n\n${USAGE}`)
}

await main()
