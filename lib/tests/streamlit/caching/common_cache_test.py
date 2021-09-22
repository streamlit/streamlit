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

"""Tests that are common to both st.memo and st.singleton"""
import unittest

from parameterized import parameterized
import streamlit as st


class CommonCacheTest(unittest.TestCase):
    @parameterized.expand([(st.experimental_memo, ), (st.experimental_singleton,)])
    def test_simple(self, cache_decorator):
        @cache_decorator
        def foo():
            return 42

        self.assertEqual(foo(), 42)
        self.assertEqual(foo(), 42)
