#!/usr/bin/env bash

input=$(cat)
sid=$(echo "$input" | jq -r '.session_id')
rm -f ~/.claude/state/processing-"$sid"
