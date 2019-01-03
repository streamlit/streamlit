# -*- coding: future_fstrings -*-

# Copyright 2018 Streamlit Inc. All rights reserved.

"""Config System Unittest."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import errno
import random
import unittest

import pytest

from mock import patch, mock_open

from streamlit import util
from streamlit.compatibility import running_py3


class UtilTest(unittest.TestCase):
    """Test Streamlit utility functions."""
    def setUp(self):
        self.patch1 = patch('streamlit.util.os.stat')
        self.os_stat = self.patch1.start()

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
        self.assertEquals('test string.', util._decode_ascii(b'test string.'))

    @patch('streamlit.util.open', mock_open(read_data="data"))
    def test_streamlit_read(self):
        """Test streamlit.util.streamlit.read."""
        with util.streamlit_read('/some/cache/file') as input:
            data = input.read()
        self.assertEquals('data', data)

    @patch('streamlit.util.open', mock_open(read_data=b'\xaa\xbb'))
    def test_streamlit_read_binary(self):
        """Test streamlit.util.streamlit.read."""
        with util.streamlit_read('/some/cache/file', binary=True) as input:
            data = input.read()
        self.assertEquals(b'\xaa\xbb', data)

    @patch('streamlit.util.open', mock_open(read_data="data"))
    def test_streamlit_read_zero_bytes(self):
        """Test streamlit.util.streamlit.read."""
        self.os_stat.return_value.st_size = 0
        with pytest.raises(util.Error) as e:
            with util.streamlit_read('/some/cache/file') as input:
                data = input.read()
        self.assertEquals(str(e.value), 'Read zero byte file: "/some/cache/file"')

    def test_streamlit_write(self):
        """Test streamlit.util.streamlit.write."""
        with patch('streamlit.util.open', mock_open()) as p:
            with util.streamlit_write('/some/cache/file') as output:
                output.write('some data')
            p().write.assert_called_once_with('some data')

    def test_streamlit_write_exception(self):
        """Test streamlit.util.streamlit.write."""
        with patch('streamlit.util.open', mock_open()) as p, \
             patch('streamlit.util.platform.system') as system:
            system.return_value = 'Darwin'
            p.side_effect=OSError(errno.EINVAL, '[Errno 22] Invalid argument')
            with pytest.raises(util.Error) as e:
                with util.streamlit_write('/some/cache/file') as output:
                    output.write('some data')
            error_msg = (
                'Unable to write file: /some/cache/file\n'
                'Python is limited to files below 2GB on OSX. '
                'See https://bugs.python.org/issue24658'
            )
            self.assertEquals(str(e.value), error_msg)
