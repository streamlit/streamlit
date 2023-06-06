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

"""st.cache_resource unit tests."""

import threading
import unittest
from typing import Any, List
from unittest.mock import Mock, patch

from parameterized import parameterized
from pympler.asizeof import asizeof

import streamlit as st
from streamlit.runtime.caching import (
    cache_resource_api,
    get_resource_cache_stats_provider,
)
from streamlit.runtime.caching.cache_type import CacheType
from streamlit.runtime.caching.cached_message_replay import MultiCacheResults
from streamlit.runtime.caching.hashing import UserHashError
from streamlit.runtime.scriptrunner import add_script_run_ctx
from streamlit.runtime.stats import CacheStat
from tests.streamlit.runtime.caching.common_cache_test import (
    as_cached_result as _as_cached_result,
)
from tests.testutil import create_mock_script_run_ctx


def as_cached_result(value: Any) -> MultiCacheResults:
    return _as_cached_result(value, CacheType.RESOURCE)


class CacheResourceTest(unittest.TestCase):
    def setUp(self) -> None:
        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())

    def tearDown(self):
        st.cache_resource.clear()
        # Some of these tests reach directly into _cache_info and twiddle it.
        # Reset default values on teardown.
        cache_resource_api.CACHE_RESOURCE_MESSAGE_REPLAY_CTX._cached_func_stack = []
        cache_resource_api.CACHE_RESOURCE_MESSAGE_REPLAY_CTX._suppress_st_function_warning = (
            0
        )

    @patch.object(st, "exception")
    def test_mutate_return(self, exception):
        """Mutating a cache_resource return value is legal, and *will* affect
        future accessors of the data."""

        @st.cache_resource
        def f():
            return [0, 1]

        r1 = f()

        r1[0] = 1

        r2 = f()

        exception.assert_not_called()

        self.assertEqual(r1, [1, 1])
        self.assertEqual(r2, [1, 1])

    def test_multiple_api_names(self):
        """`st.experimental_singleton` is effectively an alias for `st.cache_resource`, and we
        support both APIs while experimental_singleton is being deprecated.
        """
        num_calls = [0]

        def foo():
            num_calls[0] += 1
            return 42

        # Annotate a function with both `cache_resource` and `experimental_singleton`.
        cache_resource_func = st.cache_resource(foo)
        singleton_func = st.experimental_singleton(foo)

        # Call both versions of the function and assert the results.
        self.assertEqual(42, cache_resource_func())
        self.assertEqual(42, singleton_func())

        # Because these decorators share the same cache, calling both functions
        # results in just a single call to the decorated function.
        self.assertEqual(1, num_calls[0])

    @parameterized.expand(
        [
            ("cache_resource", st.cache_resource, False),
            ("experimental_singleton", st.experimental_singleton, True),
        ]
    )
    @patch("streamlit.runtime.caching.cache_resource_api.show_deprecation_warning")
    def test_deprecation_warnings(
        self, _, decorator: Any, should_show_warning: bool, show_warning_mock: Mock
    ):
        """We show deprecation warnings when using `@st.experimental_singleton`, but not `@st.cache_resource`."""
        warning_str = (
            "`st.experimental_singleton` is deprecated. Please use the new command `st.cache_resource` instead, "
            "which has the same behavior. More information [in our docs](https://docs.streamlit.io/library/advanced-features/caching)."
        )

        # We show the deprecation warning at declaration time:
        @decorator
        def foo():
            return 42

        if should_show_warning:
            show_warning_mock.assert_called_once_with(warning_str)
        else:
            show_warning_mock.assert_not_called()

        # And also when clearing the cache:
        show_warning_mock.reset_mock()
        decorator.clear()

        if should_show_warning:
            show_warning_mock.assert_called_once_with(warning_str)
        else:
            show_warning_mock.assert_not_called()

    def test_cached_member_function_with_hash_func(self):
        """@st.cache_resource can be applied to class member functions
        with corresponding hash_func.
        """

        class TestClass:
            @st.cache_resource(
                hash_funcs={
                    "tests.streamlit.runtime.caching.cache_resource_api_test.CacheResourceTest.test_cached_member_function_with_hash_func.<locals>.TestClass": id
                }
            )
            def member_func(self):
                return "member func!"

            @classmethod
            @st.cache_resource
            def class_method(cls):
                return "class method!"

            @staticmethod
            @st.cache_resource
            def static_method():
                return "static method!"

        obj = TestClass()
        self.assertEqual("member func!", obj.member_func())
        self.assertEqual("class method!", obj.class_method())
        self.assertEqual("static method!", obj.static_method())

    def test_function_name_does_not_use_hashfuncs(self):
        """Hash funcs should only be used on arguments to a function,
        and not when computing the key for a function's unique MemCache.
        """

        str_hash_func = Mock(return_value=None)

        @st.cache(hash_funcs={str: str_hash_func})
        def foo(string_arg):
            return []

        # If our str hash_func is called multiple times, it's probably because
        # it's being used to compute the function's function_key (as opposed to
        # the value_key). It should only be used to compute the value_key!
        foo("ahoy")
        str_hash_func.assert_called_once_with("ahoy")

    def test_user_hash_error(self):
        class MyObj:
            # we specify __repr__ here, to avoid `MyObj object at 0x1347a3f70`
            # in error message
            def __repr__(self):
                return "MyObj class"

        def bad_hash_func(x):
            x += 10  # Throws a TypeError since x has type MyObj.
            return x

        @st.cache_resource(hash_funcs={MyObj: bad_hash_func})
        def user_hash_error_func(x):
            pass

        with self.assertRaises(UserHashError) as ctx:
            my_obj = MyObj()
            user_hash_error_func(my_obj)

        expected_message = """unsupported operand type(s) for +=: 'MyObj' and 'int'

This error is likely due to a bug in `bad_hash_func()`, which is a
user-defined hash function that was passed into the `@st.cache_resource` decorator of
`user_hash_error_func()`.

`bad_hash_func()` failed when hashing an object of type
`tests.streamlit.runtime.caching.cache_resource_api_test.CacheResourceTest.test_user_hash_error.<locals>.MyObj`.  If you don't know where that object is coming from,
try looking at the hash chain below for an object that you do recognize, then
pass that to `hash_funcs` instead:

```
Object of type tests.streamlit.runtime.caching.cache_resource_api_test.CacheResourceTest.test_user_hash_error.<locals>.MyObj: MyObj class
```

If you think this is actually a Streamlit bug, please
[file a bug report here](https://github.com/streamlit/streamlit/issues/new/choose)."""
        self.assertEqual(str(ctx.exception), expected_message)


class CacheResourceValidateTest(unittest.TestCase):
    def setUp(self) -> None:
        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())

    def tearDown(self):
        st.cache_resource.clear()
        # Some of these tests reach directly into _cache_info and twiddle it.
        # Reset default values on teardown.
        cache_resource_api.CACHE_RESOURCE_MESSAGE_REPLAY_CTX._cached_func_stack = []
        cache_resource_api.CACHE_RESOURCE_MESSAGE_REPLAY_CTX._suppress_st_function_warning = (
            0
        )

    def test_validate_success(self):
        """If we have a validate function and it returns True, we don't recompute our cached value."""
        validate = Mock(return_value=True)

        call_count: List[int] = [0]

        @st.cache_resource(validate=validate)
        def f() -> int:
            call_count[0] += 1
            return call_count[0]

        # First call: call_count == 1; validate not called (because we computed a new value)
        self.assertEqual(1, f())
        validate.assert_not_called()

        # Subsequent calls: call_count == 1; validate called each time
        for _ in range(3):
            self.assertEqual(1, f())
            validate.assert_called_once_with(1)
            validate.reset_mock()

    def test_validate_fail(self):
        """If we have a validate function and it returns False, we recompute our cached value."""
        validate = Mock(return_value=False)

        call_count: List[int] = [0]

        @st.cache_resource(validate=validate)
        def f() -> int:
            call_count[0] += 1
            return call_count[0]

        # First call: call_count == 1; validate not called (because we computed a new value)
        expected_call_count = 1
        self.assertEqual(expected_call_count, f())
        validate.assert_not_called()

        # Subsequent calls: call_count increases; validate called with previous value
        for _ in range(3):
            expected_call_count += 1
            self.assertEqual(expected_call_count, f())
            validate.assert_called_once_with(expected_call_count - 1)
            validate.reset_mock()


class CacheResourceStatsProviderTest(unittest.TestCase):
    def setUp(self):
        # Guard against external tests not properly cache-clearing
        # in their teardowns.
        st.cache_resource.clear()

        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())

    def tearDown(self):
        st.cache_resource.clear()

    def test_no_stats(self):
        self.assertEqual([], get_resource_cache_stats_provider().get_stats())

    def test_multiple_stats(self):
        @st.cache_resource
        def foo(count):
            return [3.14] * count

        @st.cache_resource
        def bar():
            return threading.Lock()

        foo(1)
        foo(53)
        bar()
        bar()

        foo_cache_name = f"{foo.__module__}.{foo.__qualname__}"
        bar_cache_name = f"{bar.__module__}.{bar.__qualname__}"

        expected = [
            CacheStat(
                category_name="st_cache_resource",
                cache_name=foo_cache_name,
                byte_length=get_byte_length(as_cached_result([3.14])),
            ),
            CacheStat(
                category_name="st_cache_resource",
                cache_name=foo_cache_name,
                byte_length=get_byte_length(as_cached_result([3.14] * 53)),
            ),
            CacheStat(
                category_name="st_cache_resource",
                cache_name=bar_cache_name,
                byte_length=get_byte_length(as_cached_result(bar())),
            ),
        ]

        # The order of these is non-deterministic, so check Set equality
        # instead of List equality
        self.assertEqual(
            set(expected), set(get_resource_cache_stats_provider().get_stats())
        )


def get_byte_length(value: Any) -> int:
    """Return the byte length of the pickled value."""
    return asizeof(value)
