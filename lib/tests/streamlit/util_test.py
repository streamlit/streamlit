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

"""Config System Unittest."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims

setup_2_3_shims(globals())

import errno
import random
import unittest
from collections import namedtuple

import requests
import pytest
import requests_mock
from mock import patch, mock_open, mock, MagicMock
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
        with patch("streamlit.util.open", mock_open()) as p, util.streamlit_write(
            FILENAME
        ) as output:
            output.write("some data")
            p().write.assert_called_once_with("some data")

    @patch("streamlit.credentials.util.get_streamlit_file_path", mock_get_path)
    def test_streamlit_write_exception(self):
        """Test streamlit.util.streamlit.write."""
        with patch("streamlit.util.open", mock_open()) as p, patch(
            "streamlit.util.platform.system"
        ) as system:
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

    def test_list_is_plotly_chart(self):
        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])
        trace1 = go.Scatter(x=[1, 2, 3, 4], y=[16, 5, 11, 9])
        data = [trace0, trace1]

        res = util.is_plotly_chart(data)
        self.assertTrue(res)

    def test_data_dict_is_plotly_chart(self):
        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])
        trace1 = go.Scatter(x=[1, 2, 3, 4], y=[16, 5, 11, 9])
        d = {"data": [trace0, trace1]}

        res = util.is_plotly_chart(d)
        self.assertTrue(res)

    def test_dirty_data_dict_is_not_plotly_chart(self):
        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])
        trace1 = go.Scatter(x=[1, 2, 3, 4], y=[16, 5, 11, 9])
        d = {"data": [trace0, trace1], "foo": "bar"}  # Illegal property!

        res = util.is_plotly_chart(d)
        self.assertFalse(res)

    def test_layout_dict_is_not_plotly_chart(self):
        d = {
            # Missing a component with a graph object!
            "layout": {"width": 1000}
        }

        res = util.is_plotly_chart(d)
        self.assertFalse(res)

    def test_fig_is_plotly_chart(self):
        trace1 = go.Scatter(x=[1, 2, 3, 4], y=[16, 5, 11, 9])

        # Plotly 3.7 needs to read the config file at /home/.plotly when
        # creating an image. So let's mock that part of the Figure creation:
        with patch("plotly.offline.offline._get_jconfig") as mock:
            mock.return_value = {}
            fig = go.Figure(data=[trace1])

        res = util.is_plotly_chart(fig)
        self.assertTrue(res)

    def test_is_namedtuple(self):
        Boy = namedtuple("Boy", ("name", "age"))
        John = Boy("John", "29")

        res = util.is_namedtuple(John)
        self.assertTrue(res)

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
