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

import subprocess
import unittest
from contextlib import contextmanager
from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

import pytest

from streamlit import git_util
from streamlit.git_util import (
    GitRepo,
    _extract_github_repo_from_url,
    _parse_git_version,
)

if TYPE_CHECKING:
    from collections.abc import Iterator, Sequence


@contextmanager
def _mock_git_repo(
    *,
    module_path: str = "/repo",
    git_version: str | None = "git version 2.20.3",
    show_toplevel: str | None = "/repo",
    head_detached: bool = False,
    upstream: str | None = "origin/main",
    remote_urls: Sequence[str] | None = ("https://github.com/owner/repo.git",),
    untracked_files: Sequence[str] = (),
    diff_paths: Sequence[str] = (),
    rev_list: Sequence[str] | None = (),
) -> Iterator[GitRepo]:
    """Yield a GitRepo whose git CLI calls are mocked via canned responses.

    Each key mirrors the exact arguments GitRepo passes to ``git`` so we can
    exercise the subprocess-based implementation without a real repository.
    """
    responses: dict[tuple[str, ...], str | None] = {
        ("--version",): git_version,
        ("rev-parse", "--show-toplevel"): show_toplevel,
        ("symbolic-ref", "-q", "HEAD"): None if head_detached else "refs/heads/main",
        ("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"): upstream,  # noqa: RUF027
        ("ls-files", "--others", "--exclude-standard"): "\n".join(untracked_files),
        ("diff", "--name-only"): "\n".join(diff_paths),
    }

    if upstream:
        remote_name, *branch = upstream.split("/")
        branch_name = "/".join(branch)
        responses["remote", "get-url", "--all", remote_name] = (
            "\n".join(remote_urls) if remote_urls else None
        )
        responses["rev-list", f"{remote_name}/{branch_name}..{branch_name}"] = (
            None if rev_list is None else "\n".join(rev_list)
        )

    def fake_run_git(self: GitRepo, *args: str, cwd: str | None = None) -> str | None:
        return responses.get(tuple(args))

    with patch.object(GitRepo, "_run_git", fake_run_git):
        yield GitRepo(module_path)


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://github.com/username/repo.git", "username/repo"),
        ("https://github.com/username/repo", "username/repo"),
        ("https://www.github.com/username/repo.git", "username/repo"),
        ("https://www.github.com/username/repo", "username/repo"),
        ("https://user@github.com/username/repo.git", "username/repo"),
        ("https://user@github.com/username/repo", "username/repo"),
        ("https://github.com:443/username/repo.git/", "username/repo"),
        ("https://github.com:443/username/repo/", "username/repo"),
        ("http://www.github.com/username/repo.git", "username/repo"),
        ("git@github.com:username/repo.git", "username/repo"),
        ("git@github.com:username/repo", "username/repo"),
        ("ssh://git@github.com/username/repo.git", "username/repo"),
        ("ssh://git@github.com/username/repo/", "username/repo"),
        ("ssh://git@github.com:22/username/repo.git", "username/repo"),
    ],
)
def test_extract_github_repo_from_url(url: str, expected: str) -> None:
    """Parameterize URL forms and ensure extractor returns owner/repo."""
    assert _extract_github_repo_from_url(url) == expected


@pytest.mark.parametrize(
    ("output", "expected"),
    [
        ("git version 2.39.3", (2, 39, 3)),
        ("git version 2.39.3 (Apple Git-145)", (2, 39, 3)),
        # A missing patch component is normalized to 0 so the version can be
        # compared directly against _MIN_GIT_VERSION.
        ("git version 2.7", (2, 7, 0)),
        ("not a version", None),
    ],
)
def test_parse_git_version(output: str, expected: tuple[int, ...] | None) -> None:
    """Ensure git version strings are parsed into version tuples."""
    assert _parse_git_version(output) == expected


class GitUtilTest(unittest.TestCase):
    def test_git_repo_invalid(self):
        """A directory that is not a git repo is not valid."""
        with _mock_git_repo(show_toplevel=None) as repo:
            assert not repo.is_valid()

    def test_old_git_version(self):
        """If the installed git is older than 2.7, certain repo operations
        prompt the user for credentials. We don't want to do this, so
        repo.is_valid() returns False for old gits.
        """
        with _mock_git_repo(git_version="git version 1.6.4") as repo:
            assert not repo.is_valid()
            assert repo.git_version == (1, 6, 4)

    def test_git_repo_valid(self):
        """A directory with a recent git version and a repo root is valid."""
        with _mock_git_repo(git_version="git version 2.20.3") as repo:
            assert repo.is_valid()
            assert repo.git_version == (2, 20, 3)

    def test_two_part_min_git_version_is_valid(self):
        """A two-part git version at the minimum (e.g. "2.7") is still valid.

        The patch component is normalized to 0 so it compares as
        (2, 7, 0) >= _MIN_GIT_VERSION rather than the two-tuple (2, 7), which
        would incorrectly sort below (2, 7, 0).
        """
        with _mock_git_repo(git_version="git version 2.7") as repo:
            assert repo.is_valid()
            assert repo.git_version == (2, 7, 0)

    def test_git_not_installed(self):
        """When git is not installed, all commands return None and the repo
        is not valid.
        """
        with _mock_git_repo(git_version=None, show_toplevel=None) as repo:
            assert not repo.is_valid()

    def test_get_repo_info_https_userinfo(self) -> None:
        """Ensure get_repo_info extracts owner/repo from https with userinfo."""
        with _mock_git_repo(
            module_path="/repo/sub/module",
            remote_urls=("https://user@github.com/owner/repo.git",),
        ) as gr:
            assert gr.get_repo_info() == ("owner/repo", "main", "sub/module")

    def test_get_repo_info_ssh_scp(self) -> None:
        """Ensure get_repo_info extracts owner/repo from scp-like ssh url."""
        with _mock_git_repo(
            module_path="/repo/sub/module",
            remote_urls=("git@github.com:owner/repo.git",),
        ) as gr:
            assert gr.get_repo_info() == ("owner/repo", "main", "sub/module")

    def test_get_repo_info_no_tracking_branch(self) -> None:
        """Return None when there is no tracking branch configured."""
        with _mock_git_repo(module_path="/repo/sub/module", upstream=None) as gr:
            assert gr.get_repo_info() is None

    def test_get_repo_info_no_matching_remote_url(self) -> None:
        """Return None when remote URLs don't match GitHub."""
        with _mock_git_repo(
            module_path="/repo/sub/module",
            remote_urls=("git@example.com:owner/repo.git",),
        ) as gr:
            assert gr.get_repo_info() is None

    def test_get_repo_info_head_detached(self) -> None:
        """Return None when HEAD is detached (no active branch)."""
        with _mock_git_repo(module_path="/repo/sub/module", head_detached=True) as gr:
            assert gr.get_repo_info() is None

    def test_get_tracking_branch_remote_branch_with_slashes(self) -> None:
        """Branch names with slashes are preserved after the remote name segment."""
        with _mock_git_repo(upstream="origin/feature/foo/bar") as gr:
            result = gr.get_tracking_branch_remote()
            assert result is not None
            _, branch = result
            assert branch == "feature/foo/bar"

    def test_get_tracking_branch_remote_missing_remote(self) -> None:
        """If the named remote cannot be resolved, return None."""
        with _mock_git_repo(upstream="missing/main", remote_urls=None) as gr:
            assert gr.get_tracking_branch_remote() is None

    def test_ahead_commits_success(self) -> None:
        """ahead_commits returns commits compared to the remote branch."""
        with _mock_git_repo(rev_list=("commit1", "commit2")) as gr:
            assert gr.ahead_commits == ["commit1", "commit2"]

    def test_ahead_commits_no_tracking(self) -> None:
        """ahead_commits returns None when there's no tracking branch."""
        with _mock_git_repo(upstream=None) as gr:
            assert gr.ahead_commits is None

    def test_ahead_commits_rev_list_failure_returns_empty(self) -> None:
        """When rev-list fails (returns None), ahead_commits returns an empty list."""
        with _mock_git_repo(rev_list=None) as gr:
            assert gr.ahead_commits == []

    def test_untracked_files_property(self) -> None:
        """untracked_files returns repo list when valid, else None."""
        with _mock_git_repo(untracked_files=("a.txt", "b.txt")) as gr:
            assert gr.untracked_files == ["a.txt", "b.txt"]

        with _mock_git_repo(show_toplevel=None) as gr:
            assert gr.untracked_files is None

    def test_uncommitted_files_property(self) -> None:
        """uncommitted_files returns diff --name-only entries; None if invalid."""
        with _mock_git_repo(diff_paths=("x.py", "y.py")) as gr:
            assert gr.uncommitted_files == ["x.py", "y.py"]

        with _mock_git_repo(show_toplevel=None) as gr:
            assert gr.uncommitted_files is None

    def test_is_head_detached_property(self) -> None:
        """is_head_detached reflects HEAD state when valid; False if invalid."""
        with _mock_git_repo(head_detached=False) as gr:
            assert gr.is_head_detached is False

        with _mock_git_repo(head_detached=True) as gr:
            assert gr.is_head_detached is True

        with _mock_git_repo(show_toplevel=None) as gr:
            assert gr.is_head_detached is False

    def test_tracking_branch_property(self) -> None:
        """tracking_branch returns None for invalid or detached HEAD; else value."""
        with _mock_git_repo() as gr:
            assert gr.tracking_branch is not None

        with _mock_git_repo(head_detached=True) as gr:
            assert gr.tracking_branch is None

        with _mock_git_repo(show_toplevel=None) as gr:
            assert gr.tracking_branch is None

    def test_repr_returns_string(self) -> None:
        """Verify __repr__ returns a valid string representation."""
        with _mock_git_repo() as gr:
            result = repr(gr)
            assert isinstance(result, str)
            assert "GitRepo" in result

    def test_get_repo_info_invalid_repo(self) -> None:
        """Verify get_repo_info returns None when repo is invalid."""
        with _mock_git_repo(show_toplevel=None) as gr:
            assert gr.get_repo_info() is None

    def test_ahead_commits_invalid_repo(self) -> None:
        """Verify ahead_commits returns None when repo is invalid."""
        with _mock_git_repo(show_toplevel=None) as gr:
            assert gr.ahead_commits is None

    def test_get_tracking_branch_remote_invalid_repo(self) -> None:
        """Verify get_tracking_branch_remote returns None when repo is invalid."""
        with _mock_git_repo(show_toplevel=None) as gr:
            assert gr.get_tracking_branch_remote() is None


# These tests exercise the actual subprocess boundary of `_run_git`, which the
# `_mock_git_repo` helper above stubs out.


def test_run_git_builds_safe_command_and_strips_output() -> None:
    """_run_git runs a list-form git command with a timeout and no credential prompt."""
    with patch("streamlit.git_util.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="  output \n")
        repo = GitRepo("/some/dir")

        mock_run.reset_mock()
        result = repo._run_git("status", "--short")

        assert result == "output"
        (command,), kwargs = mock_run.call_args
        assert command == ["git", "-C", repo._start_dir, "status", "--short"]
        assert kwargs["timeout"] == git_util._GIT_TIMEOUT
        assert kwargs["check"] is False
        assert kwargs["capture_output"] is True
        # Credential prompts are disabled so git can never block waiting for input.
        assert kwargs["env"]["GIT_TERMINAL_PROMPT"] == "0"


def test_run_git_uses_provided_cwd() -> None:
    """_run_git runs in the explicit cwd when one is given (whole-repo listings)."""
    with patch("streamlit.git_util.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="")
        repo = GitRepo("/some/dir")

        mock_run.reset_mock()
        repo._run_git("ls-files", cwd="/repo/root")

        (command,), _kwargs = mock_run.call_args
        assert command == ["git", "-C", "/repo/root", "ls-files"]


def test_run_git_returns_none_on_nonzero_exit() -> None:
    """A non-zero git exit code yields None."""
    with patch("streamlit.git_util.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=1, stdout="whatever")
        repo = GitRepo("/some/dir")
        assert repo._run_git("status") is None


def test_run_git_returns_none_when_git_missing() -> None:
    """When the git binary is missing, _run_git returns None and the repo is invalid."""
    with patch("streamlit.git_util.subprocess.run", side_effect=FileNotFoundError()):
        repo = GitRepo("/some/dir")
        assert not repo.is_valid()
        assert repo._run_git("status") is None


def test_run_git_returns_none_on_timeout() -> None:
    """A git command that times out yields None rather than raising."""
    with patch(
        "streamlit.git_util.subprocess.run",
        side_effect=subprocess.TimeoutExpired(cmd="git", timeout=git_util._GIT_TIMEOUT),
    ):
        repo = GitRepo("/some/dir")
        assert repo._run_git("status") is None
