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

"""Lightweight git repository inspection.

This uses the ``git`` command-line tool via :mod:`subprocess` instead of a
third-party library (previously GitPython) so that Streamlit does not need an
extra runtime dependency. Only the read-only information required by the
"Deploy" button is collected; every operation degrades gracefully (returning
``None``/empty results) when ``git`` is missing or the directory is not a
repository.
"""

from __future__ import annotations

import os
import re
import subprocess  # noqa: S404
from typing import Final

from streamlit import util
from streamlit.logger import get_logger

_LOGGER: Final = get_logger(__name__)

# Github repo extractor: match owner/repo for https/ssh/scp forms, with optional
# userinfo/port/trailing slash. This is just to extract the repo name, not validate the URL.
_GITHUB_URL_PATTERN: Final = re.compile(
    r"github\.com(?::\d+)?[/:]([^/]+)/([^/]+?)(?:\.git)?/?$"
)

# Parser for the output of ``git --version`` (e.g. "git version 2.39.3").
_GIT_VERSION_PATTERN: Final = re.compile(r"(\d+)\.(\d+)(?:\.(\d+))?")

# We don't support git < 2.7, because we can't get repo info without
# talking to the remote server, which results in the user being prompted
# for credentials.
_MIN_GIT_VERSION: Final = (2, 7, 0)

# Timeout (in seconds) applied to each git invocation so a hanging git process
# (e.g. waiting for credentials) can never block the server indefinitely.
_GIT_TIMEOUT: Final = 5


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


def _parse_git_version(version_output: str) -> tuple[int, int, int] | None:
    """Parse a ``git --version`` string into a ``(major, minor, patch)`` tuple.

    A missing patch component (e.g. ``git version 2.7``) is normalized to ``0``
    so the result can be compared directly against ``_MIN_GIT_VERSION`` (a
    two-element tuple like ``(2, 7)`` would otherwise compare as less than
    ``(2, 7, 0)``).
    """
    match = _GIT_VERSION_PATTERN.search(version_output)
    if match is None:
        return None
    major, minor, patch = match.groups()
    return (int(major), int(minor), int(patch) if patch is not None else 0)


class GitRepo:
    def __init__(self, path: str) -> None:
        # If git is installed, git_version will be a 3-tuple of ints:
        # (major, minor, patch). A missing patch component is normalized to 0.
        self.git_version: tuple[int, int, int] | None = None
        self.module: str = ""

        # `git -C` needs a directory, but `path` may point at a file (e.g. the
        # main script). Fall back to its parent directory in that case.
        self._start_dir: str = (
            path if os.path.isdir(path) else os.path.dirname(os.path.abspath(path))
        )
        # The repository root. File listings run from here so they cover the
        # whole repo with root-relative paths (matching prior GitPython behavior).
        self._git_root: str | None = None
        self.is_repo: bool = False

        try:
            version_output = self._run_git("--version")
            if version_output is not None:
                self.git_version = _parse_git_version(version_output)

            git_root = self._run_git("rev-parse", "--show-toplevel")
            if git_root is not None:
                self.is_repo = True
                self._git_root = git_root
                if (
                    self.git_version is not None
                    and self.git_version >= _MIN_GIT_VERSION
                ):
                    self.module = str(os.path.relpath(path, git_root))
        except Exception:
            _LOGGER.debug(
                "Did not find a git repo at %s. This is expected if this isn't a git repo, but could "
                "also fail for other reasons: "
                "1) git binary not installed "
                "2) No .git folder "
                "3) Corrupted .git folder "
                "4) Path is invalid.",
                path,
                exc_info=True,
            )
            self.is_repo = False

    def __repr__(self) -> str:
        return util.repr_(self)

    def _run_git(self, *args: str, cwd: str | None = None) -> str | None:
        """Run a git command in the repo directory.

        Runs in ``cwd`` if provided, otherwise in the starting directory.
        Returns the stripped stdout on success, or ``None`` if git is not
        installed, the command fails, or it times out.
        """
        try:
            # `git` is intentionally resolved from PATH (S607) and the argument
            # list is fixed with no shell interpolation (S603).
            result = subprocess.run(  # noqa: S603
                ["git", "-C", cwd or self._start_dir, *args],  # noqa: S607
                capture_output=True,
                text=True,
                check=False,
                timeout=_GIT_TIMEOUT,
                # Never prompt for credentials; fail fast instead.
                env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
            )
        except (OSError, subprocess.SubprocessError):
            return None

        if result.returncode != 0:
            return None
        return result.stdout.strip()

    def is_valid(self) -> bool:
        """True if there's a git repo here, and git.version >= _MIN_GIT_VERSION."""
        return (
            self.is_repo
            and self.git_version is not None
            and self.git_version >= _MIN_GIT_VERSION
        )

    @property
    def tracking_branch(self) -> str | None:
        """The upstream tracking branch (e.g. ``origin/main``), or None."""
        if not self.is_valid() or self.is_head_detached:
            return None

        return self._run_git(
            "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"
        )

    @property
    def untracked_files(self) -> list[str] | None:
        if not self.is_valid():
            return None

        output = self._run_git(
            "ls-files", "--others", "--exclude-standard", cwd=self._git_root
        )
        if output is None:
            return None
        return output.splitlines() if output else []

    @property
    def is_head_detached(self) -> bool:
        if not self.is_valid():
            return False

        # `symbolic-ref -q HEAD` exits non-zero (returns None here) when HEAD is
        # detached, and returns the ref name (e.g. "refs/heads/main") otherwise.
        return self._run_git("symbolic-ref", "-q", "HEAD") is None

    @property
    def uncommitted_files(self) -> list[str] | None:
        if not self.is_valid():
            return None

        # Unstaged changes (working tree vs. index), matching the previous
        # GitPython `index.diff(None)` behavior (whole-repo, root-relative).
        output = self._run_git("diff", "--name-only", cwd=self._git_root)
        if output is None:
            return None
        return output.splitlines() if output else []

    @property
    def ahead_commits(self) -> list[str] | None:
        if not self.is_valid():
            return None

        tracking_branch_info = self.get_tracking_branch_remote()
        if tracking_branch_info is None:
            return None

        remote_name, branch_name = tracking_branch_info
        remote_branch = f"{remote_name}/{branch_name}"

        output = self._run_git("rev-list", f"{remote_branch}..{branch_name}")
        if output is None:
            return []
        return output.splitlines() if output else []

    def get_tracking_branch_remote(self) -> tuple[str, str] | None:
        """Return the (remote_name, branch_name) for the tracking branch."""
        if not self.is_valid():
            return None

        tracking_branch = self.tracking_branch

        if tracking_branch is None:
            return None

        remote_name, *branch = tracking_branch.split("/")
        branch_name = "/".join(branch)

        # Confirm the remote actually resolves to at least one URL.
        if not self._get_remote_urls(remote_name):
            _LOGGER.debug("Failed to resolve remote %s", remote_name)
            return None

        return remote_name, branch_name

    def _get_remote_urls(self, remote_name: str) -> list[str]:
        """Return the configured fetch URLs for a remote (may be empty)."""
        output = self._run_git("remote", "get-url", "--all", remote_name)
        if output is None:
            return []
        return [line for line in output.splitlines() if line]

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

        remote_name, branch = remote_info
        remote_urls = self._get_remote_urls(remote_name)
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
