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
from typing import Any, Dict

from parameterized import parameterized

from streamlit.elements.lib.dicttools import remove_none_values


class DictToolsTest(unittest.TestCase):
    @parameterized.expand(
        [
            ({}, {}),
            ({"a": 1, "b": 2}, {"a": 1, "b": 2}),
            ({"a": 1, "b": None}, {"a": 1}),
            ({"a": 1, "b": {"c": None}}, {"a": 1, "b": {}}),
            ({"a": 1, "b": {"c": 2}}, {"a": 1, "b": {"c": 2}}),
            ({"a": 1, "b": {"c": None, "d": 3}}, {"a": 1, "b": {"d": 3}}),
        ]
    )
    def test_remove_none_values(self, input: Dict[str, Any], expected: Dict[str, Any]):
        """Test remove_none_values."""

        self.assertEqual(
            remove_none_values(input),
            expected,
            f"Expected {input} to be transformed into {expected}.",
        )
