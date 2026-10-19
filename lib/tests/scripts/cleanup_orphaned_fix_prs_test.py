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

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Any

import pytest

_REPO_ROOT = Path(__file__).resolve().parents[3]
_SCRIPT_PATH = _REPO_ROOT / "scripts" / "cleanup_orphaned_fix_prs.py"


def _load_cleanup_module() -> Any:
    spec = importlib.util.spec_from_file_location(
        "cleanup_orphaned_fix_prs", _SCRIPT_PATH
    )
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


cleanup = _load_cleanup_module()


def _candidate(
    *,
    number: int = 20,
    title: str = "[autofix] Automated fixes for #10",
    body: str = "Automated fixes for #10.\n",
    base_ref_name: str = "feature/widget",
    head_ref_name: str = "autofix/10-99",
) -> Any:
    return cleanup.CandidatePR(
        number=number,
        title=title,
        body=body,
        base_ref_name=base_ref_name,
        head_ref_name=head_ref_name,
        url=f"https://github.com/streamlit/streamlit/pull/{number}",
    )


def _target(
    *,
    number: int = 10,
    state: str = "OPEN",
    head_ref_name: str = "feature/widget",
) -> Any:
    return cleanup.TargetPR(number=number, state=state, head_ref_name=head_ref_name)


class _FakeGitHub:
    def __init__(
        self,
        candidates: list[Any],
        prs: dict[int, Any | None],
        branches: set[str],
    ) -> None:
        self.candidates = candidates
        self.prs = prs
        self.branches = branches
        self.checked_branches: list[str] = []
        self.closed: list[tuple[int, str, str | None]] = []
        self.edited: list[tuple[int, str | None, str | None]] = []

    def list_open_fix_prs(self) -> list[Any]:
        return self.candidates

    def fetch_pr(self, number: int) -> Any | None:
        if number not in self.prs:
            raise cleanup.GitHubError(f"failed to fetch #{number}")
        return self.prs[number]

    def branch_exists(self, branch: str) -> bool:
        self.checked_branches.append(branch)
        return branch in self.branches

    def edit_pull_request(
        self,
        number: int,
        *,
        title: str | None = None,
        body: str | None = None,
    ) -> None:
        self.edited.append((number, title, body))

    def close_pull_request(
        self,
        number: int,
        comment: str,
        *,
        delete_branch: str | None,
    ) -> None:
        self.closed.append((number, comment, delete_branch))


def test_parse_title_accepts_canonical_and_trailing_text() -> None:
    parsed = cleanup.parse_title("[snapshots] Update E2E snapshots for #15")
    assert parsed.kind == "snapshots"
    assert parsed.target_number == 15
    assert parsed.canonical == "[snapshots] Update E2E snapshots for #15"

    with_suffix = cleanup.parse_title("[autofix] Automated fixes for #8 take 2")
    assert with_suffix is not None
    assert with_suffix.canonical == "[autofix] Automated fixes for #8"

    assert cleanup.parse_title("[chore] Automated fixes for #8") is None


def test_close_reason_for_merged_closed_missing_and_deleted_branches() -> None:
    assert (
        cleanup.close_reason(
            target_number=10,
            target=_target(state="MERGED"),
            target_head_exists=None,
            base_ref_name="feature/widget",
            base_exists=None,
        )
        == "its target pull request #10 is merged"
    )
    assert (
        cleanup.close_reason(
            target_number=10,
            target=_target(state="CLOSED"),
            target_head_exists=True,
            base_ref_name="feature/widget",
            base_exists=True,
        )
        == "its target pull request #10 is closed"
    )
    assert (
        cleanup.close_reason(
            target_number=10,
            target=None,
            target_head_exists=None,
            base_ref_name="feature/widget",
            base_exists=None,
        )
        == "its target pull request #10 could not be found"
    )
    assert (
        cleanup.close_reason(
            target_number=10,
            target=_target(),
            target_head_exists=False,
            base_ref_name="develop",
            base_exists=True,
        )
        == "its target branch `feature/widget` was deleted"
    )
    assert (
        cleanup.close_reason(
            target_number=10,
            target=_target(),
            target_head_exists=True,
            base_ref_name="old-feature",
            base_exists=False,
        )
        == "its base branch `old-feature` was deleted"
    )
    assert (
        cleanup.close_reason(
            target_number=10,
            target=_target(),
            target_head_exists=True,
            base_ref_name="feature/widget",
            base_exists=True,
        )
        is None
    )


def test_body_with_notice_inserts_before_cursor_summary() -> None:
    notice = cleanup.auto_close_notice(10)
    body = "Fixes things.\n\n<!-- CURSOR_SUMMARY -->\nsummary\n"
    updated = cleanup.body_with_notice(body, 10)

    assert updated == f"Fixes things.\n\n{notice}\n\n<!-- CURSOR_SUMMARY -->\nsummary\n"
    assert cleanup.body_with_notice(updated, 10) is None


def test_status_code_reads_headers_and_stops_before_body() -> None:
    output = "HTTP/2.0 404 Not Found\nX-Test: 1\n\nHTTP/2.0 200 OK\n"
    assert cleanup.status_code_from_api_output(output) == 404

    with pytest.raises(cleanup.GitHubError):
        cleanup.status_code_from_api_output("not an http response")


def test_cleanup_closes_merged_target_and_deletes_generated_branch() -> None:
    github = _FakeGitHub(
        candidates=[_candidate()],
        prs={10: _target(state="MERGED")},
        branches=set(),
    )

    summary = cleanup.cleanup(github, dry_run=False)

    assert summary.closed == 1
    assert summary.errors == []
    number, comment, delete_branch = github.closed[0]
    assert number == 20
    assert "target pull request #10 is merged" in comment
    assert delete_branch == "autofix/10-99"
    assert github.checked_branches == []


def test_cleanup_closes_when_target_branch_was_deleted_after_retarget() -> None:
    """GitHub retargets the bot PR at develop after the feature branch is deleted."""
    github = _FakeGitHub(
        candidates=[_candidate(base_ref_name="develop")],
        prs={10: _target(head_ref_name="feature/widget")},
        branches={"develop"},
    )

    summary = cleanup.cleanup(github, dry_run=False)

    assert summary.closed == 1
    assert github.closed[0][2] == "autofix/10-99"
    assert "target branch `feature/widget` was deleted" in github.closed[0][1]
    assert github.checked_branches == ["feature/widget"]


def test_cleanup_keeps_valid_pr_and_updates_title_and_body() -> None:
    notice = cleanup.auto_close_notice(10)
    github = _FakeGitHub(
        candidates=[
            _candidate(
                title="[autofix] Automated fixes for #10 extra",
                body="Automated fixes for #10.\n",
            )
        ],
        prs={10: _target()},
        branches={"feature/widget"},
    )

    summary = cleanup.cleanup(github, dry_run=False)

    assert summary.updated == 1
    assert summary.closed == 0
    number, title, body = github.edited[0]
    assert number == 20
    assert title == "[autofix] Automated fixes for #10"
    assert body.endswith(f"\n\n{notice}\n")
    assert github.checked_branches == ["feature/widget"]


def test_cleanup_keeps_canonical_pr_without_editing() -> None:
    body = f"Automated fixes.\n\n{cleanup.auto_close_notice(10)}\n"
    github = _FakeGitHub(
        candidates=[_candidate(body=body, head_ref_name="feature/manual")],
        prs={10: _target()},
        branches={"feature/widget"},
    )

    summary = cleanup.cleanup(github, dry_run=False)

    assert summary.kept == 1
    assert github.edited == []
    assert github.closed == []


def test_cleanup_dry_run_does_not_mutate() -> None:
    github = _FakeGitHub(
        candidates=[_candidate()],
        prs={10: _target(state="CLOSED")},
        branches=set(),
    )

    summary = cleanup.cleanup(github, dry_run=True)

    assert summary.closed == 1
    assert github.closed == []
    assert github.edited == []


def test_cleanup_closes_when_base_branch_is_missing() -> None:
    github = _FakeGitHub(
        candidates=[_candidate(base_ref_name="deleted-base")],
        prs={10: _target()},
        branches={"feature/widget"},
    )

    summary = cleanup.cleanup(github, dry_run=False)

    assert summary.closed == 1
    assert "base branch `deleted-base` was deleted" in github.closed[0][1]
    assert github.checked_branches == ["feature/widget", "deleted-base"]


def test_cleanup_does_not_delete_unrelated_head_branch() -> None:
    github = _FakeGitHub(
        candidates=[_candidate(head_ref_name="feature/manual-fix")],
        prs={10: _target(state="MERGED")},
        branches=set(),
    )

    cleanup.cleanup(github, dry_run=False)

    assert github.closed[0][2] is None


def test_cleanup_continues_after_a_github_error() -> None:
    healthy = _candidate(
        number=21,
        title="[snapshots] Update E2E snapshots for #11",
        head_ref_name="snapshots/11-99",
    )
    github = _FakeGitHub(
        candidates=[_candidate(), healthy],
        prs={11: _target(number=11, state="MERGED", head_ref_name="feature/other")},
        branches=set(),
    )

    summary = cleanup.cleanup(github, dry_run=False)

    assert summary.errors == ["#20: failed to fetch #10"]
    assert summary.closed == 1
    assert github.closed[0][0] == 21
    assert github.closed[0][2] == "snapshots/11-99"


def test_workflow_bodies_include_the_auto_close_notice() -> None:
    notice_start = "This pull request is closed automatically once #"
    notice_end = "is merged or closed, or once its branch is deleted."
    for relative in (
        ".github/workflows/autofix.yml",
        ".github/workflows/snapshot-autofix.yml",
    ):
        text = (_REPO_ROOT / relative).read_text(encoding="utf-8")
        assert notice_start in text
        assert notice_end in text


def test_generated_head_branch_rejects_unrelated_branches() -> None:
    assert cleanup.generated_head_branch("autofix/10-99", "autofix") == "autofix/10-99"
    assert cleanup.generated_head_branch("snapshots/10-99", "snapshots") == (
        "snapshots/10-99"
    )
    assert cleanup.generated_head_branch("snapshots/10-99", "autofix") is None
    assert cleanup.generated_head_branch("feature/widget", "autofix") is None
    assert cleanup.generated_head_branch("autofix", "autofix") is None
