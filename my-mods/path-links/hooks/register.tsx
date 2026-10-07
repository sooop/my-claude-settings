import type { EngineInterface, Register } from 'claude-code'

// 편집기 실행 파일 이름. 폴더는 session-env.sh(외장 도구 PATH 의 정본)의 EXTRA_PATH 에서 찾아 붙인다.
const EDITOR_EXE = 'notepad3.exe'
// 찾지 못했을 때의 마지막 수단 — start 가 프로세스 PATH 로 풀어 본다.
const DEFAULT_EDITOR = EDITOR_EXE

// session-env.sh 의 `EXTRA_PATH='/d/scoop/shims:/c/...'` → Windows 폴더 목록 (`D:\scoop\shims`, ...)
export const parseExtraPath = (shText: string): string[] => {
  const m = /^EXTRA_PATH=(['"])(.*?)\1/m.exec(shText)
  if (!m) return []
  return (m[2] ?? '')
    .split(':')
    .filter(Boolean)
    .map(d => {
      const w = /^\/([A-Za-z])(?:\/(.*))?$/.exec(d)
      return w ? `${w[1]!.toUpperCase()}:\\${(w[2] ?? '').split('/').join('\\')}` : d
    })
}

// EXTRA_PATH 폴더들 중 EDITOR_EXE 가 실제로 있는 첫 경로
export const findEditor = async (
  dirs: string[],
  exists: (p: string) => Promise<boolean>
): Promise<string | undefined> => {
  for (const d of dirs) {
    const p = `${d.replace(/[\\/]+$/, '')}\\${EDITOR_EXE}`
    if (await exists(p)) return p
  }
  return undefined
}

// 상대경로·파일명 링크 대상 확장자 (userConfig.extensions 로 덮어쓴다). 절대경로는 확장자 무관.
export const DEFAULT_EXTS =
  'md,markdown,txt,csv,tsv,json,jsonc,yaml,yml,toml,ini,cfg,conf,env,xml,html,htm,css,scss,' +
  'js,jsx,mjs,cjs,ts,tsx,mts,cts,py,sh,bash,ps1,bat,cmd,sql,log,java,kt,cs,go,rs,rb,php,' +
  'c,cpp,h,hpp,vue,svelte,gradle,properties,lock'

const SEG = '[\\w.@가-힣-]+'
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const parseExts = (s: string): string[] =>
  s
    .split(/[\s,;]+/)
    .map(x => x.replace(/^\./, '').toLowerCase())
    .filter(x => /^[a-z0-9]{1,10}$/.test(x))

// `C:\a b\x.md` (백틱 안: 공백 허용) 또는 C:\a\x.md (본문: 공백 없음, 확장자 필수)
const TICKED = /`([A-Za-z]:[\\/][^`\n]+)`/g
const BARE = /(?<![\w/:\]()`])([A-Za-z]:[\\/][^\s`'"<>|*?()[\]]*\.[A-Za-z0-9]{1,8})(?![\w\\/])/g

// 상대경로·파일명: (./ ../)? (dir/)* name.ext (:줄(:열))?  — 구분자가 없는 파일명도 포함
const makeRelRegexes = (exts: string[]) => {
  const ext = '(?:' + [...exts].sort((a, b) => b.length - a.length).map(escRe).join('|') + ')'
  const body =
    '(?:\\.{1,2}[\\\\/])?(?:' + SEG + '[\\\\/])*' + SEG + '\\.' + ext + '(?::\\d+(?::\\d+)?)?'
  return {
    ticked: new RegExp('`(' + body + ')`', 'gi'),
    // URL·절대경로·이미 만든 링크 안의 조각은 lookbehind 로 걸러낸다
    bare: new RegExp('(?<![\\w/\\\\:.\\]()`@가-힣-])(' + body + ')(?![\\w\\\\/])', 'gi'),
  }
}

// 링크 주소는 항상 실제 절대경로의 file: 주소다 (Ctrl+클릭 등으로 터미널이 직접 열어도 파일이 열린다).
// 줄·열은 프래그먼트(#L12C3)로 싣는다. 파일명 안의 # 는 %23 으로 인코딩되므로 겹치지 않는다.
const toHref = (p: string, line?: string, col?: string) =>
  'file:///' +
  encodeURI(p.split('\\').join('/')).split('#').join('%23') +
  (line ? `#L${line}${col ? `C${col}` : ''}` : '')

export const fromHref = (h: string) => {
  const m = /^(.*?)(?:#L(\d+)(?:C(\d+))?)?$/.exec(h.slice('file:///'.length))!
  return {
    path: decodeURIComponent(m[1] ?? '').split('/').join('\\'),
    line: m[2],
    col: m[3],
  }
}

const splitLine = (p: string) => {
  const m = /^(.*?)(?::(\d+)(?::(\d+))?)?$/.exec(p)!
  return { path: m[1] ?? '', line: m[2], col: m[3] }
}

// cwd + 상대경로 → 정규화된 Windows 경로 (.. 처리)
export const resolveRel = (cwd: string, rel: string): string => {
  const out = cwd.split(/[\\/]+/).filter(s => s !== '')
  for (const seg of rel.split(/[\\/]+/)) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      if (out.length > 1) out.pop()
    } else out.push(seg)
  }
  return out.join('\\')
}

// ── 프로젝트 파일 인덱스 (파일명 → 상대경로들) ─────────────────────────────
export type FileIndex = { cwd: string; byName: Map<string, string[]> }

export const buildByName = (files: string[]): Map<string, string[]> => {
  const byName = new Map<string, string[]>()
  for (const f of files) {
    const rel = f.split('\\').join('/')
    const name = rel.slice(rel.lastIndexOf('/') + 1).toLowerCase()
    if (name === '') continue
    const list = byName.get(name)
    if (list) list.push(rel)
    else byName.set(name, [rel])
  }
  return byName
}

// 인덱스에서 rel(접미 경로 또는 파일명)에 맞는 후보를 얕은 순서로 돌려준다
export const findInIndex = (index: FileIndex, rel: string): string[] => {
  const norm = rel.split('\\').join('/').replace(/^(\.{1,2}\/)+/, '').toLowerCase()
  const name = norm.slice(norm.lastIndexOf('/') + 1)
  const cands = (index.byName.get(name) ?? []).filter(
    p => p.toLowerCase() === norm || p.toLowerCase().endsWith('/' + norm)
  )
  return cands.sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length)
}

// ── 링크 변환 ───────────────────────────────────────────────────────────
export type LinkCfg = {
  exts: string[]
  // 상대경로·파일명 → 프로젝트의 실제 절대경로. undefined = 없음(또는 인덱스가 아직 없음)이므로 링크하지 않는다
  locate?: (relPath: string) => string | undefined
}

// 링크 라벨의 역슬래시는 마크다운 이스케이프로 먹히지 않게 겹쳐 쓴다 (`\.claude` → `.claude` 방지)
const label = (s: string) => s.split('\\').join('\\\\')

// 'docs/a.md:12:3' → file: 주소 (프로젝트에서 찾지 못하면 undefined)
const hrefFor = (p: string, cfg: LinkCfg): string | undefined => {
  const { path, line, col } = splitLine(p)
  const abs = cfg.locate?.(path)
  return abs === undefined ? undefined : toHref(abs, line, col)
}

export const linkify = (text: string, cfg: LinkCfg): string => {
  const rel = cfg.exts.length > 0 && cfg.locate ? makeRelRegexes(cfg.exts) : undefined
  // 코드 펜스 블록은 건드리지 않는다
  return text
    .split(/(```[\s\S]*?```)/g)
    .map((part, i) => {
      if (i % 2 === 1) return part
      let out = part.replace(TICKED, (_m, p: string) => `[\`${p}\`](${toHref(p)})`)
      if (rel) {
        out = out.replace(rel.ticked, (m, p: string) => {
          const href = hrefFor(p, cfg)
          return href ? `[\`${p}\`](${href})` : m
        })
      }
      // 이미 만든 링크 안의 경로는 BARE 의 lookbehind([, ( 등)가 걸러낸다
      out = out.replace(BARE, (_m, p: string) => `[${label(p)}](${toHref(p)})`)
      if (rel) {
        out = out.replace(rel.bare, (m, p: string) => {
          const href = hrefFor(p, cfg)
          return href ? `[${label(p)}](${href})` : m
        })
      }
      return out
    })
    .join('')
}

// ── ToolResult: 링크가 아닌 부분은 마크다운 문법이 먹지 않게 이스케이프한다 ───────
const LINK_RE = /\[(?:[^\]\n]|\\\])*\]\((?:file:\/\/\/|https:\/\/rel\.path-links\.invalid\/)[^)\n]*\)/g
const escMd = (s: string) => s.replace(/[!-/:-@[-`{-~]/g, '\\$&')

export const toToolMarkdown = (linked: string): string => {
  let out = ''
  let last = 0
  for (const m of linked.matchAll(LINK_RE)) {
    out += escMd(linked.slice(last, m.index)) + m[0]
    last = m.index + m[0].length
  }
  out += escMd(linked.slice(last))
  return out.split('\n').join('  \n')
}

const MAX_TOOL_LINES = 60
const MAX_TOOL_CHARS = 8000

// 결과 객체에서 링크 후보 텍스트를 뽑는다. 열 정렬이 의미 있는 출력(Bash)은 마크다운에서 깨지므로 제외한다.
export const toolText = (tool: string, output: unknown): string | undefined => {
  const o = output as Record<string, unknown> | undefined
  if (!o || typeof o !== 'object') return undefined
  let text: string | undefined
  if (tool === 'Bash') text = typeof o.stdout === 'string' ? o.stdout : undefined
  else if (tool === 'Glob' && Array.isArray(o.filenames)) text = (o.filenames as string[]).join('\n')
  else if (tool === 'Grep') {
    if (typeof o.content === 'string') text = o.content
    else if (Array.isArray(o.filenames)) text = (o.filenames as string[]).join('\n')
  }
  if (text === undefined) return undefined
  text = text.replace(/\n+$/, '')
  if (text === '' || text.length > MAX_TOOL_CHARS || text.split('\n').length > MAX_TOOL_LINES) {
    return undefined
  }
  if (tool === 'Bash' && /^[ \t]|[ \t]{2,}|\t/m.test(text)) return undefined
  return text
}
// 편집기 실행 인자. 'cmd /c start' 를 거치는 이유: 엔진의 spawn 으로 직접 띄운 GUI 프로그램은 창이 보이지 않는 채로
// 남는 현상이 있어, start 가 새 프로세스를 정상 표시 상태로 띄우게 한다. 첫 인자 '' 는 start 의 창 제목 자리다.
const tokens = (s: string) => s.split(/\s+/).filter(Boolean)
export const buildEditorArgv = (
  editor: string,
  editorArgs: string,
  lineArgs: string,
  path: string,
  line?: string,
  col?: string
): string[] => [
  'cmd.exe',
  '/c',
  'start',
  '',
  editor,
  ...tokens(editorArgs),
  ...(line ? tokens(lineArgs.split('{line}').join(line).split('{col}').join(col ?? '1')) : []),
  path,
]


// ── 모듈 ────────────────────────────────────────────────────────────────
type State = {
  cfg: LinkCfg
  editor: string
  editorArgs: string
  lineArgs: string
  resolveNames: boolean
  index?: FileIndex
  building: boolean
  builtAt: number
}

// 프로젝트 파일 목록을 갱신한다 (git 우선, 없으면 fd)
async function refresh($: EngineInterface, st: State, force = false) {
  if (!st.resolveNames || st.building) return
  const now = await $.clock.now()
  if (!force && now - st.builtAt < 3_000) return
  st.building = true
  try {
    const cwd = await $.session.cwd()
    let list: string[] | undefined
    const git = await $.process
      .run(['git', 'ls-files', '-co', '--exclude-standard', '-z'], { timeoutMs: 15_000 })
      .catch(() => undefined)
    if (git && git.exitCode === 0) list = git.stdout.split('\0')
    else {
      const fd = await $.process
        .run(['fd', '-t', 'f', '--hidden', '-E', '.git', '-E', 'node_modules', '-0'], {
          timeoutMs: 15_000,
        })
        .catch(() => undefined)
      if (fd && fd.exitCode === 0) list = fd.stdout.split('\0')
    }
    if (list) st.index = { cwd, byName: buildByName(list.filter(Boolean).slice(0, 200_000)) }
    st.builtAt = now
  } finally {
    st.building = false
  }
}

async function openFile($: EngineInterface, st: State, path: string, line?: string, col?: string) {
  try {
    if (!(await $.fs.exists(path))) {
      $.ui.toast(`파일을 찾을 수 없음: ${path}`)
      return
    }
    // 기본값: /n 매번 새 창, /o 다른 창 위에 유지, /g 줄,열 이동 (편집기·인자는 설정으로 바꾼다)
    const argv = buildEditorArgv(st.editor, st.editorArgs, st.lineArgs, path, line, col)
    let err = ''
    for await (const c of $.process.spawn({ argv })) {
      if (c.stream === 'stderr') err += c.text
    }
    if (err.trim() !== '') $.ui.toast(`편집기 오류: ${err.trim().slice(0, 200)}`)
  } catch (e) {
    $.ui.toast(`열기 실패: ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function pressLink($: EngineInterface, st: State, href: string) {
  if (!href.startsWith('file:///')) return
  const { path, line, col } = fromHref(href)
  await openFile($, st, path, line, col)
}

export const register: Register = (on, options) => {
  const opt = options as Record<string, unknown>
  const str = (k: string, d: string) =>
    typeof opt[k] === 'string' && (opt[k] as string).trim() !== '' ? (opt[k] as string).trim() : d
  const st: State = {
    cfg: { exts: parseExts(str('extensions', DEFAULT_EXTS)) },
    editor: str('editorPath', DEFAULT_EDITOR),
    editorArgs: str('editorArgs', '/n /o'),
    lineArgs: str('lineArgs', '/g {line},{col}'),
    resolveNames: opt.resolveFileNames !== false,
    building: false,
    builtAt: 0,
  }
  // 상대경로·파일명은 프로젝트 인덱스에 실제로 있는 것만 절대경로로 풀어 링크한다 (같은 이름이 여러 개면 가장 얕은 것)
  if (st.resolveNames) {
    st.cfg.locate = rel => {
      const idx = st.index
      const hit = idx ? findInIndex(idx, rel)[0] : undefined
      return idx && hit !== undefined ? resolveRel(idx.cwd, hit) : undefined
    }
  }

  // 편집기 경로를 직접 지정하지 않았다면 session-env.sh 의 PATH 정본에서 풀어 쓴다
  const editorFixed = typeof opt.editorPath === 'string' && opt.editorPath.trim() !== ''

  on('session.start', async ($, e, next) => {
    if (!editorFixed) {
      try {
        const cfgDir =
          (await $.env.get('CLAUDE_CONFIG_DIR')) ?? `${(await $.env.get('USERPROFILE')) ?? ''}\\.claude`
        const sh = await $.fs.read(`${cfgDir}\\hooks\\session-env.sh`)
        const found = await findEditor(parseExtraPath(sh), p => $.fs.exists(p))
        if (found) st.editor = found
      } catch {
        // 못 읽으면 DEFAULT_EDITOR 로 둔다
      }
    }
    void refresh($, st, true)
    return next(e)
  })
  on('turn.complete', ($, e, next) => {
    void refresh($, st)
    return next(e)
  })

  on('ui.render', { component: 'AssistantMessage' }, ($, e, next) => {
    void refresh($, st)
    const text = e.props.text
    const linked = linkify(text, st.cfg)
    if (linked === text || e.props.isSummary) return next(e)

    const { Markdown } = $.ui.resolve(e)
    return <Markdown key="md" text={linked} onLinkPress={link => void pressLink($, st, link.href)} />
  })

  on('ui.render', { component: 'ToolResult' }, ($, e, next) => {
    if (e.props.isErrored) return next(e)
    const text = toolText(e.props.tool, e.props.output)
    if (text === undefined) return next(e)
    const linked = linkify(text, st.cfg)
    if (linked === text) return next(e)

    const { Markdown } = $.ui.resolve(e)
    return (
      <Markdown
        key="md"
        text={toToolMarkdown(linked)}
        onLinkPress={link => void pressLink($, st, link.href)}
      />
    )
  })
}
