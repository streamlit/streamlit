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

# PostToolUse hook: Auto-format and fix lint errors in files after Edit/Write
#
# NOTE: This can be extended to other file types (e.g., TypeScript, JSON), but
# any additions must be very fast since this runs on every file edit/write.

INPUT=$(cat)

# Support both Claude (.tool_input.file_path) and Cursor (.filePath) input formats
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .filePath // .file_path // empty')

# Only process Python files
if [[ ! "$FILE_PATH" == *.py ]]; then
    exit 0
fi

# Check if file exists (might have been deleted)
if [[ ! -f "$FILE_PATH" ]]; then
    exit 0
fi

# Ensure project directory is set; exit silently if not
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$CURSOR_PROJECT_DIR}"
if [[ -z "$PROJECT_DIR" ]] || [[ ! -d "$PROJECT_DIR" ]]; then
    exit 0
fi
cd "$PROJECT_DIR" || exit 0

# Run ruff check --fix first, then format (per ruff's recommended order)
# Ruff automatically respects exclusions from pyproject.toml.
# This hook only applies fixes - it never fails on unfixable lint errors.
uv run ruff check --fix "$FILE_PATH" 2>&1 || true
uv run ruff format "$FILE_PATH" 2>&1 || true

exit 0
