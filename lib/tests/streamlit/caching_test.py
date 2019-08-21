# Copyright 2019 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

"""st.caching unit tests."""

import unittest
from mock import patch

import streamlit as st
from streamlit.caching import _build_args_mutated_message


class CacheTest(unittest.TestCase):
    @patch.object(st, 'warning')
    def test_args(self, warning):
        called = [False]

        @st.cache
        def f(x):
            called[0] = True
            return x

        self.assertFalse(called[0])
        f(0)

        self.assertTrue(called[0])

        called = [False]  # Reset called

        f(0)
        self.assertFalse(called[0])

        f(1)
        self.assertTrue(called[0])

        warning.assert_not_called()

    @patch.object(st, 'warning')
    def test_modify_args(self, warning):
        @st.cache
        def f(x):
            x[0] = 2

        warning.assert_not_called()

        f([1, 2])

        warning.assert_called_with(_build_args_mutated_message(f))
