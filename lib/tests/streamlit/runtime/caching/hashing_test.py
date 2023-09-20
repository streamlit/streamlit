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

"""st.memo/singleton hashing tests."""
import datetime
import functools
import hashlib
import os
import re
import tempfile
import time
import types
import unittest
import uuid
from dataclasses import dataclass
from enum import Enum, auto
from io import BytesIO, StringIO
from unittest.mock import MagicMock, Mock

import cffi
import dateutil.tz
import numpy as np
import pandas
import pandas as pd
import tzlocal
from parameterized import parameterized
from PIL import Image

from streamlit.proto.Common_pb2 import FileURLs
from streamlit.runtime.caching import cache_data, cache_resource
from streamlit.runtime.caching.cache_errors import UnhashableTypeError
from streamlit.runtime.caching.cache_type import CacheType
from streamlit.runtime.caching.hashing import (
    _NP_SIZE_LARGE,
    _PANDAS_ROWS_LARGE,
    UserHashError,
    update_hash,
)
from streamlit.runtime.uploaded_file_manager import UploadedFile, UploadedFileRec
from streamlit.type_util import is_type

get_main_script_director = MagicMock(return_value=os.getcwd())


def get_hash(value, hash_funcs=None, cache_type=None):
    hasher = hashlib.new("md5")
    update_hash(
        value, hasher, cache_type=cache_type or MagicMock(), hash_funcs=hash_funcs
    )
    return hasher.digest()


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

    def test_uuid(self):
        uuid1 = uuid.uuid4()
        uuid1_copy = uuid.UUID(uuid1.hex)
        uuid2 = uuid.uuid4()

        # Our hashing functionality should work with UUIDs
        # regardless of UUID factory function.

        uuid3 = uuid.uuid5(uuid.NAMESPACE_DNS, "streamlit.io")
        uuid3_copy = uuid.UUID(uuid3.hex)
        uuid4 = uuid.uuid5(uuid.NAMESPACE_DNS, "snowflake.com")

        self.assertEqual(get_hash(uuid1), get_hash(uuid1_copy))
        self.assertNotEqual(id(uuid1), id(uuid1_copy))
        self.assertNotEqual(get_hash(uuid1), get_hash(uuid2))

        self.assertEqual(get_hash(uuid3), get_hash(uuid3_copy))
        self.assertNotEqual(id(uuid3), id(uuid3_copy))
        self.assertNotEqual(get_hash(uuid3), get_hash(uuid4))

    def test_datetime_naive(self):
        naive_datetime1 = datetime.datetime(2007, 12, 23, 15, 45, 55)
        naive_datetime1_copy = datetime.datetime(2007, 12, 23, 15, 45, 55)
        naive_datetime3 = datetime.datetime(2011, 12, 21, 15, 45, 55)

        self.assertEqual(get_hash(naive_datetime1), get_hash(naive_datetime1_copy))
        self.assertNotEqual(id(naive_datetime1), id(naive_datetime1_copy))
        self.assertNotEqual(get_hash(naive_datetime1), get_hash(naive_datetime3))

    @parameterized.expand(
        [
            datetime.timezone.utc,
            tzlocal.get_localzone(),
            dateutil.tz.gettz("America/Los_Angeles"),
            dateutil.tz.gettz("Europe/Berlin"),
            dateutil.tz.UTC,
        ]
    )
    def test_datetime_aware(self, tz_info):
        aware_datetime1 = datetime.datetime(2007, 12, 23, 15, 45, 55, tzinfo=tz_info)
        aware_datetime1_copy = datetime.datetime(
            2007, 12, 23, 15, 45, 55, tzinfo=tz_info
        )
        aware_datetime2 = datetime.datetime(2011, 12, 21, 15, 45, 55, tzinfo=tz_info)

        # naive datetime1 is the same datetime that aware_datetime,
        # but without timezone info. They should have different hashes.
        naive_datetime1 = datetime.datetime(2007, 12, 23, 15, 45, 55)

        self.assertEqual(get_hash(aware_datetime1), get_hash(aware_datetime1_copy))
        self.assertNotEqual(id(aware_datetime1), id(aware_datetime1_copy))
        self.assertNotEqual(get_hash(aware_datetime1), get_hash(aware_datetime2))
        self.assertNotEqual(get_hash(aware_datetime1), get_hash(naive_datetime1))

    @parameterized.expand(
        [
            "US/Pacific",
            "America/Los_Angeles",
            "Europe/Berlin",
            "UTC",
            None,  # check for naive too
        ]
    )
    def test_pandas_timestamp(self, tz_info):
        timestamp1 = pandas.Timestamp("2017-01-01T12", tz=tz_info)
        timestamp1_copy = pandas.Timestamp("2017-01-01T12", tz=tz_info)
        timestamp2 = pandas.Timestamp("2019-01-01T12", tz=tz_info)

        self.assertEqual(get_hash(timestamp1), get_hash(timestamp1_copy))
        self.assertNotEqual(id(timestamp1), id(timestamp1_copy))
        self.assertNotEqual(get_hash(timestamp1), get_hash(timestamp2))

    def test_mocks_do_not_result_in_infinite_recursion(self):
        try:
            get_hash(Mock())
            get_hash(MagicMock())
        except BaseException:
            self.fail("get_hash raised an exception")

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

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    def test_recursive_hash_func(self, _, cache_decorator):
        """Test that if user defined hash_func returns the value of the same type
        that hash_funcs tries to cache, we break the recursive cycle with predefined
        placeholder"""

        def hash_int(x):
            return x

        @cache_decorator(hash_funcs={int: hash_int})
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
        self.assertEqual(get_hash({1: 1}), get_hash({1: 1}))
        self.assertNotEqual(get_hash({1: 1}), get_hash({1: 2}))
        self.assertNotEqual(get_hash({1: 1}), get_hash([(1, 1)]))

        dict_gen = {1: (x for x in range(1))}
        with self.assertRaises(UnhashableTypeError):
            get_hash(dict_gen)

    def test_self_reference_dict(self):
        d1 = {"cat": "hat"}
        d2 = {"things": [1, 2]}

        self.assertEqual(get_hash(d1), get_hash(d1))
        self.assertNotEqual(get_hash(d1), get_hash(d2))

        # test that we can hash self-referencing dictionaries
        d2 = {"book": d1}
        self.assertNotEqual(get_hash(d2), get_hash(d1))

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

    def test_pandas_large_dataframe(self):

        df1 = pd.DataFrame(np.zeros((_PANDAS_ROWS_LARGE, 4)), columns=list("ABCD"))
        df2 = pd.DataFrame(np.ones((_PANDAS_ROWS_LARGE, 4)), columns=list("ABCD"))
        df3 = pd.DataFrame(np.zeros((_PANDAS_ROWS_LARGE, 4)), columns=list("ABCD"))

        self.assertEqual(get_hash(df1), get_hash(df3))
        self.assertNotEqual(get_hash(df1), get_hash(df2))

    @parameterized.expand(
        [
            (pd.DataFrame({"foo": [12]}), pd.DataFrame({"foo": [12]}), True),
            (pd.DataFrame({"foo": [12]}), pd.DataFrame({"foo": [42]}), False),
            (
                pd.DataFrame(data={"A": [1, 2, 3], "B": [2, 3, 4]}),
                pd.DataFrame(data={"A": [1, 2, 3], "B": [2, 3, 4]}),
                True,
            ),
            # Extra column
            (
                pd.DataFrame(data={"A": [1, 2, 3], "B": [2, 3, 4]}),
                pd.DataFrame(data={"A": [1, 2, 3], "B": [2, 3, 4], "C": [1, 2, 3]}),
                False,
            ),
            # Different values
            (
                pd.DataFrame(data={"A": [1, 2, 3], "B": [2, 3, 4]}),
                pd.DataFrame(data={"A": [1, 2, 3], "B": [2, 3, 5]}),
                False,
            ),
            # Different order
            (
                pd.DataFrame(data={"A": [1, 2, 3], "B": [2, 3, 4]}),
                pd.DataFrame(data={"B": [1, 2, 3], "A": [2, 3, 4]}),
                False,
            ),
            # Different index
            (
                pd.DataFrame(data={"A": [1, 2, 3], "B": [2, 3, 4]}, index=[1, 2, 3]),
                pd.DataFrame(data={"A": [1, 2, 3], "B": [2, 3, 4]}, index=[1, 2, 4]),
                False,
            ),
            # Missing column
            (
                pd.DataFrame(data={"A": [1, 2, 3], "B": [2, 3, 4]}),
                pd.DataFrame(data={"A": [1, 2, 3]}),
                False,
            ),
            # Different sort
            (
                pd.DataFrame(data={"A": [1, 2, 3], "B": [2, 3, 4]}).sort_values(
                    by=["A"]
                ),
                pd.DataFrame(data={"A": [1, 2, 3], "B": [2, 3, 4]}).sort_values(
                    by=["B"], ascending=False
                ),
                False,
            ),
            # Different headers
            (
                pd.DataFrame(data={"A": [1, 2, 3], "C": [2, 3, 4]}),
                pd.DataFrame(data={"A": [1, 2, 3], "B": [2, 3, 4]}),
                False,
            ),
            # Reordered columns
            (
                pd.DataFrame(data={"A": [1, 2, 3], "C": [2, 3, 4]}),
                pd.DataFrame(data={"C": [2, 3, 4], "A": [1, 2, 3]}),
                False,
            ),
            # Slightly different dtypes
            (
                pd.DataFrame(
                    data={"A": [1, 2, 3], "C": pd.array([1, 2, 3], dtype="UInt64")}
                ),
                pd.DataFrame(
                    data={"A": [1, 2, 3], "C": pd.array([1, 2, 3], dtype="Int64")}
                ),
                False,
            ),
        ]
    )
    def test_pandas_dataframe(self, df1, df2, expected):
        result = get_hash(df1) == get_hash(df2)
        self.assertEqual(result, expected)

    def test_pandas_series(self):
        series1 = pd.Series([1, 2])
        series2 = pd.Series([1, 3])
        series3 = pd.Series([1, 2])

        self.assertEqual(get_hash(series1), get_hash(series3))
        self.assertNotEqual(get_hash(series1), get_hash(series2))

        series4 = pd.Series(range(_PANDAS_ROWS_LARGE))
        series5 = pd.Series(range(_PANDAS_ROWS_LARGE))

        self.assertEqual(get_hash(series4), get_hash(series5))

    def test_pandas_series_similar_dtypes(self):
        series1 = pd.Series([1, 2], dtype="UInt64")
        series2 = pd.Series([1, 2], dtype="Int64")

        self.assertNotEqual(get_hash(series1), get_hash(series2))

    def test_numpy(self):
        np1 = np.zeros(10)
        np2 = np.zeros(11)
        np3 = np.zeros(10)

        self.assertEqual(get_hash(np1), get_hash(np3))
        self.assertNotEqual(get_hash(np1), get_hash(np2))

        np4 = np.zeros(_NP_SIZE_LARGE)
        np5 = np.zeros(_NP_SIZE_LARGE)

        self.assertEqual(get_hash(np4), get_hash(np5))

    def test_numpy_similar_dtypes(self):
        np1 = np.ones(10, dtype="u8")
        np2 = np.ones(10, dtype="i8")

        np3 = np.ones(10, dtype=[("a", "u8"), ("b", "i8")])
        np4 = np.ones(10, dtype=[("a", "i8"), ("b", "u8")])

        self.assertNotEqual(get_hash(np1), get_hash(np2))
        self.assertNotEqual(get_hash(np3), get_hash(np4))

    def test_PIL_image(self):
        im1 = Image.new("RGB", (50, 50), (220, 20, 60))
        im2 = Image.new("RGB", (50, 50), (30, 144, 255))
        im3 = Image.new("RGB", (50, 50), (220, 20, 60))

        self.assertEqual(get_hash(im1), get_hash(im3))
        self.assertNotEqual(get_hash(im1), get_hash(im2))

        # Check for big PIL images, they converted to numpy array with size
        # bigger than _NP_SIZE_LARGE
        # 1000 * 1000 * 3 = 3_000_000 > _NP_SIZE_LARGE = 1_000_000
        im4 = Image.new("RGB", (1000, 1000), (100, 20, 60))
        im5 = Image.new("RGB", (1000, 1000), (100, 20, 60))
        im6 = Image.new("RGB", (1000, 1000), (101, 21, 61))

        im4_np_array = np.frombuffer(im4.tobytes(), dtype="uint8")
        self.assertGreater(im4_np_array.size, _NP_SIZE_LARGE)

        self.assertEqual(get_hash(im4), get_hash(im5))
        self.assertNotEqual(get_hash(im5), get_hash(im6))

    @parameterized.expand(
        [
            (BytesIO, b"123", b"456", b"123"),
            (StringIO, "123", "456", "123"),
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

    def test_uploaded_file_io(self):
        rec1 = UploadedFileRec("file1", "name", "type", b"123")
        rec2 = UploadedFileRec("file1", "name", "type", b"456")
        rec3 = UploadedFileRec("file1", "name", "type", b"123")
        io1 = UploadedFile(
            rec1, FileURLs(file_id=rec1.file_id, upload_url="u1", delete_url="d1")
        )
        io2 = UploadedFile(
            rec2, FileURLs(file_id=rec2.file_id, upload_url="u2", delete_url="d2")
        )
        io3 = UploadedFile(
            rec3, FileURLs(file_id=rec3.file_id, upload_url="u3", delete_url="u3")
        )

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
        """MagicMocks never hash to the same thing."""
        # (This also tests that MagicMock can hash at all, without blowing the
        # stack due to an infinite recursion.)
        self.assertNotEqual(get_hash(MagicMock()), get_hash(MagicMock()))

    def test_dataclass(self):
        @dataclass(frozen=True, eq=True)
        class Data:
            foo: str

        bar = Data("bar")

        assert get_hash(bar)

    def test_enum(self):
        """The hashing function returns the same result when called with the same
        Enum members."""

        class EnumClass(Enum):
            ENUM_1 = auto()
            ENUM_2 = auto()

        # Hash values should be stable
        self.assertEqual(get_hash(EnumClass.ENUM_1), get_hash(EnumClass.ENUM_1))

        # Different enum values should produce different hashes
        self.assertNotEqual(get_hash(EnumClass.ENUM_1), get_hash(EnumClass.ENUM_2))

    def test_different_enums(self):
        """Different enum classes should have different hashes, even when the enum
        values are the same."""

        class EnumClassA(Enum):
            ENUM_1 = "hello"

        class EnumClassB(Enum):
            ENUM_1 = "hello"

        enum_a = EnumClassA.ENUM_1
        enum_b = EnumClassB.ENUM_1

        self.assertNotEqual(get_hash(enum_a), get_hash(enum_b))


class NotHashableTest(unittest.TestCase):
    """Tests for various unhashable types. Many of these types *are*
    hashable by @st.cache's hasher, and we're explicitly removing support for
    them.
    """

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

    def test_compiled_ffi_not_hashable(self):
        self._build_cffi("foo")
        from cffi_bin._foo import ffi as foo

        with self.assertRaises(UnhashableTypeError):
            get_hash(foo)

    def test_lambdas_not_hashable(self):
        with self.assertRaises(UnhashableTypeError):
            get_hash(lambda x: x.lower())

    def test_generator_not_hashable(self):
        with self.assertRaises(UnhashableTypeError):
            get_hash((x for x in range(1)))

    def test_hash_funcs_acceptable_keys(self):
        """Test that hashes are equivalent when hash_func key is supplied both as a
        type literal, and as a type name string.
        """
        test_generator = (x for x in range(1))

        with self.assertRaises(UnhashableTypeError):
            get_hash(test_generator)

        self.assertEqual(
            get_hash(test_generator, hash_funcs={types.GeneratorType: id}),
            get_hash(test_generator, hash_funcs={"builtins.generator": id}),
        )

    def test_hash_funcs_error(self):
        with self.assertRaises(UserHashError) as ctx:
            get_hash(1, cache_type=CacheType.DATA, hash_funcs={int: lambda x: "a" + x})

        expected_message = """can only concatenate str (not "int") to str

This error is likely due to a bug in `<lambda>()`, which is a
user-defined hash function that was passed into the `@st.cache_data` decorator of
something.

`<lambda>()` failed when hashing an object of type
`builtins.int`.  If you don't know where that object is coming from,
try looking at the hash chain below for an object that you do recognize, then
pass that to `hash_funcs` instead:

```
Object of type builtins.int: 1
```

If you think this is actually a Streamlit bug, please
[file a bug report here](https://github.com/streamlit/streamlit/issues/new/choose)."""
        self.assertEqual(str(ctx.exception), expected_message)

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

    def test_function_not_hashable(self):
        def foo():
            pass

        with self.assertRaises(UnhashableTypeError):
            get_hash(foo)

    def test_reduce_not_hashable(self):
        class A:
            def __init__(self):
                self.x = [1, 2, 3]

        with self.assertRaises(UnhashableTypeError):
            get_hash(A().__reduce__())
