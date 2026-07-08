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
from unittest.mock import patch

import pytest

from streamlit.components.v2.component_path_utils import ComponentPathUtils
from streamlit.errors import StreamlitComponentRegistryError


def _touch(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("console.log('ok');", encoding="utf-8")


def test_resolve_glob_pattern_accepts_file_within_root(tmp_path: Path) -> None:
    """Resolves a simple relative path within the package root."""
    package_root = tmp_path / "pkg"
    asset = package_root / "assets" / "main.js"
    _touch(asset)

    resolved = ComponentPathUtils.resolve_glob_pattern(
        pattern="assets/main.js", package_root=package_root
    )

    assert resolved == asset.resolve()


def test_resolve_glob_pattern_handles_subdirectory_wildcards_single_match(
    tmp_path: Path,
) -> None:
    """Resolves a wildcard pattern when only one match exists."""
    package_root = tmp_path / "pkg"
    a1 = package_root / "assets" / "v1" / "main.js"
    a2 = package_root / "assets" / "v2" / "other.js"
    _touch(a1)
    _touch(a2)

    # Only one file should match this pattern
    resolved = ComponentPathUtils.resolve_glob_pattern(
        pattern="assets/*/main.js", package_root=package_root
    )
    assert resolved == a1.resolve()


def test_resolve_glob_pattern_raises_on_multiple_matches(tmp_path: Path) -> None:
    """Raises when wildcard pattern matches multiple files."""
    package_root = tmp_path / "pkg"
    a1 = package_root / "assets" / "v1" / "main.js"
    a2 = package_root / "assets" / "v2" / "main.js"
    _touch(a1)
    _touch(a2)

    with pytest.raises(StreamlitComponentRegistryError):
        ComponentPathUtils.resolve_glob_pattern(
            pattern="assets/*/main.js", package_root=package_root
        )


def test_ensure_within_root_blocks_outside_with_prefix_collision(
    tmp_path: Path,
) -> None:
    """Blocks files outside root even if paths share a prefix."""
    root = tmp_path / "package"
    inside_file = root / "dir" / "file.js"
    outside_file = tmp_path / "package_malicious" / "file.js"
    _touch(inside_file)
    _touch(outside_file)

    # Sanity: inside should not raise
    ComponentPathUtils.ensure_within_root(
        abs_path=inside_file.resolve(), root=root.resolve(), kind="js"
    )

    # Prevent a prefix-collision path escape: an attacker could place files in a
    # sibling directory named "package_malicious" that shares the "package"
    # prefix to bypass naive prefix-based checks and access files outside the
    # package root. Such access must raise.
    with pytest.raises(StreamlitComponentRegistryError):
        ComponentPathUtils.ensure_within_root(
            abs_path=outside_file.resolve(), root=root.resolve(), kind="js"
        )


@pytest.mark.skipif(not hasattr(os, "symlink"), reason="OS does not support symlinks")
def test_resolve_glob_pattern_rejects_symlink_pointing_outside_root(
    tmp_path: Path,
) -> None:
    """Rejects symlinked files that resolve outside the package root."""
    package_root = tmp_path / "pkg"
    outside_dir = tmp_path / "outside"
    outside_file = outside_dir / "evil.js"
    _touch(outside_file)

    link_dir = package_root / "link"
    link_dir.parent.mkdir(parents=True, exist_ok=True)

    try:
        os.symlink(str(outside_dir), str(link_dir), target_is_directory=True)
    except (OSError, NotImplementedError):
        pytest.skip("Symlink creation not permitted in this environment")

    # The pattern targets a file reachable via a symlink inside package_root,
    # but the resolved path points outside. It must be ignored, causing a
    # 'no files found' error.
    with pytest.raises(StreamlitComponentRegistryError):
        ComponentPathUtils.resolve_glob_pattern(
            pattern="link/evil.js", package_root=package_root
        )


@pytest.mark.parametrize(
    "invalid_path",
    [
        "/etc/passwd",  # POSIX absolute
        "C:\\Windows\\system32",  # Windows drive
        "\\\\server\\share\\file",  # UNC
        "../secret",  # traversal
        "dir/../secret",  # traversal in middle
        "\\rooted\\path",  # rooted backslash
        "C:\\mix/sep\\file.js",  # mixed separators but absolute
    ],
)
def test_validate_path_security_rejects_invalid_paths(invalid_path: str) -> None:
    """Absolute, rooted-backslash, and traversal paths must be rejected."""
    with pytest.raises(StreamlitComponentRegistryError):
        ComponentPathUtils.validate_path_security(invalid_path)


def test_validate_path_security_allows_non_traversal_double_dots() -> None:
    """Double dots in filenames are allowed when not a traversal segment."""
    # Should not raise
    ComponentPathUtils.validate_path_security("dir/file..js")


@pytest.mark.parametrize(
    "invalid_pattern",
    [
        "/etc/*.js",  # POSIX absolute
        "C:/Windows/*.dll",  # Windows drive
        "\\\\server\\share\\*.js",  # UNC
        "../assets/*.js",  # traversal
        "assets/../*.js",  # traversal in middle
        "\\assets\\*.js",  # rooted backslash
        "assets/**/../evil.js",  # traversal with glob
    ],
)
def test_resolve_glob_pattern_rejects_invalid_patterns(
    tmp_path: Path, invalid_pattern: str
) -> None:
    """resolve_glob_pattern must reject absolute, rooted-backslash, and traversal patterns."""
    package_root = tmp_path / "pkg"
    (package_root / "assets").mkdir(parents=True, exist_ok=True)
    with pytest.raises(StreamlitComponentRegistryError):
        ComponentPathUtils.resolve_glob_pattern(
            pattern=invalid_pattern, package_root=package_root
        )


def test_validate_path_security_allows_current_dir_segment() -> None:
    """'.' segments are benign and should not raise."""
    ComponentPathUtils.validate_path_security("./assets/file.js")
    ComponentPathUtils.validate_path_security("assets/./file.js")


def test_resolve_glob_pattern_accepts_dot_prefixed_relative(tmp_path: Path) -> None:
    """'./' prefixed relative patterns should resolve normally within root."""
    package_root = tmp_path / "pkg"
    asset = package_root / "assets" / "a.js"
    asset.parent.mkdir(parents=True, exist_ok=True)
    asset.write_text("console.log('ok');", encoding="utf-8")

    resolved = ComponentPathUtils.resolve_glob_pattern(
        pattern="./assets/a.js", package_root=package_root
    )
    assert resolved == asset.resolve()


@pytest.mark.parametrize(
    ("value", "expected_inline"),
    [
        ("console.log('x')", True),  # Base JS case -> inline
        ("console.log('x')\nalert('y')", True),  # newlines -> inline
        ("var x = 1;/*no path*/", False),  # has '/' -> path-like
        ("var x = 1;\n/*no path*/", True),  # multiline -> inline
        ("assets/main.js", False),
        ("./main.css", False),
        ("dir\\file.mjs", False),
        ("file.cjs", False),
    ],
)
def test_looks_like_inline_content_heuristic(value: str, expected_inline: bool) -> None:
    """Inline content heuristic should classify strings correctly across cases."""
    assert ComponentPathUtils.looks_like_inline_content(value) == expected_inline


def _patch_path_resolve_to_fail_for(target: Path) -> object:
    """Patch Path.resolve so it raises OSError only for ``target``."""
    original_resolve = Path.resolve

    def patched_resolve(self: Path, *args: object, **kwargs: object) -> Path:
        if self == target:
            raise OSError("Simulated resolution failure")
        return original_resolve(self, *args, **kwargs)

    return patch.object(Path, "resolve", patched_resolve)


def test_resolve_glob_pattern_skips_files_whose_resolution_raises(
    tmp_path: Path,
) -> None:
    """resolve_glob_pattern logs a warning and skips files whose resolve() raises."""
    package_root = tmp_path / "pkg"
    asset = package_root / "assets" / "main.js"
    _touch(asset)

    with _patch_path_resolve_to_fail_for(asset):
        with pytest.raises(StreamlitComponentRegistryError, match="No files found"):
            ComponentPathUtils.resolve_glob_pattern(
                pattern="assets/main.js", package_root=package_root
            )


def test_ensure_within_root_wraps_resolution_errors(tmp_path: Path) -> None:
    """ensure_within_root raises a StreamlitComponentRegistryError when resolve fails."""
    bad_path = tmp_path / "missing-file.js"

    with _patch_path_resolve_to_fail_for(bad_path):
        with pytest.raises(
            StreamlitComponentRegistryError, match="Failed to resolve js path"
        ):
            ComponentPathUtils.ensure_within_root(
                abs_path=bad_path, root=tmp_path, kind="js"
            )
