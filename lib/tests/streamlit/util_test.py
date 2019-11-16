# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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

import random
import unittest

from streamlit import util


class UtilTest(unittest.TestCase):
    """Test Streamlit utility functions."""

    def test_memoization(self):
        """Test that util.memoize works."""
        non_memoized_func = lambda: random.randint(0, 1000000)
        yes_memoized_func = util.memoize(non_memoized_func)
        self.assertNotEqual(non_memoized_func(), non_memoized_func())
        self.assertEqual(yes_memoized_func(), yes_memoized_func())
