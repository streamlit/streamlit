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

import unittest

from streamlit.commands.set_option import set_option
from streamlit.config import get_option
from streamlit.errors import StreamlitAPIException


class SetOptionTest(unittest.TestCase):
    """Test st.set_option."""

    def test_set_option_scriptable(self):
        """Test that scriptable options can be set from API."""
        # This is set in lib/tests/conftest.py to off
        self.assertEqual(True, get_option("client.displayEnabled"))

        try:
            # client.displayEnabled and client.caching can be set after run starts.
            set_option("client.displayEnabled", False)
            self.assertEqual(False, get_option("client.displayEnabled"))
        finally:
            # Restore original value
            set_option("client.displayEnabled", True)

    def test_set_option_unscriptable(self):
        """Test that unscriptable options cannot be set with st.set_option."""
        # This is set in lib/tests/conftest.py to off
        self.assertEqual(True, get_option("server.enableCORS"))

        with self.assertRaises(StreamlitAPIException):
            set_option("server.enableCORS", False)
