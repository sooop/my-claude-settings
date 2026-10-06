import type { Register } from 'claude-code'

const NOTEPAD3 = 'C:\\Users\\sooop\\scoop\\shims\\notepad3.exe'

// 상대경로는 이 확장자만 링크로 만든다 (절대경로는 확장자 무관)
const REL_EXT = '(?:md|txt|csv|tsv)'
const SEG = '[\\w.@가-힣-]+'

// `C:\a b\x.md` (백틱 안: 공백 허용) 또는 C:\a\x.md (본문: 공백 없음, 확장자 필수)
const TICKED = /`([A-Za-z]:[\\/][^`\n]+)`/g
const BARE = /(?<![\w/:\]()`])([A-Za-z]:[\\/][^\s`'"<>|*?()[\]]*\.[A-Za-z0-9]{1,8})(?![\w\\/])/g

// 상대경로: 경로 구분자가 1개 이상 있고 md|txt|csv|tsv 로 끝나며, 뒤에 :줄[:열] 이 올 수 있다
// 백틱 안 (`docs/a.md`, `docs/a.md:12`)
const TICKED_REL = new RegExp(
  '`((?:\\.{1,2}[\\\\/])?(?:' + SEG + '[\\\\/])+' + SEG + '\\.' + REL_EXT + '(?::\\d+(?::\\d+)?)?)`',
  'gi'
)
// 본문 (URL·절대경로·이미 만든 링크 안의 조각은 lookbehind 로 걸러낸다)
const BARE_REL = new RegExp(
  '(?<![\\w/\\\\:.\\]()`@가-힣-])((?:\\.{1,2}[\\\\/])?(?:' +
    SEG + '[\\\\/])+' + SEG + '\\.' + REL_EXT + '(?::\\d+(?::\\d+)?)?)(?![\\w\\\\/])',
  'gi'
)

// file: 주소는 렌더러가 정규화한다(file:///__rel__/x → file:///C:/__rel__/x). https: 는 href 가 원문 그대로
// 돌아오므로 상대경로 표식은 https 가짜 호스트로 싣는다. 이 호스트는 실제로 열리지 않는다.
const REL_PREFIX = 'https://rel.path-links.invalid/'

const toHref = (p: string) =>
  'file:///' + encodeURI(p.split('\\').join('/')).split('#').join('%23')
const fromHref = (h: string) =>
  decodeURIComponent(h.slice('file:///'.length)).split('/').join('\\')

// 'docs/a.md:12:3' → href (줄·열은 쿼리로 보존)
export const toRelHref = (p: string) => {
  const m = /^(.*?)(?::(\d+)(?::(\d+))?)?$/.exec(p)!
  const path = m[1].split('\\').join('/')
  const q = m[2] ? `?line=${m[2]}${m[3] ? `&col=${m[3]}` : ''}` : ''
  return REL_PREFIX + encodeURI(path).split('#').join('%23') + q
}

export const parseRelHref = (h: string) => {
  const [pathPart, query = ''] = h.slice(REL_PREFIX.length).split('?')
  const params = new URLSearchParams(query)
  return {
    rel: decodeURIComponent(pathPart),
    line: params.get('line') ?? undefined,
    col: params.get('col') ?? undefined,
  }
}

// cwd + 상대경로 → 정규화된 Windows 경로 (.. 처리)
export const resolveRel = (cwd: string, rel: string): string => {
  const out = cwd.split(/[\\/]+/).filter(s => s !== '')
  for (const seg of rel.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      if (out.length > 1) out.pop()
    } else out.push(seg)
  }
  return out.join('\\')
}

export const linkify = (text: string): string =>
  // 코드 펜스 블록은 건드리지 않는다
  text
    .split(/(```[\s\S]*?```)/g)
    .map((part, i) => {
      if (i % 2 === 1) return part
      const ticked = part
        .replace(TICKED, (_m, p: string) => `[\`${p}\`](${toHref(p)})`)
        .replace(TICKED_REL, (_m, p: string) => `[\`${p}\`](${toRelHref(p)})`)
      // 이미 만든 링크 안의 경로는 BARE 의 lookbehind([, ( 등)가 걸러낸다
      return ticked
        .replace(BARE, (_m, p: string) => `[${p}](${toHref(p)})`)
        .replace(BARE_REL, (_m, p: string) => `[${p}](${toRelHref(p)})`)
    })
    .join('')

export const register: Register = on => {
  on('ui.render', { component: 'AssistantMessage' }, ($, e, next) => {
    const text = e.props.text
    const linked = linkify(text)

    if (linked === text || e.props.isSummary) {
      return next(e)
    }

    const { Markdown } = $.ui.resolve(e)

    const open = async (path: string, line?: string, col?: string) => {
      if (!(await $.fs.exists(path))) {
        $.ui.toast(`파일을 찾을 수 없음: ${path}`)
        return
      }
      const argv = [NOTEPAD3]
      if (line) argv.push(`/g`, col ? `${line},${col}` : line)
      argv.push(path)
      for await (const _ of $.process.spawn({ argv })) {
        // 자식(notepad3)이 끝날 때까지 루프를 유지
      }
    }

    return (
      <Markdown
        key="md"
        text={linked}
        onLinkPress={link => {
          if (link.href.startsWith(REL_PREFIX)) {
            const { rel, line, col } = parseRelHref(link.href)
            void (async () => {
              const cwd = await $.session.cwd()
              await open(resolveRel(cwd, rel), line, col)
            })()
            return
          }
          if (!link.href.startsWith('file:///')) return
          void open(fromHref(link.href))
        }}
      />
    )
  })
}
