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

"""Close orphaned autofix and snapshot pull requests.

Autofix PRs (`[autofix] Automated fixes for #<n>`) and snapshot PRs
(`[snapshots] Update E2E snapshots for #<n>`) target a feature branch. When
that pull request is merged or closed, or its branch is deleted, GitHub often
leaves the bot PR open (sometimes retargeted at the default branch).

This script closes those pull requests. If one is still valid, it updates the
title or body when they no longer match the canonical text.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal, Protocol, cast
from urllib.parse import quote

FixKind = Literal["autofix", "snapshots"]
PrState = Literal["OPEN", "CLOSED", "MERGED"]

AUTOFIX_TITLE_PREFIX = "[autofix] Automated fixes for #"
SNAPSHOT_TITLE_PREFIX = "[snapshots] Update E2E snapshots for #"
_CURSOR_SUMMARY_MARKER = "<!-- CURSOR_SUMMARY -->"
_SEARCH_LIMIT = 300
_GENERATED_HEAD_PREFIXES = ("autofix/", "snapshots/")
_PULL_REQUEST_NOT_FOUND = "Could not resolve to a PullRequest"

_TITLE_PATTERNS: dict[FixKind, re.Pattern[str]] = {
    "autofix": re.compile(re.escape(AUTOFIX_TITLE_PREFIX) + r"(\d+)(.*)"),
    "snapshots": re.compile(re.escape(SNAPSHOT_TITLE_PREFIX) + r"(\d+)(.*)"),
}


class GitHubError(Exception):
    """A GitHub API request failed."""


@dataclass(frozen=True)
class ParsedTitle:
    """Title parsed from an autofix or snapshot pull request."""

    kind: FixKind
    target_number: int
    canonical: str


@dataclass(frozen=True)
class CandidatePR:
    """An open autofix or snapshot pull request."""

    number: int
    title: str
    body: str
    base_ref_name: str
    head_ref_name: str
    url: str


@dataclass(frozen=True)
class TargetPR:
    """The feature pull request an autofix or snapshot PR was opened for."""

    number: int
    state: PrState
    head_ref_name: str


@dataclass
class CleanupSummary:
    """Counts from one cleanup pass."""

    closed: int = 0
    updated: int = 0
    kept: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)


class GitHubClient(Protocol):
    """GitHub operations used by the cleanup pass."""

    def list_open_fix_prs(self) -> list[CandidatePR]:
        """Return open autofix and snapshot pull requests."""

    def fetch_pr(self, number: int) -> TargetPR | None:
        """Return a pull request, or None when that number is not a PR."""

    def branch_exists(self, branch: str) -> bool:
        """Return whether a branch exists in the repository."""

    def edit_pull_request(
        self,
        number: int,
        *,
        title: str | None = None,
        body: str | None = None,
    ) -> None:
        """Update a pull request title and/or body."""

    def close_pull_request(
        self,
        number: int,
        comment: str,
        *,
        delete_branch: str | None,
    ) -> None:
        """Close a pull request and optionally delete its generated head branch."""


def canonical_title(kind: FixKind, target_number: int) -> str:
    """Return the title used for a bot pull request."""
    prefix = AUTOFIX_TITLE_PREFIX if kind == "autofix" else SNAPSHOT_TITLE_PREFIX
    return f"{prefix}{target_number}"


def auto_close_notice(target_number: int) -> str:
    """Return the body sentence that describes automatic cleanup."""
    return (
        "This pull request is closed automatically once "
        f"#{target_number} is merged or closed, or once its branch is deleted."
    )


def parse_title(title: str) -> ParsedTitle | None:
    """Parse a bot PR title. Extra trailing text is allowed."""
    for kind, pattern in _TITLE_PATTERNS.items():
        match = pattern.fullmatch(title.strip())
        if match is None:
            continue
        target_number = int(match.group(1))
        return ParsedTitle(
            kind=kind,
            target_number=target_number,
            canonical=canonical_title(kind, target_number),
        )
    return None


def body_with_notice(body: str, target_number: int) -> str | None:
    """Return an updated body, or None when the auto-close notice is present."""
    notice = auto_close_notice(target_number)
    if notice in body:
        return None

    if _CURSOR_SUMMARY_MARKER in body:
        head, tail = body.split(_CURSOR_SUMMARY_MARKER, 1)
        return f"{head.rstrip()}\n\n{notice}\n\n{_CURSOR_SUMMARY_MARKER}{tail}"

    if body.strip():
        return f"{body.rstrip()}\n\n{notice}\n"
    return f"{notice}\n"


def close_reason(
    *,
    target_number: int,
    target: TargetPR | None,
    target_head_exists: bool | None,
    base_ref_name: str,
    base_exists: bool | None,
) -> str | None:
    """Return why a bot PR should be closed, or None to keep it open."""
    if target is None:
        return f"its target pull request #{target_number} could not be found"
    if target.state != "OPEN":
        state_label = "merged" if target.state == "MERGED" else "closed"
        return f"its target pull request #{target.number} is {state_label}"
    if target_head_exists is False:
        return f"its target branch `{target.head_ref_name}` was deleted"
    if base_exists is False:
        return f"its base branch `{base_ref_name}` was deleted"
    return None


def generated_head_branch(head_ref_name: str, kind: FixKind) -> str | None:
    """Return the head branch when it belongs to this bot pull request."""
    if head_ref_name.startswith(f"{kind}/"):
        return head_ref_name
    return None


def close_comment(reason: str) -> str:
    """Return the comment posted when a bot pull request is closed."""
    return (
        f"Closing this automated pull request because {reason}.\n\n"
        "Autofix and snapshot pull requests stay open only while their target "
        "pull request is open and its branch still exists."
    )


def status_code_from_api_output(output: str) -> int:
    """Return the HTTP status from `gh api --include` output."""
    code: int | None = None
    for line in output.splitlines():
        if line.startswith("HTTP/"):
            parts = line.split()
            if len(parts) >= 2 and parts[1].isdigit():
                code = int(parts[1])
            continue
        if line == "" and code is not None:
            break
    if code is None:
        raise GitHubError("GitHub API did not return a status line.")
    return code


def cleanup(client: GitHubClient, *, dry_run: bool) -> CleanupSummary:
    """Close orphaned bot PRs and refresh titles or bodies that drifted."""
    summary = CleanupSummary()
    candidates = client.list_open_fix_prs()
    print(f"Found {len(candidates)} open autofix/snapshot pull request(s).")

    for candidate in candidates:
        try:
            action = _handle_candidate(client, candidate, dry_run=dry_run)
        except GitHubError as exc:
            message = f"#{candidate.number}: {exc}"
            print(f"Error: {message}")
            summary.errors.append(message)
            continue

        if action == "closed":
            summary.closed += 1
        elif action == "updated":
            summary.updated += 1
        elif action == "kept":
            summary.kept += 1
        else:
            summary.skipped += 1

    _print_summary(summary, dry_run=dry_run)
    return summary


def _handle_candidate(
    client: GitHubClient,
    candidate: CandidatePR,
    *,
    dry_run: bool,
) -> Literal["closed", "updated", "kept", "skipped"]:
    parsed = parse_title(candidate.title)
    if parsed is None:
        print(f"Skipping #{candidate.number}: unrecognized title {candidate.title!r}")
        return "skipped"

    reason = _reason_to_close(client, candidate, parsed)
    if reason is not None:
        delete_branch = generated_head_branch(candidate.head_ref_name, parsed.kind)
        verb = "Would close" if dry_run else "Closing"
        branch_note = f" and delete branch {delete_branch}" if delete_branch else ""
        print(f"{verb} #{candidate.number}{branch_note}: {reason} ({candidate.url})")
        if not dry_run:
            client.close_pull_request(
                candidate.number,
                close_comment(reason),
                delete_branch=delete_branch,
            )
        return "closed"

    new_title = None if candidate.title == parsed.canonical else parsed.canonical
    new_body = body_with_notice(candidate.body, parsed.target_number)
    if new_title is None and new_body is None:
        print(f"Keeping #{candidate.number} ({candidate.url})")
        return "kept"

    changes: list[str] = []
    if new_title is not None:
        changes.append(f"title to {new_title!r}")
    if new_body is not None:
        changes.append("body with the auto-close notice")
    verb = "Would update" if dry_run else "Updating"
    print(f"{verb} #{candidate.number} {' and '.join(changes)} ({candidate.url})")
    if not dry_run:
        client.edit_pull_request(candidate.number, title=new_title, body=new_body)
    return "updated"


def _reason_to_close(
    client: GitHubClient,
    candidate: CandidatePR,
    parsed: ParsedTitle,
) -> str | None:
    target = client.fetch_pr(parsed.target_number)
    target_head_exists: bool | None = None
    base_exists: bool | None = None

    if target is not None and target.state == "OPEN":
        target_head_exists = client.branch_exists(target.head_ref_name)
        if target_head_exists and target.head_ref_name == candidate.base_ref_name:
            base_exists = True
        elif target_head_exists:
            base_exists = client.branch_exists(candidate.base_ref_name)

    return close_reason(
        target_number=parsed.target_number,
        target=target,
        target_head_exists=target_head_exists,
        base_ref_name=candidate.base_ref_name,
        base_exists=base_exists,
    )


def _print_summary(summary: CleanupSummary, *, dry_run: bool) -> None:
    if dry_run:
        print(f"Dry run: would close {summary.closed} pull request(s).")
        print(f"Dry run: would update {summary.updated} pull request(s).")
    else:
        print(f"Closed {summary.closed} pull request(s).")
        print(f"Updated {summary.updated} pull request(s).")
    print(f"Kept {summary.kept} pull request(s).")
    print(f"Skipped {summary.skipped} pull request(s).")
    print(f"Errors: {len(summary.errors)}.")


class GhCli:
    """GitHub client backed by the gh CLI."""

    def __init__(self, repo: str) -> None:
        self._repo = repo

    def list_open_fix_prs(self) -> list[CandidatePR]:
        """Return open autofix and snapshot pull requests."""
        found: dict[int, CandidatePR] = {}
        for search in (
            'is:open "[autofix] Automated fixes for" in:title',
            'is:open "[snapshots] Update E2E snapshots for" in:title',
        ):
            completed = self._run(
                [
                    "pr",
                    "list",
                    "--repo",
                    self._repo,
                    "--limit",
                    str(_SEARCH_LIMIT),
                    "--search",
                    search,
                    "--json",
                    "number,title,body,baseRefName,headRefName,url",
                ]
            )
            payload = _parse_json_list(completed.stdout)
            if len(payload) >= _SEARCH_LIMIT:
                print(
                    "Warning: a search returned "
                    f"{_SEARCH_LIMIT} pull requests and may be truncated."
                )
            for item in payload:
                candidate = _candidate_from_json(item)
                if candidate is None or parse_title(candidate.title) is None:
                    continue
                found[candidate.number] = candidate
        return sorted(found.values(), key=lambda candidate: candidate.number)

    def fetch_pr(self, number: int) -> TargetPR | None:
        """Return a pull request, or None when that number is not a PR."""
        completed = self._run(
            [
                "pr",
                "view",
                str(number),
                "--repo",
                self._repo,
                "--json",
                "state,headRefName",
            ],
            check=False,
        )
        if completed.returncode != 0:
            if _PULL_REQUEST_NOT_FOUND in completed.stderr:
                return None
            detail = completed.stderr.strip() or completed.stdout.strip()
            raise GitHubError(detail or f"gh pr view exited {completed.returncode}")

        data = _parse_json_object(completed.stdout)
        state = data.get("state")
        head_ref_name = data.get("headRefName")
        if state not in {"OPEN", "CLOSED", "MERGED"} or not isinstance(
            head_ref_name, str
        ):
            raise GitHubError(f"Unexpected pull request payload for #{number}.")
        return TargetPR(
            number=number,
            state=cast("PrState", state),
            head_ref_name=head_ref_name,
        )

    def branch_exists(self, branch: str) -> bool:
        """Return whether a branch exists in the repository."""
        encoded = quote(branch, safe="")
        completed = self._run(
            ["api", "--include", f"repos/{self._repo}/branches/{encoded}"],
            check=False,
        )
        code = status_code_from_api_output(completed.stdout)
        if code == 200:
            return True
        if code == 404:
            return False
        raise GitHubError(
            f"HTTP {code} while checking branch {branch}: {completed.stderr.strip()}"
        )

    def edit_pull_request(
        self,
        number: int,
        *,
        title: str | None = None,
        body: str | None = None,
    ) -> None:
        """Update a pull request title and/or body."""
        if title is None and body is None:
            return
        if not self._is_open(number):
            print(f"#{number} is no longer open; skipping title/body update.")
            return

        args = ["pr", "edit", str(number), "--repo", self._repo]
        if title is not None:
            args.extend(["--title", title])

        body_file: str | None = None
        try:
            if body is not None:
                with tempfile.NamedTemporaryFile(
                    mode="w",
                    encoding="utf-8",
                    prefix="pr-body-",
                    suffix=".md",
                    delete=False,
                ) as handle:
                    handle.write(body)
                    body_file = handle.name
                args.extend(["--body-file", body_file])
            self._run(args)
        finally:
            if body_file is not None:
                Path(body_file).unlink(missing_ok=True)

    def close_pull_request(
        self,
        number: int,
        comment: str,
        *,
        delete_branch: str | None,
    ) -> None:
        """Close a pull request and optionally delete its generated head branch."""
        if not self._is_open(number):
            print(f"#{number} is no longer open; skipping close.")
            return
        self._run(
            [
                "pr",
                "close",
                str(number),
                "--repo",
                self._repo,
                "--comment",
                comment,
            ]
        )
        if delete_branch is None:
            return
        if not delete_branch.startswith(_GENERATED_HEAD_PREFIXES):
            raise GitHubError(f"Refusing to delete unexpected branch {delete_branch}.")
        self._delete_branch(delete_branch)

    def _is_open(self, number: int) -> bool:
        current = self.fetch_pr(number)
        return current is not None and current.state == "OPEN"

    def _delete_branch(self, branch: str) -> None:
        encoded = quote(branch, safe="")
        completed = self._run(
            [
                "api",
                "--method",
                "DELETE",
                "--include",
                f"repos/{self._repo}/git/refs/heads/{encoded}",
            ],
            check=False,
        )
        try:
            code = status_code_from_api_output(completed.stdout)
        except GitHubError:
            print(
                f"Warning: could not delete branch {branch}: {completed.stderr.strip()}"
            )
            return
        if code in {200, 204}:
            return
        if code == 404:
            print(f"Branch {branch} was already deleted.")
            return
        print(
            f"Warning: could not delete branch {branch} "
            f"(HTTP {code}): {completed.stderr.strip()}"
        )

    def _run(
        self,
        args: list[str],
        *,
        check: bool = True,
    ) -> subprocess.CompletedProcess[str]:
        env = os.environ.copy()
        env["GH_PROMPT_DISABLED"] = "1"
        try:
            completed = subprocess.run(
                ["gh", *args],
                check=False,
                capture_output=True,
                text=True,
                encoding="utf-8",
                env=env,
            )
        except FileNotFoundError as exc:
            raise GitHubError("The gh CLI is not installed.") from exc
        if check and completed.returncode != 0:
            detail = completed.stderr.strip() or completed.stdout.strip()
            raise GitHubError(detail or f"gh exited {completed.returncode}")
        return completed


def _parse_json_list(payload: str) -> list[dict[str, Any]]:
    data: object = json.loads(payload)
    if not isinstance(data, list):
        raise GitHubError("Expected a JSON list of pull requests.")
    items: list[dict[str, Any]] = []
    for entry in data:
        if not isinstance(entry, dict):
            raise GitHubError("Expected each pull request to be a JSON object.")
        items.append(cast("dict[str, Any]", entry))
    return items


def _parse_json_object(payload: str) -> dict[str, Any]:
    data: object = json.loads(payload)
    if not isinstance(data, dict):
        raise GitHubError("Expected a JSON object.")
    return cast("dict[str, Any]", data)


def _candidate_from_json(item: dict[str, Any]) -> CandidatePR | None:
    number = item.get("number")
    title = item.get("title")
    base_ref_name = item.get("baseRefName")
    head_ref_name = item.get("headRefName")
    url = item.get("url")
    body = item.get("body") or ""
    if (
        not isinstance(number, int)
        or not isinstance(title, str)
        or not isinstance(base_ref_name, str)
        or not isinstance(head_ref_name, str)
        or not isinstance(url, str)
        or not isinstance(body, str)
    ):
        return None
    return CandidatePR(
        number=number,
        title=title,
        body=body,
        base_ref_name=base_ref_name,
        head_ref_name=head_ref_name,
        url=url,
    )


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Close orphaned autofix and snapshot pull requests."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print actions without closing or editing pull requests.",
    )
    parser.add_argument(
        "--repo",
        default=os.environ.get("GITHUB_REPOSITORY", "streamlit/streamlit"),
        help="GitHub repository in owner/name form.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Run cleanup and return a process exit code."""
    args = _parse_args(argv)
    repo = str(args.repo)
    dry_run = bool(args.dry_run)
    if dry_run:
        print(f"Dry run against {repo}.")
    else:
        print(f"Cleaning orphaned autofix and snapshot pull requests in {repo}.")

    try:
        summary = cleanup(GhCli(repo), dry_run=dry_run)
    except GitHubError as exc:
        print(f"Error: {exc}")
        return 1
    except json.JSONDecodeError as exc:
        print(f"Error: invalid JSON from gh: {exc}")
        return 1
    return 1 if summary.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
