#!/usr/bin/env bash
# SessionStart — 외장 도구 경로(scoop shims·python·nodejs)를 Bash 세션 PATH 에 추가한다.
# 외장 도구 경로의 정본. 다른 훅(bash-guard.sh)은 이 파일을 source 해 PATH 만 받아 간다.
EXTRA_PATH='/d/scoop/shims:/c/Python/Python315:/c/Program Files/nodejs'

# source 된 경우: 호출자 셸의 PATH 만 확장하고 돌아간다.
if [ "${BASH_SOURCE[0]}" != "$0" ]; then
  export PATH="$PATH:$EXTRA_PATH"
  return 0
fi

[ -n "$CLAUDE_ENV_FILE" ] || exit 0
printf 'export PATH="$PATH:%s"\n' "$EXTRA_PATH" >> "$CLAUDE_ENV_FILE"
exit 0
