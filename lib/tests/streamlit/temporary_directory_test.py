# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import os
import unittest

from testfixtures import tempdir

from streamlit.temporary_directory import TemporaryDirectory


class TemporaryFileTest(unittest.TestCase):
    """Test temp directory context manager."""

    @tempdir()
    def test_temp_directory(self, dir):
        """Test that the directory only exists inside the context."""
        with TemporaryDirectory(dir=dir.path) as temp_fname:
            self.assertTrue(os.path.exists(temp_fname))
        self.assertFalse(os.path.exists(temp_fname))
