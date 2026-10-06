#!/usr/bin/env bash
# PreToolUse(Bash) 가드 — CLAUDE.md "CLI 도구 사용 지침" 의 <CRITICAL> 항목을 강제한다.
# 판정 실패 시에는 항상 통과시킨다(fail-open). 차단은 아래 2가지 경우에만(인자 없는 duckdb / 대화형 fzf).
#
# 설계 메모(2026-09-17 개정):
#  - 프로세스 스폰을 jq 1회 + sed 1회로 줄였다. 이전 판은 매 호출마다 rg 를 최대 5회 띄워
#    모든 Bash 호출에 ~440ms 를 더했다(누적 실측 약 18분). 매칭은 bash 내장 정규식으로 한다.
#  - 매칭 전에 인용부호 안 내용을 지운다. 이전 판은 도구 이름이 *데이터로만* 등장해도 막아
#    `echo "| grep 금지" >> NOTES.md` 나 `rg -n "; find " docs/` 가 차단됐다.
#  - 줄바꿈도 명령 구분자로 본다(여러 줄 명령의 2번째 줄에서 시작하는 위반을 놓치지 않는다).
export PATH="$PATH:/c/Users/sooop/scoop/shims"

CMD=$(jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
[ -z "$CMD" ] && exit 0

# 명시적 탈출구: 명령에 '# guard-off' 를 넣으면 모든 검사를 건너뛴다.
case "$CMD" in *"# guard-off"*) exit 0 ;; esac

deny() {
  jq -nc --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

# 인용부호 안(문자열 리터럴)을 비워 둔 사본으로 판정한다 — 데이터로만 등장한 도구 이름 오탐 방지.
SCAN=$(printf '%s' "$CMD" | sed -e "s/'[^']*'/''/g" -e 's/"[^"]*"/""/g' 2>/dev/null) || SCAN=$CMD

# 명령어 위치(줄 시작 / 줄바꿈 / 파이프 / 세미콜론 / && / || / ( / xargs / -x 뒤)에 오는 단어만 매칭
SEP='(^|[;&|($'$'\n'']|xargs[[:space:]]+|[[:space:]]-x[[:space:]]+)[[:space:]]*'

# POSIX 셸 래퍼(`bash -c "..."`)는 따옴표 안이 곧 실행될 코드다 — 원문도 함께 본다.
# (이게 없으면 `bash -c 'ls; grep x'` 가 인용부호 제거로 통째로 사라져 통과한다.)
RAW=''
if [[ $SCAN =~ ${SEP}(bash|sh|dash|zsh|ksh)[[:space:]]+-c ]]; then RAW=$CMD; fi

at_cmd_pos() {
  [[ $SCAN =~ $SEP$1([[:space:]]|$) ]] && return 0
  [ -n "$RAW" ] && [[ $RAW =~ $SEP$1([[:space:]]|$) ]]
}

# 1) (삭제됨 2026-10-06) sd 를 코드 파일에 쓰는 것을 막던 규칙 — 사용자 결정으로 제거

# 2) 인자 없는 duckdb (REPL 진입 → 세션 hang)
if at_cmd_pos 'duckdb' && ! [[ $SCAN =~ duckdb[^|\;\&]*(-c|-f|-cmd|--help|--version|\<) ]]; then
  deny "CLAUDE.md 금지: 인자 없는 duckdb 는 REPL 로 진입해 세션이 멈춘다.
→ 항상 -c 또는 -f 를 붙일 것:  duckdb -c \"SELECT ... FROM 'data.csv'\""
fi

# 3) --filter 없는 fzf (대화형 → 입력 대기로 hang)
if at_cmd_pos 'fzf' && ! [[ $SCAN =~ fzf[^|\;\&]*(--filter|[[:space:]]-f[[:space:]]) ]]; then
  deny "CLAUDE.md 금지: fzf 는 대화형이라 그냥 실행하면 입력 대기로 멈춘다.
→ 비대화형 모드만 사용:  fzf --filter '<query>'"
fi

exit 0
