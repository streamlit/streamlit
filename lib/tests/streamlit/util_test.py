# -*- coding: future_fstrings -*-

# Copyright 2018 Streamlit Inc. All rights reserved.

"""Config System Unittest."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import unittest
import random

from streamlit import util


class UtilTest(unittest.TestCase):
    """Test Streamlit utility functions."""

    def test_memoization(self):
        """Test that util.memoize works."""
        non_memoized_func = lambda: random.randint(0, 1000000)
        yes_memoized_func = util.memoize(non_memoized_func)
        self.assertNotEqual(non_memoized_func(), non_memoized_func())
        self.assertEqual(yes_memoized_func(), yes_memoized_func())
