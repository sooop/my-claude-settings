#!/usr/bin/env bash

input=$(cat)
sid=$(echo "$input" | jq -r '.session_id')
rm ~/.claude/state/processing-$sid
