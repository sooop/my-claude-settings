import type { Register } from 'claude-code'

const NOTEPAD3 = 'C:\\Users\\sooop\\scoop\\shims\\notepad3.exe'

// `C:\a b\x.md` (백틱 안: 공백 허용) 또는 C:\a\x.md (본문: 공백 없음, 확장자 필수)
const TICKED = /`([A-Za-z]:[\\/][^`\n]+)`/g
const BARE = /(?<![\w/:\]()`])([A-Za-z]:[\\/][^\s`'"<>|*?()[\]]*\.[A-Za-z0-9]{1,8})(?![\w\\/])/g

const toHref = (p: string) =>
  'file:///' + encodeURI(p.split('\\').join('/')).split('#').join('%23')
const fromHref = (h: string) =>
  decodeURIComponent(h.slice('file:///'.length)).split('/').join('\\')

export const linkify = (text: string): string =>
  // 코드 펜스 블록은 건드리지 않는다
  text
    .split(/(```[\s\S]*?```)/g)
    .map((part, i) => {
      if (i % 2 === 1) return part
      const ticked = part.replace(TICKED, (_m, p: string) => `[\`${p}\`](${toHref(p)})`)
      // 이미 만든 링크 안의 경로는 BARE 의 lookbehind([, ( 등)가 걸러낸다
      return ticked.replace(BARE, (_m, p: string) => `[${p}](${toHref(p)})`)
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

    return (
      <Markdown
        key="md"
        text={linked}
        onLinkPress={link => {
          if (!link.href.startsWith('file:///')) return
          const path = fromHref(link.href)
          void (async () => {
            for await (const _ of $.process.spawn({ argv: [NOTEPAD3, path] })) {
              // 자식(notepad3)이 끝날 때까지 루프를 유지
            }
          })()
        }}
      />
    )
  })
}
