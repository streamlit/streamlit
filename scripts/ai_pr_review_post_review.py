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

"""Post a single GitHub PR review with inline comments batched together."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import time
from pathlib import Path
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
VALID_EVENTS = {"APPROVE", "REQUEST_CHANGES", "COMMENT"}


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Post a single GitHub PR review with batched inline comments."
    )
    parser.add_argument("--comments-file", required=True)
    parser.add_argument("--review-body-file", required=True)
    parser.add_argument(
        "--event",
        required=True,
        choices=sorted(VALID_EVENTS),
        help="Review event type.",
    )
    parser.add_argument("--repo", required=True)
    parser.add_argument("--pr-number", required=True)
    parser.add_argument("--commit-sha", required=True)
    parser.add_argument("--summary-output", required=True)
    parser.add_argument("--failed-output", required=True)
    return parser.parse_args()


def _read_review_body(path: str) -> str:
    """Read the review body from a file, returning empty string if missing."""
    try:
        return Path(path).read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return ""


def _build_comment_payload(comment: dict[str, Any]) -> dict[str, Any]:
    """Build a single comment dict for the review API payload."""
    body = comment.get("body", "")
    if not isinstance(body, str):
        body = ""
    if len(body) > MAX_COMMENT_BODY_CHARS:
        body = body[:MAX_COMMENT_BODY_CHARS]

    return {
        "path": comment.get("path", ""),
        "line": comment.get("line", 1),
        "body": body,
        "side": "RIGHT",
    }


def _parse_http_result(stdout: str, stderr: str) -> tuple[int | None, str]:
    """Extract HTTP status code and response body from gh api output."""
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


def _post_review(
    repo: str,
    pr_number: str,
    commit_sha: str,
    body: str,
    event: str,
    comments: list[dict[str, Any]],
) -> tuple[bool, int | None, str]:
    """Post a review via gh api, piping JSON to stdin to avoid shell injection.

    Returns (success, status_code, response_or_error).
    """
    payload = {
        "body": body,
        "event": event,
        "commit_id": commit_sha,
        "comments": comments,
    }
    payload_json = json.dumps(payload, ensure_ascii=False)

    endpoint = f"repos/{repo}/pulls/{pr_number}/reviews"
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
            "--input",
            "-",
            "--include",
        ]
        result = subprocess.run(
            command,
            input=payload_json,
            capture_output=True,
            text=True,
            check=False,
        )
        status_code, response_body = _parse_http_result(result.stdout, result.stderr)
        last_status = status_code

        if (
            result.returncode == 0
            and status_code is not None
            and 200 <= status_code < 300
        ):
            return True, status_code, response_body

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

    return False, last_status, last_reason


def main() -> None:
    args = _parse_args()

    review_body = _read_review_body(args.review_body_file)
    raw_comments = extract_comment_dicts(read_json_file(args.comments_file, default={}))
    comment_payloads = [_build_comment_payload(c) for c in raw_comments]

    success, status_code, response = _post_review(
        repo=args.repo,
        pr_number=args.pr_number,
        commit_sha=args.commit_sha,
        body=review_body,
        event=args.event,
        comments=comment_payloads,
    )

    if success:
        posted = [
            {
                "path": c.get("path"),
                "line": c.get("line"),
                "severity": c.get("severity"),
            }
            for c in raw_comments
        ]
        write_json_file(args.failed_output, {"comments": []})
        write_json_file(
            args.summary_output,
            {
                "attempted": len(raw_comments),
                "posted": len(raw_comments),
                "failed": 0,
                "posted_comments": posted,
            },
        )
    else:
        failed = [
            {
                "path": c.get("path"),
                "line": c.get("line"),
                "body": c.get("body"),
                "severity": c.get("severity"),
                "status_code": status_code,
                "reason": response or "failed_to_post_review",
            }
            for c in raw_comments
        ]
        write_json_file(args.failed_output, {"comments": failed})
        write_json_file(
            args.summary_output,
            {
                "attempted": len(raw_comments),
                "posted": 0,
                "failed": len(raw_comments),
                "posted_comments": [],
                "review_error": response or "failed_to_post_review",
            },
        )
        raise SystemExit(1)


if __name__ == "__main__":
    main()
