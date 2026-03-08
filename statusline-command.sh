#!/usr/bin/env bash
input=$(cat)

# 모델명 (short)
model=$(echo "$input" | jq -r '.model.display_name // .model.id // "Claude"')
short_model=$(echo "$model" | sed 's/Claude //i' | sed 's/ /-/g')

# 컨텍스트 사용량 (used_percentage 기반)
used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty')

if [ -n "$used_pct" ]; then
  # 정수로 변환
  pct_int=$(printf "%.0f" "$used_pct")

  # 진행 바 생성 (10칸)
  filled=$(( pct_int / 10 ))
  [ "$filled" -gt 10 ] && filled=10
  empty=$(( 10 - filled ))
  bar=""
  for i in $(seq 1 $filled); do bar="${bar}▓"; done
  for i in $(seq 1 $empty);  do bar="${bar}░"; done

  # 색상: 90% 이상 빨강, 80% 이상 노랑, 그 외 기본
  if [ "$pct_int" -ge 90 ]; then
    color="\033[31m"   # 빨강
  elif [ "$pct_int" -ge 80 ]; then
    color="\033[33m"   # 노랑
  else
    color=""
  fi
  reset="\033[0m"

  if [ -n "$color" ]; then
    ctx=$(printf "${color}${pct_int}%% [${bar}]${reset}")
  else
    ctx="${pct_int}% [${bar}]"
  fi
else
  ctx=""
fi

# 오른쪽 영역: agent > worktree > cwd 마지막 디렉토리명
agent_name=$(echo "$input" | jq -r '.agent.name // empty')
worktree_name=$(echo "$input" | jq -r '.worktree.name // empty')
cwd=$(echo "$input" | jq -r '.cwd // .workspace.current_dir // "."')
dir_name=$(basename "$cwd")

if [ -n "$agent_name" ]; then
  right="⚡ ${agent_name}"
elif [ -n "$worktree_name" ]; then
  right="⎇ ${worktree_name}"
else
  right="${dir_name}"
fi

# 출력: {모델} {ctx바} {%}  |  {오른쪽}
if [ -n "$ctx" ]; then
  printf "%s %b  |  %s" "$short_model" "$ctx" "$right"
else
  printf "%s  |  %s" "$short_model" "$right"
fi
