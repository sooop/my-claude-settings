#!/usr/bin/env bash
# PreToolUse(Agent) — model 미지정 호출을 막는다(미지정 시 세션 모델 opus 를 상속한다).
# 티어 에이전트·fork 등 frontmatter/세션이 모델을 정하는 유형은 통과. 판정 실패 시 통과(fail-open).
IN=$(cat) || exit 0
read -r MODEL TYPE < <(printf '%s' "$IN" | jq -r '[(.tool_input.model // "-"), (.tool_input.subagent_type // "-")] | join(" ")' 2>/dev/null | tr -d '\r') || exit 0
[ "$MODEL" != "-" ] && exit 0
case "$TYPE" in scout|worker|verifier|deep-reasoner|git-commiter|plan-planter|statusline-setup|claude-code-guide|fork) exit 0 ;; esac
jq -nc '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:"CLAUDE.md: Agent 호출에는 model 을 명시해야 한다(미지정 시 opus 상속). haiku/sonnet/opus 중 작업 성격에 맞게 지정하거나 티어 에이전트(scout·worker·verifier·deep-reasoner)를 쓸 것. 기준: agent-routing 스킬."}}'
exit 0
