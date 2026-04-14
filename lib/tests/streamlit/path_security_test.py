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

"""Tests for the shared path security utilities."""

from __future__ import annotations

import pytest

from streamlit.path_security import is_unsafe_path_pattern


class TestIsUnsafePathPattern:
    """Tests for the is_unsafe_path_pattern function."""

    @pytest.mark.parametrize(
        ("path", "expected_unsafe"),
        [
            # Safe paths
            pytest.param("inside.txt", False, id="simple_filename_safe"),
            pytest.param("subdir/file.js", False, id="subdir_forward_slash_safe"),
            pytest.param("subdir\\file.js", False, id="subdir_backslash_safe"),
            pytest.param("file..name.js", False, id="double_dots_in_filename_safe"),
            pytest.param("..file.js", False, id="dots_prefix_filename_safe"),
            pytest.param("file..", False, id="dots_suffix_filename_safe"),
            pytest.param("", False, id="empty_string_safe"),
            pytest.param(".", False, id="current_dir_safe"),
            # UNC paths
            pytest.param("\\\\server\\share", True, id="unc_backslash_unsafe"),
            pytest.param("//server/share", True, id="unc_forward_unsafe"),
            pytest.param("\\\\?\\C:\\Windows", True, id="extended_length_path"),
            pytest.param("\\\\.\\device", True, id="device_namespace"),
            # Absolute paths
            pytest.param("/etc/passwd", True, id="absolute_posix_unsafe"),
            pytest.param("\\rooted", True, id="rooted_backslash_unsafe"),
            # Path traversal
            pytest.param("../secret", True, id="traversal_parent_unsafe"),
            pytest.param("dir/../secret", True, id="traversal_in_middle_unsafe"),
            pytest.param("a/b/../c/../../../d", True, id="traversal_complex_unsafe"),
            # Windows drive paths
            pytest.param("C:\\file.txt", True, id="windows_drive_backslash"),
            pytest.param("C:/file.txt", True, id="windows_drive_forward"),
            pytest.param("D:\\path\\to\\file", True, id="windows_drive_d"),
            pytest.param("c:/users/file.txt", True, id="windows_drive_lowercase"),
            pytest.param("Z:foo", True, id="windows_drive_relative"),
            pytest.param("C:Windows", True, id="windows_drive_relative_no_slash"),
            # Null bytes
            pytest.param("\x00", True, id="null_only"),
            pytest.param("file\x00.txt", True, id="null_in_middle"),
            pytest.param("\x00../secret", True, id="null_before_traversal"),
        ],
    )
    def test_pattern_detection(self, path: str, expected_unsafe: bool) -> None:
        """Validates is_unsafe_path_pattern correctly identifies dangerous patterns.

        This is the shared core function used by both component_file_utils and
        component_path_utils to ensure consistent security checks.
        """
        assert is_unsafe_path_pattern(path) == expected_unsafe

    def test_traversal_with_mixed_separators(self) -> None:
        """Path traversal using mixed separators should be detected."""
        mixed_traversal_paths = [
            "sub\\..\\..\\secret",
            "sub/../..\\secret",
            "sub\\../secret",
        ]
        for path in mixed_traversal_paths:
            assert is_unsafe_path_pattern(path), f"Expected {path!r} to be unsafe"

    def test_safe_nested_paths(self) -> None:
        """Nested subdirectory paths should be safe."""
        safe_paths = [
            "sub/nested/deep.txt",
            "a/b/c/d/e/f.js",
            "components/my-component/index.js",
        ]
        for path in safe_paths:
            assert not is_unsafe_path_pattern(path), f"Expected {path!r} to be safe"
