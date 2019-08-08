# Copyright 2019 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

"""st.caching unit tests."""

import unittest

import streamlit as st


class CacheTest(unittest.TestCase):
    def test_simple(self):
        @st.cache
        def foo():
            return 42

        self.assertEqual(foo(), 42)
        self.assertEqual(foo(), 42)


class RunOnceTest(unittest.TestCase):
    def test_simple(self):
        for _ in range(2):
            c = st.run_once()
            if c:
                c.value = 42

            self.assertEqual(c.value, 42)
