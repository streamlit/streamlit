# Copyright 2018-2020 Streamlit Inc.
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

from mock import patch, mock_open
import unittest

from streamlit.watcher import util


class UtilTest(unittest.TestCase):
    def test_md5_calculation_succeeds_with_bytes_input(self):
        with patch("streamlit.watcher.util.open", mock_open(read_data=b"hello")) as m:
            md5 = util.calc_md5_with_blocking_retries("foo")
            self.assertEqual(md5, "5d41402abc4b2a76b9719d911017c592")

    def test_md5_calculation_opens_file_with_rb(self):
        # This tests implementation :( . But since the issue this is addressing
        # could easily come back to bite us if a distracted coder tweaks the
        # implementation, I'm putting this here anyway.
        with patch("streamlit.watcher.util.open", mock_open(read_data=b"hello")) as m:
            md5 = util.calc_md5_with_blocking_retries("foo")
            m.assert_called_once_with("foo", "rb")
