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

"""st.hashing unit tests."""

import functools
import sys
import tempfile
import unittest

import altair as alt
import numpy as np
import pandas as pd
import pytest
from mock import MagicMock

import streamlit as st
from streamlit.hashing import NP_SIZE_LARGE, PANDAS_ROWS_LARGE, get_hash


class HashTest(unittest.TestCase):
    def test_string(self):
        self.assertEqual(get_hash("hello"), get_hash("hello"))
        self.assertNotEqual(get_hash("hello"), get_hash("hellö"))

    def test_int(self):
        self.assertEqual(get_hash(145757624235), get_hash(145757624235))
        self.assertNotEqual(get_hash(10), get_hash(11))
        self.assertNotEqual(get_hash(-1), get_hash(1))
        self.assertNotEqual(get_hash(2 ** 7), get_hash(2 ** 7 - 1))
        self.assertNotEqual(get_hash(2 ** 7), get_hash(2 ** 7 + 1))

    def test_list(self):
        self.assertEqual([1, 2], [1, 2])
        self.assertNotEqual([1, 2], [2, 2])
        self.assertNotEqual([1], 1)

    def test_tuple(self):
        self.assertEqual((1, 2), (1, 2))
        self.assertNotEqual((1, 2), (2, 2))
        self.assertNotEqual((1,), 1)
        self.assertNotEqual((1,), [1])

    def test_float(self):
        self.assertEqual(get_hash(0.1), get_hash(0.1))
        self.assertNotEqual(get_hash(23.5234), get_hash(23.5235))

    def test_bool(self):
        self.assertEqual(get_hash(True), get_hash(True))
        self.assertNotEqual(get_hash(True), get_hash(False))

    def test_none(self):
        self.assertEqual(get_hash(None), get_hash(None))
        self.assertNotEqual(get_hash(None), get_hash(False))

    def test_builtins(self):
        self.assertEqual(get_hash(abs), get_hash(abs))
        self.assertNotEqual(get_hash(abs), get_hash(type))

    def test_pandas_dataframe(self):
        df1 = pd.DataFrame({"foo": [12]})
        df2 = pd.DataFrame({"foo": [42]})
        df3 = pd.DataFrame({"foo": [12]})

        self.assertEqual(get_hash(df1), get_hash(df3))
        self.assertNotEqual(get_hash(df1), get_hash(df2))

        df4 = pd.DataFrame(np.zeros((PANDAS_ROWS_LARGE, 4)), columns=list("ABCD"))
        df5 = pd.DataFrame(np.zeros((PANDAS_ROWS_LARGE, 4)), columns=list("ABCD"))

        self.assertEqual(get_hash(df4), get_hash(df5))

    def test_pandas_series(self):
        series1 = pd.Series([1, 2])
        series2 = pd.Series([1, 3])
        series3 = pd.Series([1, 2])

        self.assertEqual(get_hash(series1), get_hash(series3))
        self.assertNotEqual(get_hash(series1), get_hash(series2))

        series4 = pd.Series(range(PANDAS_ROWS_LARGE))
        series5 = pd.Series(range(PANDAS_ROWS_LARGE))

        self.assertEqual(get_hash(series4), get_hash(series5))

    def test_numpy(self):
        np1 = np.zeros(10)
        np2 = np.zeros(11)
        np3 = np.zeros(10)

        self.assertEqual(get_hash(np1), get_hash(np3))
        self.assertNotEqual(get_hash(np1), get_hash(np2))

        np4 = np.zeros(NP_SIZE_LARGE)
        np5 = np.zeros(NP_SIZE_LARGE)

        self.assertEqual(get_hash(np4), get_hash(np5))

    def test_partial(self):
        p1 = functools.partial(int, base=2)
        p2 = functools.partial(int, base=3)
        p3 = functools.partial(int, base=2)

        self.assertEqual(get_hash(p1), get_hash(p3))
        self.assertNotEqual(get_hash(p1), get_hash(p2))

    def test_lambdas(self):
        # self.assertEqual(get_hash(lambda x: x.lower()), get_hash(lambda x: x.lower()))
        self.assertNotEqual(
            get_hash(lambda x: x.lower()), get_hash(lambda x: x.upper())
        )

    def test_files(self):
        temp1 = tempfile.NamedTemporaryFile()
        temp2 = tempfile.NamedTemporaryFile()

        with open(__file__, "r") as f:
            with open(__file__, "r") as g:
                self.assertEqual(get_hash(f), get_hash(g))

            self.assertNotEqual(get_hash(f), get_hash(temp1))

        self.assertEqual(get_hash(temp1), get_hash(temp1))
        self.assertNotEqual(get_hash(temp1), get_hash(temp2))

    def test_file_position(self):
        with open(__file__, "r") as f:
            h1 = get_hash(f)
            self.assertEqual(h1, get_hash(f))
            f.readline()
            self.assertNotEqual(h1, get_hash(f))
            f.seek(0)
            self.assertEqual(h1, get_hash(f))

    def test_magic_mock(self):
        """Test that MagicMocks never hash to the same thing."""
        # (This also tests that MagicMock can hash at all, without blowing the
        # stack due to an infinite recursion.)
        self.assertNotEqual(get_hash(MagicMock()), get_hash(MagicMock()))


class CodeHashTest(unittest.TestCase):
    def test_simple(self):
        """Test the hash of simple functions."""

        def f(x):
            return x * x

        def g(x):
            return x + x

        def h(x):
            return x * x

        self.assertNotEqual(get_hash(f), get_hash(g))
        self.assertEqual(get_hash(f), get_hash(h))

    def test_rename(self):
        """Test the hash of function with renamed variables."""

        def f(x, y):
            return x + y

        def g(x, y):
            return y + x

        def h(y, x):
            return y + x

        self.assertNotEqual(get_hash(f), get_hash(g))
        self.assertEqual(get_hash(f), get_hash(h))

    def test_value(self):
        """Test the hash of functions with values."""

        def f():
            x = 42
            return x

        def g():
            x = 12
            return x

        def h():
            y = 42
            return y

        self.assertNotEqual(get_hash(f), get_hash(g))
        self.assertEqual(get_hash(f), get_hash(h))

    def test_defaults(self):
        """Test the hash of functions with defaults."""

        def f(x=42):
            return x

        def g(x=12):
            return x

        def h(x=42):
            return x

        self.assertNotEqual(get_hash(f), get_hash(g))
        self.assertEqual(get_hash(f), get_hash(h))

    def test_referenced(self):
        """Test the hash of functions that reference values."""

        x = 42
        y = 123

        def f():
            return x

        def g():
            return y

        def h():
            return x

        self.assertNotEqual(get_hash(f), get_hash(g))
        self.assertEqual(get_hash(f), get_hash(h))

    def test_referenced_referenced(self):
        """Test that we can follow references."""

        def hash_prog_1():
            x = 12

            def g():
                return x

            def f():
                return g()

            return get_hash(f)

        def hash_prog_2():
            x = 42

            def g():
                return x

            def f():
                return g()

            return get_hash(f)

        self.assertNotEqual(hash_prog_1(), hash_prog_2())

    def test_builtins(self):
        """Tes code with builtins."""

        def code_with_print():
            print(12)

        def code_with_type():
            type(12)

        self.assertNotEqual(get_hash(code_with_print), get_hash(code_with_type))

    def test_pandas_df(self):
        """Test code that references pandas dataframes."""

        def hash_prog_1():
            df = pd.DataFrame({"foo": [12]})

            def f():
                return df

            return get_hash(f)

        def hash_prog_2():
            df = pd.DataFrame({"foo": [42]})

            def f():
                return df

            return get_hash(f)

        def hash_prog_3():
            df = pd.DataFrame({"foo": [12]})

            def f():
                return df

            return get_hash(f)

        self.assertNotEqual(hash_prog_1(), hash_prog_2())
        self.assertEqual(hash_prog_1(), hash_prog_3())

    def test_lambdas(self):
        """Test code with different lambdas produces different hashes."""

        v42 = 42
        v123 = 123

        def f1():
            lambda x: v42

        def f2():
            lambda x: v123

        self.assertNotEqual(get_hash(f1), get_hash(f2))

    def test_lambdas_calls(self):
        """Test code with lambdas that call functions."""

        def f_lower():
            lambda x: x.lower()

        def f_upper():
            lambda x: x.upper()

        def f_lower2():
            lambda x: x.lower()

        self.assertNotEqual(get_hash(f_lower), get_hash(f_upper))
        self.assertEqual(get_hash(f_lower), get_hash(f_lower2))

    def test_dict_reference(self):
        """Test code with lambdas that call a dictionary."""

        a = {"foo": 42, "bar": {"baz": 12}}

        def f():
            return a["bar"]["baz"]

        def g():
            return a["foo"]

        def h():
            return a["bar"]["baz"]

        self.assertNotEqual(get_hash(f), get_hash(g))
        self.assertEqual(get_hash(f), get_hash(h))

    def test_external_module(self):
        """Test code that references an external module."""

        def call_altair_concat():
            return alt.vegalite.v3.api.concat()

        def call_altair_layer():
            return alt.vegalite.v3.api.layer()

        self.assertNotEqual(get_hash(call_altair_concat), get_hash(call_altair_layer))

    def test_import(self):
        """Test code that imports module."""

        def f():
            import numpy

            return numpy

        def g():
            import pandas

            return pandas

        def n():
            import foobar

            return foobar

        self.assertNotEqual(get_hash(f), get_hash(g))
        self.assertNotEqual(get_hash(f), get_hash(n))

    def test_class(self):
        """Test hash for classes is we call different functions."""

        x = 12
        y = 13

        class Foo:
            def get_x(self):
                return x

            def get_y(self):
                return y

        def hash_prog_1():
            o = Foo()

            def f():
                return o.get_x()

            return get_hash(f)

        def hash_prog_2():
            o = Foo()

            def f():
                return o.get_y()

            return get_hash(f)

        def hash_prog_3():
            o = Foo()

            def f():
                return o.get_x()

            return get_hash(f)

        self.assertNotEqual(hash_prog_1(), hash_prog_2())
        self.assertEqual(hash_prog_1(), hash_prog_3())

    @pytest.mark.skipif(sys.version_info < (3,), reason="Requires Python 3.")
    def test_class_referenced(self):
        """Test hash for classes with methods that reference values."""

        def hash_prog_1():
            class Foo:
                x = 12

                def get_x(self):
                    return self.x

            o = Foo()

            def f():
                return o.get_x()

            return get_hash(f)

        def hash_prog_2():
            class Foo:
                x = 42

                def get_x(self):
                    return self.x

            o = Foo()

            def f():
                return o.get_x()

            return get_hash(f)

        self.assertNotEqual(hash_prog_1(), hash_prog_2())

    def test_coref(self):
        """Test code that references itself."""

        def f(x):
            return f(x)

        def g(x):
            return g(x) + 1

        def h(x):
            return h(x)

        self.assertNotEqual(get_hash(f), get_hash(g))
        self.assertEqual(get_hash(f), get_hash(h))

    def test_multiple(self):
        """Test code that references multiple objects."""

        x = 12
        y = 13
        z = 14

        def f():
            return x + z

        def g():
            return y + z

        def h():
            return x + z

        self.assertNotEqual(get_hash(f), get_hash(g))
        self.assertEqual(get_hash(f), get_hash(h))

    def test_decorated(self):
        """Test decorated functions."""

        def do(func):
            @functools.wraps(func)
            def wrapper_do(*args, **kwargs):
                return func(*args, **kwargs)

            return wrapper_do

        @do
        def f():
            return 42

        @do
        def g():
            return 12

        @do
        def h():
            return 42

        self.assertNotEqual(get_hash(f), get_hash(g))
        self.assertEqual(get_hash(f), get_hash(h))

    def test_cached(self):
        """Test decorated functions."""

        @st.cache
        def f():
            return 42

        @st.cache
        def g():
            return 12

        @st.cache
        def h():
            return 42

        self.assertNotEqual(get_hash(f), get_hash(g))
        self.assertEqual(get_hash(f), get_hash(h))

    def test_streamlit(self):
        """Test hashing streamlit functions."""

        def f():
            st.write("Hello")

        def g():
            st.write("World")

        def h():
            st.write("Hello")

        self.assertNotEqual(get_hash(f), get_hash(g))
        self.assertEqual(get_hash(f), get_hash(h))

    def test_higher_order(self):
        """Test hashing higher order functions."""

        def f(x):
            def func(v):
                return v ** x

            return func

        def g(x):
            def func(v):
                return v * x

            return func

        def h(x):
            def func(v):
                return v ** x

            return func

        self.assertNotEqual(get_hash(f), get_hash(g))
        # TODO: Enable test. f and h are not the same since the co_consts
        # contains the name of the function in the closure.
        # self.assertEqual(get_hash(f), get_hash(h))
