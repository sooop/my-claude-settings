#!/usr/bin/env bash
# 원문(html/htm/docx)을 pandoc 으로 GFM 마크다운으로 변환한다.
# 사용: to-md.sh <입력파일> [출력파일] [--force]
#   출력파일을 생략하면 입력 파일 옆에 같은 이름의 .md 로 쓴다.
#   이미 있는 출력 파일은 --force 없이는 덮어쓰지 않는다.
set -euo pipefail

force=0
args=()
for a in "$@"; do
  if [ "$a" = "--force" ]; then force=1; else args+=("$a"); fi
done

in="${args[0]:-}"
out="${args[1]:-}"

if [ -z "$in" ]; then
  echo "사용: to-md.sh <입력파일.html|.htm|.docx> [출력파일.md] [--force]" >&2
  exit 2
fi
if [ ! -f "$in" ]; then
  echo "입력 파일이 없다: $in" >&2
  exit 2
fi
# scoop shims 가 PATH 에 없으면 앞에 붙인다. 위치는 $SCOOP → ~/scoop 순으로 본다.
# (SessionStart 훅 session-env.sh 가 보통 이미 추가하지만, 방금 설치했거나 훅이 안 돈 셸을 위한 보강이다.)
scoop_root="$HOME/scoop"
if [ -n "${SCOOP:-}" ]; then
  scoop_root="$(cygpath -u "$SCOOP" 2>/dev/null || printf '%s' "$SCOOP")"
fi
add_scoop_path() {
  if [ -d "$scoop_root/shims" ]; then
    case ":$PATH:" in
      *":$scoop_root/shims:"*) ;;
      *) export PATH="$scoop_root/shims:$PATH" ;;
    esac
  fi
}
add_scoop_path

# pandoc 이 없으면 scoop 으로 설치한다. scoop 도 없으면 scoop 부터 설치한다.
# Windows 이므로 PowerShell 이 있다고 가정한다.
if ! command -v pandoc >/dev/null 2>&1; then
  if ! command -v scoop >/dev/null 2>&1; then
    echo "scoop 이 없다. 설치한다(관리자 권한 셸에서는 scoop 설치가 거부된다)." >&2
    powershell -NoProfile -ExecutionPolicy Bypass -Command \
      "Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force; Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression" >&2 || true
    add_scoop_path
  fi
  if command -v scoop >/dev/null 2>&1; then
    echo "pandoc 이 없다. scoop 으로 설치한다." >&2
    scoop install pandoc >&2 || true
    add_scoop_path
  fi
fi
if ! command -v pandoc >/dev/null 2>&1; then
  echo "pandoc 을 설치하지 못했다. 원문을 직접 읽고 변환하지 못했다고 보고한다." >&2
  exit 3
fi

ext="${in##*.}"
ext="$(printf '%s' "$ext" | tr '[:upper:]' '[:lower:]')"
case "$ext" in
  html|htm) from="html" ;;
  docx)     from="docx" ;;
  *) echo "지원하지 않는 형식이다(.html .htm .docx 만): $in" >&2; exit 2 ;;
esac

[ -n "$out" ] || out="${in%.*}.md"
if [ -e "$out" ] && [ "$force" -ne 1 ]; then
  echo "출력 파일이 이미 있다. 덮어쓰려면 --force 를 붙인다: $out" >&2
  exit 4
fi

# 표를 보존하려고 gfm 을 쓴다. 줄바꿈은 원문 그대로 둔다.
# html 에서 <style>/<script> 는 본문이 아니므로 pandoc 이 버린다.
pandoc -f "$from" -t gfm --wrap=none "$in" -o "$out"

# 병합 셀(colspan/rowspan)이 있는 표는 gfm 이 HTML 표로 남긴다. 개수를 알려 준다.
raw_tables=$(grep -c '<table' "$out" || true)
echo "변환 완료: $out"
if [ "${raw_tables:-0}" -gt 0 ]; then
  echo "주의: 마크다운 표로 바꾸지 못한 HTML 표가 ${raw_tables}개 있다(병합 셀 등). 내용을 확인한다." >&2
fi
