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
from typing import TYPE_CHECKING

from parameterized import parameterized

from streamlit.elements.lib.file_uploader_utils import (
    enforce_filename_restriction,
    normalize_upload_file_type,
)
from streamlit.errors import StreamlitAPIException

if TYPE_CHECKING:
    from collections.abc import Sequence


class FileUploaderUtilsTest(unittest.TestCase):
    @parameterized.expand(
        [
            ("png", [".png"]),
            (["png", ".svg", "foo"], [".png", ".svg", ".foo"]),
            (["jpeg"], [".jpeg", ".jpg"]),
            (["png", ".jpg"], [".png", ".jpg", ".jpeg"]),
            ([".JpG"], [".jpg", ".jpeg"]),
        ]
    )
    def test_file_type(self, file_type: str | Sequence[str], expected: Sequence[str]):
        """Test that it can be called using string(s) for type parameter."""
        normalized = normalize_upload_file_type(file_type=file_type)
        assert normalized == expected


def is_filename_valid(filename: str, allowed_types: Sequence[str]) -> bool:
    """Return True if the filename passes validation, False otherwise."""
    try:
        enforce_filename_restriction(filename, allowed_types)
        return True
    except StreamlitAPIException:
        return False


class EnforceFilenameRestrictionTest(unittest.TestCase):
    @parameterized.expand(
        [
            # Valid cases
            ("valid_single_extension_pdf", "document.pdf", [".pdf", ".png"], True),
            ("valid_single_extension_png", "image.png", [".pdf", ".png"], True),
            ("case_insensitive", "image.png", [".PDF", ".PNG"], True),
            ("valid_multi_part_tar_gz", "archive.tar.gz", [".tar.gz", ".zip"], True),
            ("valid_multi_part_zip", "data.zip", [".tar.gz", ".zip"], True),
            ("valid_tar_gz_allowed_gz", "archive.tar.gz", [".gz"], True),
            (
                "valid_multiple_periods",
                "my.file.tar.gz",
                [".tar.gz", ".pdf"],
                True,
            ),
            ("extension_is_uppercase", "document.CSV", [".csv"], True),
            # Invalid cases
            ("invalid_single_extension", "document.docx", [".pdf", ".png"], False),
            (
                "invalid_multi_part_extension",
                "archive.tar.bz2",
                [".tar.gz", ".zip"],
                False,
            ),
            ("no_extension", "file_without_extension", [".pdf", ".png"], False),
            ("empty_filename", "", [".pdf", ".tar.gz"], False),
            ("filename_is_period", ".", [".pdf", ".tar.gz"], False),
        ]
    )
    def test_filename_valid(self, _, filename, allowed_types, expected_valid):
        """Test whether filenames are valid against allowed extensions."""
        actual_valid = is_filename_valid(filename, allowed_types)
        assert actual_valid == expected_valid
