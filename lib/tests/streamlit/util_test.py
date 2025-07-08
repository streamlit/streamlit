# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

from __future__ import annotations

import random
import unittest

from streamlit import util


class UtilTest(unittest.TestCase):
    """Test Streamlit utility functions."""

    def test_memoization(self):
        """Test that util.memoize works."""

        def non_memoized_func():
            return random.randint(0, 1000000)

        yes_memoized_func = util.memoize(non_memoized_func)
        assert non_memoized_func() != non_memoized_func()
        assert yes_memoized_func() == yes_memoized_func()

    def test_functools_wraps(self):
        """Test wrap for functools.wraps"""

        import streamlit as st

        @st.cache_data
        def f():
            return True

        assert hasattr(f, "__wrapped__")

    def test_calc_md5_can_handle_bytes_and_strings(self):
        assert util.calc_md5("eventually bytes") == util.calc_md5(b"eventually bytes")
