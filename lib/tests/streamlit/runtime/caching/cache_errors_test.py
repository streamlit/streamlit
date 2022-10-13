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

import threading

import streamlit as st
from streamlit.elements import exception
from streamlit.proto.Exception_pb2 import Exception as ExceptionProto
from streamlit.runtime.caching.cache_errors import (
    UnhashableParamError,
    UnserializableReturnValueError,
    get_return_value_type,
)
from tests import testutil


class CacheErrorsTest(testutil.DeltaGeneratorTestCase):
    """Make sure user-visible error messages look correct.

    These errors are a little annoying to test, but they're important! So we
    are testing them word-for-word as much as possible. Even though this
    *feels* like an antipattern, it isn't: we're making sure the codepaths
    that pull useful debug info from the code are working.

    TODO: parameterize these tests for both memo + singleton
    """

    maxDiff = None

    def test_unhashable_type(self):
        @st.experimental_memo
        def unhashable_type_func(lock: threading.Lock):
            return str(lock)

        with self.assertRaises(UnhashableParamError) as cm:
            unhashable_type_func(threading.Lock())

        ep = ExceptionProto()
        exception.marshall(ep, cm.exception)

        self.assertEqual(ep.type, "UnhashableParamError")

        expected_message = """
Cannot hash argument 'lock' (of type `_thread.lock`) in 'unhashable_type_func'.

To address this, you can tell Streamlit not to hash this argument by adding a
leading underscore to the argument's name in the function signature:

```
@st.experimental_memo
def unhashable_type_func(_lock, ...):
    ...
```
                    """

        self.assertEqual(
            testutil.normalize_md(expected_message), testutil.normalize_md(ep.message)
        )
        # Stack trace doesn't show in test :(
        # self.assertNotEqual(len(ep.stack_trace), 0)
        self.assertEqual(ep.message_is_markdown, True)
        self.assertEqual(ep.is_warning, False)

    def test_unserializable_return_value_error(self):
        @st.experimental_memo
        def unserializable_return_value_func():
            return threading.Lock()

        with self.assertRaises(UnserializableReturnValueError) as cm:
            unserializable_return_value_func()

        ep = ExceptionProto()
        exception.marshall(ep, cm.exception)

        self.assertEqual(ep.type, "UnserializableReturnValueError")

        expected_message = f"""
            Cannot serialize the return value (of type {get_return_value_type(return_value=threading.Lock())}) in `unserializable_return_value_func()`.  
            `st.experimental_memo` uses [pickle](https://docs.python.org/3/library/pickle.html) to 
            serialize the function’s return value and safely store it in the cache without mutating the original object. Please convert the return value to a pickle-serializable type.  
            If you want to cache unserializable objects such as database connections or Tensorflow 
            sessions, use `st.experimental_singleton` instead (see [our docs](https://docs.streamlit.io/library/advanced-features/experimental-cache-primitives) for differences)."""

        self.assertEqual(
            testutil.normalize_md(expected_message), testutil.normalize_md(ep.message)
        )
        self.assertEqual(ep.message_is_markdown, True)
        self.assertEqual(ep.is_warning, False)
