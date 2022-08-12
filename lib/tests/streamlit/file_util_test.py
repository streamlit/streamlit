from unittest.mock import patch, mock_open, MagicMock
import errno
import os
import pytest
import unittest

from streamlit import file_util
from streamlit import util


FILENAME = "/some/cache/file"
mock_get_path = MagicMock(return_value=FILENAME)


class FileUtilTest(unittest.TestCase):
    def setUp(self):
        self.patch1 = patch("streamlit.file_util.os.stat")
        self.os_stat = self.patch1.start()

    def tearDown(self):
        self.patch1.stop()

    @patch("streamlit.file_util.get_streamlit_file_path", mock_get_path)
    @patch("streamlit.file_util.open", mock_open(read_data="data"))
    def test_streamlit_read(self):
        """Test streamlitfile_util.streamlit_read."""
        with file_util.streamlit_read(FILENAME) as input:
            data = input.read()
        self.assertEqual("data", data)

    @patch("streamlit.file_util.get_streamlit_file_path", mock_get_path)
    @patch("streamlit.file_util.open", mock_open(read_data=b"\xaa\xbb"))
    def test_streamlit_read_binary(self):
        """Test streamlitfile_util.streamlit_read."""
        with file_util.streamlit_read(FILENAME, binary=True) as input:
            data = input.read()
        self.assertEqual(b"\xaa\xbb", data)

    @patch("streamlit.file_util.get_streamlit_file_path", mock_get_path)
    @patch("streamlit.file_util.open", mock_open(read_data="data"))
    def test_streamlit_read_zero_bytes(self):
        """Test streamlitfile_util.streamlit_read."""
        self.os_stat.return_value.st_size = 0
        with pytest.raises(util.Error) as e:
            with file_util.streamlit_read(FILENAME) as input:
                data = input.read()
        self.assertEqual(str(e.value), 'Read zero byte file: "/some/cache/file"')

    @patch("streamlit.file_util.get_streamlit_file_path", mock_get_path)
    def test_streamlit_write(self):
        """Test streamlitfile_util.streamlit_write."""

        dirname = os.path.dirname(file_util.get_streamlit_file_path(FILENAME))
        # patch streamlit.*.os.makedirs instead of os.makedirs for py35 compat
        with patch("streamlit.file_util.open", mock_open()) as open, patch(
            "streamlit.util.os.makedirs"
        ) as makedirs, file_util.streamlit_write(FILENAME) as output:
            output.write("some data")
            open().write.assert_called_once_with("some data")
            makedirs.assert_called_once_with(dirname, exist_ok=True)

    @patch("streamlit.file_util.get_streamlit_file_path", mock_get_path)
    @patch("streamlit.env_util.IS_DARWIN", True)
    def test_streamlit_write_exception(self):
        """Test streamlitfile_util.streamlit_write."""
        with patch("streamlit.file_util.open", mock_open()) as p, patch(
            "streamlit.util.os.makedirs"
        ):
            p.side_effect = OSError(errno.EINVAL, "[Errno 22] Invalid argument")
            with pytest.raises(util.Error) as e, file_util.streamlit_write(
                FILENAME
            ) as output:
                output.write("some data")
            error_msg = (
                "Unable to write file: /some/cache/file\n"
                "Python is limited to files below 2GB on OSX. "
                "See https://bugs.python.org/issue24658"
            )
            self.assertEqual(str(e.value), error_msg)

    def test_get_project_streamlit_file_path(self):
        expected = os.path.join(
            os.getcwd(), file_util.CONFIG_FOLDER_NAME, "some/random/file"
        )

        self.assertEqual(
            expected, file_util.get_project_streamlit_file_path("some/random/file")
        )

        self.assertEqual(
            expected,
            file_util.get_project_streamlit_file_path("some", "random", "file"),
        )


class FileIsInFolderTest(unittest.TestCase):
    def test_file_in_folder(self):
        # Test with and without trailing slash
        ret = file_util.file_is_in_folder_glob("/a/b/c/foo.py", "/a/b/c/")
        self.assertTrue(ret)
        ret = file_util.file_is_in_folder_glob("/a/b/c/foo.py", "/a/b/c")
        self.assertTrue(ret)

    def test_file_in_subfolder(self):
        # Test with and without trailing slash
        ret = file_util.file_is_in_folder_glob("/a/b/c/foo.py", "/a")
        self.assertTrue(ret)
        ret = file_util.file_is_in_folder_glob("/a/b/c/foo.py", "/a/")
        self.assertTrue(ret)
        ret = file_util.file_is_in_folder_glob("/a/b/c/foo.py", "/a/b")
        self.assertTrue(ret)
        ret = file_util.file_is_in_folder_glob("/a/b/c/foo.py", "/a/b/")
        self.assertTrue(ret)

    def test_file_not_in_folder(self):
        # Test with and without trailing slash
        ret = file_util.file_is_in_folder_glob("/a/b/c/foo.py", "/d/e/f/")
        self.assertFalse(ret)
        ret = file_util.file_is_in_folder_glob("/a/b/c/foo.py", "/d/e/f")
        self.assertFalse(ret)

    def test_rel_file_not_in_folder(self):
        # Test with and without trailing slash
        ret = file_util.file_is_in_folder_glob("foo.py", "/d/e/f/")
        self.assertFalse(ret)
        ret = file_util.file_is_in_folder_glob("foo.py", "/d/e/f")
        self.assertFalse(ret)

    def test_file_in_folder_glob(self):
        ret = file_util.file_is_in_folder_glob("/a/b/c/foo.py", "**/c")
        self.assertTrue(ret)

    def test_file_not_in_folder_glob(self):
        ret = file_util.file_is_in_folder_glob("/a/b/c/foo.py", "**/f")
        self.assertFalse(ret)

    def test_rel_file_not_in_folder_glob(self):
        ret = file_util.file_is_in_folder_glob("foo.py", "**/f")
        self.assertFalse(ret)

    def test_rel_file_not_in_folder_glob(self):
        ret = file_util.file_is_in_folder_glob("foo.py", "")
        self.assertTrue(ret)


class FileInPythonPathTest(unittest.TestCase):
    @staticmethod
    def _make_it_absolute(path):
        # Use manual join instead of os.abspath to test against non normalized paths
        return os.path.join(os.getcwd(), path)

    def test_no_pythonpath(self):
        with patch("os.environ", {}) as d:
            self.assertFalse(
                file_util.file_in_pythonpath(
                    self._make_it_absolute("../something/dir1/dir2/module")
                )
            )

    def test_empty_pythonpath(self):
        with patch("os.environ", {"PYTHONPATH": ""}):
            self.assertFalse(
                file_util.file_in_pythonpath(
                    self._make_it_absolute("something/dir1/dir2/module")
                )
            )

    def test_python_path_relative(self):
        with patch("os.environ", {"PYTHONPATH": "something"}):
            self.assertTrue(
                file_util.file_in_pythonpath(
                    self._make_it_absolute("something/dir1/dir2/module")
                )
            )
            self.assertFalse(
                file_util.file_in_pythonpath(
                    self._make_it_absolute("something_else/module")
                )
            )
            self.assertFalse(
                file_util.file_in_pythonpath(
                    self._make_it_absolute("../something/dir1/dir2/module")
                )
            )

    def test_python_path_absolute(self):
        with patch("os.environ", {"PYTHONPATH": self._make_it_absolute("something")}):
            self.assertTrue(
                file_util.file_in_pythonpath(
                    self._make_it_absolute("something/dir1/dir2/module")
                )
            )
            self.assertFalse(
                file_util.file_in_pythonpath(
                    self._make_it_absolute("something_else/module")
                )
            )
            self.assertFalse(
                file_util.file_in_pythonpath(
                    self._make_it_absolute("../something/dir1/dir2/module")
                )
            )

    def test_python_path_mixed(self):
        with patch(
            "os.environ",
            {
                "PYTHONPATH": os.pathsep.join(
                    [self._make_it_absolute("something"), "something"]
                )
            },
        ):
            self.assertTrue(
                file_util.file_in_pythonpath(
                    self._make_it_absolute("something/dir1/dir2/module")
                )
            )
            self.assertFalse(
                file_util.file_in_pythonpath(
                    self._make_it_absolute("something_else/module")
                )
            )

    def test_current_directory(self):
        with patch("os.environ", {"PYTHONPATH": "."}):
            self.assertTrue(
                file_util.file_in_pythonpath(
                    self._make_it_absolute("something/dir1/dir2/module")
                )
            )
            self.assertTrue(
                file_util.file_in_pythonpath(
                    self._make_it_absolute("something_else/module")
                )
            )
            self.assertFalse(
                file_util.file_in_pythonpath(
                    self._make_it_absolute("../something_else/module")
                )
            )
