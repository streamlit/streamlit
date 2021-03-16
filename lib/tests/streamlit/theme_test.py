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

from streamlit import config
from streamlit import theme

REQUIRED_THEME_OPTIONS = [
    "primaryColor",
    "backgroundColor",
    "secondaryBackgroundColor",
    "textColor",
]


class ThemeTest(unittest.TestCase):
    def test_check_theme_completeness_with_no_theme_set(self):
        theme_options = config.get_options_for_section("theme")
        for opt in REQUIRED_THEME_OPTIONS:
            theme_options[opt] = None
        self.assertEqual(
            theme.check_theme_completeness(theme_options),
            theme.ThemeCompleteness.NOT_DEFINED,
        )

    def test_check_theme_completeness_with_theme_fully_set(self):
        theme_options = config.get_options_for_section("theme")
        for opt in REQUIRED_THEME_OPTIONS:
            theme_options[opt] = "Test"
        self.assertEqual(
            theme.check_theme_completeness(theme_options),
            theme.ThemeCompleteness.FULLY_DEFINED,
        )

    def test_check_theme_completeness_with_partial_config(self):
        theme_options = config.get_options_for_section("theme")
        theme_options[REQUIRED_THEME_OPTIONS[0]] = "Test"

        self.assertEqual(
            theme.check_theme_completeness(theme_options),
            theme.ThemeCompleteness.PARTIALLY_DEFINED,
        )
