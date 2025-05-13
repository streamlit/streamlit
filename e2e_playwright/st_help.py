# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
class FooWithNoDocs:
    my_static_var_1 = 123


st.container(key="help_no_docs").help(FooWithNoDocs)

# Testing case where there are no members.
st.container(key="help_globals").help(globals)


# Test case where there the docs need to scroll
class FooWithLongDocs:
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


f = FooWithLongDocs()

st.container(key="help_long_docs").help(f)


class FooWithMixedDocs:
    """My docstring."""

    def __init__(self):
        self.my_var_1 = 123

    def my_func_1(self, a: int, b: bool = False) -> None:
        """Func with doc."""

    def my_func_2(self):
        # Func without doc.
        pass


st.container(key="help_mixed_docs").help(FooWithMixedDocs())


# Create a class with very long documentation to demonstrate width differences
class LongDocumentationClass:
    """Class with very long documentation to demonstrate width differences.

    This documentation is intentionally long to show how different width settings affect
    the display of help text. The content should be long enough to wrap and show the
    difference between stretch and fixed width settings.

    Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore
    eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident,
    sunt in culpa qui officia deserunt mollit anim id est laborum.
    """

    def __init__(self):
        self.some_attribute = "This is a sample attribute"
        self.another_attribute = "This is another attribute"
        self.third_attribute = "This is a third attribute"
        self.fourth_attribute = "This is a fourth attribute"
        self.fifth_attribute = "This is a fifth attribute"


# Create instances for testing
long_doc_instance = LongDocumentationClass()

# Test different width configurations
st.help(long_doc_instance, width=300)
st.help(long_doc_instance, width="stretch")
