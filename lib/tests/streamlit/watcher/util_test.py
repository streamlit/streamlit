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

import tempfile
import unittest
from unittest.mock import MagicMock, mock_open, patch

import pytest

from streamlit.errors import StreamlitMaxRetriesError
from streamlit.watcher import util


class UtilTest(unittest.TestCase):
    def test_md5_calculation_succeeds_with_bytes_input(self):
        with patch("streamlit.watcher.util.open", mock_open(read_data=b"hello")):
            md5 = util.calc_md5_with_blocking_retries("foo")
            assert md5 == "5d41402abc4b2a76b9719d911017c592"

    @patch("os.path.isdir", MagicMock(return_value=True))
    @patch("streamlit.watcher.util._stable_dir_identifier")
    def test_md5_calculation_succeeds_with_dir_input(self, mock_stable_dir_identifier):
        mock_stable_dir_identifier.return_value = "hello"

        md5 = util.calc_md5_with_blocking_retries("foo")
        assert md5 == "5d41402abc4b2a76b9719d911017c592"
        mock_stable_dir_identifier.assert_called_once_with("foo", "*")

    @patch("os.path.isdir", MagicMock(return_value=True))
    @patch("streamlit.watcher.util._stable_dir_identifier")
    def test_md5_calculation_can_pass_glob(self, mock_stable_dir_identifier):
        mock_stable_dir_identifier.return_value = "hello"

        util.calc_md5_with_blocking_retries("foo", glob_pattern="*.py")
        mock_stable_dir_identifier.assert_called_once_with("foo", "*.py")

    @patch("os.path.exists", MagicMock(return_value=False))
    def test_md5_calculation_allow_nonexistent(self):
        md5 = util.calc_md5_with_blocking_retries("hello", allow_nonexistent=True)
        assert md5 == "5d41402abc4b2a76b9719d911017c592"

    def test_md5_calculation_opens_file_with_rb(self):
        # This tests implementation :( . But since the issue this is addressing
        # could easily come back to bite us if a distracted coder tweaks the
        # implementation, I'm putting this here anyway.
        with patch("streamlit.watcher.util.open", mock_open(read_data=b"hello")) as m:
            util.calc_md5_with_blocking_retries("foo")
            m.assert_called_once_with("foo", "rb")


class FakeStat:
    """Emulates the output of os.stat()."""

    def __init__(self, mtime):
        self.st_mtime = mtime


class PathModificationTimeTests(unittest.TestCase):
    @patch("streamlit.watcher.util.os.stat", MagicMock(return_value=FakeStat(101.0)))
    @patch("streamlit.watcher.util.os.path.exists", MagicMock(return_value=True))
    def test_st_mtime_if_file_exists(self):
        assert util.path_modification_time("foo") == 101.0

    @patch("streamlit.watcher.util.os.stat", MagicMock(return_value=FakeStat(101.0)))
    @patch("streamlit.watcher.util.os.path.exists", MagicMock(return_value=True))
    def test_st_mtime_if_file_exists_and_allow_nonexistent(self):
        assert util.path_modification_time("foo", allow_nonexistent=True) == 101.0

    @patch("streamlit.watcher.util.os.path.exists", MagicMock(return_value=False))
    def test_zero_if_file_nonexistent_and_allow_nonexistent(self):
        assert util.path_modification_time("foo", allow_nonexistent=True) == 0.0


class DirHelperTests(unittest.TestCase):
    def setUp(self) -> None:
        self._test_dir = tempfile.TemporaryDirectory()

        def create_file(prefix, suffix):
            return tempfile.NamedTemporaryFile(
                dir=self._test_dir.name, prefix=prefix, suffix=suffix, delete=False
            )

        create_file("01", ".py")
        create_file("02", ".py")
        create_file("03", ".py")
        create_file("04", ".rs")
        create_file(".05", ".py")

    def tearDown(self) -> None:
        self._test_dir.cleanup()

    def test_dirfiles_sorts_files_and_ignores_hidden(self):
        dirfiles = util._dirfiles(self._test_dir.name, "*")
        filename_prefixes = [f[:2] for f in dirfiles.split("+")]
        assert filename_prefixes == ["01", "02", "03", "04"]

    def test_dirfiles_glob_pattern(self):
        dirfiles = util._dirfiles(self._test_dir.name, "*.py")
        filename_prefixes = [f[:2] for f in dirfiles.split("+")]
        assert filename_prefixes == ["01", "02", "03"]

    @patch("streamlit.watcher.util._dirfiles", MagicMock(side_effect=["foo", "foo"]))
    def test_stable_dir(self):
        assert util._stable_dir_identifier("my_dir", "*") == "my_dir+foo"

    @patch(
        "streamlit.watcher.util._dirfiles", MagicMock(side_effect=["foo", "bar", "bar"])
    )
    def test_stable_dir_files_change(self):
        assert util._stable_dir_identifier("my_dir", "*") == "my_dir+bar"


class RaceConditionTests(unittest.TestCase):
    """Tests for race conditions where files are deleted during watcher operations."""

    @patch("streamlit.watcher.util._do_with_retries")
    @patch("streamlit.watcher.util.os.path.exists")
    def test_path_modification_time_handles_deletion_race_condition(
        self, mock_exists: MagicMock, mock_do_with_retries: MagicMock
    ) -> None:
        """Test that path_modification_time handles file deletion gracefully.

        Scenario: File exists when checked, but is deleted before os.stat() completes.
        With allow_nonexistent=True, should return 0.0 instead of raising.
        """
        # File exists initially
        mock_exists.return_value = True
        # But stat fails because file was deleted (race condition)
        mock_do_with_retries.side_effect = StreamlitMaxRetriesError("File gone")

        # With allow_nonexistent=True, should return 0.0 (not raise)
        result = util.path_modification_time(
            "deleted_file.toml", allow_nonexistent=True
        )
        assert result == 0.0

        # Without allow_nonexistent, should raise
        with pytest.raises(StreamlitMaxRetriesError):
            util.path_modification_time("deleted_file.toml", allow_nonexistent=False)

    @patch("streamlit.watcher.util._do_with_retries")
    @patch("streamlit.watcher.util.os.path.isdir")
    @patch("streamlit.watcher.util.os.path.exists")
    def test_calc_md5_handles_deletion_race_condition(
        self,
        mock_exists: MagicMock,
        mock_isdir: MagicMock,
        mock_do_with_retries: MagicMock,
    ) -> None:
        """Test that calc_md5_with_blocking_retries handles file deletion gracefully.

        Scenario: File exists when checked, but is deleted before read() completes.
        With allow_nonexistent=True, should return MD5 of path string instead of raising.
        """
        # File exists initially, is not a directory
        mock_exists.return_value = True
        mock_isdir.return_value = False
        # But read fails because file was deleted (race condition)
        mock_do_with_retries.side_effect = StreamlitMaxRetriesError("File gone")

        # With allow_nonexistent=True, should return MD5 of path (not raise)
        result = util.calc_md5_with_blocking_retries(
            "deleted_file.toml", allow_nonexistent=True
        )
        # MD5 of "deleted_file.toml" encoded as UTF-8
        expected_md5 = util.calc_md5(b"deleted_file.toml")
        assert result == expected_md5

        # Without allow_nonexistent, should raise
        with pytest.raises(StreamlitMaxRetriesError):
            util.calc_md5_with_blocking_retries(
                "deleted_file.toml", allow_nonexistent=False
            )
