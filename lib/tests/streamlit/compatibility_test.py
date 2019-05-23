# Copyright 2018 Streamlit Inc. All rights reserved.

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims, is_running_py3
setup_2_3_shims(globals())

import unittest


class CompatibilityTest(unittest.TestCase):
    def test_print_function(self):
        if is_running_py3:
            return
        from io import BytesIO
        string_buffer = BytesIO()
        print(1, 2, file=string_buffer)
        self.assertEqual('1 2\n', string_buffer.getvalue())

    def test_builtin_types(self):
        if is_running_py3:
            return
        import itertools
        import future.types
        self.assertEqual(range, future.types.newrange)
        self.assertEqual(map, itertools.imap)
        self.assertEqual(str, future.types.newstr)
        self.assertEqual(dict, future.types.newdict)
        self.assertEqual(object, future.types.newobject)
        self.assertEqual(zip, itertools.izip)
        self.assertEqual(int, future.types.newint)
        self.assertEqual(open.__module__, '_io')
