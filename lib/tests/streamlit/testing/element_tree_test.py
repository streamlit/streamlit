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

from unittest.mock import patch

import pytest

from tests.script_interactions import InteractiveScriptTests


@patch("streamlit.source_util._cached_pages", new=None)
class CheckboxTest(InteractiveScriptTests):
    def test_value(self):
        script = self.script_from_string(
            "checkbox_test.py",
            """
            import streamlit as st

            st.checkbox("defaults")
            st.checkbox("defaulted on", True)
            """,
        )
        sr = script.run()
        assert sr.get("checkbox")
        assert sr.get("checkbox")[0].value == False
        assert sr.get("checkbox")[1].value == True

        sr2 = sr.get("checkbox")[0].check().run()
        assert sr2.get("checkbox")[0].value == True
        assert sr2.get("checkbox")[1].value == True

        sr3 = sr2.get("checkbox")[1].uncheck().run()
        assert sr3.get("checkbox")[0].value == True
        assert sr3.get("checkbox")[1].value == False


@pytest.mark.xfail(reason="button does not work correctly with session state")
@patch("streamlit.source_util._cached_pages", new=None)
class ButtonTest(InteractiveScriptTests):
    def test_value(self):
        script = self.script_from_string(
            "button_test.py",
            """
            import streamlit as st

            st.button("button")
            st.button("second button")
            """,
        )
        sr = script.run()
        assert sr.get("button")[0].value == False
        assert sr.get("button")[1].value == False

        sr2 = sr.get("button")[0].click().run()
        assert sr2.get("button")[0].value == True
        assert sr2.get("button")[1].value == False

        sr3 = sr2.run()
        assert sr3.get("button")[0].value == False
        assert sr3.get("button")[1].value == False


@patch("streamlit.source_util._cached_pages", new=None)
class MultiselectTest(InteractiveScriptTests):
    def test_value(self):
        script = self.script_from_string(
            "multiselect_test.py",
            """
            import streamlit as st

            st.multiselect("one", options=["a", "b", "c"])
            st.multiselect("two", options=["zero", "one", "two"], default=["two"])
            """,
        )
        sr = script.run()
        assert sr.get("multiselect")[0].value == []
        assert sr.get("multiselect")[1].value == ["two"]

        sr2 = sr.get("multiselect")[0].select("b").run()
        assert sr2.get("multiselect")[0].value == ["b"]
        assert sr2.get("multiselect")[1].value == ["two"]

        sr3 = sr2.get("multiselect")[1].select("zero").select("one").run()
        assert sr3.get("multiselect")[0].value == ["b"]
        assert set(sr3.get("multiselect")[1].value) == set(["zero", "one", "two"])

        sr4 = sr3.get("multiselect")[0].unselect("b").run()
        assert sr4.get("multiselect")[0].value == []
        assert set(sr3.get("multiselect")[1].value) == set(["zero", "one", "two"])


@patch("streamlit.source_util._cached_pages", new=None)
class MarkdownTest(InteractiveScriptTests):
    def test_markdown(self):
        script = self.script_from_string(
            "markdown_element.py",
            """
            import streamlit as st

            st.markdown("**This is a markdown**")
            """,
        )
        sr = script.run()

        assert sr.get("markdown")
        assert sr.get("markdown")[0].type == "markdown"
        assert sr.get("markdown")[0].value == "**This is a markdown**"

    def test_caption(self):
        script = self.script_from_string(
            "caption_element.py",
            """
            import streamlit as st

            st.caption("This is a caption")
            """,
        )
        sr = script.run()

        assert sr.get("caption")
        assert sr.get("caption")[0].type == "caption"
        assert sr.get("caption")[0].value == "This is a caption"
        assert sr.get("caption")[0].is_caption

    def test_code(self):
        script = self.script_from_string(
            "code_element.py",
            """
            import streamlit as st

            st.code("import streamlit as st")
            """,
        )
        sr = script.run()

        assert sr.get("code")
        assert sr.get("code")[0].type == "code"
        assert sr.get("code")[0].value == "```python\nimport streamlit as st\n```"

    def test_latex(self):
        script = self.script_from_string(
            "latex_element.py",
            """
            import streamlit as st

            st.latex("E=mc^2")
            """,
        )
        sr = script.run()

        assert sr.get("latex")
        assert sr.get("latex")[0].type == "latex"
        assert sr.get("latex")[0].value == "$$\nE=mc^2\n$$"

    def test_markdown_elements_by_type(self):
        script = self.script_from_string(
            "markdown_element.py",
            """
            import streamlit as st

            st.markdown("**This is a markdown1**")
            st.caption("This is a caption1")
            st.code("print('hello world1')")
            st.latex("sin(2x)=2sin(x)cos(x)")

            st.markdown("**This is a markdown2**")
            st.caption("This is a caption2")
            st.code("print('hello world2')")
            st.latex("cos(2x)=cos^2(x)-sin^2(x)")
            """,
        )
        sr = script.run()

        assert len(sr.get("markdown")) == 2
        assert len(sr.get("caption")) == 2
        assert len(sr.get("code")) == 2
        assert len(sr.get("latex")) == 2


@patch("streamlit.source_util._cached_pages", new=None)
class HeadingTest(InteractiveScriptTests):
    def test_title(self):
        script = self.script_from_string(
            "title_element.py",
            """
            import streamlit as st

            st.title("This is a title")
            st.title("This is a title with anchor", anchor="anchor text")
            """,
        )
        sr = script.run()

        assert len(sr.get("title")) == 2
        assert sr.get("title")[1].tag == "h1"
        assert sr.get("title")[1].anchor == "anchor text"
        assert sr.get("title")[1].value == "This is a title with anchor"

    def test_header(self):
        script = self.script_from_string(
            "header_element.py",
            """
            import streamlit as st

            st.header("This is a header")
            st.header("This is a header with anchor", anchor="header anchor text")
            """,
        )
        sr = script.run()

        assert len(sr.get("header")) == 2
        assert sr.get("header")[1].tag == "h2"
        assert sr.get("header")[1].anchor == "header anchor text"
        assert sr.get("header")[1].value == "This is a header with anchor"

    def test_subheader(self):
        script = self.script_from_string(
            "subheader_element.py",
            """
            import streamlit as st

            st.subheader("This is a subheader")
            st.subheader(
                "This is a subheader with anchor",
                anchor="subheader anchor text"
            )
            """,
        )
        sr = script.run()

        assert len(sr.get("subheader")) == 2
        assert sr.get("subheader")[1].tag == "h3"
        assert sr.get("subheader")[1].anchor == "subheader anchor text"
        assert sr.get("subheader")[1].value == "This is a subheader with anchor"

    def test_heading_elements_by_type(self):
        script = self.script_from_string(
            "heading_elements.py",
            """
            import streamlit as st

            st.title("title1")
            st.header("header1")
            st.subheader("subheader1")

            st.title("title2")
            st.header("header2")
            st.subheader("subheader2")
            """,
        )
        sr = script.run()

        assert len(sr.get("title")) == 2
        assert len(sr.get("header")) == 2
        assert len(sr.get("subheader")) == 2
