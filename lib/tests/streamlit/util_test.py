# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import

import os

from streamlit.compatibility import setup_2_3_shims
from streamlit.util import CONFIG_FOLDER_NAME

setup_2_3_shims(globals())

import errno
import random
import unittest
from collections import namedtuple

import requests
import pytest
import requests_mock
from mock import patch, mock_open, MagicMock
import plotly.graph_objs as go

from streamlit import util


FILENAME = "/some/cache/file"
mock_get_path = MagicMock(return_value=FILENAME)


class UtilTest(unittest.TestCase):
    """Test Streamlit utility functions."""

    def setUp(self):
        self.patch1 = patch("streamlit.util.os.stat")
        self.os_stat = self.patch1.start()
        util._external_ip = None

    def tearDown(self):
        self.patch1.stop()

    def test_memoization(self):
        """Test that util.memoize works."""
        non_memoized_func = lambda: random.randint(0, 1000000)
        yes_memoized_func = util.memoize(non_memoized_func)
        self.assertNotEqual(non_memoized_func(), non_memoized_func())
        self.assertEqual(yes_memoized_func(), yes_memoized_func())

    def test_decode_ascii(self):
        """Test streamlit.util._decode_ascii."""
        self.assertEqual("test string.", util._decode_ascii(b"test string."))

    @patch("streamlit.credentials.util.get_streamlit_file_path", mock_get_path)
    @patch("streamlit.util.open", mock_open(read_data="data"))
    def test_streamlit_read(self):
        """Test streamlit.util.streamlit.read."""
        with util.streamlit_read(FILENAME) as input:
            data = input.read()
        self.assertEqual("data", data)

    @patch("streamlit.credentials.util.get_streamlit_file_path", mock_get_path)
    @patch("streamlit.util.open", mock_open(read_data=b"\xaa\xbb"))
    def test_streamlit_read_binary(self):
        """Test streamlit.util.streamlit.read."""
        with util.streamlit_read(FILENAME, binary=True) as input:
            data = input.read()
        self.assertEqual(b"\xaa\xbb", data)

    @patch("streamlit.credentials.util.get_streamlit_file_path", mock_get_path)
    @patch("streamlit.util.open", mock_open(read_data="data"))
    def test_streamlit_read_zero_bytes(self):
        """Test streamlit.util.streamlit.read."""
        self.os_stat.return_value.st_size = 0
        with pytest.raises(util.Error) as e:
            with util.streamlit_read(FILENAME) as input:
                data = input.read()
        self.assertEqual(str(e.value), 'Read zero byte file: "/some/cache/file"')

    @patch("streamlit.credentials.util.get_streamlit_file_path", mock_get_path)
    def test_streamlit_write(self):
        """Test streamlit.util.streamlit.write."""

        dirname = os.path.dirname(util.get_streamlit_file_path(FILENAME))
        with patch("streamlit.util.open", mock_open()) as open, patch(
            "streamlit.util.os.makedirs"
        ) as makedirs, util.streamlit_write(FILENAME) as output:
            output.write("some data")
            open().write.assert_called_once_with("some data")
            makedirs.assert_called_once_with(dirname)

    @patch("streamlit.credentials.util.get_streamlit_file_path", mock_get_path)
    def test_streamlit_write_exception(self):
        """Test streamlit.util.streamlit.write."""
        with patch("streamlit.util.open", mock_open()) as p, patch(
            "streamlit.util.os.makedirs"
        ), patch("streamlit.util.platform.system") as system:
            system.return_value = "Darwin"
            p.side_effect = OSError(errno.EINVAL, "[Errno 22] Invalid argument")
            with pytest.raises(util.Error) as e, util.streamlit_write(
                FILENAME
            ) as output:
                output.write("some data")
            error_msg = (
                "Unable to write file: /some/cache/file\n"
                "Python is limited to files below 2GB on OSX. "
                "See https://bugs.python.org/issue24658"
            )
            self.assertEqual(str(e.value), error_msg)

    def test_get_external_ip(self):
        # Test success
        with requests_mock.mock() as m:
            m.get(util._AWS_CHECK_IP, text="1.2.3.4")
            self.assertEqual("1.2.3.4", util.get_external_ip())

        util._external_ip = None

        # Test failure
        with requests_mock.mock() as m:
            m.get(util._AWS_CHECK_IP, exc=requests.exceptions.ConnectTimeout)
            self.assertEqual(None, util.get_external_ip())

    def test_get_project_streamlit_file_path(self):
        expected = os.path.join(os.getcwd(), CONFIG_FOLDER_NAME, "some/random/file")

        self.assertEqual(
            expected, util.get_project_streamlit_file_path("some/random/file")
        )

        self.assertEqual(
            expected, util.get_project_streamlit_file_path("some", "random", "file")
        )


class FileIsInFolderTest(unittest.TestCase):
    """Tests for file_is_in_folder."""

    def test_file_in_folder(self):
        # Test with and without trailing slash
        ret = util.file_is_in_folder_glob("/a/b/c/foo.py", "/a/b/c/")
        self.assertTrue(ret)
        ret = util.file_is_in_folder_glob("/a/b/c/foo.py", "/a/b/c")
        self.assertTrue(ret)

    def test_file_in_subfolder(self):
        # Test with and without trailing slash
        ret = util.file_is_in_folder_glob("/a/b/c/foo.py", "/a")
        self.assertTrue(ret)
        ret = util.file_is_in_folder_glob("/a/b/c/foo.py", "/a/")
        self.assertTrue(ret)
        ret = util.file_is_in_folder_glob("/a/b/c/foo.py", "/a/b")
        self.assertTrue(ret)
        ret = util.file_is_in_folder_glob("/a/b/c/foo.py", "/a/b/")
        self.assertTrue(ret)

    def test_file_not_in_folder(self):
        # Test with and without trailing slash
        ret = util.file_is_in_folder_glob("/a/b/c/foo.py", "/d/e/f/")
        self.assertFalse(ret)
        ret = util.file_is_in_folder_glob("/a/b/c/foo.py", "/d/e/f")
        self.assertFalse(ret)

    def test_rel_file_not_in_folder(self):
        # Test with and without trailing slash
        ret = util.file_is_in_folder_glob("foo.py", "/d/e/f/")
        self.assertFalse(ret)
        ret = util.file_is_in_folder_glob("foo.py", "/d/e/f")
        self.assertFalse(ret)

    def test_file_in_folder_glob(self):
        ret = util.file_is_in_folder_glob("/a/b/c/foo.py", "**/c")
        self.assertTrue(ret)

    def test_file_not_in_folder_glob(self):
        ret = util.file_is_in_folder_glob("/a/b/c/foo.py", "**/f")
        self.assertFalse(ret)

    def test_rel_file_not_in_folder_glob(self):
        ret = util.file_is_in_folder_glob("foo.py", "**/f")
        self.assertFalse(ret)


class GitHubUrlTest(unittest.TestCase):
    GITHUB_URLS = [
        (
            "https://github.com/aritropaul/streamlit/blob/b72adbcf00c91775db14e739e2ea33d6df9079c3/lib/streamlit/cli.py",
            "https://github.com/aritropaul/streamlit/raw/b72adbcf00c91775db14e739e2ea33d6df9079c3/lib/streamlit/cli.py",
        ),
        (
            "https://github.com/streamlit/streamlit/blob/develop/examples/video.py",
            "https://github.com/streamlit/streamlit/raw/develop/examples/video.py",
        ),
        (
            "https://github.com/text2gene/text2gene/blob/master/sbin/clinvar.hgvs_citations.sql",
            "https://github.com/text2gene/text2gene/raw/master/sbin/clinvar.hgvs_citations.sql",
        ),
        (
            "https://github.com/mekarpeles/math.mx/blob/master/README.md",
            "https://github.com/mekarpeles/math.mx/raw/master/README.md",
        ),
    ]

    GIST_URLS = [
        (
            "https://gist.github.com/nthmost/b521b80fbd834e67b3f5e271e9548232",
            "https://gist.github.com/nthmost/b521b80fbd834e67b3f5e271e9548232/raw",
        ),
        (
            "https://gist.github.com/scottyallen/1888e058261fc21f184f6be192bbe131",
            "https://gist.github.com/scottyallen/1888e058261fc21f184f6be192bbe131/raw",
        ),
        (
            "https://gist.github.com/tvst/faf057abbedaccaa70b48216a1866cdd",
            "https://gist.github.com/tvst/faf057abbedaccaa70b48216a1866cdd/raw",
        ),
    ]

    INVALID_URLS = [
        "blah",
        "google.com",
        "http://homestarrunner.com",
        "https://somethinglikegithub.com/withablob",
        "gist.github.com/nothing",
        "https://raw.githubusercontent.com/streamlit/streamlit/develop/examples/video.py",
        "streamlit.io/raw/blob",
    ]

    def test_github_url_is_replaced(self):
        for (target, processed) in self.GITHUB_URLS:
            assert util.process_gitblob_url(target) == processed

    def test_gist_url_is_replaced(self):
        for (target, processed) in self.GIST_URLS:
            assert util.process_gitblob_url(target) == processed

    def test_nonmatching_url_is_not_replaced(self):
        for url in self.INVALID_URLS:
            assert url == util.process_gitblob_url(url)
