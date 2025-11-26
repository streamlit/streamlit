# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import unittest
from contextlib import contextmanager
from typing import TYPE_CHECKING
from unittest.mock import patch

import pytest
from git.exc import InvalidGitRepositoryError

from streamlit.git_util import GitRepo, _extract_github_repo_from_url

if TYPE_CHECKING:
    from collections.abc import Iterator, Sequence


@contextmanager
def _mock_git_repo(
    *,
    module_path: str = "/repo",
    head_detached: bool = False,
    tracking_branch_name: str | None = "origin/main",
    remote_urls: Sequence[str] | None = ("https://github.com/owner/repo.git",),
    remote_exception: Exception | None = None,
    iter_commits: Sequence[object] | None = None,
    iter_commits_exc: Exception | None = None,
    untracked_files: Sequence[str] | None = None,
    diff_paths: Sequence[str] | None = None,
) -> Iterator[GitRepo]:
    """Context manager that yields a GitRepo with a mocked underlying git.Repo.

    Parameters mirror common setup needs across tests to reduce duplication.
    """
    with patch("git.Repo") as repo_ctor:
        mock_repo = repo_ctor.return_value
        mock_repo.git.version_info = (2, 20, 3)
        mock_repo.git.rev_parse.return_value = "/repo"

        mock_repo.head = unittest.mock.Mock()
        mock_repo.head.is_detached = head_detached

        mock_repo.active_branch = unittest.mock.Mock()
        if tracking_branch_name is not None and not head_detached:
            tracking = unittest.mock.Mock()
            tracking.name = tracking_branch_name
            mock_repo.active_branch.tracking_branch.return_value = tracking
        else:
            mock_repo.active_branch.tracking_branch.return_value = None

        remote = unittest.mock.Mock()
        if remote_urls is not None:
            remote.urls = list(remote_urls)
        else:
            remote.urls = []
        # Name is used by ahead_commits
        remote_name = (
            tracking_branch_name.split("/")[0] if tracking_branch_name else "origin"
        )
        remote.name = remote_name

        if remote_exception is not None:
            mock_repo.remote.side_effect = remote_exception
        else:
            mock_repo.remote.return_value = remote

        if iter_commits_exc is not None:
            mock_repo.iter_commits.side_effect = iter_commits_exc
        elif iter_commits is not None:
            mock_repo.iter_commits.return_value = list(iter_commits)
        else:
            mock_repo.iter_commits.return_value = []

        if untracked_files is not None:
            mock_repo.untracked_files = list(untracked_files)

        if diff_paths is not None:

            class _DiffObj:
                def __init__(self, path: str) -> None:
                    self.a_path = path

            mock_repo.index.diff.return_value = [_DiffObj(p) for p in diff_paths]
        else:
            mock_repo.index.diff.return_value = []

        gr = GitRepo(module_path)
        yield gr


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


class GitUtilTest(unittest.TestCase):
    def test_git_repo_invalid(self):
        with patch("git.Repo") as mock:
            mock.side_effect = InvalidGitRepositoryError("Not a git repo")
            repo = GitRepo(".")
            assert not repo.is_valid()

    def test_old_git_version(self):
        """If the installed git is older than 2.7, certain repo operations
        prompt the user for credentials. We don't want to do this, so
        repo.is_valid() returns False for old gits.
        """
        with (
            patch("git.repo.base.Repo.GitCommandWrapperType") as git_mock,
            patch("streamlit.git_util.os"),
        ):
            git_mock.return_value.version_info = (1, 6, 4)  # An old git version
            repo = GitRepo(".")
            assert not repo.is_valid()
            assert repo.git_version == (1, 6, 4)

    def test_git_repo_valid(self):
        with (
            patch("git.repo.base.Repo.GitCommandWrapperType") as git_mock,
            patch("streamlit.git_util.os"),
        ):
            git_mock.return_value.version_info = (2, 20, 3)  # A recent git version
            repo = GitRepo(".")
            assert repo.is_valid()
            assert repo.git_version == (2, 20, 3)

    def test_gitpython_not_installed(self):
        with patch.dict("sys.modules", {"git": None}):
            repo = GitRepo(".")
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
        with _mock_git_repo(
            module_path="/repo/sub/module", tracking_branch_name=None
        ) as gr:
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
        with _mock_git_repo(tracking_branch_name="origin/feature/foo/bar") as gr:
            result = gr.get_tracking_branch_remote()
            assert result is not None
            _, branch = result
            assert branch == "feature/foo/bar"

    def test_get_tracking_branch_remote_missing_remote(self) -> None:
        """If the named remote cannot be resolved, return None."""
        with _mock_git_repo(
            tracking_branch_name="missing/main",
            remote_exception=RuntimeError("remote not found"),
        ) as gr:
            assert gr.get_tracking_branch_remote() is None

    def test_ahead_commits_success(self) -> None:
        """ahead_commits returns commits compared to the remote branch."""
        commit1 = object()
        commit2 = object()
        with _mock_git_repo(iter_commits=(commit1, commit2)) as gr:
            assert gr.ahead_commits == [commit1, commit2]

    def test_ahead_commits_no_tracking(self) -> None:
        """ahead_commits returns None when there's no tracking branch."""
        with _mock_git_repo(tracking_branch_name=None) as gr:
            assert gr.ahead_commits is None

    def test_ahead_commits_iter_exception_returns_empty(self) -> None:
        """On errors iterating commits, ahead_commits returns an empty list."""
        with _mock_git_repo(iter_commits_exc=RuntimeError("boom")) as gr:
            assert gr.ahead_commits == []

    def test_untracked_files_property(self) -> None:
        """untracked_files returns repo list when valid, else None."""
        # valid repo
        with _mock_git_repo(untracked_files=("a.txt", "b.txt")) as gr:
            assert gr.untracked_files == ["a.txt", "b.txt"]

        # invalid repo
        with patch("git.Repo") as repo_ctor:
            repo_ctor.side_effect = Exception("no repo")
            gr = GitRepo("/repo")
            assert gr.untracked_files is None

    def test_uncommitted_files_property(self) -> None:
        """uncommitted_files returns index.diff(None) a_path entries; None if invalid."""
        # valid repo
        with _mock_git_repo(diff_paths=("x.py", "y.py")) as gr:
            assert gr.uncommitted_files == ["x.py", "y.py"]

        # invalid repo
        with patch("git.Repo") as repo_ctor:
            repo_ctor.side_effect = Exception("no repo")
            gr = GitRepo("/repo")
            assert gr.uncommitted_files is None

    def test_is_head_detached_property(self) -> None:
        """is_head_detached reflects repo.head.is_detached when valid; False if invalid."""
        # valid repo - attached
        with _mock_git_repo(head_detached=False) as gr:
            assert gr.is_head_detached is False

        # valid repo - detached
        with _mock_git_repo(head_detached=True) as gr:
            assert gr.is_head_detached is True

        # invalid repo
        with patch("git.Repo") as repo_ctor:
            repo_ctor.side_effect = Exception("no repo")
            gr = GitRepo("/repo")
            assert gr.is_head_detached is False

    def test_tracking_branch_property(self) -> None:
        """tracking_branch returns None for invalid or detached HEAD; else value."""
        # valid repo, attached head
        with _mock_git_repo() as gr:
            # When not detached and tracking is configured, property should be truthy
            assert gr.tracking_branch is not None

        # valid repo, detached head
        with _mock_git_repo(head_detached=True) as gr:
            assert gr.tracking_branch is None

        # invalid repo
        with patch("git.Repo") as repo_ctor:
            repo_ctor.side_effect = Exception("no repo")
            gr = GitRepo("/repo")
            assert gr.tracking_branch is None
