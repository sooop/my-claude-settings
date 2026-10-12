#!/bin/bash
# subagentStatusLine: 에이전트 패널의 각 행 라벨 앞에 구동 모델 계열(haiku/sonnet/opus/fable)을 붙인다.
# 입력: stdin JSON { model, tasks:[{id, name, label, description, model, ...}] }
# 출력: 행마다 {"id": ..., "content": ...} JSON 한 줄
input=$(cat)

echo "$input" | jq -c '
  def family:
    ascii_downcase
    | if test("fable") then "fable"
      elif test("opus") then "opus"
      elif test("sonnet") then "sonnet"
      elif test("haiku") then "haiku"
      else . end;
  def color:
    { "haiku": "38;5;37", "sonnet": "38;5;33", "opus": "38;5;170", "fable": "38;5;178" }[.] // "2";
  # 모델 미지정(상속) 행은 메인 세션 모델로 표시
  (.model.id // .model.display_name // "") as $main
  | .tasks[]
  | ((.model // $main) | if . == "" then "?" else family end) as $fam
  # 에이전트 이름: 지정 이름(name) > 에이전트 타입(worker·scout 등)
  | ([.name, .agentType] | map(select(. != null and . != "")) | first // "agent") as $agent
  | (.label // .description // "") as $desc
  | {
      id,
      content: "\u001b[1m\($agent)\u001b[0m \u001b[\($fam | color)m(\($fam))\u001b[0m\(if $desc != "" then " · \($desc)" else "" end)"
    }
'
