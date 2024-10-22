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

"""st.cache_data unit tests."""

from __future__ import annotations

import logging
import os
import pickle
import re
import threading
import unittest
from typing import Any
from unittest.mock import MagicMock, Mock, mock_open, patch

from parameterized import parameterized

import streamlit as st
from streamlit import file_util
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Text_pb2 import Text as TextProto
from streamlit.runtime import Runtime
from streamlit.runtime.caching import cached_message_replay
from streamlit.runtime.caching.cache_data_api import get_data_cache_stats_provider
from streamlit.runtime.caching.cache_errors import CacheError
from streamlit.runtime.caching.cached_message_replay import (
    CachedResult,
    ElementMsgData,
)
from streamlit.runtime.caching.hashing import UserHashError
from streamlit.runtime.caching.storage import (
    CacheStorage,
    CacheStorageContext,
    CacheStorageManager,
)
from streamlit.runtime.caching.storage.cache_storage_protocol import (
    InvalidCacheStorageContext,
)
from streamlit.runtime.caching.storage.dummy_cache_storage import (
    DummyCacheStorage,
    MemoryCacheStorageManager,
)
from streamlit.runtime.caching.storage.local_disk_cache_storage import (
    LocalDiskCacheStorageManager,
    get_cache_folder_path,
)
from streamlit.runtime.scriptrunner import add_script_run_ctx
from streamlit.runtime.stats import CacheStat
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


def as_cached_result(value: Any) -> CachedResult:
    return _as_cached_result(value)


def as_replay_test_data() -> CachedResult:
    """Creates cached results for a function that returned 1
    and executed `st.text(1)`.
    """
    return CachedResult(
        1,
        [ElementMsgData("text", TextProto(body="1"), st._main.id, "")],
        st._main.id,
        st.sidebar.id,
    )


class CacheDataTest(unittest.TestCase):
    def setUp(self) -> None:
        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())
        mock_runtime = MagicMock(spec=Runtime)
        mock_runtime.cache_storage_manager = MemoryCacheStorageManager()
        Runtime._instance = mock_runtime

    def tearDown(self):
        # Some of these tests reach directly into _cache_info and twiddle it.
        # Reset default values on teardown.
        st.cache_data.clear()

    @patch.object(st, "exception")
    def test_mutate_return(self, exception):
        """Mutating a memoized return value is legal, and *won't* affect
        future accessors of the data."""

        @st.cache_data
        def f():
            return [0, 1]

        r1 = f()

        r1[0] = 1

        r2 = f()

        exception.assert_not_called()

        self.assertEqual(r1, [1, 1])
        self.assertEqual(r2, [0, 1])

    def test_cached_member_function_with_hash_func(self):
        """@st.cache_data can be applied to class member functions
        with corresponding hash_func.
        """

        class TestClass:
            @st.cache_data(
                hash_funcs={
                    "tests.streamlit.runtime.caching.cache_data_api_test.CacheDataTest.test_cached_member_function_with_hash_func.<locals>.TestClass": id
                }
            )
            def member_func(self):
                return "member func!"

            @classmethod
            @st.cache_data
            def class_method(cls):
                return "class method!"

            @staticmethod
            @st.cache_data
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

        @st.cache_data(hash_funcs={str: str_hash_func})
        def foo(string_arg):
            return []

        # If our str hash_func is called multiple times, it's probably because
        # it's being used to compute the function's function_key (as opposed to
        # the value_key). It should only be used to compute the value_key!
        foo("ahoy")
        str_hash_func.assert_called_once_with("ahoy")

    @patch("streamlit.runtime.caching.cache_data_api.show_widget_replay_deprecation")
    def test_widget_replay_deprecation(self, show_warning_mock: Mock):
        """We show deprecation warnings when using the `experimental_allow_widgets` parameter."""

        # We show the deprecation warning at declaration time:
        @st.cache_data(experimental_allow_widgets=True)
        def foo():
            return 42

        show_warning_mock.assert_called_once()

    def test_user_hash_error(self):
        class MyObj:
            # we specify __repr__ here, to avoid `MyObj object at 0x1347a3f70`
            # in error message
            def __repr__(self):
                return "MyObj class"

        def bad_hash_func(x):
            x += 10  # Throws a TypeError since x has type MyObj.
            return x

        @st.cache_data(hash_funcs={MyObj: bad_hash_func})
        def user_hash_error_func(x):
            pass

        with self.assertRaises(UserHashError) as ctx:
            my_obj = MyObj()
            user_hash_error_func(my_obj)

        expected_message = """unsupported operand type(s) for +=: 'MyObj' and 'int'

This error is likely due to a bug in `bad_hash_func()`, which is a
user-defined hash function that was passed into the `@st.cache_data` decorator of
`user_hash_error_func()`.

`bad_hash_func()` failed when hashing an object of type
`tests.streamlit.runtime.caching.cache_data_api_test.CacheDataTest.test_user_hash_error.<locals>.MyObj`.  If you don't know where that object is coming from,
try looking at the hash chain below for an object that you do recognize, then
pass that to `hash_funcs` instead:

```
Object of type tests.streamlit.runtime.caching.cache_data_api_test.CacheDataTest.test_user_hash_error.<locals>.MyObj: MyObj class
```

If you think this is actually a Streamlit bug, please
[file a bug report here](https://github.com/streamlit/streamlit/issues/new/choose)."""
        self.assertEqual(str(ctx.exception), expected_message)

    def test_cached_st_function_clear_args(self):
        self.x = 0

        @st.cache_data()
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
            @st.cache_data
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
            @st.cache_data
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


class CacheDataPersistTest(DeltaGeneratorTestCase):
    """st.cache_data disk persistence tests"""

    def setUp(self) -> None:
        super().setUp()
        mock_runtime = MagicMock(spec=Runtime)
        mock_runtime.cache_storage_manager = LocalDiskCacheStorageManager()
        Runtime._instance = mock_runtime

    def tearDown(self) -> None:
        st.cache_data.clear()
        super().tearDown()

    @patch("streamlit.runtime.caching.storage.local_disk_cache_storage.streamlit_write")
    def test_dont_persist_by_default(self, mock_write):
        @st.cache_data
        def foo():
            return "data"

        foo()
        mock_write.assert_not_called()

    @patch("streamlit.runtime.caching.storage.local_disk_cache_storage.streamlit_write")
    def test_persist_path(self, mock_write):
        """Ensure we're writing to ~/.streamlit/cache/*.memo"""

        @st.cache_data(persist="disk")
        def foo():
            return "data"

        foo()
        mock_write.assert_called_once()

        write_path = mock_write.call_args[0][0]
        match = re.fullmatch(
            r"/mock/home/folder/.streamlit/cache/.*?\.memo", write_path
        )
        self.assertIsNotNone(match)

    @patch("streamlit.file_util.os.stat", MagicMock())
    @patch(
        "streamlit.file_util.open",
        mock_open(read_data=pickle.dumps(as_cached_result("mock_pickled_value"))),
    )
    @patch(
        "streamlit.runtime.caching.storage.local_disk_cache_storage.streamlit_read",
        wraps=file_util.streamlit_read,
    )
    def test_read_persisted_data(self, mock_read):
        """We should read persisted data from disk on cache miss."""

        @st.cache_data(persist="disk")
        def foo():
            return "actual_value"

        data = foo()
        mock_read.assert_called_once()
        self.assertEqual("mock_pickled_value", data)

    @patch("streamlit.file_util.os.stat", MagicMock())
    @patch("streamlit.file_util.open", mock_open(read_data="bad_pickled_value"))
    @patch(
        "streamlit.runtime.caching.storage.local_disk_cache_storage.streamlit_read",
        wraps=file_util.streamlit_read,
    )
    def test_read_bad_persisted_data(self, mock_read):
        """If our persisted data is bad, we raise an exception."""

        @st.cache_data(persist="disk")
        def foo():
            return "actual_value"

        with self.assertRaises(CacheError) as error:
            foo()
        mock_read.assert_called_once()
        self.assertEqual("Unable to read from cache", str(error.exception))

    @patch("streamlit.file_util.os.stat", MagicMock())
    @patch("streamlit.file_util.open", mock_open(read_data=b"bad_binary_pickled_value"))
    @patch(
        "streamlit.runtime.caching.storage.local_disk_cache_storage.streamlit_read",
        wraps=file_util.streamlit_read,
    )
    def test_read_bad_persisted_binary_data(self, mock_read):
        """If our persisted data is bad, we raise an exception."""

        @st.cache_data(persist="disk")
        def foo():
            return "actual_value"

        with self.assertRaises(CacheError) as error:
            foo()
        mock_read.assert_called_once()
        self.assertIn("Failed to unpickle", str(error.exception))

    def test_bad_persist_value(self):
        """Throw an error if an invalid value is passed to 'persist'."""
        with self.assertRaises(StreamlitAPIException) as e:

            @st.cache_data(persist="yesplz")
            def foo():
                pass

        self.assertEqual(
            "Unsupported persist option 'yesplz'. Valid values are 'disk' or None.",
            str(e.exception),
        )

    @patch("shutil.rmtree")
    def test_clear_all_disk_caches(self, mock_rmtree):
        """`clear_all` should remove the disk cache directory if it exists."""

        # If the cache dir exists, we should delete it.
        with patch("os.path.isdir", MagicMock(return_value=True)):
            st.cache_data.clear()
            mock_rmtree.assert_called_once_with(get_cache_folder_path())

        mock_rmtree.reset_mock()

        # If the cache dir does not exist, we shouldn't try to delete it.
        with patch("os.path.isdir", MagicMock(return_value=False)):
            st.cache_data.clear()
            mock_rmtree.assert_not_called()

    @patch("streamlit.file_util.os.stat", MagicMock())
    @patch(
        "streamlit.file_util.open",
        wraps=mock_open(read_data=pickle.dumps(as_cached_result("mock_pickled_value"))),
    )
    @patch("streamlit.runtime.caching.storage.local_disk_cache_storage.os.remove")
    def test_clear_one_disk_cache(self, mock_os_remove: Mock, mock_open: Mock):
        """A memoized function's clear_cache() property should just clear
        that function's cache."""

        @st.cache_data(persist="disk")
        def foo(val):
            return "actual_value"

        foo(0)
        foo(1)

        # We should've opened two files, one for each distinct "foo" call.
        self.assertEqual(2, mock_open.call_count)

        # Get the names of the two files that were created. These will look
        # something like '/mock/home/folder/.streamlit/cache/[long_hash].memo'
        created_filenames = {
            mock_open.call_args_list[0][0][0],
            mock_open.call_args_list[1][0][0],
        }

        created_files_base_names = [
            os.path.basename(filename) for filename in created_filenames
        ]

        mock_os_remove.assert_not_called()

        with patch(
            "os.listdir", MagicMock(return_value=created_files_base_names)
        ), patch("os.path.isdir", MagicMock(return_value=True)):
            # Clear foo's cache
            foo.clear()

        # os.remove should have been called once for each of our created cache files
        self.assertEqual(2, mock_os_remove.call_count)

        removed_filenames = {
            mock_os_remove.call_args_list[0][0][0],
            mock_os_remove.call_args_list[1][0][0],
        }

        # The two files we removed should be the same two files we created.
        self.assertEqual(created_filenames, removed_filenames)

    @patch("streamlit.file_util.os.stat", MagicMock())
    @patch(
        "streamlit.file_util.open",
        wraps=mock_open(read_data=pickle.dumps(as_replay_test_data())),
    )
    def test_cached_st_function_replay(self, _):
        @st.cache_data(persist="disk")
        def foo(i):
            st.text(i)
            return i

        foo(1)

        deltas = self.get_all_deltas_from_queue()
        text = [
            element.text.body
            for element in (delta.new_element for delta in deltas)
            if element.WhichOneof("type") == "text"
        ]
        assert text == ["1"]

    @patch("streamlit.file_util.os.stat", MagicMock())
    @patch(
        "streamlit.runtime.caching.storage.local_disk_cache_storage.streamlit_write",
        MagicMock(),
    )
    @patch(
        "streamlit.file_util.open",
        wraps=mock_open(read_data=pickle.dumps(1)),
    )
    def test_cached_st_function_clear_args_persist(self, _):
        self.x = 0

        @st.cache_data(persist="disk")
        def foo(y):
            self.x += y
            return self.x

        assert foo(1) == 1
        foo.clear(2)
        assert foo(1) == 1
        foo.clear(1)
        assert foo(1) == 2

    @patch("streamlit.file_util.os.stat", MagicMock())
    @patch(
        "streamlit.runtime.caching.storage.local_disk_cache_storage.streamlit_write",
        MagicMock(),
    )
    @patch(
        "streamlit.file_util.open",
        wraps=mock_open(read_data=pickle.dumps(1)),
    )
    def test_cached_format_migration(self, _):
        @st.cache_data(persist="disk")
        def foo(i):
            st.text(i)
            return i

        # Executes normally, without raising any errors
        foo(1)

    @patch("streamlit.runtime.caching.storage.local_disk_cache_storage.streamlit_write")
    def test_warning_memo_ttl_persist(self, _):
        """Using @st.cache_data with ttl and persist produces a warning."""
        with self.assertLogs(
            "streamlit.runtime.caching.storage.local_disk_cache_storage",
            level=logging.WARNING,
        ) as logs:

            @st.cache_data(ttl=60, persist="disk")
            def user_function():
                return 42

            st.write(user_function())

            output = "".join(logs.output)
            self.assertIn(
                "The cached function 'user_function' has a TTL that will be ignored.",
                output,
            )

    @parameterized.expand(
        [
            ("disk", "disk", True),
            ("True", True, True),
            ("None", None, False),
            ("False", False, False),
        ]
    )
    @patch("streamlit.runtime.caching.storage.local_disk_cache_storage.streamlit_write")
    def test_persist_param_value(
        self,
        _,
        persist_value: str | bool | None,
        should_persist: bool,
        mock_write: Mock,
    ):
        """Passing "disk" or `True` enables persistence; `None` or `False` disables it."""

        @st.cache_data(persist=persist_value)
        def foo():
            return "data"

        foo()

        if should_persist:
            mock_write.assert_called_once()
        else:
            mock_write.assert_not_called()


class CacheDataStatsProviderTest(unittest.TestCase):
    def setUp(self):
        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())
        mock_runtime = MagicMock(spec=Runtime)
        mock_runtime.cache_storage_manager = MemoryCacheStorageManager()
        Runtime._instance = mock_runtime

        # Guard against external tests not properly cache-clearing
        # in their teardowns.
        st.cache_data.clear()

    def tearDown(self):
        st.cache_data.clear()

    def test_no_stats(self):
        self.assertEqual([], get_data_cache_stats_provider().get_stats())

    def test_multiple_stats(self):
        @st.cache_data
        def foo(count):
            return [3.14] * count

        @st.cache_data
        def bar():
            return "shivermetimbers"

        foo(1)
        foo(53)
        bar()
        bar()

        foo_cache_name = f"{foo.__module__}.{foo.__qualname__}"
        bar_cache_name = f"{bar.__module__}.{bar.__qualname__}"

        expected = [
            CacheStat(
                category_name="st_cache_data",
                cache_name=foo_cache_name,
                byte_length=(
                    get_byte_length(as_cached_result([3.14] * 53))
                    + get_byte_length(as_cached_result([3.14]))
                ),
            ),
            CacheStat(
                category_name="st_cache_data",
                cache_name=bar_cache_name,
                byte_length=get_byte_length(as_cached_result("shivermetimbers")),
            ),
        ]

        # The order of these is non-deterministic, so check Set equality
        # instead of List equality
        self.assertEqual(
            set(expected), set(get_data_cache_stats_provider().get_stats())
        )


class CacheDataValidateParamsTest(DeltaGeneratorTestCase):
    """st.cache_data disk persistence tests"""

    def setUp(self) -> None:
        super().setUp()
        mock_runtime = MagicMock(spec=Runtime)
        mock_runtime.cache_storage_manager = AlwaysFailingTestCacheStorageManager()
        Runtime._instance = mock_runtime

    def test_error_logged_and_raised_on_improperly_configured_cache_data(self):
        with self.assertRaises(InvalidCacheStorageContext) as e, self.assertLogs(
            "streamlit.runtime.caching.cache_data_api", level=logging.ERROR
        ) as logs:

            @st.cache_data(persist="disk")
            def foo():
                return "data"

        self.assertEqual(str(e.exception), "This CacheStorageManager always fails")
        output = "".join(logs.output)
        self.assertIn("This CacheStorageManager always fails", output)


class CacheDataMessageReplayTest(DeltaGeneratorTestCase):
    def setUp(self):
        super().setUp()
        # Guard against external tests not properly cache-clearing
        # in their teardowns.
        st.cache_data.clear()

    def tearDown(self):
        st.cache_data.clear()

    @parameterized.expand(WIDGET_ELEMENTS)
    def test_shows_cached_widget_replay_warning(
        self, _widget_name: str, widget_producer: ELEMENT_PRODUCER
    ):
        """Test that a warning is shown when a widget is created inside a cached function."""

        if _widget_name == "experimental_audio_input":
            # The experimental_audio_input element produces also a deprecation warning
            # which makes this test irrelevant
            return

        @st.cache_data(show_spinner=False)
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

        @st.cache_data
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


def get_byte_length(value):
    """Return the byte length of the pickled value."""
    return len(pickle.dumps(value))


class AlwaysFailingTestCacheStorageManager(CacheStorageManager):
    """A CacheStorageManager that always fails in check_context."""

    def create(self, context: CacheStorageContext) -> CacheStorage:
        return DummyCacheStorage()

    def clear_all(self) -> None:
        pass

    def check_context(self, context: CacheStorageContext) -> None:
        raise InvalidCacheStorageContext("This CacheStorageManager always fails")
