#!/usr/bin/env bash
# SessionStart — 외장 도구 경로(scoop shims·python·nodejs)를 Bash 세션 PATH 에 추가한다.
# 외장 도구 경로의 정본. 다른 훅(bash-guard.sh)은 이 파일을 source 해 PATH 만 받아 간다.
# scoop 위치는 PC마다 달라 하드코딩하지 않고 탐지한다: $SCOOP → ~/scoop → /d/scoop → /c/scoop.
# (my-mods/path-links register.tsx 도 같은 순서로 탐지한다 — 바꾸면 함께 맞출 것)
scoop_root=
for c in "${SCOOP:+$(cygpath -u "$SCOOP" 2>/dev/null)}" "$HOME/scoop" /d/scoop /c/scoop; do
  if [ -n "$c" ] && [ -d "$c/shims" ]; then scoop_root=$c; break; fi
done
# 정적 도구 경로(register.tsx 가 이 줄을 파싱한다 — 리터럴 유지)
EXTRA_PATH='/c/Python/Python315:/c/Program Files/nodejs'
[ -n "$scoop_root" ] && EXTRA_PATH="$scoop_root/shims:$EXTRA_PATH"

# source 된 경우: 호출자 셸의 PATH 만 확장하고 돌아간다.
if [ "${BASH_SOURCE[0]}" != "$0" ]; then
  export PATH="$PATH:$EXTRA_PATH"
  return 0
fi

[ -n "$CLAUDE_ENV_FILE" ] || exit 0
printf 'export PATH="$PATH:%s"\n' "$EXTRA_PATH" >> "$CLAUDE_ENV_FILE"
exit 0
