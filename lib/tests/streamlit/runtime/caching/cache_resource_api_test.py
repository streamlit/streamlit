# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from __future__ import annotations

import threading
import unittest
from typing import TYPE_CHECKING, Any
from unittest.mock import Mock, patch

from parameterized import parameterized

import streamlit as st
from streamlit.runtime.caching import (
    cache_resource_api,
    cached_message_replay,
    get_resource_cache_stats_provider,
)
from streamlit.runtime.caching.hashing import UserHashError
from streamlit.runtime.scriptrunner import add_script_run_ctx
from streamlit.runtime.stats import CacheStat
from streamlit.vendor.pympler.asizeof import asizeof
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.element_mocks import (
    ELEMENT_PRODUCER,
    NON_WIDGET_ELEMENTS,
    WIDGET_ELEMENTS,
)
from tests.streamlit.runtime.caching.common_cache_test import (
    as_cached_result as _as_cached_result,
)
from tests.testutil import create_mock_script_run_ctx

if TYPE_CHECKING:
    from streamlit.runtime.caching.cached_message_replay import CachedResult


def as_cached_result(value: Any) -> CachedResult:
    return _as_cached_result(value)


class CacheResourceTest(unittest.TestCase):
    def setUp(self) -> None:
        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())

    def tearDown(self):
        st.cache_resource.clear()
        # Some of these tests reach directly into _cache_info and twiddle it.
        # Reset default values on teardown.

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

    @patch(
        "streamlit.runtime.caching.cache_resource_api.show_widget_replay_deprecation"
    )
    def test_widget_replay_deprecation(self, show_warning_mock: Mock):
        """We show deprecation warnings when using the `experimental_allow_widgets` parameter."""

        # We show the deprecation warning at declaration time:
        @st.cache_resource(experimental_allow_widgets=True)
        def foo():
            return 42

        show_warning_mock.assert_called_once()

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

        @st.cache_resource(hash_funcs={str: str_hash_func})
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

    def test_cached_st_function_clear_args(self):
        self.x = 0

        @st.cache_resource()
        def foo(y):
            self.x += y
            return self.x

        assert foo(1) == 1
        foo.clear(2)
        assert foo(1) == 1
        foo.clear(1)
        assert foo(1) == 2

    def test_cached_class_method_clear_args(self):
        self.x = 0

        class ExampleClass:
            @st.cache_resource()
            def foo(_self, y):
                self.x += y
                return self.x

        example_instance = ExampleClass()
        # Calling method foo produces the side effect of incrementing self.x
        # and returning it as the result.

        # calling foo(1) should return 1
        assert example_instance.foo(1) == 1
        # calling foo.clear(2) should clear the cache for the argument 2,
        # and keep the cache for the argument 1, therefore calling foo(1) should return
        # cached value 1
        example_instance.foo.clear(2)
        assert example_instance.foo(1) == 1
        # calling foo.clear(1) should clear the cache for the argument 1,
        # therefore calling foo(1) should return the new value 2
        example_instance.foo.clear(1)
        assert example_instance.foo(1) == 2

        # Try the same with a keyword argument:
        example_instance.foo.clear(y=1)
        assert example_instance.foo(1) == 3

    def test_cached_class_method_clear(self):
        self.x = 0

        class ExampleClass:
            @st.cache_resource()
            def foo(_self, y):
                self.x += y
                return self.x

        example_instance = ExampleClass()
        # Calling method foo produces the side effect of incrementing self.x
        # and returning it as the result.

        # calling foo(1) should return 1
        assert example_instance.foo(1) == 1
        example_instance.foo.clear()
        # calling foo.clear() should clear all cached values:
        # So the call to foo() should return the new value 2
        assert example_instance.foo(1) == 2


class CacheResourceValidateTest(unittest.TestCase):
    def setUp(self) -> None:
        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())

    def tearDown(self):
        st.cache_resource.clear()
        # Some of these tests reach directly into _cache_info and twiddle it.
        # Reset default values on teardown.
        cache_resource_api.CACHE_RESOURCE_MESSAGE_REPLAY_CTX._cached_func_stack = []

    def test_validate_success(self):
        """If we have a validate function and it returns True, we don't recompute our cached value."""
        validate = Mock(return_value=True)

        call_count: list[int] = [0]

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

        call_count: list[int] = [0]

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
                byte_length=(
                    get_byte_length(as_cached_result([3.14]))
                    + get_byte_length(as_cached_result([3.14] * 53))
                ),
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


class CacheResourceMessageReplayTest(DeltaGeneratorTestCase):
    def setUp(self):
        super().setUp()
        # Guard against external tests not properly cache-clearing
        # in their teardowns.
        st.cache_resource.clear()

    def tearDown(self):
        st.cache_resource.clear()

    @parameterized.expand(WIDGET_ELEMENTS)
    def test_shows_cached_widget_replay_warning(
        self, _widget_name: str, widget_producer: ELEMENT_PRODUCER
    ):
        """Test that a warning is shown when a widget is created inside a cached function."""

        if _widget_name == "experimental_audio_input":
            # The experimental_audio_input element produces also a deprecation warning
            # which makes this test irrelevant
            return

        @st.cache_resource(show_spinner=False)
        def cache_widget():
            widget_producer()

        cache_widget()

        # There should be only two elements in the queue:
        assert len(self.get_all_deltas_from_queue()) == 2

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-2).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning is True

    @parameterized.expand(NON_WIDGET_ELEMENTS)
    def test_works_with_element_replay(
        self, element_name: str, element_producer: ELEMENT_PRODUCER
    ):
        """Test that it works with element replay if used as non-widget element."""

        if element_name == "toast":
            # The toast element is not supported in the cache_data API
            # since elements on the event dg are not supported.
            return

        @st.cache_resource
        def cache_element():
            element_producer()

        with patch(
            "streamlit.runtime.caching.cache_utils.replay_cached_messages",
            wraps=cached_message_replay.replay_cached_messages,
        ) as replay_cached_messages_mock:
            # Call first time:
            cache_element()
            assert self.get_delta_from_queue().HasField("new_element") is True
            # The first time the cached function is called, the replay function is not called
            replay_cached_messages_mock.assert_not_called()

            # Call second time:
            cache_element()
            assert self.get_delta_from_queue().HasField("new_element") is True
            # The second time the cached function is called, the replay function is called
            replay_cached_messages_mock.assert_called()

            # Call third time:
            cache_element()
            assert self.get_delta_from_queue().HasField("new_element") is True
            # The third time the cached function is called, the replay function is called
            replay_cached_messages_mock.assert_called()


def get_byte_length(value: Any) -> int:
    """Return the byte length of the pickled value."""
    return asizeof(value)
