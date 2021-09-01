# Copyright 2018-2021 Streamlit Inc.
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

import unittest

from streamlit import string_util


class StringUtilTest(unittest.TestCase):
    def test_decode_ascii(self):
        """Test streamlit.util.decode_ascii."""
        self.assertEqual("test string.", string_util.decode_ascii(b"test string."))

    def test_snake_case_to_camel_case(self):
        """Test streamlit.util.snake_case_to_camel_case."""
        self.assertEqual(
            "TestString.", string_util.snake_case_to_camel_case("test_string.")
        )

        self.assertEqual("Init", string_util.snake_case_to_camel_case("__init__"))

    def test_clean_filename(self):
        """Test streamlit.util.clean_filename."""
        self.assertEqual("test_result", string_util.clean_filename("test re*su/lt;"))

    def test_generate_download_filename_from_title(self):
        """Test streamlit.util.generate_download_filename_from_title."""

        self.assertTrue(
            string_util.generate_download_filename_from_title(
                "app · Streamlit"
            ).startswith("App")
        )

        self.assertTrue(
            string_util.generate_download_filename_from_title(
                "app · Streamlit"
            ).startswith("App")
        )

        self.assertTrue(
            string_util.generate_download_filename_from_title(
                "App title here"
            ).startswith("AppTitleHere")
        )

        self.assertTrue(
            string_util.generate_download_filename_from_title(
                "Аптека, улица, фонарь"
            ).startswith("АптекаУлицаФонарь")
        )
