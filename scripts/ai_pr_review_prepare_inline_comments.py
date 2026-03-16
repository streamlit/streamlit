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

"""Validate and filter inline PR comment candidates against the actual diff."""

from __future__ import annotations

import argparse
import re
from typing import Any

from ai_pr_review_common import (
    MAX_COMMENT_BODY_CHARS,
    extract_comment_dicts,
    read_json_file,
    write_json_file,
)

HUNK_HEADER_RE = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@(?: .*)?$")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Ranked inline candidate JSON.")
    parser.add_argument(
        "--pr-files", required=True, help="JSON from GET /pulls/{pull_number}/files."
    )
    parser.add_argument(
        "--output", required=True, help="Validated comments output JSON."
    )
    parser.add_argument(
        "--rejected-output", required=True, help="Rejected comments output JSON."
    )
    parser.add_argument("--max-comments", type=int, default=20)
    return parser.parse_args()


def _build_allowed_lines_by_file(pr_files_payload: Any) -> dict[str, set[int]]:
    """Parse PR file payload from GET /pulls/{pull_number}/files.

    The expected payload is a list of file-entry objects where each entry contains
    a `filename` and a unified-diff `patch` string. Invalid entries are skipped.
    """
    allowed: dict[str, set[int]] = {}
    if not isinstance(pr_files_payload, list):
        return allowed

    for file_entry in pr_files_payload:
        if not isinstance(file_entry, dict):
            continue

        filename = file_entry.get("filename")
        patch = file_entry.get("patch")
        if not isinstance(filename, str) or not isinstance(patch, str):
            continue

        lines = allowed.setdefault(filename, set())
        new_line: int | None = None

        for raw_line in patch.splitlines():
            hunk_match = HUNK_HEADER_RE.match(raw_line)
            if hunk_match:
                new_line = int(hunk_match.group(1))
                continue

            if new_line is None:
                continue

            if (
                raw_line.startswith("+") and not raw_line.startswith("+++")
            ) or raw_line.startswith(" "):
                lines.add(new_line)
                new_line += 1
            elif raw_line.startswith("-") and not raw_line.startswith("---"):
                # Deletion lines don't advance the RHS line number.
                continue
            elif raw_line.startswith("\\"):
                # "\ No newline at end of file"
                continue

    return allowed


def _safe_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip())
    return None


def main() -> None:
    args = _parse_args()
    ranked_payload = read_json_file(args.input, default={})
    pr_files_payload = read_json_file(args.pr_files, default=[])
    if not isinstance(pr_files_payload, list):
        pr_files_payload = []

    candidates = extract_comment_dicts(ranked_payload)
    allowed_lines_by_file = _build_allowed_lines_by_file(pr_files_payload)

    validated: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    seen: set[tuple[str, int]] = set()

    for candidate in candidates:
        path = candidate.get("path")
        line = _safe_int(candidate.get("line"))
        body = candidate.get("body")

        if not isinstance(path, str) or not path.strip():
            rejected.append({"candidate": candidate, "reason": "invalid_path"})
            continue
        path = path.strip()

        if not isinstance(body, str) or not body.strip():
            rejected.append({"candidate": candidate, "reason": "invalid_body"})
            continue
        body = body.strip()

        if len(body) > MAX_COMMENT_BODY_CHARS:
            rejected.append({"candidate": candidate, "reason": "body_too_long"})
            continue

        if line is None or line <= 0:
            rejected.append({"candidate": candidate, "reason": "invalid_line"})
            continue

        allowed_lines = allowed_lines_by_file.get(path)
        if not allowed_lines or line not in allowed_lines:
            rejected.append({"candidate": candidate, "reason": "line_not_in_diff"})
            continue

        if (path, line) in seen:
            rejected.append({"candidate": candidate, "reason": "duplicate"})
            continue
        seen.add((path, line))

        validated.append(
            {
                "path": path,
                "line": line,
                "body": body,
                "severity": candidate.get("severity", "medium"),
            }
        )

        if len(validated) >= args.max_comments:
            break

    write_json_file(args.output, {"comments": validated})
    write_json_file(
        args.rejected_output,
        {
            "accepted_count": len(validated),
            "rejected_count": len(rejected),
            "rejected": rejected,
        },
    )


if __name__ == "__main__":
    main()
