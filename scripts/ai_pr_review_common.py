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

"""Shared helpers for AI PR review scripts."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

# GitHub API limit for pull request review comment body (characters).
MAX_COMMENT_BODY_CHARS = 65535


def read_json_file(path: str, default: Any) -> Any:
    """Read a JSON file, returning default on missing/invalid input."""
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def extract_comment_dicts(payload: Any) -> list[dict[str, Any]]:
    """Extract comments as dicts from a {'comments': [...]} payload."""
    if isinstance(payload, dict) and isinstance(payload.get("comments"), list):
        return [item for item in payload["comments"] if isinstance(item, dict)]
    return []


def write_json_file(path: str, payload: Any) -> None:
    """Write a formatted JSON file with a trailing newline."""
    Path(path).write_text(
        json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=False) + "\n",
        encoding="utf-8",
    )
