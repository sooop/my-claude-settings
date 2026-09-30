#!/usr/bin/env bash

input=$(cat)
sid=$(echo "$input" | jq -r '.session_id')
mkdir -p ~/.claude/state
date +%s > ~/.claude/state/processing-$sid
