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
from pathlib import Path
from typing import TYPE_CHECKING
from unittest import mock
from urllib.parse import unquote

import pytest

from streamlit.web.server.component_file_utils import (
    build_safe_abspath,
    guess_content_type,
)

if TYPE_CHECKING:
    from collections.abc import Callable


@pytest.fixture
def root(tmp_path: Path) -> Path:
    """Create an isolated component root with a single file inside."""
    root_dir = tmp_path / "root"
    root_dir.mkdir(parents=True, exist_ok=True)
    (root_dir / "inside.txt").write_text("ok")
    return root_dir


@pytest.mark.parametrize(
    ("candidate", "expect_allowed"),
    [
        pytest.param("inside.txt", True, id="inside_ok"),
        pytest.param("../etc/passwd", False, id="relative_traversal_forbidden"),
        pytest.param(
            os.sep + "etc" + os.sep + "passwd", False, id="absolute_injection_forbidden"
        ),
    ],
)
def test_path_security_cases(root: Path, candidate: str, expect_allowed: bool) -> None:
    """Validate safe path resolution and forbidden cases (relative and absolute traversal).

    Parameters
    ----------
    root
        Temporary component root directory fixture.
    candidate
        Relative URL path candidate to resolve under the component root.
    expect_allowed
        Whether the candidate is expected to resolve inside the root.
    """
    abspath = build_safe_abspath(str(root), candidate)
    if expect_allowed:
        assert abspath is not None
        assert Path(abspath).read_text(encoding="utf-8") == "ok"
    else:
        assert abspath is None


def test_rejects_symlink_escape(root: Path, tmp_path: Path) -> None:
    """Rejects a symlink inside root that points outside root."""
    outside = tmp_path / "outside.txt"
    outside.write_text("nope")
    link_inside = root / "link.txt"
    try:
        os.symlink(outside, link_inside)
    except (OSError, NotImplementedError):
        pytest.skip("Symlinks not supported in this environment")

    abspath = build_safe_abspath(str(root), "link.txt")
    assert abspath is None


def test_commonpath_valueerror_treated_as_forbidden(root: Path) -> None:
    """When os.path.commonpath raises ValueError (e.g., cross-drive), treat as forbidden."""
    with mock.patch(
        "streamlit.web.server.component_file_utils.os.path.commonpath"
    ) as m:
        m.side_effect = ValueError("different drives")
        abspath = build_safe_abspath(str(root), "inside.txt")
        assert abspath is None


def test_symlink_within_root_allowed(root: Path) -> None:
    """Allows a symlink that targets a file within the same root directory.

    This ensures we don't over-block legitimate symlinked resources that resolve
    inside the component root after ``realpath`` resolution.
    """
    target = root / "inside.txt"
    link_inside = root / "alias.txt"
    try:
        os.symlink(target, link_inside)
    except (OSError, NotImplementedError):
        pytest.skip("Symlinks not supported in this environment")

    abspath = build_safe_abspath(str(root), "alias.txt")
    assert abspath is not None
    assert Path(abspath).read_text(encoding="utf-8") == "ok"


@pytest.mark.parametrize(
    ("candidate", "expect"),
    [
        pytest.param(
            "", lambda root: os.path.realpath(str(root)), id="empty_means_root"
        ),
        pytest.param(
            ".", lambda root: os.path.realpath(str(root)), id="dot_means_root"
        ),
        pytest.param(
            os.path.join("does", "not", "exist.txt"),
            lambda root: os.path.realpath(str(root / "does" / "not" / "exist.txt")),
            id="nonexistent_inside_root",
        ),
    ],
)
def test_normalization_and_nonexistent_paths(
    root: Path, candidate: str, expect: Callable[[Path], str]
) -> None:
    """Normalizes candidates and allows non-existent paths that remain inside root.

    The helper under test does not enforce existence; it only enforces that the
    resolved path stays within the component root.
    """
    abspath = build_safe_abspath(str(root), candidate)
    assert abspath is not None
    assert abspath == expect(root)


def test_normalized_parent_segments_rejected(root: Path) -> None:
    """Paths containing '..' are now rejected early for SSRF protection.

    This is a security-motivated behavior change: paths like 'sub/../inside.txt'
    are rejected at validation time even if they would resolve safely. This prevents
    potential SSRF attacks where path traversal could be combined with other techniques.
    """
    traversal_path = os.path.join("sub", "..", "inside.txt")
    assert build_safe_abspath(str(root), traversal_path) is None


def test_component_root_is_symlink(tmp_path: Path) -> None:
    """Supports a component root that itself is a symlink to a real directory."""
    real_root = tmp_path / "real_root"
    real_root.mkdir(parents=True, exist_ok=True)
    (real_root / "inside.txt").write_text("ok")
    link_root = tmp_path / "root_link"
    try:
        os.symlink(real_root, link_root)
    except (OSError, NotImplementedError):
        pytest.skip("Symlinks not supported in this environment")

    abspath = build_safe_abspath(str(link_root), "inside.txt")
    assert abspath == os.path.realpath(str(real_root / "inside.txt"))


@pytest.mark.parametrize(
    ("path", "expected"),
    [
        pytest.param("file.js.gz", "application/gzip", id="gzip_encoding_overrides"),
        pytest.param("file.svgz", "application/gzip", id="svgz_is_gzip"),
    ],
)
def test_guess_content_type_gzip(path: str, expected: str) -> None:
    """Returns application/gzip when encoding is gzip, regardless of base type."""
    assert guess_content_type(path) == expected


def test_guess_content_type_other_encoding_bzip2() -> None:
    """Falls back to octet-stream when an encoding other than gzip is detected."""
    # .bz2 is commonly recognized with encoding "bzip2" across platforms
    assert guess_content_type("archive.tar.bz2") == "application/octet-stream"


@pytest.mark.parametrize(
    ("path", "expected_prefix"),
    [
        pytest.param("note.txt", "text/plain", id="plain_text"),
        pytest.param("image.png", "image/png", id="png_image"),
        pytest.param("script.js", "application/javascript", id="javascript"),
    ],
)
def test_guess_content_type_basic_types(path: str, expected_prefix: str) -> None:
    """Returns the detected mime type when there is no content encoding.

    We accept that the exact string can vary slightly across Python versions or
    platforms (e.g., application/javascript vs text/javascript), so for types
    known to be stable we check equality, and for JavaScript we assert a prefix.
    """
    mime = guess_content_type(path)
    if path.endswith(".js"):
        assert (
            mime.endswith("javascript") and mime.startswith("application")
        ) or mime.startswith("text")
    else:
        assert mime == expected_prefix


def test_guess_content_type_unknown_extension() -> None:
    """Returns octet-stream for unknown or unregistered file extensions."""
    assert (
        guess_content_type("file.somethingreallyrandomext")
        == "application/octet-stream"
    )


# ---------------------------------------------------------------------------
# UNC path and SSRF prevention tests
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "unsafe_path",
    [
        pytest.param("\\\\server\\share\\file.js", id="unc_backslash"),
        pytest.param("//server/share/file.js", id="unc_forward_slash"),
        pytest.param("\\rooted\\path", id="rooted_backslash"),
        pytest.param("/etc/passwd", id="rooted_forward_slash"),
        pytest.param("../../../etc/passwd", id="traversal_relative"),
        pytest.param("foo/../../../etc/passwd", id="traversal_in_middle"),
    ],
)
def test_rejects_unsafe_paths_before_realpath(root: Path, unsafe_path: str) -> None:
    """Unsafe paths must be rejected before os.path.realpath() is called.

    This prevents Windows UNC paths from triggering SMB connections (SSRF).
    """
    abspath = build_safe_abspath(str(root), unsafe_path)
    assert abspath is None


@pytest.mark.parametrize(
    "unsafe_path",
    [
        pytest.param("\\\\server\\share\\file.js", id="unc_backslash"),
        pytest.param("//server/share/file.js", id="unc_forward_slash"),
        pytest.param("../../../etc/passwd", id="traversal"),
    ],
)
def test_realpath_not_called_for_unsafe_paths(root: Path, unsafe_path: str) -> None:
    """Verify os.path.realpath is NOT called when an unsafe path is provided.

    This is a regression test for the SSRF fix. The security invariant is that
    realpath() must never be called on untrusted input, because on Windows it
    can trigger SMB connections to attacker-controlled servers.

    If someone refactors and moves the is_unsafe_path_pattern() check after the
    realpath() call, this test will catch it.
    """
    with mock.patch(
        "streamlit.web.server.component_file_utils.os.path.realpath"
    ) as mock_realpath:
        result = build_safe_abspath(str(root), unsafe_path)

        # Should return None (rejected)
        assert result is None

        # realpath should NOT have been called at all
        mock_realpath.assert_not_called()


@pytest.mark.parametrize(
    "unsafe_path",
    [
        pytest.param("C:\\Windows\\system32\\file.dll", id="windows_drive_backslash"),
        pytest.param("C:/Windows/system32/file.dll", id="windows_drive_forward"),
        pytest.param("Z:mapped_drive_file", id="windows_drive_relative"),
    ],
)
def test_rejects_windows_drive_paths(root: Path, unsafe_path: str) -> None:
    """Windows drive paths are rejected to prevent mapped drive access.

    This includes drive-relative paths like 'Z:foo' which on Windows resolve
    against the current directory of that drive. Checked on all platforms
    for defense-in-depth and testability (CI runs on Linux).
    """
    abspath = build_safe_abspath(str(root), unsafe_path)
    assert abspath is None


def test_safe_path_still_resolves_correctly(root: Path) -> None:
    """Ensures that safe paths still work after the security check is added.

    This is an anti-regression test to verify the fix doesn't break normal usage.
    """
    abspath = build_safe_abspath(str(root), "inside.txt")
    assert abspath is not None
    assert Path(abspath).read_text(encoding="utf-8") == "ok"


def test_safe_nested_path_resolves(root: Path) -> None:
    """Nested subdirectory paths should still resolve correctly."""
    subdir = root / "sub" / "nested"
    subdir.mkdir(parents=True, exist_ok=True)
    (subdir / "deep.txt").write_text("deep content")

    abspath = build_safe_abspath(str(root), "sub/nested/deep.txt")
    assert abspath is not None
    assert Path(abspath).read_text(encoding="utf-8") == "deep content"


@pytest.mark.parametrize(
    "decoded_path",
    [
        pytest.param("../../etc/passwd", id="url_decoded_traversal"),
        pytest.param("\\\\server\\share", id="url_decoded_unc_backslash"),
        pytest.param("//server/share", id="url_decoded_unc_forward"),
    ],
)
def test_url_decoded_paths_are_rejected(root: Path, decoded_path: str) -> None:
    """Verify that URL-decoded malicious paths are correctly rejected.

    Tornado and Starlette automatically URL-decode path parameters before passing
    them to handlers. This test documents that our validation works correctly on
    the decoded paths (e.g., %2e%2e becomes .., %5c%5c becomes \\\\).

    Note: Double URL encoding (e.g., %252e%252e) is not a concern because web
    frameworks only decode once. So %252e%252e becomes %2e%2e (literal string),
    not "..", which our check would not flag as traversal. This is safe because
    the filesystem would look for a literal "%2e%2e" directory.
    """
    # These are example encoded forms that would decode to the test paths
    encoded_examples = {
        "../../etc/passwd": "%2e%2e/%2e%2e/etc/passwd",
        "\\\\server\\share": "%5c%5cserver%5cshare",
        "//server/share": "%2f%2fserver%2fshare",
    }

    # Verify the encoding/decoding relationship for documentation
    if decoded_path in encoded_examples:
        assert unquote(encoded_examples[decoded_path]) == decoded_path

    # The actual test: decoded paths should be rejected
    abspath = build_safe_abspath(str(root), decoded_path)
    assert abspath is None


@pytest.mark.parametrize(
    "path_with_null",
    [
        pytest.param("\x00", id="null_only"),
        pytest.param("file\x00.txt", id="null_in_middle"),
        pytest.param("\x00../secret", id="null_before_traversal"),
        pytest.param("safe.txt\x00", id="null_at_end"),
    ],
)
def test_rejects_null_bytes(root: Path, path_with_null: str) -> None:
    """Paths containing null bytes should be rejected.

    Null byte injection can be used to truncate paths in some contexts.
    While Python 3 generally handles this safely, we reject them as
    defense in depth.
    """
    assert build_safe_abspath(str(root), path_with_null) is None


@pytest.mark.parametrize(
    "windows_special_path",
    [
        pytest.param("\\\\?\\C:\\Windows", id="extended_length_path"),
        pytest.param("\\\\.\\device", id="device_namespace"),
        pytest.param("\\\\?\\UNC\\server\\share", id="extended_unc"),
    ],
)
def test_rejects_windows_special_path_prefixes(
    root: Path, windows_special_path: str
) -> None:
    """Windows extended-length and device namespace paths should be rejected.

    These paths start with \\\\ so they're caught by the UNC check, but this
    test documents that coverage explicitly.
    """
    assert build_safe_abspath(str(root), windows_special_path) is None


def test_mixed_separators_not_rejected_early(root: Path) -> None:
    """Paths with mixed separators should not be rejected by the early validation.

    On Windows, backslashes are path separators. On Unix, they're valid filename
    characters. Safe relative paths with backslashes should not be rejected.
    """
    # On Unix, this would look for a directory literally named "sub\nested"
    # On Windows, this would be equivalent to "sub/nested/file.js"
    # Either way, build_safe_abspath should not reject it as unsafe
    abspath = build_safe_abspath(str(root), "sub\\nested/file.js")
    # The path passes validation (not None) - it just might not exist
    assert abspath is not None


def test_traversal_with_mixed_separators_rejected(root: Path) -> None:
    """Path traversal using mixed separators should be rejected."""
    # These all contain '..' and should be rejected regardless of separator style
    mixed_traversal_paths = [
        "sub\\..\\..\\secret",
        "sub/../..\\secret",
        "sub\\../secret",
    ]
    for path in mixed_traversal_paths:
        abspath = build_safe_abspath(str(root), path)
        assert abspath is None, f"Expected {path!r} to be rejected"
