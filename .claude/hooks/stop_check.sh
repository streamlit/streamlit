#!/bin/bash
# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Stop hook: runs `make check` when Claude/Cursor finishes responding.
# If check fails, blocks the agent from stopping so it can fix issues.
#
# Compatible with both Claude Code and Cursor hooks:
# - Claude Code expects: {"decision": "block", "reason": "..."}
# - Cursor expects: {"followup_message": "..."} or just exit 2
# We output both fields for cross-compatibility.

# Run make check from project root (fast mode to skip slow type checks)
cd "$CLAUDE_PROJECT_DIR" || cd "$CURSOR_PROJECT_DIR" || exit 0
OUTPUT=$(FAST_CHECK=true make check 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    # Truncate output if too long (keep last 10000 chars to show recent errors)
    if [ ${#OUTPUT} -gt 10000 ]; then
        OUTPUT="[truncated]...${OUTPUT: -10000}"
    fi
    # Output JSON with both fields for Claude Code and Cursor compatibility
    REASON="make check failed (exit $EXIT_CODE). Please fix the issues:

$OUTPUT"
    jq -n --arg reason "$REASON" '{"decision": "block", "reason": $reason, "followup_message": $reason}'
fi

exit 0
