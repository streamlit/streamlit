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
        self.assertEqual("1 2\n", string_buffer.getvalue())

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
        self.assertEqual(open.__module__, "_io")
