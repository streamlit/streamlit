# Copyright 2018-2021 Streamlit Inc.
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
import threading

import streamlit as st
from streamlit.caching.cache_errors import UnhashableParamError
from tests import testutil
from streamlit.elements import exception
from streamlit.proto.Exception_pb2 import Exception as ExceptionProto


class CacheErrorsTest(testutil.DeltaGeneratorTestCase):
    """Make sure user-visible error messages look correct.

    These errors are a little annoying to test, but they're important! So we
    are testing them word-for-word as much as possible. Even though this
    *feels* like an antipattern, it isn't: we're making sure the codepaths
    that pull useful debug info from the code are working.

    TODO: parameterize these tests for both memo + singleton
    """

    def test_st_warning_text(self):
        @st.experimental_memo
        def st_warning_text_func():
            st.markdown("hi")

        st_warning_text_func()

        el = self.get_delta_from_queue(-2).new_element
        self.assertEqual("CachedStFunctionWarning", el.exception.type)

        expected_message = """
Your script uses `st.markdown()` or `st.write()` to write to your Streamlit app
from within some cached code at `st_warning_text_func()`. This code will only be
called when we detect a cache "miss", which can lead to unexpected results.

How to fix this:
* Move the `st.markdown()` or `st.write()` call outside `st_warning_text_func()`.
* Or, if you know what you're doing, use `@st.experimental_memo(suppress_st_warning=True)`
to suppress the warning.
        """
        self.assertEqual(
            testutil.normalize_md(expected_message),
            testutil.normalize_md(el.exception.message),
        )
        self.assertNotEqual(len(el.exception.stack_trace), 0)
        self.assertEqual(el.exception.message_is_markdown, True)
        self.assertEqual(el.exception.is_warning, True)

        el = self.get_delta_from_queue(-1).new_element
        self.assertEqual(el.markdown.body, "hi")

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
