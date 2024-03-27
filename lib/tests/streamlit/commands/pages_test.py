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

from pathlib import Path

import pytest

import streamlit as st
from streamlit.commands.pages import Page
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class PagesTest(DeltaGeneratorTestCase):
    def test_basic_page_creation(self):
        p1 = Page("foo.py")
        assert p1.title == "foo"
        assert p1.icon == ""
        assert p1.default == False
        assert p1.url_path == "foo"

        p2 = Page(Path("foo.py"))
        assert p2.title == "foo"
        assert p2.icon == ""
        assert p2.default == False
        assert p2.url_path == "foo"

        def foo():
            st.text("foo")

        p3 = Page(foo)
        assert p3.title == "foo"
        assert p3.icon == ""
        assert p3.default == False
        assert p3.url_path == "foo"

    def test_inferred_attributes(self):
        p1 = Page("😰_123.py")
        assert p1.title == "123"
        assert p1.icon == "😰"
        assert p1.url_path == "123"

        p2 = Page("foobar.py", default=True)
        assert p2.url_path == ""

    def test_navigation_explicit_default(self):
        p1 = Page("foo.py")
        p2 = Page(Path("baz/bar.py"), default=True)
        p3 = Page(Path("quux.py"))

        pg = st.navigation([p1, p2, p3])
        # Uses the explicitly set default
        assert pg == p2

    def test_navigation_unspecified_default(self):
        p1 = Page("foo.py")
        p2 = Page(Path("baz/bar.py"))
        p3 = Page(Path("quux.py"))

        pg = st.navigation([p1, p2, p3])
        # Falls back to the first one
        assert pg == p1

    def test_navigation_multiple_defaults_throws(self):
        p1 = Page("foo.py")
        p2 = Page(Path("baz/bar.py"), default=True)
        p3 = Page(Path("quux.py"), default=True)

        with pytest.raises(StreamlitAPIException):
            st.navigation([p1, p2, p3])
