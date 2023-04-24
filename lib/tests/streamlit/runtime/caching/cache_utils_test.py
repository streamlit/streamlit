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

import math
import unittest
from datetime import timedelta
from typing import Any

from parameterized import parameterized

from streamlit.runtime.caching.cache_utils import ttl_to_seconds

NORMAL_PARAMS = [
    ("float", 3.5, 3.5),
    ("timedelta", timedelta(minutes=3), 60 * 3),
    ("str 1 arg", "1d", 24 * 60 * 60),
    ("str 2 args", "1d23h", 24 * 60 * 60 + 23 * 60 * 60),
    (
        "complex str 3 args",
        "1 day 23hr 45minutes",
        24 * 60 * 60 + 23 * 60 * 60 + 45 * 60,
    ),
    ("str 2 args with float", "1.5d23.5h", 1.5 * 24 * 60 * 60 + 23.5 * 60 * 60),
]


class CacheUtilsTest(unittest.TestCase):
    @parameterized.expand(
        [
            *NORMAL_PARAMS,
            ("None", None, math.inf),
        ]
    )
    def test_ttl_to_seconds_coerced(self, _, input_value: Any, expected_seconds: float):
        """Test the various types of input that ttl_to_seconds accepts."""
        self.assertEqual(expected_seconds, ttl_to_seconds(input_value))

    @parameterized.expand(
        [
            *NORMAL_PARAMS,
            ("None", None, None),
        ]
    )
    def test_ttl_to_seconds_not_coerced(
        self, _, input_value: Any, expected_seconds: float
    ):
        """Test the various types of input that ttl_to_seconds accepts."""
        self.assertEqual(
            expected_seconds, ttl_to_seconds(input_value, coerce_none_to_inf=False)
        )
