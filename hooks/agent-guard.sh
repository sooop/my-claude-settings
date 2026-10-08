#!/usr/bin/env bash
# PreToolUse(Agent) — model 미지정 호출은 sonnet 으로 지정해 통과시킨다(미지정 시 세션 모델 opus 를 상속하므로). CLAUDE.md: 기본 sonnet.
#  - 티어 에이전트·fork 등 frontmatter/세션이 모델을 정하는 유형은 그대로 통과.
#  - model=haiku 별칭은 Haiku 4.5 로 해석된다(실측 2026-10-08: 5.5 보다 느리고 건당 약 14배 비쌈). 거부하고 scout/builder 로 안내한다.
# 판정 실패 시 통과(fail-open).
IN=$(cat) || exit 0
read -r MODEL TYPE < <(printf '%s' "$IN" | jq -r '[(.tool_input.model // "-"), (.tool_input.subagent_type // "-")] | join(" ")' 2>/dev/null | tr -d '\r') || exit 0
if [ "$MODEL" = "haiku" ]; then  # 티어 에이전트에 명시해도 frontmatter(5.5)를 4.5 로 덮어쓰므로 유형과 무관하게 거부
  jq -nc '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:"model=haiku 별칭은 Haiku 4.5(느리고 비쌈)로 해석된다. 수집·추적·집계는 scout, 범위가 정해진 구현은 builder 티어 에이전트(Haiku 5.5)를 model 없이 쓸 것. 기준: agent-routing 스킬."}}'
  exit 0
fi
case "$TYPE" in scout|builder|worker|verifier|deep-reasoner|git-commiter|plan-planter|statusline-setup|claude-code-guide|fork) exit 0 ;; esac
[ "$MODEL" != "-" ] && exit 0
printf '%s' "$IN" | jq -c '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"allow",permissionDecisionReason:"model 미지정 → sonnet 기본(CLAUDE.md)",updatedInput:(.tool_input + {model:"sonnet"})}}' 2>/dev/null || exit 0
exit 0
