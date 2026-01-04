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
from unittest import mock

import pytest

from streamlit.web.server.component_file_utils import (
    build_safe_abspath,
    guess_content_type,
)


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
        assert Path(abspath).read_text() == "ok"
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
    assert Path(abspath).read_text() == "ok"


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
            os.path.join("sub", "..", "inside.txt"),
            lambda root: os.path.realpath(str(root / "inside.txt")),
            id="normalized_parent_segments",
        ),
        pytest.param(
            os.path.join("does", "not", "exist.txt"),
            lambda root: os.path.realpath(str(root / "does" / "not" / "exist.txt")),
            id="nonexistent_inside_root",
        ),
    ],
)
def test_normalization_and_nonexistent_paths(
    root: Path, candidate: str, expect
) -> None:  # type: ignore[no-untyped-def]
    """Normalizes candidates and allows non-existent paths that remain inside root.

    The helper under test does not enforce existence; it only enforces that the
    resolved path stays within the component root.
    """
    abspath = build_safe_abspath(str(root), candidate)
    assert abspath is not None
    assert abspath == expect(root)


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
