#!/usr/bin/env bash
# SessionStart — 외장 도구 경로(scoop shims·python·nodejs)를 Bash 세션 PATH 에 추가한다.
[ -n "$CLAUDE_ENV_FILE" ] || exit 0
printf '%s\n' 'export PATH="$PATH:/d/scoop/shims:/c/Python/Python315:/c/Program Files/nodejs"' >> "$CLAUDE_ENV_FILE"
exit 0
