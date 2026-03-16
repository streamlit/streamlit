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

"""Post validated inline PR comments with bounded retry and rate-limit handling."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import time
from typing import Any

from ai_pr_review_common import (
    MAX_COMMENT_BODY_CHARS,
    extract_comment_dicts,
    read_json_file,
    write_json_file,
)

STATUS_RE = re.compile(r"HTTP/\d(?:\.\d)?\s+(\d{3})")
RECOVERABLE_STATUS_CODES = {500, 502, 503, 504}
MAX_ATTEMPTS = 3
MAX_BACKOFF_SECONDS = 30


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--comments-file", required=True)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--pr-number", required=True)
    parser.add_argument("--commit-sha", required=True)
    parser.add_argument("--summary-output", required=True)
    parser.add_argument("--failed-output", required=True)
    return parser.parse_args()


def _parse_http_result(stdout: str, stderr: str) -> tuple[int | None, str]:
    status_code = None
    for chunk in (stdout, stderr):
        if not chunk:
            continue
        status_match = STATUS_RE.search(chunk)
        if status_match:
            status_code = int(status_match.group(1))
            break

    body = stdout.split("\n\n", maxsplit=1)[1] if "\n\n" in stdout else ""
    if not body.strip():
        body = stderr.strip() or stdout.strip()
    return status_code, body


def _compute_delay_seconds(status_code: int | None, body: str, attempt: int) -> int:
    body_lower = body.lower()
    if status_code in {403, 429} or "rate limit" in body_lower:
        rate_limit_delay_seconds = 5 * (1 << (attempt - 1))
        return min(rate_limit_delay_seconds, MAX_BACKOFF_SECONDS)

    transient_delay_seconds = 1 << attempt
    return min(transient_delay_seconds, MAX_BACKOFF_SECONDS)


def _is_recoverable(status_code: int | None, body: str) -> bool:
    body_lower = body.lower()
    if status_code in RECOVERABLE_STATUS_CODES:
        return True
    return status_code in {403, 429} and "rate limit" in body_lower


def _post_comment(
    repo: str, pr_number: str, commit_sha: str, comment: dict[str, Any]
) -> tuple[bool, dict[str, Any]]:
    path = comment.get("path")
    line = comment.get("line")
    raw_body = comment.get("body")
    body = raw_body if isinstance(raw_body, str) else ""
    if len(body) > MAX_COMMENT_BODY_CHARS:
        body = body[:MAX_COMMENT_BODY_CHARS]
    severity = comment.get("severity")

    endpoint = f"repos/{repo}/pulls/{pr_number}/comments"
    attempts = 0
    last_status: int | None = None
    last_reason = ""

    while attempts < MAX_ATTEMPTS:
        attempts += 1
        command = [
            "gh",
            "api",
            endpoint,
            "-X",
            "POST",
            "-f",
            f"body={body}",
            "-f",
            f"commit_id={commit_sha}",
            "-f",
            f"path={path}",
            "-F",
            f"line={line}",
            "-f",
            "side=RIGHT",
            "--include",
        ]
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        status_code, response_body = _parse_http_result(result.stdout, result.stderr)
        last_status = status_code

        if (
            result.returncode == 0
            and status_code is not None
            and 200 <= status_code < 300
        ):
            comment_id = None
            try:
                parsed = json.loads(response_body)
                if isinstance(parsed, dict):
                    comment_id = parsed.get("id")
            except json.JSONDecodeError:
                comment_id = None
            return (
                True,
                {
                    "path": path,
                    "line": line,
                    "severity": severity,
                    "id": comment_id,
                    "attempts": attempts,
                },
            )

        if _is_recoverable(status_code, response_body) and attempts < MAX_ATTEMPTS:
            delay_seconds = _compute_delay_seconds(
                status_code=status_code,
                body=response_body,
                attempt=attempts,
            )
            time.sleep(delay_seconds)
            continue

        last_reason = (response_body or result.stderr or "unknown_error").strip()
        if len(last_reason) > 500:
            last_reason = last_reason[:500] + "...(truncated)"
        break

    return (
        False,
        {
            "path": path,
            "line": line,
            "body": body,
            "severity": severity,
            "attempts": attempts,
            "status_code": last_status,
            "reason": last_reason or "failed_to_post_comment",
        },
    )


def main() -> None:
    args = _parse_args()
    comments = extract_comment_dicts(read_json_file(args.comments_file, default={}))

    posted: list[dict[str, Any]] = []
    failed: list[dict[str, Any]] = []

    for comment in comments:
        success, payload = _post_comment(
            repo=args.repo,
            pr_number=args.pr_number,
            commit_sha=args.commit_sha,
            comment=comment,
        )
        if success:
            posted.append(payload)
        else:
            failed.append(payload)

    write_json_file(args.failed_output, {"comments": failed})
    write_json_file(
        args.summary_output,
        {
            "attempted": len(comments),
            "posted": len(posted),
            "failed": len(failed),
            "posted_comments": posted,
        },
    )


if __name__ == "__main__":
    main()
