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

# Read input from stdin (Claude Code passes JSON with hook context)
INPUT=$(cat)

# Check if stop hook already triggered a continuation to prevent infinite loops
# See: https://code.claude.com/docs/en/hooks-guide#stop-hook-runs-forever
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active // false')" = "true" ]; then
    exit 0  # Allow Claude to stop
fi

# Run make check from project root (fast mode to skip slow type checks)
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || cd "$CURSOR_PROJECT_DIR" 2>/dev/null || {
    echo "Error: Cannot find project directory" >&2
    exit 1
}
OUTPUT=$(FAST_CHECK=true make check 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    # Truncate output if too long (keep last 10000 chars to show recent errors)
    if [ ${#OUTPUT} -gt 10000 ]; then
        OUTPUT="[truncated]...${OUTPUT: -10000}"
    fi
    # Output JSON with both fields for Claude Code and Cursor compatibility
    # Use printf to avoid jq dependency
    REASON="make check failed (exit $EXIT_CODE). Please fix the issues:

$OUTPUT"
    # Escape special JSON characters in REASON
    ESCAPED_REASON=$(printf '%s' "$REASON" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g' | tr '\n' '\r' | sed 's/\r/\\n/g')
    printf '{"decision": "block", "reason": "%s", "followup_message": "%s"}\n' "$ESCAPED_REASON" "$ESCAPED_REASON"
    exit 2
fi

exit 0
