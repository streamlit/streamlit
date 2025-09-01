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
from unittest.mock import patch

import pytest
from git.exc import InvalidGitRepositoryError

from streamlit.git_util import GitRepo, _extract_github_repo_from_url


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
        with patch("git.Repo") as repo_ctor:
            mock_repo = repo_ctor.return_value
            mock_repo.git.version_info = (2, 20, 3)
            mock_repo.git.rev_parse.return_value = "/repo"

            # Ensure HEAD is not detached
            mock_repo.head = unittest.mock.Mock()
            mock_repo.head.is_detached = False

            tracking = unittest.mock.Mock()
            tracking.name = "origin/main"
            mock_repo.active_branch = unittest.mock.Mock()
            mock_repo.active_branch.tracking_branch.return_value = tracking

            remote = unittest.mock.Mock()
            remote.urls = ["https://user@github.com/owner/repo.git"]
            mock_repo.remote.return_value = remote

            gr = GitRepo("/repo/sub/module")
            info = gr.get_repo_info()
            assert info == ("owner/repo", "main", "sub/module")

    def test_get_repo_info_ssh_scp(self) -> None:
        """Ensure get_repo_info extracts owner/repo from scp-like ssh url."""
        with patch("git.Repo") as repo_ctor:
            mock_repo = repo_ctor.return_value
            mock_repo.git.version_info = (2, 20, 3)
            mock_repo.git.rev_parse.return_value = "/repo"

            # Ensure HEAD is not detached
            mock_repo.head = unittest.mock.Mock()
            mock_repo.head.is_detached = False

            tracking = unittest.mock.Mock()
            tracking.name = "origin/main"
            mock_repo.active_branch = unittest.mock.Mock()
            mock_repo.active_branch.tracking_branch.return_value = tracking

            remote = unittest.mock.Mock()
            remote.urls = ["git@github.com:owner/repo.git"]
            mock_repo.remote.return_value = remote

            gr = GitRepo("/repo/sub/module")
            info = gr.get_repo_info()
            assert info == ("owner/repo", "main", "sub/module")

    def test_get_repo_info_no_tracking_branch(self) -> None:
        """Return None when there is no tracking branch configured."""
        with patch("git.Repo") as repo_ctor:
            mock_repo = repo_ctor.return_value
            mock_repo.git.version_info = (2, 20, 3)
            mock_repo.git.rev_parse.return_value = "/repo"

            mock_repo.active_branch = unittest.mock.Mock()
            mock_repo.active_branch.tracking_branch.return_value = None

            gr = GitRepo("/repo/sub/module")
            assert gr.get_repo_info() is None

    def test_get_repo_info_no_matching_remote_url(self) -> None:
        """Return None when remote URLs don't match GitHub."""
        with patch("git.Repo") as repo_ctor:
            mock_repo = repo_ctor.return_value
            mock_repo.git.version_info = (2, 20, 3)
            mock_repo.git.rev_parse.return_value = "/repo"

            tracking = unittest.mock.Mock()
            tracking.name = "origin/main"
            mock_repo.active_branch = unittest.mock.Mock()
            mock_repo.active_branch.tracking_branch.return_value = tracking

            remote = unittest.mock.Mock()
            remote.urls = ["git@example.com:owner/repo.git"]
            mock_repo.remote.return_value = remote

            gr = GitRepo("/repo/sub/module")
            assert gr.get_repo_info() is None

    def test_get_repo_info_head_detached(self) -> None:
        """Return None when HEAD is detached (no active branch)."""
        with patch("git.Repo") as repo_ctor:
            mock_repo = repo_ctor.return_value
            mock_repo.git.version_info = (2, 20, 3)
            mock_repo.git.rev_parse.return_value = "/repo"

            # HEAD detached
            mock_head = unittest.mock.Mock()
            mock_head.is_detached = True
            mock_repo.head = mock_head

            # active_branch.tracking_branch should not be called when detached, but set defensively
            mock_repo.active_branch = unittest.mock.Mock()
            mock_repo.active_branch.tracking_branch.return_value = None

            gr = GitRepo("/repo/sub/module")
            assert gr.get_repo_info() is None
