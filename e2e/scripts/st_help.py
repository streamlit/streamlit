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

import streamlit as st
from streamlit.elements.doc_string import _get_scriptrunner_frame

if _get_scriptrunner_frame() is None:
    st.warning(
        """
        You're running this script in an `exec` context, so the `foo` part
        of `st.help(foo)` will not appear inside the displayed `st.help` element.
        """
    )

# Testing case where there are no docs.
st.help(st.net_util)

# Testing case where there are no members.
st.help(globals)

# Test case where there the docs need to scroll,
# and test case where some members doesn't have docs.
class Foo:
    """My docstring.

    This is a very long one! You probably need to scroll, scroll, scroll, scroll,
    scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll,
    scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll,
    scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll,
    scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll,
    scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll.

    Scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll,
    scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll,
    scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll,
    scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll.

    Scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll,
    scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll,
    scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll,
    scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll.

    Scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll,
    scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll,
    scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll,
    scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll.

    Scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll,
    scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll,
    scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll,
    scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll, scroll.
    """

    def __init__(self):
        self.my_var_1 = 123

    def my_func_1(self, a, b=False):
        "Func with doc."

    def my_func_2(self):
        # Func without doc.
        pass


f = Foo()

f
