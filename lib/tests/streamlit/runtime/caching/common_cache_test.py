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

"""Tests that are common to both st.cache_data and st.cache_resource"""

import threading
import time
import unittest
from datetime import timedelta
from typing import Any, List
from unittest.mock import MagicMock, Mock, patch

from parameterized import parameterized

import streamlit as st
from streamlit.runtime import Runtime
from streamlit.runtime.caching import (
    CACHE_DATA_MESSAGE_REPLAY_CTX,
    CACHE_RESOURCE_MESSAGE_REPLAY_CTX,
    cache_data,
    cache_resource,
)
from streamlit.runtime.caching.cache_errors import CacheReplayClosureError
from streamlit.runtime.caching.cache_type import CacheType
from streamlit.runtime.caching.cache_utils import CachedResult
from streamlit.runtime.caching.cached_message_replay import (
    MultiCacheResults,
    _make_widget_key,
)
from streamlit.runtime.caching.storage.dummy_cache_storage import (
    MemoryCacheStorageManager,
)
from streamlit.runtime.forward_msg_queue import ForwardMsgQueue
from streamlit.runtime.scriptrunner import (
    ScriptRunContext,
    add_script_run_ctx,
    get_script_run_ctx,
    script_run_context,
)
from streamlit.runtime.state import SafeSessionState, SessionState
from streamlit.runtime.uploaded_file_manager import UploadedFileManager
from streamlit.testing.script_interactions import InteractiveScriptTests
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.exception_capturing_thread import ExceptionCapturingThread, call_on_threads
from tests.streamlit.elements.image_test import create_image
from tests.testutil import create_mock_script_run_ctx


def get_text_or_block(delta):
    if delta.WhichOneof("type") == "new_element":
        element = delta.new_element
        if element.WhichOneof("type") == "text":
            return element.text.body
    elif delta.WhichOneof("type") == "add_block":
        return "new_block"


def as_cached_result(value: Any, cache_type: CacheType) -> MultiCacheResults:
    """Creates cached results for a function that returned `value`
    and did not execute any elements.
    """
    result = CachedResult(value, [], st._main.id, st.sidebar.id)
    widget_key = _make_widget_key([], cache_type)
    d = {widget_key: result}
    initial = MultiCacheResults(set(), d)
    return initial


class CommonCacheTest(DeltaGeneratorTestCase):
    def tearDown(self):
        # Clear caches
        st.cache_data.clear()
        st.cache_resource.clear()

        # And some tests create widgets, and can result in DuplicateWidgetID
        # errors on subsequent runs.
        ctx = script_run_context.get_script_run_ctx()
        if ctx is not None:
            ctx.widget_ids_this_run.clear()
            ctx.widget_user_keys_this_run.clear()

        super().tearDown()

    def get_text_delta_contents(self) -> List[str]:
        deltas = self.get_all_deltas_from_queue()
        text = [
            element.text.body
            for element in (delta.new_element for delta in deltas)
            if element.WhichOneof("type") == "text"
        ]
        return text

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    def test_simple(self, _, cache_decorator):
        @cache_decorator
        def foo():
            return 42

        self.assertEqual(foo(), 42)
        self.assertEqual(foo(), 42)

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    def test_multiple_int_like_floats(self, _, cache_decorator):
        @cache_decorator
        def foo(x):
            return x

        self.assertEqual(foo(1.0), 1.0)
        self.assertEqual(foo(3.0), 3.0)

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    def test_return_cached_object(self, _, cache_decorator):
        """If data has been cached, the cache function shouldn't be called."""
        with patch.object(st, "exception") as mock_exception:
            called = [False]

            @cache_decorator
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

            mock_exception.assert_not_called()

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    def test_mutate_args(self, _, cache_decorator):
        """Mutating an argument inside a cached function doesn't throw
        an error (but it's probably not a great idea)."""
        with patch.object(st, "exception") as mock_exception:

            @cache_decorator
            def foo(d):
                d["answer"] += 1
                return d["answer"]

            d = {"answer": 0}

            self.assertEqual(foo(d), 1)
            self.assertEqual(foo(d), 2)

            mock_exception.assert_not_called()

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    def test_ignored_args(self, _, cache_decorator):
        """Args prefixed with _ are not used as part of the cache key."""
        call_count = [0]

        @cache_decorator
        def foo(arg1, _arg2, *args, kwarg1, _kwarg2=None, **kwargs):
            call_count[0] += 1

        foo(1, 2, 3, kwarg1=4, _kwarg2=5, kwarg3=6, _kwarg4=7)
        self.assertEqual([1], call_count)

        # Call foo again, but change the values for _arg2, _kwarg2, and _kwarg4.
        # The call count shouldn't change, because these args will not be part
        # of the hash.
        foo(1, None, 3, kwarg1=4, _kwarg2=None, kwarg3=6, _kwarg4=None)
        self.assertEqual([1], call_count)

        # Changing the value of any other argument will increase the call
        # count. We test each argument type:

        # arg1 (POSITIONAL_OR_KEYWORD)
        foo(None, 2, 3, kwarg1=4, _kwarg2=5, kwarg3=6, _kwarg4=7)
        self.assertEqual([2], call_count)

        # *arg (VAR_POSITIONAL)
        foo(1, 2, None, kwarg1=4, _kwarg2=5, kwarg3=6, _kwarg4=7)
        self.assertEqual([3], call_count)

        # kwarg1 (KEYWORD_ONLY)
        foo(1, 2, 3, kwarg1=None, _kwarg2=5, kwarg3=6, _kwarg4=7)
        self.assertEqual([4], call_count)

        # **kwarg (VAR_KEYWORD)
        foo(1, 2, 3, kwarg1=4, _kwarg2=5, kwarg3=None, _kwarg4=7)
        self.assertEqual([5], call_count)

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    def test_cached_member_function(self, _, cache_decorator):
        """Our cache decorators can be applied to class member functions."""

        class TestClass:
            @cache_decorator
            def member_func(_self):
                # We underscore-prefix `_self`, because our class is not hashable.
                return "member func!"

            @classmethod
            @cache_decorator
            def class_method(cls):
                return "class method!"

            @staticmethod
            @cache_decorator
            def static_method():
                return "static method!"

        obj = TestClass()
        self.assertEqual("member func!", obj.member_func())
        self.assertEqual("class method!", obj.class_method())
        self.assertEqual("static method!", obj.static_method())

    @parameterized.expand(
        [
            ("cache_data", cache_data, CACHE_DATA_MESSAGE_REPLAY_CTX),
            ("cache_resource", cache_resource, CACHE_RESOURCE_MESSAGE_REPLAY_CTX),
        ]
    )
    def test_cached_st_function_warning(self, _, cache_decorator, call_stack):
        """Ensure we properly warn when interactive st.foo functions are called
        inside a cached function.
        """
        forward_msg_queue = ForwardMsgQueue()
        orig_report_ctx = get_script_run_ctx()
        add_script_run_ctx(
            threading.current_thread(),
            ScriptRunContext(
                session_id="test session id",
                _enqueue=forward_msg_queue.enqueue,
                query_string="",
                session_state=SafeSessionState(SessionState()),
                uploaded_file_mgr=UploadedFileManager(),
                page_script_hash="",
                user_info={"email": "test@test.com"},
            ),
        )
        with patch.object(call_stack, "_show_cached_st_function_warning") as warning:
            st.text("foo")
            warning.assert_not_called()

            @cache_decorator
            def cached_func():
                st.text("Inside cached func")

            cached_func()
            warning.assert_not_called()

            warning.reset_mock()

            # Make sure everything got reset properly
            st.text("foo")
            warning.assert_not_called()

            # Test nested st.cache functions
            @cache_decorator
            def outer():
                @cache_decorator
                def inner():
                    st.text("Inside nested cached func")

                return inner()

            outer()
            warning.assert_not_called()

            warning.reset_mock()

            # Test st.cache functions that raise errors
            with self.assertRaises(RuntimeError):

                @cache_decorator
                def cached_raise_error():
                    st.text("About to throw")
                    raise RuntimeError("avast!")

                cached_raise_error()

            warning.assert_not_called()
            warning.reset_mock()

            # Make sure everything got reset properly
            st.text("foo")
            warning.assert_not_called()

            # Test st.cache functions with widgets
            @cache_decorator
            def cached_widget():
                st.button("Press me!")

            cached_widget()

            warning.assert_called()
            warning.reset_mock()

            # Make sure everything got reset properly
            st.text("foo")
            warning.assert_not_called()

            # Test st.cache functions with widgets enabled
            @cache_decorator(experimental_allow_widgets=True)
            def cached_widget_enabled():
                st.button("Press me too!")

            cached_widget_enabled()

            warning.assert_not_called()
            warning.reset_mock()

            # Make sure everything got reset properly
            st.text("foo")
            warning.assert_not_called()

            add_script_run_ctx(threading.current_thread(), orig_report_ctx)

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    def test_cached_st_function_replay(self, _, cache_decorator):
        @cache_decorator
        def foo_replay(i):
            st.text(i)
            return i

        foo_replay(1)
        st.text("---")
        foo_replay(1)

        text = self.get_text_delta_contents()

        assert text == ["1", "---", "1"]

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    def test_cached_st_function_replay_nested(self, _, cache_decorator):
        @cache_decorator
        def inner(i):
            st.text(i)

        @cache_decorator
        def outer(i):
            inner(i)
            st.text(i + 10)

        outer(1)
        outer(1)
        st.text("---")
        inner(2)
        outer(2)
        st.text("---")
        outer(3)
        inner(3)

        text = self.get_text_delta_contents()
        assert text == [
            "1",
            "11",
            "1",
            "11",
            "---",
            "2",
            "2",
            "12",
            "---",
            "3",
            "13",
            "3",
        ]

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    def test_cached_st_function_replay_outer_blocks(self, _, cache_decorator):
        @cache_decorator
        def foo(i):
            st.text(i)
            return i

        with st.container():
            foo(1)
            st.text("---")
            foo(1)

        text = self.get_text_delta_contents()
        assert text == ["1", "---", "1"]

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    def test_cached_st_function_replay_sidebar(self, _, cache_decorator):
        @cache_decorator(show_spinner=False)
        def foo(i):
            st.sidebar.text(i)
            return i

        foo(1)  # [1,0]
        st.text("---")  # [0,0]
        foo(1)  # [1,1]

        text = [
            get_text_or_block(delta)
            for delta in self.get_all_deltas_from_queue()
            if get_text_or_block(delta) is not None
        ]
        assert text == ["1", "---", "1"]

        paths = [
            msg.metadata.delta_path
            for msg in self.forward_msg_queue._queue
            if msg.HasField("delta")
        ]
        assert paths == [[1, 0], [0, 0], [1, 1]]

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    def test_cached_st_function_replay_inner_blocks(self, _, cache_decorator):
        @cache_decorator(show_spinner=False)
        def foo(i):
            with st.container():
                st.text(i)
                return i

        with st.container():  # [0,0]
            st.text(0)  # [0,0,0]
        st.text("---")  # [0,1]
        with st.container():  # [0,2]
            st.text(0)  # [0,2,0]

        foo(1)  # [0,3] and [0,3,0]
        st.text("---")  # [0,4]
        foo(1)  # [0,5] and [0,5,0]

        paths = [
            msg.metadata.delta_path
            for msg in self.forward_msg_queue._queue
            if msg.HasField("delta")
        ]
        assert paths == [
            [0, 0],
            [0, 0, 0],
            [0, 1],
            [0, 2],
            [0, 2, 0],
            [0, 3],
            [0, 3, 0],
            [0, 4],
            [0, 5],
            [0, 5, 0],
        ]

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    def test_cached_st_function_replay_inner_direct(self, _, cache_decorator):
        @cache_decorator(show_spinner=False)
        def foo(i):
            cont = st.container()
            cont.text(i)
            return i

        foo(1)  # [0,0] and [0,0,0]
        st.text("---")  # [0,1]
        foo(1)  # [0,2] and [0,2,0]

        text = self.get_text_delta_contents()
        assert text == ["1", "---", "1"]

        paths = [
            msg.metadata.delta_path
            for msg in self.forward_msg_queue._queue
            if msg.HasField("delta")
        ]
        assert paths == [[0, 0], [0, 0, 0], [0, 1], [0, 2], [0, 2, 0]]

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    def test_cached_st_function_replay_outer_direct(self, _, cache_decorator):
        cont = st.container()

        @cache_decorator
        def foo(i):
            cont.text(i)
            return i

        with self.assertRaises(CacheReplayClosureError):
            foo(1)
            st.text("---")
            foo(1)

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    def test_cached_st_image_replay(self, _, cache_decorator):
        """Basic sanity check that nothing blows up. This test assumes that
        actual caching/replay functionality are covered by e2e tests that
        can more easily test them.
        """

        @cache_decorator
        def img_fn():
            st.image(create_image(10))

        img_fn()
        img_fn()

        @cache_decorator
        def img_fn_multi():
            st.image([create_image(5), create_image(15), create_image(100)])

        img_fn_multi()
        img_fn_multi()

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    def test_nested_widget_replay(self, _, cache_decorator):
        """Regression test for GH#5677"""

        @cache_decorator(experimental_allow_widgets=True)
        def foo():
            x = st.number_input("AAAA", 1, 100, 12)
            return x**2

        @cache_decorator(experimental_allow_widgets=True)
        def baz(y):
            return foo() + y

        st.write(baz(10))

    @parameterized.expand(
        [
            ("cache_data", cache_data, cache_data.clear),
            ("cache_resource", cache_resource, cache_resource.clear),
        ]
    )
    def test_clear_all_caches(self, _, cache_decorator, clear_cache_func):
        """Calling a cache's global `clear_all` function should remove all
        items from all caches of the appropriate type.
        """
        foo_vals = []

        @cache_decorator
        def foo(x):
            foo_vals.append(x)
            return x

        bar_vals = []

        @cache_decorator
        def bar(x):
            bar_vals.append(x)
            return x

        foo(0), foo(1), foo(2)
        bar(0), bar(1), bar(2)
        self.assertEqual([0, 1, 2], foo_vals)
        self.assertEqual([0, 1, 2], bar_vals)

        # Clear the cache and access our original values again. They
        # should be recomputed.
        clear_cache_func()

        foo(0), foo(1), foo(2)
        bar(0), bar(1), bar(2)
        self.assertEqual([0, 1, 2, 0, 1, 2], foo_vals)
        self.assertEqual([0, 1, 2, 0, 1, 2], bar_vals)

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    def test_clear_single_cache(self, _, cache_decorator):
        foo_call_count = [0]

        @cache_decorator
        def foo():
            foo_call_count[0] += 1

        bar_call_count = [0]

        @cache_decorator
        def bar():
            bar_call_count[0] += 1

        foo(), foo(), foo()
        bar(), bar(), bar()
        self.assertEqual(1, foo_call_count[0])
        self.assertEqual(1, bar_call_count[0])

        # Clear just foo's cache, and call the functions again.
        foo.clear()

        foo(), foo(), foo()
        bar(), bar(), bar()

        # Foo will have been called a second time, and bar will still
        # have been called just once.
        self.assertEqual(2, foo_call_count[0])
        self.assertEqual(1, bar_call_count[0])

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    def test_without_spinner(self, _, cache_decorator):
        """If the show_spinner flag is not set, the report queue should be
        empty.
        """

        @cache_decorator(show_spinner=False)
        def function_without_spinner(x: int) -> int:
            return x

        function_without_spinner(3)
        self.assertTrue(self.forward_msg_queue.is_empty())

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    def test_with_spinner(self, _, cache_decorator):
        """If the show_spinner flag is set, there should be one element in the
        report queue.
        """

        @cache_decorator(show_spinner=True)
        def function_with_spinner(x: int) -> int:
            return x

        function_with_spinner(3)
        self.assertFalse(self.forward_msg_queue.is_empty())

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    def test_with_custom_text_spinner(self, _, cache_decorator):
        """If the show_spinner flag is set, there should be one element in the
        report queue.
        """

        @cache_decorator(show_spinner="CUSTOM_TEXT")
        def function_with_spinner_custom_text(x: int) -> int:
            return x

        function_with_spinner_custom_text(3)
        self.assertFalse(self.forward_msg_queue.is_empty())

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    def test_with_empty_text_spinner(self, _, cache_decorator):
        """If the show_spinner flag is set, even if it is empty text,
        there should be one element in the report queue.
        """

        @cache_decorator(show_spinner="")
        def function_with_spinner_empty_text(x: int) -> int:
            return x

        function_with_spinner_empty_text(3)
        self.assertFalse(self.forward_msg_queue.is_empty())


class CommonCacheTTLTest(unittest.TestCase):
    def setUp(self) -> None:
        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())
        mock_runtime = MagicMock(spec=Runtime)
        mock_runtime.cache_storage_manager = MemoryCacheStorageManager()
        Runtime._instance = mock_runtime

    def tearDown(self):
        cache_data.clear()
        cache_resource.clear()

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    @patch("streamlit.runtime.caching.cache_utils.TTLCACHE_TIMER")
    def test_ttl(self, _, cache_decorator, timer_patch: Mock):
        """Entries should expire after the given ttl."""
        one_day = 60 * 60 * 24

        # Create 2 cached functions to test that they don't interfere
        # with each other.
        foo_vals = []

        @cache_decorator(ttl=one_day)
        def foo(x):
            foo_vals.append(x)
            return x

        bar_vals = []

        @cache_decorator(ttl=one_day * 2)
        def bar(x):
            bar_vals.append(x)
            return x

        # Store a value at time 0
        timer_patch.return_value = 0
        foo(0)
        bar(0)
        self.assertEqual([0], foo_vals)
        self.assertEqual([0], bar_vals)

        # Advance our timer, but not enough to expire our value.
        timer_patch.return_value = one_day * 0.5
        foo(0)
        bar(0)
        self.assertEqual([0], foo_vals)
        self.assertEqual([0], bar_vals)

        # Advance our timer enough to expire foo, but not bar.
        timer_patch.return_value = one_day * 1.5
        foo(0)
        bar(0)
        self.assertEqual([0, 0], foo_vals)
        self.assertEqual([0], bar_vals)

        # Expire bar. Foo's second value was inserted at time=1.5 days,
        # so it won't expire until time=2.5 days
        timer_patch.return_value = (one_day * 2) + 1
        foo(0)
        bar(0)
        self.assertEqual([0, 0], foo_vals)
        self.assertEqual([0, 0], bar_vals)

        # Expire foo for a second time.
        timer_patch.return_value = (one_day * 2.5) + 1
        foo(0)
        bar(0)
        self.assertEqual([0, 0, 0], foo_vals)
        self.assertEqual([0, 0], bar_vals)

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    @patch("streamlit.runtime.caching.cache_utils.TTLCACHE_TIMER")
    def test_ttl_timedelta(self, _, cache_decorator, timer_patch: Mock):
        """Entries should expire after the given ttl."""
        one_day_seconds = 60 * 60 * 24
        one_day_timedelta = timedelta(days=1)
        two_days_timedelta = timedelta(days=2)

        # Create 2 cached functions to test that they don't interfere
        # with each other.
        foo_vals = []

        @cache_decorator(ttl=one_day_timedelta)
        def foo(x):
            foo_vals.append(x)
            return x

        bar_vals = []

        @cache_decorator(ttl=two_days_timedelta)
        def bar(x):
            bar_vals.append(x)
            return x

        # Store a value at time 0
        timer_patch.return_value = 0
        foo(0)
        bar(0)
        self.assertEqual([0], foo_vals)
        self.assertEqual([0], bar_vals)

        # Advance our timer, but not enough to expire our value.
        timer_patch.return_value = one_day_seconds * 0.5
        foo(0)
        bar(0)
        self.assertEqual([0], foo_vals)
        self.assertEqual([0], bar_vals)

        # Advance our timer enough to expire foo, but not bar.
        timer_patch.return_value = one_day_seconds * 1.5
        foo(0)
        bar(0)
        self.assertEqual([0, 0], foo_vals)
        self.assertEqual([0], bar_vals)

        # Expire bar. Foo's second value was inserted at time=1.5 days,
        # so it won't expire until time=2.5 days
        timer_patch.return_value = (one_day_seconds * 2) + 1
        foo(0)
        bar(0)
        self.assertEqual([0, 0], foo_vals)
        self.assertEqual([0, 0], bar_vals)

        # Expire foo for a second time.
        timer_patch.return_value = (one_day_seconds * 2.5) + 1
        foo(0)
        bar(0)
        self.assertEqual([0, 0, 0], foo_vals)
        self.assertEqual([0, 0], bar_vals)


class CommonCacheThreadingTest(unittest.TestCase):
    # The number of threads to run our tests on
    NUM_THREADS = 50

    def setUp(self):
        mock_runtime = MagicMock(spec=Runtime)
        mock_runtime.cache_storage_manager = MemoryCacheStorageManager()
        Runtime._instance = mock_runtime

    def tearDown(self):
        # Some of these tests reach directly into CALL_STACK data and twiddle it.
        # Reset default values on teardown.
        CACHE_DATA_MESSAGE_REPLAY_CTX._cached_func_stack = []
        CACHE_DATA_MESSAGE_REPLAY_CTX._suppress_st_function_warning = 0
        CACHE_RESOURCE_MESSAGE_REPLAY_CTX._cached_func_stack = []
        CACHE_RESOURCE_MESSAGE_REPLAY_CTX._suppress_st_function_warning = 0

        # Clear caches
        st.cache_data.clear()
        st.cache_resource.clear()

        # And some tests create widgets, and can result in DuplicateWidgetID
        # errors on subsequent runs.
        ctx = script_run_context.get_script_run_ctx()
        if ctx is not None:
            ctx.widget_ids_this_run.clear()
            ctx.widget_user_keys_this_run.clear()

        super().tearDown()

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    def test_get_cache(self, _, cache_decorator):
        """Accessing a cached value is safe from multiple threads."""

        cached_func_call_count = [0]

        @cache_decorator
        def foo():
            cached_func_call_count[0] += 1
            return 42

        def call_foo(_: int) -> None:
            self.assertEqual(42, foo())

        # Call foo from multiple threads and assert no errors.
        call_on_threads(call_foo, self.NUM_THREADS)

        # The cached function should only be called once (see `test_compute_value_only_once`).
        self.assertEqual(1, cached_func_call_count[0])

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    def test_compute_value_only_once(self, _, cache_decorator):
        """Cached values should be computed only once, even if multiple sessions read from an
        unwarmed cache simultaneously.
        """
        cached_func_call_count = [0]

        @cache_decorator
        def foo():
            self.assertEqual(
                0,
                cached_func_call_count[0],
                "A cached value was computed multiple times!",
            )
            cached_func_call_count[0] += 1

            # Sleep to "guarantee" that our other threads try to access the
            # cached data while it's being computed. (The other threads should
            # block on cache computation, so this function should only
            # be called a single time.)
            time.sleep(0.25)
            return 42

        def call_foo(_: int) -> None:
            self.assertEqual(42, foo())

        call_on_threads(call_foo, num_threads=self.NUM_THREADS, timeout=0.5)

    @parameterized.expand(
        [
            ("cache_data", cache_data, cache_data.clear),
            ("cache_resource", cache_resource, cache_resource.clear),
        ]
    )
    def test_clear_all_caches(self, _, cache_decorator, clear_cache_func):
        """Clearing all caches is safe to call from multiple threads."""

        @cache_decorator
        def foo():
            return 42

        # Populate the cache
        foo()

        def clear_caches(_: int) -> None:
            clear_cache_func()

        # Clear the cache from a bunch of threads and assert no errors.
        call_on_threads(clear_caches, self.NUM_THREADS)

        # Sanity check: ensure we can still call our cached function.
        self.assertEqual(42, foo())

    @parameterized.expand(
        [("cache_data", cache_data), ("cache_resource", cache_resource)]
    )
    def test_clear_single_cache(self, _, cache_decorator):
        """It's safe to clear a single function cache from multiple threads."""

        @cache_decorator
        def foo():
            return 42

        # Populate the cache
        foo()

        def clear_foo(_: int) -> None:
            foo.clear()

        # Clear it from a bunch of threads and assert no errors.
        call_on_threads(clear_foo, self.NUM_THREADS)

        # Sanity check: ensure we can still call our cached function.
        self.assertEqual(42, foo())

    @parameterized.expand(
        [
            ("cache_data", CACHE_DATA_MESSAGE_REPLAY_CTX),
            ("cache_resource", CACHE_RESOURCE_MESSAGE_REPLAY_CTX),
        ]
    )
    def test_multithreaded_call_stack(self, _, call_stack):
        """CachedFunctionCallStack works across multiple threads."""

        def get_counter():
            return len(call_stack._cached_func_stack)

        def set_counter(val):
            call_stack._cached_func_stack = ["foo"] * val

        self.assertEqual(0, get_counter())
        set_counter(1)
        self.assertEqual(1, get_counter())

        values_in_thread = []

        def thread_test():
            values_in_thread.append(get_counter())
            set_counter(55)
            values_in_thread.append(get_counter())

        thread = ExceptionCapturingThread(target=thread_test)
        thread.start()
        thread.join()
        thread.assert_no_unhandled_exception()

        self.assertEqual([0, 55], values_in_thread)

        # The other thread should not have modified the main thread
        self.assertEqual(1, get_counter())


class WidgetReplayInteractionTest(InteractiveScriptTests):
    def test_dynamic_widget_replay(self):
        script = self.script_from_filename(__file__, "cached_widget_replay_dynamic.py")

        sr = script.run()
        assert len(sr.get("checkbox")) == 1
        assert sr.get("text")[0].value == "['foo']"

        sr2 = sr.get("checkbox")[0].check().run()
        assert len(sr2.get("multiselect")) == 1
        assert sr2.get("text")[0].value == "[]"

        sr3 = sr2.get("multiselect")[0].select("baz").run()
        assert sr3.get("text")[0].value == "['baz']"

        sr4 = sr3.get("checkbox")[0].uncheck().run()
        sr5 = sr4.get("button")[0].click().run()
        assert sr5.get("text")[0].value == "['foo']"


class WidgetReplayTest(InteractiveScriptTests):
    def test_arrow_replay(self):
        """Regression test for https://github.com/streamlit/streamlit/issues/6103"""
        script = self.script_from_filename(__file__, "arrow_replay.py")

        sr = script.run()
        assert len(sr.get("exception")) == 0
