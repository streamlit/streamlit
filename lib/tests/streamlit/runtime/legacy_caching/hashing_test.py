# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

"""st.hashing unit tests."""

import functools
import hashlib
import os
import re
import socket
import tempfile
import time
import types
import unittest
import urllib
from io import BytesIO, StringIO
from unittest.mock import MagicMock, Mock, patch

import altair.vegalite.v3
import cffi
import numpy as np
import pandas as pd
import pytest
import sqlalchemy as db
from parameterized import parameterized

try:
    import keras
    import tensorflow as tf
    import torch
    import torchvision

    HAS_TENSORFLOW = True
except ImportError:
    HAS_TENSORFLOW = False


import streamlit as st
from streamlit.runtime.legacy_caching.hashing import (
    _FFI_TYPE_NAMES,
    _NP_SIZE_LARGE,
    _PANDAS_ROWS_LARGE,
    InternalHashError,
    UnhashableTypeError,
    UserHashError,
    _CodeHasher,
)
from streamlit.runtime.uploaded_file_manager import UploadedFile, UploadedFileRec
from streamlit.type_util import get_fqn_type, is_type

get_main_script_director = MagicMock(return_value=os.getcwd())

# Get code hasher and mock the main script directory.
def get_hash(f, context=None, hash_funcs=None):
    hasher = hashlib.new("md5")
    ch = _CodeHasher(hash_funcs=hash_funcs)
    ch._get_main_script_directory = MagicMock()
    ch._get_main_script_directory.return_value = os.getcwd()
    ch.update(hasher, f, context)
    return hasher.digest()


# Helper function to hash an engine
def hash_engine(*args, **kwargs):
    return get_hash(db.create_engine(*args, **kwargs))


class HashTest(unittest.TestCase):
    def test_string(self):
        self.assertEqual(get_hash("hello"), get_hash("hello"))
        self.assertNotEqual(get_hash("hello"), get_hash("hellö"))

    def test_int(self):
        self.assertEqual(get_hash(145757624235), get_hash(145757624235))
        self.assertNotEqual(get_hash(10), get_hash(11))
        self.assertNotEqual(get_hash(-1), get_hash(1))
        self.assertNotEqual(get_hash(2**7), get_hash(2**7 - 1))
        self.assertNotEqual(get_hash(2**7), get_hash(2**7 + 1))

    def test_mocks_do_not_result_in_infinite_recursion(self):
        try:
            get_hash(Mock())
            get_hash(MagicMock())
        except InternalHashError:
            self.fail("get_hash raised InternalHashError")

    def test_list(self):
        self.assertEqual(get_hash([1, 2]), get_hash([1, 2]))
        self.assertNotEqual(get_hash([1, 2]), get_hash([2, 2]))
        self.assertNotEqual(get_hash([1]), get_hash(1))

        # test that we can hash self-referencing lists
        a = [1, 2, 3]
        a.append(a)
        b = [1, 2, 3]
        b.append(b)
        self.assertEqual(get_hash(a), get_hash(b))

    def test_recursive_hash_func(self):
        def hash_int(x):
            return x

        @st.cache(hash_funcs={int: hash_int})
        def foo(x):
            return x

        self.assertEqual(foo(1), foo(1))
        # Note: We're able to break the recursive cycle caused by the identity
        # hash func but it causes all cycles to hash to the same thing.
        # https://github.com/streamlit/streamlit/issues/1659
        # self.assertNotEqual(foo(2), foo(1))

    def test_tuple(self):
        self.assertEqual(get_hash((1, 2)), get_hash((1, 2)))
        self.assertNotEqual(get_hash((1, 2)), get_hash((2, 2)))
        self.assertNotEqual(get_hash((1,)), get_hash(1))
        self.assertNotEqual(get_hash((1,)), get_hash([1]))

    def test_mappingproxy(self):
        a = types.MappingProxyType({"a": 1})
        b = types.MappingProxyType({"a": 1})
        c = types.MappingProxyType({"c": 1})

        self.assertEqual(get_hash(a), get_hash(b))
        self.assertNotEqual(get_hash(a), get_hash(c))

    def test_dict_items(self):
        a = types.MappingProxyType({"a": 1}).items()
        b = types.MappingProxyType({"a": 1}).items()
        c = types.MappingProxyType({"c": 1}).items()

        assert is_type(a, "builtins.dict_items")
        self.assertEqual(get_hash(a), get_hash(b))
        self.assertNotEqual(get_hash(a), get_hash(c))

    def test_getset_descriptor(self):
        class A:
            x = 1

        class B:
            x = 1

        a = A.__dict__["__dict__"]
        b = B.__dict__["__dict__"]
        assert is_type(a, "builtins.getset_descriptor")

        self.assertEqual(get_hash(a), get_hash(a))
        self.assertNotEqual(get_hash(a), get_hash(b))

    def test_dict(self):
        dict_gen = {1: (x for x in range(1))}

        self.assertEqual(get_hash({1: 1}), get_hash({1: 1}))
        self.assertNotEqual(get_hash({1: 1}), get_hash({1: 2}))
        self.assertNotEqual(get_hash({1: 1}), get_hash([(1, 1)]))

        with self.assertRaises(UnhashableTypeError):
            get_hash(dict_gen)
        get_hash(dict_gen, hash_funcs={types.GeneratorType: id})

    def test_self_reference_dict(self):
        d1 = {"cat": "hat"}
        d2 = {"things": [1, 2]}

        self.assertEqual(get_hash(d1), get_hash(d1))
        self.assertNotEqual(get_hash(d1), get_hash(d2))

        # test that we can hash self-referencing dictionaries
        d2 = {"book": d1}
        self.assertNotEqual(get_hash(d2), get_hash(d1))

    def test_reduce_(self):
        class A(object):
            def __init__(self):
                self.x = [1, 2, 3]

        class B(object):
            def __init__(self):
                self.x = [1, 2, 3]

        class C(object):
            def __init__(self):
                self.x = (x for x in range(1))

        self.assertEqual(get_hash(A()), get_hash(A()))
        self.assertNotEqual(get_hash(A()), get_hash(B()))
        self.assertNotEqual(get_hash(A()), get_hash(A().__reduce__()))

        with self.assertRaises(UnhashableTypeError):
            get_hash(C())
        get_hash(C(), hash_funcs={types.GeneratorType: id})

    def test_generator(self):
        with self.assertRaises(UnhashableTypeError):
            get_hash((x for x in range(1)))

    def test_hashing_broken_code(self):
        import datetime

        def a():
            return datetime.strptime("%H")

        def b():
            x = datetime.strptime("%H")
            ""
            ""
            return x

        data = [
            (a, '```\nreturn datetime.strptime("%H")\n```'),
            (b, '```\nx = datetime.strptime("%H")\n""\n""\n```'),
        ]

        for func, code_msg in data:
            exc_msg = "module 'datetime' has no attribute 'strptime'"

            with self.assertRaises(UserHashError) as ctx:
                get_hash(func)

            exc = str(ctx.exception)
            self.assertEqual(exc.find(exc_msg) >= 0, True)
            self.assertNotEqual(re.search(r"a bug in `.+` near line `\d+`", exc), None)
            self.assertEqual(exc.find(code_msg) >= 0, True)

    def test_hash_funcs_acceptable_keys(self):
        class C(object):
            def __init__(self):
                self.x = (x for x in range(1))

        with self.assertRaises(UnhashableTypeError):
            get_hash(C())

        self.assertEqual(
            get_hash(C(), hash_funcs={types.GeneratorType: id}),
            get_hash(C(), hash_funcs={"builtins.generator": id}),
        )

    def test_hash_funcs_error(self):
        with self.assertRaises(UserHashError):
            get_hash(1, hash_funcs={int: lambda x: "a" + x})

    def test_internal_hashing_error(self):
        def side_effect(i):
            if i == 123456789:
                return "a" + 1
            return i.to_bytes((i.bit_length() + 8) // 8, "little", signed=True)

        with self.assertRaises(InternalHashError):
            with patch(
                "streamlit.runtime.legacy_caching.hashing._int_to_bytes",
                side_effect=side_effect,
            ):
                get_hash(123456789)

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

    def test_regex(self):
        p2 = re.compile(".*")
        p1 = re.compile(".*")
        p3 = re.compile(".*", re.I)
        self.assertEqual(get_hash(p1), get_hash(p2))
        self.assertNotEqual(get_hash(p1), get_hash(p3))

    def test_pandas_dataframe(self):
        df1 = pd.DataFrame({"foo": [12]})
        df2 = pd.DataFrame({"foo": [42]})
        df3 = pd.DataFrame({"foo": [12]})

        self.assertEqual(get_hash(df1), get_hash(df3))
        self.assertNotEqual(get_hash(df1), get_hash(df2))

        df4 = pd.DataFrame(np.zeros((_PANDAS_ROWS_LARGE, 4)), columns=list("ABCD"))
        df5 = pd.DataFrame(np.zeros((_PANDAS_ROWS_LARGE, 4)), columns=list("ABCD"))

        self.assertEqual(get_hash(df4), get_hash(df5))

    def test_pandas_series(self):
        series1 = pd.Series([1, 2])
        series2 = pd.Series([1, 3])
        series3 = pd.Series([1, 2])

        self.assertEqual(get_hash(series1), get_hash(series3))
        self.assertNotEqual(get_hash(series1), get_hash(series2))

        series4 = pd.Series(range(_PANDAS_ROWS_LARGE))
        series5 = pd.Series(range(_PANDAS_ROWS_LARGE))

        self.assertEqual(get_hash(series4), get_hash(series5))

    def test_numpy(self):
        np1 = np.zeros(10)
        np2 = np.zeros(11)
        np3 = np.zeros(10)

        self.assertEqual(get_hash(np1), get_hash(np3))
        self.assertNotEqual(get_hash(np1), get_hash(np2))

        np4 = np.zeros(_NP_SIZE_LARGE)
        np5 = np.zeros(_NP_SIZE_LARGE)

        self.assertEqual(get_hash(np4), get_hash(np5))

    @parameterized.expand(
        [
            (BytesIO, b"123", b"456", b"123"),
            (StringIO, "123", "456", "123"),
            (
                UploadedFile,
                UploadedFileRec("id", "name", "type", b"123"),
                UploadedFileRec("id", "name", "type", b"456"),
                UploadedFileRec("id", "name", "type", b"123"),
            ),
        ]
    )
    def test_io(self, io_type, io_data1, io_data2, io_data3):
        io1 = io_type(io_data1)
        io2 = io_type(io_data2)
        io3 = io_type(io_data3)

        self.assertEqual(get_hash(io1), get_hash(io3))
        self.assertNotEqual(get_hash(io1), get_hash(io2))

        # Changing the stream position should change the hash
        io1.seek(1)
        io3.seek(0)
        self.assertNotEqual(get_hash(io1), get_hash(io3))

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

    @unittest.skipIf(not HAS_TENSORFLOW, "Tensorflow not installed")
    def test_keras_model(self):
        a = keras.applications.vgg16.VGG16(include_top=False, weights=None)
        b = keras.applications.vgg16.VGG16(include_top=False, weights=None)

        # This test still passes if we remove the default hash func for Keras
        # models. Ideally we'd seed the weights before creating the models
        # but not clear how to do so.
        self.assertEqual(get_hash(a), get_hash(a))
        self.assertNotEqual(get_hash(a), get_hash(b))

    @unittest.skipIf(not HAS_TENSORFLOW, "Tensorflow not installed")
    def test_tf_keras_model(self):
        a = tf.keras.applications.vgg16.VGG16(include_top=False, weights=None)
        b = tf.keras.applications.vgg16.VGG16(include_top=False, weights=None)

        self.assertEqual(get_hash(a), get_hash(a))
        self.assertNotEqual(get_hash(a), get_hash(b))

    @unittest.skipIf(not HAS_TENSORFLOW, "Tensorflow not installed")
    def test_tf_saved_model(self):
        tempdir = tempfile.TemporaryDirectory()

        model = tf.keras.models.Sequential(
            [
                tf.keras.layers.Dense(512, activation="relu", input_shape=(784,)),
            ]
        )
        model.save(tempdir.name)

        a = tf.saved_model.load(tempdir.name)
        b = tf.saved_model.load(tempdir.name)

        self.assertEqual(get_hash(a), get_hash(a))
        self.assertNotEqual(get_hash(a), get_hash(b))

    @unittest.skipIf(not HAS_TENSORFLOW, "Tensorflow not installed")
    def test_pytorch_model(self):
        a = torchvision.models.resnet.resnet18()
        b = torchvision.models.resnet.resnet18()

        self.assertEqual(get_hash(a), get_hash(a))
        self.assertNotEqual(get_hash(a), get_hash(b))

    def test_socket(self):
        a = socket.socket()
        b = socket.socket()

        self.assertEqual(get_hash(a), get_hash(a))
        self.assertNotEqual(get_hash(a), get_hash(b))

    def test_magic_mock(self):
        """Test that MagicMocks never hash to the same thing."""
        # (This also tests that MagicMock can hash at all, without blowing the
        # stack due to an infinite recursion.)
        self.assertNotEqual(get_hash(MagicMock()), get_hash(MagicMock()))

    @unittest.skipIf(not HAS_TENSORFLOW, "Tensorflow not installed")
    def test_tensorflow_session(self):
        tf_config = tf.compat.v1.ConfigProto()
        tf_session = tf.compat.v1.Session(config=tf_config)
        self.assertEqual(get_hash(tf_session), get_hash(tf_session))

        tf_session2 = tf.compat.v1.Session(config=tf_config)
        self.assertNotEqual(get_hash(tf_session), get_hash(tf_session2))

    @unittest.skipIf(not HAS_TENSORFLOW, "Tensorflow not installed")
    def test_torch_c_tensorbase(self):
        a = torch.ones([1, 1]).__reduce__()[1][2]
        b = torch.ones([1, 1], requires_grad=True).__reduce__()[1][2]
        c = torch.ones([1, 2]).__reduce__()[1][2]

        assert is_type(a, "torch._C._TensorBase")
        self.assertEqual(get_hash(a), get_hash(b))
        self.assertNotEqual(get_hash(a), get_hash(c))

        b.mean().backward()
        # Calling backward on a tensorbase doesn't seem to affect the gradient
        self.assertEqual(get_hash(a), get_hash(b))

    @unittest.skipIf(not HAS_TENSORFLOW, "Tensorflow not installed")
    def test_torch_tensor(self):
        a = torch.ones([1, 1])
        b = torch.ones([1, 1], requires_grad=True)
        c = torch.ones([1, 2])

        self.assertEqual(get_hash(a), get_hash(b))
        self.assertNotEqual(get_hash(a), get_hash(c))

        b.mean().backward()

        self.assertNotEqual(get_hash(a), get_hash(b))

    def test_non_hashable(self):
        """Test user provided hash functions."""

        g = (x for x in range(1))

        # Unhashable object raises an error
        with self.assertRaises(UnhashableTypeError):
            get_hash(g)

        id_hash_func = {types.GeneratorType: id}

        self.assertEqual(
            get_hash(g, hash_funcs=id_hash_func),
            get_hash(g, hash_funcs=id_hash_func),
        )

        unique_hash_func = {types.GeneratorType: lambda x: time.time()}

        self.assertNotEqual(
            get_hash(g, hash_funcs=unique_hash_func),
            get_hash(g, hash_funcs=unique_hash_func),
        )

    def test_override_streamlit_hash_func(self):
        """Test that a user provided hash function has priority over a streamlit one."""

        hash_funcs = {int: lambda x: "hello"}
        self.assertNotEqual(get_hash(1), get_hash(1, hash_funcs=hash_funcs))

    def _build_cffi(self, name):
        ffibuilder = cffi.FFI()
        ffibuilder.set_source(
            "cffi_bin._%s" % name,
            r"""
                static int %s(int x)
                {
                    return x + "A";
                }
            """
            % name,
        )

        ffibuilder.cdef("int %s(int);" % name)
        ffibuilder.compile(verbose=True)

    def test_compiled_ffi(self):
        self._build_cffi("foo")
        self._build_cffi("bar")
        from cffi_bin._bar import ffi as bar
        from cffi_bin._foo import ffi as foo

        # Note: We've verified that all properties on CompiledFFI objects
        # are global, except have not verified `error` either way.
        self.assertIn(get_fqn_type(foo), _FFI_TYPE_NAMES)
        self.assertEqual(get_hash(foo), get_hash(bar))

    @pytest.mark.filterwarnings("ignore:No driver name specified")
    def test_sqlite_sqlalchemy_engine(self):
        """Separate tests for sqlite since it uses a file based
        and in memory database and has no auth
        """

        mem = "sqlite://"
        foo = "sqlite:///foo.db"

        self.assertEqual(hash_engine(mem), hash_engine(mem))
        self.assertEqual(hash_engine(foo), hash_engine(foo))
        self.assertNotEqual(hash_engine(foo), hash_engine("sqlite:///bar.db"))
        self.assertNotEqual(hash_engine(foo), hash_engine(mem))

        # Need to use absolute paths otherwise one path resolves
        # relatively and the other absolute
        self.assertEqual(
            hash_engine("sqlite:////foo.db", connect_args={"uri": True}),
            hash_engine("sqlite:////foo.db?uri=true"),
        )

        self.assertNotEqual(
            hash_engine(foo, connect_args={"uri": True}),
            hash_engine(foo, connect_args={"uri": False}),
        )

        self.assertNotEqual(
            hash_engine(foo, creator=lambda: False),
            hash_engine(foo, creator=lambda: True),
        )

    @pytest.mark.filterwarnings("ignore:No driver name specified")
    def test_mssql_sqlalchemy_engine(self):
        """Specialized tests for mssql since it uses a different way of
        passing connection arguments to the engine
        """

        url = "mssql:///?odbc_connect"
        auth_url = "mssql://foo:pass@localhost/db"

        params_foo = urllib.parse.quote_plus(
            "Server=localhost;Database=db;UID=foo;PWD=pass"
        )
        params_bar = urllib.parse.quote_plus(
            "Server=localhost;Database=db;UID=bar;PWD=pass"
        )
        params_foo_caps = urllib.parse.quote_plus(
            "SERVER=localhost;Database=db;UID=foo;PWD=pass"
        )
        params_foo_order = urllib.parse.quote_plus(
            "Database=db;Server=localhost;UID=foo;PWD=pass"
        )

        self.assertEqual(
            hash_engine(auth_url),
            hash_engine("%s=%s" % (url, params_foo)),
        )
        self.assertNotEqual(
            hash_engine("%s=%s" % (url, params_foo)),
            hash_engine("%s=%s" % (url, params_bar)),
        )

        # Note: False negative because the ordering of the keys affects
        # the hash
        self.assertNotEqual(
            hash_engine("%s=%s" % (url, params_foo)),
            hash_engine("%s=%s" % (url, params_foo_order)),
        )

        # Note: False negative because the keys are case insensitive
        self.assertNotEqual(
            hash_engine("%s=%s" % (url, params_foo)),
            hash_engine("%s=%s" % (url, params_foo_caps)),
        )

        # Note: False negative because `connect_args` doesn't affect the
        # connection string
        self.assertNotEqual(
            hash_engine(url, connect_args={"user": "foo"}),
            hash_engine(url, connect_args={"user": "bar"}),
        )

    @parameterized.expand(
        [
            ("postgresql", "password"),
            ("mysql", "passwd"),
            ("oracle", "password"),
            ("mssql", "password"),
        ]
    )
    @pytest.mark.filterwarnings("ignore:No driver name specified")
    def test_sqlalchemy_engine(self, dialect, password_key):
        def connect():
            pass

        url = "%s://localhost/db" % dialect
        auth_url = "%s://user:pass@localhost/db" % dialect

        self.assertEqual(hash_engine(url), hash_engine(url))
        self.assertEqual(
            hash_engine(auth_url, creator=connect),
            hash_engine(auth_url, creator=connect),
        )

        # Note: Hashing an engine with a creator can only be equal to the hash of another
        # engine with a creator, even if the underlying connection arguments are the same
        self.assertNotEqual(hash_engine(url), hash_engine(url, creator=connect))

        self.assertNotEqual(hash_engine(url), hash_engine(auth_url))
        self.assertNotEqual(
            hash_engine(url, encoding="utf-8"), hash_engine(url, encoding="ascii")
        )
        self.assertNotEqual(
            hash_engine(url, creator=connect), hash_engine(url, creator=lambda: True)
        )

        # mssql doesn't use `connect_args`
        if dialect != "mssql":
            self.assertEqual(
                hash_engine(auth_url),
                hash_engine(url, connect_args={"user": "user", password_key: "pass"}),
            )

            self.assertNotEqual(
                hash_engine(url, connect_args={"user": "foo"}),
                hash_engine(url, connect_args={"user": "bar"}),
            )


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

        # NB: If a future vegalite update removes the v3 API, these functions
        # will need to be updated!

        def call_altair_concat():
            return altair.vegalite.v4.api.concat()

        def call_altair_layer():
            return altair.vegalite.v4.api.layer()

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
        """Test hash for classes if we call different functions."""

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
                return v**x

            return func

        def g(x):
            def func(v):
                return v * x

            return func

        def h(x):
            def func(v):
                return v**x

            return func

        self.assertNotEqual(get_hash(f), get_hash(g))
        # TODO: Enable test. f and h are not the same since the co_consts
        # contains the name of the function in the closure.
        # self.assertEqual(get_hash(f), get_hash(h))

    def test_non_hashable(self):
        """Test the hash of functions that return non hashable objects."""

        gen = (x for x in range(1))

        def f(x):
            return gen

        def g(y):
            return gen

        with self.assertRaises(UnhashableTypeError):
            get_hash(gen)

        hash_funcs = {types.GeneratorType: id}

        self.assertEqual(
            get_hash(f, hash_funcs=hash_funcs), get_hash(g, hash_funcs=hash_funcs)
        )

    def test_ufunc(self):
        """Test code that references numpy ufuncs."""

        def f(a, b):
            return np.logical_and(a, b)

        def g(a, b):
            return np.logical_and(a, b)

        def h(a, b):
            return np.remainder(a, b)

        self.assertNotEqual(get_hash(np.remainder), get_hash(np.logical_and))
        self.assertEqual(get_hash(f), get_hash(g))
        self.assertNotEqual(get_hash(f), get_hash(h))


class MainScriptDirectoryDetectionTest(unittest.TestCase):

    relative_path = "app.py"
    abs_path = "/path/to/app.py"

    @patch("__main__.__file__", relative_path)
    def test_relative_main_file(self):
        """Test that we get abs dir path when __main__.__file__ is script file name only."""

        ch = _CodeHasher()

        # We don't want empty string returned:
        self.assertNotEqual(ch._get_main_script_directory(), "")

        # During testing, __main__.__file__ has not modified so we expect current
        # working dir:
        self.assertEqual(ch._get_main_script_directory(), os.getcwd())

    @patch("__main__.__file__", abs_path)
    def test_absolute_main_file(self):
        """Test that we get abs dir path when __main__.__file__ relative path."""

        import pathlib

        ch = _CodeHasher()

        # When __main__.__file__ is absolute path to script, we expect parent dir to be
        # returned:
        self.assertEqual(
            ch._get_main_script_directory(), str(pathlib.Path(self.abs_path).parent)
        )
