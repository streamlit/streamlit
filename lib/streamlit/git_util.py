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

"""Defensive, read-only Git repository inspection."""

from __future__ import annotations

import os
import re
import subprocess  # noqa: S404
from typing import TYPE_CHECKING, Final

from streamlit import util
from streamlit.logger import get_logger

if TYPE_CHECKING:
    from collections.abc import Sequence

_LOGGER: Final = get_logger(__name__)

# Github repo extractor: match owner/repo for https/ssh/scp forms, with optional
# userinfo/port/trailing slash. This is just to extract the repo name, not validate the URL.
_GITHUB_URL_PATTERN: Final = re.compile(
    r"github\.com(?::\d+)?[/:]([^/]+)/([^/]+?)(?:\.git)?/?$"
)

_GIT_VERSION_PATTERN: Final = re.compile(rb"^git version (\d+)\.(\d+)(?:\.(\d+))?")

# We don't support git < 2.7, because we can't get repo info without
# talking to the remote server, which results in the user being prompted
# for credentials.
_MIN_GIT_VERSION: Final = (2, 7, 0)

# A finite timeout ensures unusual local Git configuration cannot hold up an app.
_GIT_TIMEOUT: Final = 5

# Ambient vars that can redirect or truncate Git discovery away from ``cwd``.
_GIT_REPO_OVERRIDE_ENV_VARS: Final = (
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_COMMON_DIR",
    "GIT_CEILING_DIRECTORIES",
)


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


def _run_git(args: Sequence[str], *, cwd: str) -> bytes | None:
    """Run a local Git command, returning stdout bytes on success.

    Anchors inspection to ``cwd`` by dropping ambient repo-selection ``GIT_*``
    overrides, and runs non-interactively (no prompts/pagers, finite timeout).
    All failures are contained so metadata collection cannot block the app.
    """
    try:
        # Inherit the process environment, but drop repo-selection overrides so
        # inspection stays anchored to ``cwd`` rather than ambient ``GIT_*`` state.
        env = {
            key: value
            for key, value in os.environ.items()
            if key not in _GIT_REPO_OVERRIDE_ENV_VARS
        }
        env.update(
            {
                "GIT_OPTIONAL_LOCKS": "0",
                "GIT_PAGER": "",
                "GIT_TERMINAL_PROMPT": "0",
                "PAGER": "",
            }
        )
        # `git` is intentionally resolved from PATH (S607). Arguments are
        # passed directly without shell interpolation (S603).
        result = subprocess.run(  # noqa: S603
            ["git", *args],  # noqa: S607
            cwd=cwd,
            stdin=subprocess.DEVNULL,
            capture_output=True,
            check=False,
            shell=False,
            timeout=_GIT_TIMEOUT,
            env=env,
        )
    except Exception:
        _LOGGER.debug("Failed to run Git command %s", args, exc_info=True)
        return None

    if result.returncode != 0:
        return None
    return result.stdout


def _parse_git_version(version_output: bytes) -> tuple[int, int, int] | None:
    """Parse ``git --version`` output, normalizing a missing patch to zero."""
    try:
        match = _GIT_VERSION_PATTERN.search(version_output)
        if match is None:
            return None
        major, minor, patch = match.groups()
        return (int(major), int(minor), int(patch) if patch is not None else 0)
    except Exception:
        return None


def _decode_line(output: bytes) -> str:
    """Decode one Git record without stripping whitespace from its value.

    On Windows, Git terminates records with CRLF; elsewhere with LF. Only strip
    the platform record terminator so a trailing carriage return in the path
    itself is preserved.
    """
    if os.name == "nt" and output.endswith(
        b"\r\n"
    ):  # pragma: no cover - platform-specific
        output = output[:-2]
    elif output.endswith(b"\n"):
        output = output[:-1]
    return output.decode("utf-8", errors="replace")


def _decode_lines(output: bytes) -> list[str]:
    """Decode LF-delimited Git output without propagating decoding failures."""
    return [
        line.removesuffix(b"\r").decode("utf-8", errors="replace")
        for line in output.split(b"\n")
        if line
    ]


def _decode_nul_paths(output: bytes) -> list[str]:
    """Decode NUL-delimited paths, preserving whitespace inside filenames."""
    return [
        path.decode("utf-8", errors="replace") for path in output.split(b"\0") if path
    ]


class GitRepo:
    """Read-only Git metadata for a path, safe when git is missing or invalid."""

    def __init__(self, path: str) -> None:
        self.git_version: tuple[int, int, int] | None = None
        self.module: str = ""
        self._git_root: str | None = None
        self._start_dir: str = ""
        self.is_repo: bool = False

        try:
            # Git commands need a directory; callers usually pass the main script path.
            # Always store an absolute path so later queries stay valid if cwd changes.
            absolute_path = os.path.abspath(path)
            self._start_dir = (
                absolute_path
                if os.path.isdir(absolute_path)
                else os.path.dirname(absolute_path)
            )

            version_output = _run_git(("--version",), cwd=self._start_dir)
            if version_output is not None:
                self.git_version = _parse_git_version(version_output)

            root_output = _run_git(
                ("rev-parse", "--show-toplevel"), cwd=self._start_dir
            )
            if root_output is None:
                return

            git_root = _decode_line(root_output)
            if not git_root:
                return

            self._git_root = git_root
            self.is_repo = True
            if self.is_valid():
                self.module = os.path.relpath(os.path.abspath(path), git_root)
        except Exception:
            # Contain unexpected errors resolving Git metadata; common non-repo
            # / git-missing cases return early above when ``_run_git`` yields
            # ``None``.
            _LOGGER.debug(
                "Unexpected error while resolving Git metadata at %s.",
                path,
                exc_info=True,
            )
            self.is_repo = False

    def __repr__(self) -> str:
        return util.repr_(self)

    def is_valid(self) -> bool:
        """True if this path is a git repo and ``git_version >= _MIN_GIT_VERSION``."""
        return (
            self.is_repo
            and self.git_version is not None
            and self.git_version >= _MIN_GIT_VERSION
        )

    def _valid_git_root(self) -> str | None:
        """Return the repo root when this instance is valid; otherwise ``None``."""
        if not self.is_valid():
            return None
        return self._git_root

    @property
    def tracking_branch(self) -> str | None:
        """The current branch's upstream ref, such as ``origin/main``."""
        try:
            if not self.is_valid() or self.is_head_detached:
                return None

            output = _run_git(
                (
                    "rev-parse",
                    "--abbrev-ref",
                    "--symbolic-full-name",
                    "@{upstream}",
                ),
                cwd=self._start_dir,
            )
            if output is None:
                return None
            tracking_branch = _decode_line(output)
            return tracking_branch or None
        except Exception:
            return None

    @property
    def untracked_files(self) -> list[str] | None:
        try:
            git_root = self._valid_git_root()
            if git_root is None:
                return None

            output = _run_git(
                ("ls-files", "-z", "--others", "--exclude-standard"), cwd=git_root
            )
            return None if output is None else _decode_nul_paths(output)
        except Exception:
            return None

    @property
    def is_head_detached(self) -> bool:
        try:
            if not self.is_valid():
                return False

            output = _run_git(
                ("rev-parse", "--abbrev-ref", "HEAD"), cwd=self._start_dir
            )
            # A failed command can also mean an unborn or malformed HEAD. Only
            # a successful, explicit "HEAD" response proves detachment.
            return output is not None and _decode_line(output) == "HEAD"
        except Exception:
            return False

    @property
    def uncommitted_files(self) -> list[str] | None:
        try:
            git_root = self._valid_git_root()
            if git_root is None:
                return None

            # Only report unstaged working-tree changes, not staged-only edits.
            output = _run_git(("diff", "--name-only", "-z"), cwd=git_root)
            return None if output is None else _decode_nul_paths(output)
        except Exception:
            return None

    @property
    def ahead_commits(self) -> list[str] | None:
        """Commit hashes that are ahead of the configured upstream.

        Returns
        -------
        list[str] | None
            ``None`` when the repository is invalid or has no usable upstream.
            An empty list when the rev-list query fails or HEAD is not ahead.
            Otherwise, the commit hashes from ``@{upstream}..HEAD``.
        """
        try:
            if not self.is_valid() or self.get_tracking_branch_remote() is None:
                return None

            # Compare HEAD to the configured upstream tip so ahead commits stay
            # correct when the local branch name differs from the upstream
            # branch name. Also avoids interpolating slash-containing names.
            output = _run_git(
                ("rev-list", "@{upstream}..HEAD", "--"), cwd=self._start_dir
            )
            return [] if output is None else _decode_lines(output)
        except Exception:
            return []

    def get_tracking_branch_remote(self) -> tuple[str, str] | None:
        """Return the remote name and branch name for the current upstream."""
        try:
            if not self.is_valid():
                return None

            tracking_branch = self.tracking_branch
            if tracking_branch is None or "/" not in tracking_branch:
                return None

            remote_name, branch_name = tracking_branch.split("/", maxsplit=1)
            if (
                not remote_name
                or not branch_name
                or not self._get_remote_urls(remote_name)
            ):
                _LOGGER.debug("Failed to resolve remote %s", remote_name)
                return None

            return remote_name, branch_name
        except Exception:
            return None

    def _get_remote_urls(self, remote_name: str) -> list[str]:
        try:
            # Pass remote_name after "--" so a dash-prefixed name cannot be
            # parsed as a flag.
            output = _run_git(
                ("remote", "get-url", "--all", "--", remote_name),
                cwd=self._start_dir,
            )
            return [] if output is None else _decode_lines(output)
        except Exception:
            return []

    def get_repo_info(self) -> tuple[str, str, str] | None:
        try:
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
                # Redact URL userinfo so tokens in remotes are not written to logs.
                redacted_urls = [
                    re.sub(r"(://[^/]*@)", "://***@", url) for url in remote_urls
                ]
                _LOGGER.debug(
                    "Unable to determine repo name from configured remote URLs. URLs: %s",
                    redacted_urls,
                )
                return None

            return repo, branch, self.module
        except Exception:
            return None
