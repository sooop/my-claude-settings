#!/usr/bin/env bash
input=$(cat)

# Claude Code 설정의 테마(dark/light)에 따라 가독성 좋은 색상 사용
theme=$(jq -r '.theme // "dark"' ~/.claude/settings.json 2>/dev/null)
case "$theme" in
  light*) is_light=1 ;;
  *)      is_light=0 ;;
esac

# 모델명 (short)
model=$(echo "$input" | jq -r '.model.display_name // .model.id // "Claude"')
short_model=$(echo "$model" | sed 's/Claude //i' | sed 's/ /-/g')

# effort 레벨 (고정 도형 + 색상만 변화)
effort=$(echo "$input" | jq -r '.effort.level // empty')
case "$effort" in
  low)    short_model=$(printf '%s(\033[38;5;246m●\033[0m)' "$short_model") ;;
  medium) short_model=$(printf '%s(\033[38;5;226m●\033[0m)' "$short_model") ;;
  high)   short_model=$(printf '%s(\033[38;5;208m●\033[0m)' "$short_model") ;;
  xhigh)  short_model=$(printf '%s(\033[38;5;196m●\033[0m)' "$short_model") ;;
  max)    short_model=$(printf '%s(\033[1;38;5;201m●\033[0m)' "$short_model") ;;
esac
sid=$(echo "$input" | jq -r '.session_id')
flag=~/.claude/state/processing-$sid

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

  # 색상 그라데이션: 녹색 → 황록 → 노랑 → 진노랑 → 주황 → 빨강
  # 라이트 테마는 흰 배경에서도 보이도록 더 어둡고 채도 높은 톤 사용
  if [ "$is_light" -eq 1 ]; then
    if   [ "$pct_int" -ge 95 ]; then color="\033[1;38;5;88m"   # 진빨강 (bold)
    elif [ "$pct_int" -ge 85 ]; then color="\033[38;5;124m"    # 빨강
    elif [ "$pct_int" -ge 70 ]; then color="\033[38;5;166m"    # 진주황
    elif [ "$pct_int" -ge 55 ]; then color="\033[38;5;136m"    # 골드/진노랑
    elif [ "$pct_int" -ge 40 ]; then color="\033[38;5;100m"    # 올리브
    elif [ "$pct_int" -ge 20 ]; then color="\033[38;5;28m"     # 진녹색
    else                             color="\033[38;5;22m"     # 어두운 녹색
    fi
  else
    if   [ "$pct_int" -ge 95 ]; then color="\033[1;38;5;196m"  # 빨강 (bold)
    elif [ "$pct_int" -ge 85 ]; then color="\033[38;5;202m"    # 빨강-주황
    elif [ "$pct_int" -ge 70 ]; then color="\033[38;5;208m"    # 주황
    elif [ "$pct_int" -ge 55 ]; then color="\033[38;5;214m"    # 진노랑
    elif [ "$pct_int" -ge 40 ]; then color="\033[38;5;226m"    # 노랑
    elif [ "$pct_int" -ge 20 ]; then color="\033[38;5;154m"    # 황록
    else                             color="\033[38;5;76m"     # 녹색
    fi
  fi
  reset="\033[0m"

  ctx=$(printf "${color}${pct_int}%% [${bar}]${reset}")
else
  ctx=""
fi
# 오른쪽 영역: agent > worktree > cwd 마지막 디렉토리명 (+ 브랜치명)
agent_name=$(echo "$input" | jq -r '.agent.name // empty')
worktree_name=$(echo "$input" | jq -r '.worktree.name // empty')
cwd=$(echo "$input" | jq -r '.cwd // .workspace.current_dir // "."')
dir_name=$(basename "$cwd")

# 현재 디렉토리의 git 브랜치 (detached HEAD면 짧은 커밋 해시)
branch=$(git -C "$cwd" symbolic-ref --quiet --short HEAD 2>/dev/null \
  || git -C "$cwd" rev-parse --short HEAD 2>/dev/null)

if [ -n "$agent_name" ]; then
  right="⚡ ${agent_name}"
elif [ -n "$worktree_name" ]; then
  right="⎇ ${worktree_name}"
else
  right="${dir_name}"
fi

if [ -n "$branch" ]; then
  # 브랜치명 색상: 라이트 테마는 흰 배경에서도 잘 보이는 진한 파랑, 다크 테마는 하늘색
  if [ "$is_light" -eq 1 ]; then
    branch_color="\033[1;38;5;25m"
  else
    branch_color="\033[38;5;117m"
  fi
  right=$(printf "%s ${branch_color}(%s)\033[0m" "$right" "$branch")
fi

# 작업 진행 상태
if [ -f "$flag" ]; then
	# 주황 배경(테마 무관하게 잘 보임) + 글자색만 테마별 분기
	if [ "$is_light" -eq 1 ]; then
		cstat=$(printf '\033[48;5;208;30m busy \033[0m')   # 라이트: 검은 글씨
	else
		cstat=$(printf '\033[48;5;208;1;37m busy \033[0m') # 다크: 흰 글씨(볼드)
	fi
else
	cstat=""

fi
# 출력: {모델} {ctx바} {%}  |  {오른쪽}
if [ -n "$ctx" ]; then
  printf "%s %s %b  |  %s" "$short_model" "$cstat" "$ctx" "$right"
else
  printf "%s %s |  %s" "$short_model" "$cstat" "$right"
fi
