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

import os
import re
from typing import TYPE_CHECKING, Final, cast

from streamlit import util
from streamlit.logger import get_logger

if TYPE_CHECKING:
    from git import Commit, Remote, RemoteReference, Repo

_LOGGER: Final = get_logger(__name__)

# Github repo extractor: match owner/repo for https/ssh/scp forms, with optional
# userinfo/port/trailing slash. This is just to extract the repo name, not validate the URL.
_GITHUB_URL_PATTERN: Final = re.compile(
    r"github\.com(?::\d+)?[/:]([^/]+)/([^/]+?)(?:\.git)?/?$"
)

# We don't support git < 2.7, because we can't get repo info without
# talking to the remote server, which results in the user being prompted
# for credentials.
_MIN_GIT_VERSION: Final = (2, 7, 0)


def _extract_github_repo_from_url(url: str) -> str | None:
    """Extract the ``owner/repo`` from a GitHub remote URL.

    This supports HTTPS and SSH URL forms including optional user info, port,
    trailing slash, and ``.git`` suffix. Validation of the scheme is not
    performed; we only extract if the URL contains ``github.com`` and ends with
    a path of the shape ``owner/repo``.

    Parameters
    ----------
    url
        The remote URL string.

    Returns
    -------
    str | None
        The extracted ``owner/repo`` if found; otherwise ``None``.
    """
    match = _GITHUB_URL_PATTERN.search(url.strip())
    if match is None:
        return None
    return f"{match.group(1)}/{match.group(2)}"


class GitRepo:
    repo: Repo | None

    def __init__(self, path: str) -> None:
        # If we have a valid repo, git_version will be a tuple
        # of 3+ ints: (major, minor, patch, possible_additional_patch_number)
        self.git_version: tuple[int, ...] | None = None
        self.module: str = ""

        try:
            import git

            self.repo = git.Repo(path, search_parent_directories=True)
            self.git_version = self.repo.git.version_info

            if self.git_version is not None and self.git_version >= _MIN_GIT_VERSION:
                git_root = self.repo.git.rev_parse("--show-toplevel")
                self.module = str(os.path.relpath(path, git_root))
        except Exception:
            _LOGGER.debug(
                "Did not find a git repo at %s. This is expected if this isn't a git repo, but could "
                "also fail for other reasons: "
                "1) git binary or GitPython not installed "
                "2) No .git folder "
                "3) Corrupted .git folder "
                "4) Path is invalid.",
                path,
                exc_info=True,
            )
            self.repo = None

    def __repr__(self) -> str:
        return util.repr_(self)

    def is_valid(self) -> bool:
        """True if there's a git repo here, and git.version >= _MIN_GIT_VERSION."""
        return (
            self.repo is not None
            and self.git_version is not None
            and self.git_version >= _MIN_GIT_VERSION
        )

    @property
    def tracking_branch(self) -> RemoteReference | None:
        if self.repo is None or not self.is_valid():
            return None

        if self.is_head_detached:
            return None

        return self.repo.active_branch.tracking_branch()

    @property
    def untracked_files(self) -> list[str] | None:
        if self.repo is None or not self.is_valid():
            return None

        return self.repo.untracked_files

    @property
    def is_head_detached(self) -> bool:
        if self.repo is None or not self.is_valid():
            return False

        return self.repo.head.is_detached

    @property
    def uncommitted_files(self) -> list[str] | None:
        if self.repo is None or not self.is_valid():
            return None

        return [cast("str", item.a_path) for item in self.repo.index.diff(None)]

    @property
    def ahead_commits(self) -> list[Commit] | None:
        if self.repo is None or not self.is_valid():
            return None

        try:
            tracking_branch_info = self.get_tracking_branch_remote()
            if tracking_branch_info is None:
                return None

            remote, branch_name = tracking_branch_info
            remote_branch = f"{remote.name}/{branch_name}"

            return list(self.repo.iter_commits(f"{remote_branch}..{branch_name}"))
        except Exception:
            return []

    def get_tracking_branch_remote(self) -> tuple[Remote, str] | None:
        if self.repo is None or not self.is_valid():
            return None

        tracking_branch = self.tracking_branch

        if tracking_branch is None:
            return None

        remote_name, *branch = tracking_branch.name.split("/")
        branch_name = "/".join(branch)

        try:
            return self.repo.remote(remote_name), branch_name
        except Exception:
            _LOGGER.debug("Failed to resolve remote %s", remote_name, exc_info=True)
            return None

    def get_repo_info(self) -> tuple[str, str, str] | None:
        if not self.is_valid():
            _LOGGER.debug(
                "No valid git information found. Git version: %s", self.git_version
            )
            return None

        remote_info = self.get_tracking_branch_remote()
        if remote_info is None:
            _LOGGER.debug("No tracking remote branch found for the git repo.")
            return None

        remote, branch = remote_info
        remote_urls = list(remote.urls)
        repo = None
        for url in remote_urls:
            repo = _extract_github_repo_from_url(url)
            if repo is not None:
                break

        if repo is None:
            _LOGGER.debug(
                "Unable to determine repo name from configured remote URLs. URLs: %s",
                remote_urls,
            )
            return None

        return repo, branch, self.module
