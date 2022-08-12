from unittest.mock import patch, MagicMock, mock_open
import tempfile
import unittest

from streamlit.watcher import util


class UtilTest(unittest.TestCase):
    def test_md5_calculation_succeeds_with_bytes_input(self):
        with patch("streamlit.watcher.util.open", mock_open(read_data=b"hello")) as m:
            md5 = util.calc_md5_with_blocking_retries("foo")
            self.assertEqual(md5, "5d41402abc4b2a76b9719d911017c592")

    @patch("os.path.isdir", MagicMock(return_value=True))
    @patch("streamlit.watcher.util._stable_dir_identifier")
    def test_md5_calculation_succeeds_with_dir_input(self, mock_stable_dir_identifier):
        mock_stable_dir_identifier.return_value = "hello"

        md5 = util.calc_md5_with_blocking_retries("foo")
        self.assertEqual(md5, "5d41402abc4b2a76b9719d911017c592")
        mock_stable_dir_identifier.assert_called_once_with("foo", "*")

    @patch("os.path.isdir", MagicMock(return_value=True))
    @patch("streamlit.watcher.util._stable_dir_identifier")
    def test_md5_calculation_can_pass_glob(self, mock_stable_dir_identifier):
        mock_stable_dir_identifier.return_value = "hello"

        md5 = util.calc_md5_with_blocking_retries("foo", glob_pattern="*.py")
        mock_stable_dir_identifier.assert_called_once_with("foo", "*.py")

    @patch("os.path.exists", MagicMock(return_value=False))
    def test_md5_calculation_allow_nonexistent(self):
        md5 = util.calc_md5_with_blocking_retries("hello", allow_nonexistent=True)
        self.assertEqual(md5, "5d41402abc4b2a76b9719d911017c592")

    def test_md5_calculation_opens_file_with_rb(self):
        # This tests implementation :( . But since the issue this is addressing
        # could easily come back to bite us if a distracted coder tweaks the
        # implementation, I'm putting this here anyway.
        with patch("streamlit.watcher.util.open", mock_open(read_data=b"hello")) as m:
            md5 = util.calc_md5_with_blocking_retries("foo")
            m.assert_called_once_with("foo", "rb")


class FakeStat(object):
    """Emulates the output of os.stat()."""

    def __init__(self, mtime):
        self.st_mtime = mtime


class PathModificationTimeTests(unittest.TestCase):
    @patch(
        "streamlit.watcher.util.os.stat", new=MagicMock(return_value=FakeStat(101.0))
    )
    @patch("streamlit.watcher.util.os.path.exists", new=MagicMock(return_value=True))
    def test_st_mtime_if_file_exists(self):
        assert util.path_modification_time("foo") == 101.0

    @patch(
        "streamlit.watcher.util.os.stat", new=MagicMock(return_value=FakeStat(101.0))
    )
    @patch("streamlit.watcher.util.os.path.exists", new=MagicMock(return_value=True))
    def test_st_mtime_if_file_exists_and_allow_nonexistent(self):
        assert util.path_modification_time("foo", allow_nonexistent=True) == 101.0

    @patch("streamlit.watcher.util.os.path.exists", new=MagicMock(return_value=False))
    def test_zero_if_file_nonexistent_and_allow_nonexistent(self):
        assert util.path_modification_time("foo", allow_nonexistent=True) == 0.0


class DirHelperTests(unittest.TestCase):
    def setUp(self) -> None:
        self._test_dir = tempfile.TemporaryDirectory()

        create_file = lambda prefix, suffix: tempfile.NamedTemporaryFile(
            dir=self._test_dir.name,
            prefix=prefix,
            suffix=suffix,
            delete=False,
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
