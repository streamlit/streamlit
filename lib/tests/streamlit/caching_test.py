# Copyright 2019 Streamlit Inc. All rights reserved.

"""st.cache unit tests."""

import hashlib
import sys
import unittest

import streamlit as st


def get_hash(f):
    hasher = hashlib.new('md5')
    st.caching._hash_object(f, hasher)
    return hasher.hexdigest()


class HashTest(unittest.TestCase):
    def test_int(self):
        self.assertEqual(get_hash(145757624235), get_hash(145757624235))
        self.assertNotEqual(get_hash(10), get_hash(11))

    def test_float(self):
        self.assertEqual(get_hash(0.1), get_hash(0.1))
        self.assertNotEqual(get_hash(23.5234), get_hash(23.5235))

    def test_none_bool(self):
        self.assertEqual(get_hash(True), get_hash(True))
        self.assertNotEqual(get_hash(True), get_hash(False))
