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
import shutil
import subprocess
from contextlib import contextmanager
from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

import pytest

from streamlit import git_util
from streamlit.git_util import (
    GitRepo,
    _decode_line,
    _decode_nul_paths,
    _extract_github_repo_from_url,
    _parse_git_version,
)

if TYPE_CHECKING:
    from collections.abc import Iterator, Sequence
    from pathlib import Path

_REQUIRES_GIT = pytest.mark.skipif(
    shutil.which("git") is None, reason="git binary required"
)


@contextmanager
def _mock_git_repo(
    *,
    module_path: str = "/repo/app.py",
    git_version: bytes | None = b"git version 2.20.3\n",
    show_toplevel: bytes | None = b"/repo\n",
    head: bytes | None = b"main\n",
    upstream: bytes | None = b"origin/main\n",
    remote_urls: Sequence[bytes] = (b"https://github.com/owner/repo.git",),
    untracked_files: bytes = b"",
    diff_paths: bytes = b"",
    rev_list: bytes | None = b"",
) -> Iterator[GitRepo]:
    """Yield a GitRepo backed by exact, canned Git command responses."""
    responses: dict[tuple[str, ...], bytes | None] = {
        ("--version",): git_version,
        ("rev-parse", "--show-toplevel"): show_toplevel,
        ("rev-parse", "--abbrev-ref", "HEAD"): head,
        (
            "rev-parse",
            "--abbrev-ref",
            "--symbolic-full-name",
            "@{upstream}",  # noqa: RUF027
        ): upstream,
        ("ls-files", "-z", "--others", "--exclude-standard"): untracked_files,
        ("diff", "--name-only", "-z"): diff_paths,
        ("rev-list", "@{upstream}..HEAD", "--"): rev_list,  # noqa: RUF027
    }

    if upstream:
        remote_name = upstream.decode().strip().split("/", maxsplit=1)[0]
        responses["remote", "get-url", "--all", "--", remote_name] = (
            b"\n".join(remote_urls) + b"\n" if remote_urls else None
        )

    def fake_run_git(args: Sequence[str], *, cwd: str) -> bytes | None:
        return responses.get(tuple(args))

    with patch("streamlit.git_util._run_git", side_effect=fake_run_git):
        yield GitRepo(module_path)


def _git(repo: Path, *args: str) -> bytes:
    """Run Git for real-repository parity tests."""
    result = subprocess.run(
        ["git", *args],
        cwd=repo,
        stdin=subprocess.DEVNULL,
        capture_output=True,
        check=True,
    )
    return result.stdout


def _init_repo(path: Path, *, initial_commit: bool = True) -> Path:
    path.mkdir()
    _git(path, "init")
    _git(path, "config", "user.email", "git-util@example.com")
    _git(path, "config", "user.name", "Git Util Tests")
    _git(path, "config", "commit.gpgsign", "false")
    _git(path, "config", "tag.gpgsign", "false")
    _git(path, "symbolic-ref", "HEAD", "refs/heads/main")

    if initial_commit:
        (path / "tracked.txt").write_text("initial\n", encoding="utf-8")
        (path / "staged-only.txt").write_text("initial\n", encoding="utf-8")
        _git(path, "add", ".")
        _git(path, "commit", "-m", "initial")

    return path


def _configure_github_upstream(repo: Path) -> None:
    _git(repo, "remote", "add", "origin", "https://github.com/owner/repo.git")
    _git(repo, "update-ref", "refs/remotes/origin/main", "HEAD")
    _git(repo, "branch", "--set-upstream-to=origin/main", "main")


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
    """Extract repository names from supported GitHub remote URL forms."""
    assert _extract_github_repo_from_url(url) == expected


@pytest.mark.parametrize(
    ("output", "expected"),
    [
        (b"git version 2.39.3\n", (2, 39, 3)),
        (b"git version 2.39.3 (Apple Git-145)\n", (2, 39, 3)),
        (b"git version 2.47.1.windows.1\n", (2, 47, 1)),
        (b"git version 2.7\n", (2, 7, 0)),
        (b"git version 2.6.99\n", (2, 6, 99)),
        (b"not a version 2.39.3\n", None),
        (b"", None),
        (b"\xff\xfe", None),
    ],
)
def test_parse_git_version(
    output: bytes, expected: tuple[int, int, int] | None
) -> None:
    """Parse platform-specific and malformed Git version output safely."""
    assert _parse_git_version(output) == expected


@pytest.mark.parametrize(
    ("version", "is_valid"),
    [
        (b"git version 1.6.4\n", False),
        (b"git version 2.6.99\n", False),
        (b"git version 2.7\n", True),
        (b"git version 2.7.0\n", True),
        (b"git version 2.20.3\n", True),
        (None, False),
    ],
)
def test_git_version_validity(version: bytes | None, is_valid: bool) -> None:
    """Enforce the minimum supported Git version."""
    with _mock_git_repo(git_version=version) as repo:
        assert repo.is_valid() is is_valid


def test_invalid_repository_is_failure_safe() -> None:
    """Return safe defaults for every query outside a Git repository."""
    with _mock_git_repo(show_toplevel=None) as repo:
        assert not repo.is_valid()
        assert repo.tracking_branch is None
        assert repo.untracked_files is None
        assert repo.is_head_detached is False
        assert repo.uncommitted_files is None
        assert repo.ahead_commits is None
        assert repo.get_tracking_branch_remote() is None
        assert repo.get_repo_info() is None


def test_constructor_contains_unexpected_git_failure() -> None:
    """Contain unexpected Git failures during repository discovery."""
    with patch("streamlit.git_util._run_git", side_effect=RuntimeError("boom")):
        repo = GitRepo("/repo/app.py")

    assert not repo.is_valid()
    assert repo.get_repo_info() is None


def test_public_git_queries_contain_unexpected_failures() -> None:
    """Contain unexpected Git failures in every public metadata query."""
    with _mock_git_repo() as repo:
        with patch("streamlit.git_util._run_git", side_effect=RuntimeError("boom")):
            assert repo.tracking_branch is None
            assert repo.untracked_files is None
            assert repo.is_head_detached is False
            assert repo.uncommitted_files is None
            assert repo.ahead_commits is None
            assert repo.get_tracking_branch_remote() is None
            assert repo.get_repo_info() is None


def test_get_repo_info_uses_first_github_remote_url() -> None:
    """Use the first GitHub URL when a remote has multiple URLs."""
    with _mock_git_repo(
        module_path="/repo/sub dir/app.py",
        remote_urls=(
            b"git@example.com:owner/repo.git",
            b"https://user@github.com/owner/repo.git",
        ),
    ) as repo:
        assert repo.get_repo_info() == (
            "owner/repo",
            "main",
            os.path.join("sub dir", "app.py"),
        )


@pytest.mark.parametrize(
    "upstream",
    [None, b"", b"malformed\n", b"/main\n", b"origin/\n"],
)
def test_get_repo_info_rejects_missing_or_malformed_upstream(
    upstream: bytes | None,
) -> None:
    """Reject upstream values that cannot identify a remote and branch."""
    with _mock_git_repo(upstream=upstream) as repo:
        assert repo.get_tracking_branch_remote() is None
        assert repo.get_repo_info() is None


def test_get_repo_info_rejects_non_github_remote() -> None:
    """Return no deployment repository for a non-GitHub remote."""
    with _mock_git_repo(remote_urls=(b"git@example.com:owner/repo.git",)) as repo:
        assert repo.get_repo_info() is None


def test_get_repo_info_redacts_userinfo_in_debug_logs() -> None:
    """Keep remote tokens out of debug logs when GitHub detection fails."""
    remote_url = b"https://x-access-token:SECRET@example.com/o/r.git\n"
    with (
        _mock_git_repo(remote_urls=(remote_url,)) as repo,
        patch("streamlit.git_util._LOGGER") as mock_logger,
    ):
        assert repo.get_repo_info() is None

    mock_logger.debug.assert_called()
    logged = " ".join(
        str(arg) for call in mock_logger.debug.call_args_list for arg in call.args
    )
    assert "://***@" in logged
    assert "SECRET" not in logged


def test_get_repo_info_rejects_missing_remote_urls() -> None:
    """Return no remote when upstream is set but remote URLs cannot be resolved."""
    with _mock_git_repo(remote_urls=()) as repo:
        assert repo.get_tracking_branch_remote() is None
        assert repo.get_repo_info() is None


def test_tracking_branch_preserves_slashes() -> None:
    """Preserve slashes within an upstream branch name."""
    with _mock_git_repo(upstream=b"origin/feature/foo/bar\n") as repo:
        assert repo.get_tracking_branch_remote() == ("origin", "feature/foo/bar")


def test_detached_head_has_no_tracking_branch() -> None:
    """Suppress upstream metadata when HEAD is detached."""
    with _mock_git_repo(head=b"HEAD\n") as repo:
        assert repo.is_head_detached
        assert repo.tracking_branch is None
        assert repo.get_repo_info() is None


def test_failed_head_query_is_not_misreported_as_detached() -> None:
    """Distinguish a failed HEAD query from a detached HEAD."""
    with _mock_git_repo(head=None, upstream=None) as repo:
        assert repo.is_head_detached is False
        assert repo.tracking_branch is None


def test_nul_delimited_file_properties_preserve_special_paths() -> None:
    """Preserve whitespace and Unicode in NUL-delimited Git paths."""
    paths = [
        "space name.py",
        "unicodé/文件.py",
        "tab\tname.py",
        "line\nbreak.py",
    ]
    encoded_paths = b"\0".join(path.encode() for path in paths) + b"\0"

    with _mock_git_repo(
        untracked_files=encoded_paths,
        diff_paths=encoded_paths,
    ) as repo:
        assert repo.untracked_files == paths
        assert repo.uncommitted_files == paths


def test_nul_delimited_paths_decode_invalid_utf8_defensively() -> None:
    """Replace invalid UTF-8 bytes instead of raising during path decoding."""
    assert _decode_nul_paths(b"valid\0invalid-\xff-name\0") == [
        "valid",
        "invalid-\ufffd-name",
    ]


def test_decode_line_preserves_trailing_newline_in_value() -> None:
    """Remove only Git's record terminator from a newline-terminated value."""
    assert _decode_line(b"/repo\n\n") == "/repo\n"


def test_file_query_failures_return_none() -> None:
    """Return ``None`` when a Git file query fails."""
    with _mock_git_repo() as repo:
        with patch("streamlit.git_util._run_git", return_value=None):
            assert repo.untracked_files is None
            assert repo.uncommitted_files is None


def test_ahead_commits_returns_hashes() -> None:
    """Return commit hashes reported after the upstream revision."""
    with _mock_git_repo(rev_list=b"abc123\ndef456\n") as repo:
        assert repo.ahead_commits == ["abc123", "def456"]


def test_ahead_commits_uses_unambiguous_upstream_revision() -> None:
    """Compare HEAD with ``@{upstream}`` rather than interpolating branch names.

    A slash-containing upstream only resolves when the implementation asks for
    ``@{upstream}..HEAD``; interpolating ``origin/feature/foo`` would miss the
    canned mock response and yield an empty list.
    """
    with _mock_git_repo(
        upstream=b"origin/feature/foo\n",
        rev_list=b"abc123\n",
    ) as repo:
        assert repo.ahead_commits == ["abc123"]


def test_ahead_commits_returns_none_without_upstream() -> None:
    """Return ``None`` when the current branch has no upstream."""
    with _mock_git_repo(upstream=None) as repo:
        assert repo.ahead_commits is None


def test_ahead_commits_returns_empty_on_rev_list_failure() -> None:
    """Return an empty list when the ahead-commit query fails."""
    with _mock_git_repo(rev_list=None) as repo:
        assert repo.ahead_commits == []


def test_repr_returns_string() -> None:
    """Return a useful string representation for a Git repository."""
    with _mock_git_repo() as repo:
        assert "GitRepo" in repr(repo)


def test_run_git_uses_safe_noninteractive_subprocess_boundary() -> None:
    """Run Git without a shell, input, prompts, pagers, or optional locks."""
    completed = MagicMock(returncode=0, stdout=b"output\n")
    override_env = {
        var: f"/override/{var.lower()}" for var in git_util._GIT_REPO_OVERRIDE_ENV_VARS
    }
    with (
        patch.dict(os.environ, override_env, clear=False),
        patch("streamlit.git_util.subprocess.run", return_value=completed) as mock_run,
    ):
        assert git_util._run_git(("status", "--short"), cwd="/repo root") == b"output\n"

    (command,), kwargs = mock_run.call_args
    assert command == ["git", "status", "--short"]
    assert kwargs["cwd"] == "/repo root"
    assert kwargs["stdin"] is subprocess.DEVNULL
    assert kwargs["capture_output"] is True
    assert kwargs["check"] is False
    assert kwargs["shell"] is False
    assert kwargs["timeout"] == git_util._GIT_TIMEOUT
    assert kwargs["env"]["GIT_TERMINAL_PROMPT"] == "0"
    assert kwargs["env"]["GIT_PAGER"] == ""
    assert kwargs["env"]["PAGER"] == ""
    assert kwargs["env"]["GIT_OPTIONAL_LOCKS"] == "0"
    for var in git_util._GIT_REPO_OVERRIDE_ENV_VARS:
        assert var not in kwargs["env"]
    assert "text" not in kwargs


def test_run_git_returns_none_on_nonzero_exit() -> None:
    """Return ``None`` when Git exits unsuccessfully."""
    completed = MagicMock(returncode=1, stdout=b"ignored")
    with patch("streamlit.git_util.subprocess.run", return_value=completed):
        assert git_util._run_git(("status",), cwd="/repo") is None


@pytest.mark.parametrize(
    "error",
    [
        FileNotFoundError(),
        PermissionError(),
        subprocess.TimeoutExpired(cmd="git", timeout=git_util._GIT_TIMEOUT),
        OSError("platform error"),
        RuntimeError("unexpected wrapper failure"),
    ],
)
def test_run_git_contains_all_ordinary_subprocess_failures(error: Exception) -> None:
    """Contain ordinary process-launch and execution failures."""
    with patch("streamlit.git_util.subprocess.run", side_effect=error):
        assert git_util._run_git(("status",), cwd="/repo") is None


@_REQUIRES_GIT
def test_real_repository_info_and_ahead_commits(tmp_path: Path) -> None:
    """Discover repository metadata and commits from a real Git repository."""
    repo_path = _init_repo(tmp_path / "repo space ü")
    _configure_github_upstream(repo_path)
    app_path = repo_path / "app dir" / "app ü.py"
    app_path.parent.mkdir()
    app_path.write_text("import streamlit\n", encoding="utf-8")

    repo = GitRepo(str(app_path))

    assert repo.is_valid()
    assert repo.tracking_branch == "origin/main"
    assert repo.get_repo_info() == (
        "owner/repo",
        "main",
        os.path.join("app dir", "app ü.py"),
    )
    assert repo.ahead_commits == []

    (repo_path / "tracked.txt").write_text("second\n", encoding="utf-8")
    _git(repo_path, "add", "tracked.txt")
    _git(repo_path, "commit", "-m", "ahead")

    assert len(repo.ahead_commits or []) == 1


@_REQUIRES_GIT
def test_real_repository_ahead_commits_with_diverging_branch_names(
    tmp_path: Path,
) -> None:
    """Count ahead commits when the local branch name differs from upstream.

    Interpolating ``origin/<local-branch>`` would miss commits that
    ``@{upstream}..HEAD`` correctly reports against ``origin/main``.
    """
    repo_path = _init_repo(tmp_path / "repo")
    _git(repo_path, "remote", "add", "origin", "https://github.com/owner/repo.git")
    _git(repo_path, "update-ref", "refs/remotes/origin/main", "HEAD")
    _git(repo_path, "checkout", "-b", "feature")
    _git(repo_path, "branch", "--set-upstream-to=origin/main", "feature")

    (repo_path / "tracked.txt").write_text("ahead\n", encoding="utf-8")
    _git(repo_path, "add", "tracked.txt")
    _git(repo_path, "commit", "-m", "ahead on feature")

    repo = GitRepo(str(repo_path / "tracked.txt"))
    assert repo.tracking_branch == "origin/main"
    assert len(repo.ahead_commits or []) == 1


@_REQUIRES_GIT
def test_real_repository_reports_untracked_and_unstaged_only(tmp_path: Path) -> None:
    """Report untracked files and unstaged changes, excluding staged-only paths."""
    repo_path = _init_repo(tmp_path / "repo")

    (repo_path / "tracked.txt").write_text("unstaged\n", encoding="utf-8")
    (repo_path / "staged-only.txt").write_text("staged\n", encoding="utf-8")
    _git(repo_path, "add", "staged-only.txt")

    untracked_names = ["space name.txt", "unicodé 文件.txt"]
    for name in untracked_names:
        (repo_path / name).write_text("untracked\n", encoding="utf-8")

    repo = GitRepo(str(repo_path / "tracked.txt"))

    assert set(repo.untracked_files or []) == set(untracked_names)
    assert repo.uncommitted_files == ["tracked.txt"]
    assert "staged-only.txt" not in (repo.uncommitted_files or [])


@_REQUIRES_GIT
@pytest.mark.skipif(os.name == "nt", reason="Windows filenames cannot contain newlines")
def test_real_repository_preserves_tabs_and_newlines_in_filenames(
    tmp_path: Path,
) -> None:
    """Preserve tabs and newlines in filenames supported by the platform."""
    repo_path = _init_repo(tmp_path / "repo")
    tracked_name = "tracked\tline\nbreak.txt"
    untracked_name = "untracked\tline\nbreak.txt"
    tracked_path = repo_path / tracked_name
    tracked_path.write_text("initial\n", encoding="utf-8")
    _git(repo_path, "add", tracked_name)
    _git(repo_path, "commit", "-m", "special tracked path")

    tracked_path.write_text("modified\n", encoding="utf-8")
    (repo_path / untracked_name).write_text("untracked\n", encoding="utf-8")
    repo = GitRepo(str(repo_path))

    assert repo.uncommitted_files == [tracked_name]
    assert repo.untracked_files == [untracked_name]


@_REQUIRES_GIT
@pytest.mark.skipif(
    os.name == "nt", reason="Windows directory names cannot contain newlines"
)
def test_real_repository_root_preserves_trailing_newline(tmp_path: Path) -> None:
    """Preserve a trailing newline in the repository root path."""
    repo_path = _init_repo(tmp_path / "repo\n")

    repo = GitRepo(str(repo_path / "tracked.txt"))

    assert repo.is_valid()
    assert repo.module == "tracked.txt"
    assert repo.untracked_files == []
    assert repo.uncommitted_files == []


@_REQUIRES_GIT
def test_real_repository_detached_head(tmp_path: Path) -> None:
    """Detect a detached HEAD in a real Git repository."""
    repo_path = _init_repo(tmp_path / "repo")
    _configure_github_upstream(repo_path)
    _git(repo_path, "checkout", "--detach")

    repo = GitRepo(str(repo_path))

    assert repo.is_valid()
    assert repo.is_head_detached
    assert repo.tracking_branch is None
    assert repo.get_repo_info() is None


@_REQUIRES_GIT
def test_real_repository_unborn_head_is_not_detached(tmp_path: Path) -> None:
    """Do not misclassify an unborn branch as detached HEAD."""
    repo_path = _init_repo(tmp_path / "repo", initial_commit=False)
    (repo_path / "app.py").write_text("", encoding="utf-8")

    repo = GitRepo(str(repo_path / "app.py"))

    assert repo.is_valid()
    assert repo.is_head_detached is False
    assert repo.tracking_branch is None
    assert repo.get_repo_info() is None
    assert repo.untracked_files == ["app.py"]


@_REQUIRES_GIT
def test_real_git_worktree_is_discovered(tmp_path: Path) -> None:
    """Discover Git metadata correctly from a linked worktree."""
    repo_path = _init_repo(tmp_path / "repo")
    worktree_path = tmp_path / "worktree space"
    _git(repo_path, "worktree", "add", "-b", "worktree-branch", str(worktree_path))
    app_path = worktree_path / "nested" / "app.py"
    app_path.parent.mkdir()
    app_path.write_text("", encoding="utf-8")

    repo = GitRepo(str(app_path))

    assert repo.is_valid()
    assert repo.module == os.path.join("nested", "app.py")
    assert repo.untracked_files == [os.path.join("nested", "app.py")]
