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

from datetime import datetime, time

import pytest

from streamlit.elements.markdown import MARKDOWN_HORIZONTAL_RULE_EXPRESSION
from streamlit.testing.script_interactions import InteractiveScriptTests


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
        assert sr.get("code")[0].value == "import streamlit as st"

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

    def test_divider(self):
        script = self.script_from_string(
            "divider_element.py",
            """
            import streamlit as st

            st.divider()
            """,
        )
        sr = script.run()

        assert sr.get("divider")
        assert sr.get("divider")[0].type == "divider"
        assert sr.get("divider")[0].value == MARKDOWN_HORIZONTAL_RULE_EXPRESSION

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


class HeadingTest(InteractiveScriptTests):
    def test_title(self):
        script = self.script_from_string(
            "title_element.py",
            """
            import streamlit as st

            st.title("This is a title")
            st.title("This is a title with anchor", anchor="anchor text")
            st.title("This is a title with hidden anchor", anchor=False)
            """,
        )
        sr = script.run()

        assert len(sr.get("title")) == 3
        assert sr.get("title")[1].tag == "h1"
        assert sr.get("title")[1].anchor == "anchor text"
        assert sr.get("title")[1].value == "This is a title with anchor"
        assert sr.get("title")[2].hide_anchor

    def test_header(self):
        script = self.script_from_string(
            "header_element.py",
            """
            import streamlit as st

            st.header("This is a header")
            st.header("This is a header with anchor", anchor="header anchor text")
            st.header("This is a header with hidden anchor", anchor=False)
            """,
        )
        sr = script.run()

        assert len(sr.get("header")) == 3
        assert sr.get("header")[1].tag == "h2"
        assert sr.get("header")[1].anchor == "header anchor text"
        assert sr.get("header")[1].value == "This is a header with anchor"
        assert sr.get("header")[2].hide_anchor

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
            st.subheader("This is a subheader with hidden anchor", anchor=False)
            """,
        )
        sr = script.run()

        assert len(sr.get("subheader")) == 3
        assert sr.get("subheader")[1].tag == "h3"
        assert sr.get("subheader")[1].anchor == "subheader anchor text"
        assert sr.get("subheader")[1].value == "This is a subheader with anchor"
        assert sr.get("subheader")[2].hide_anchor

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


class SliderTest(InteractiveScriptTests):
    def test_value(self):
        script = self.script_from_string(
            "slider_test.py",
            """
            import streamlit as st
            from datetime import datetime, time

            st.slider("defaults")
            st.slider("int", min_value=-100, max_value=100, step=5, value=10)
            st.slider("time", value=(time(11, 30), time(12, 45)))
            st.slider("datetime", value=datetime(2020, 1, 1, 9, 30))
            st.slider("float", min_value=0.0, max_value=1.0, step=0.01)
            """,
        )
        sr = script.run()
        s = sr.get("slider")
        assert s[0].value == 0
        assert s[1].value == 10
        assert s[2].value == (time(11, 30), time(12, 45))
        assert s[3].value == datetime(2020, 1, 1, 9, 30)
        assert s[4].value == 0.0

        sr2 = sr.get("slider")[1].set_value(50).run()
        sr3 = sr2.get("slider")[2].set_range(time(12, 0), time(12, 15)).run()
        sr4 = sr3.get("slider")[3].set_value(datetime(2020, 1, 10, 8, 0)).run()
        sr5 = sr4.get("slider")[4].set_value(0.1).run()
        s = sr5.get("slider")
        assert s[0].value == 0
        assert s[1].value == 50
        assert s[2].value == (time(12, 0), time(12, 15))
        assert s[3].value == datetime(2020, 1, 10, 8, 0)
        assert s[4].value == 0.1


class SelectSliderTest(InteractiveScriptTests):
    def test_value(self):
        script = self.script_from_string(
            "select_slider_test.py",
            """
            import streamlit as st

            options=['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet']
            st.select_slider("single", options=options, value='green')
            st.select_slider("range", options=options, value=['red', 'blue'])
            """,
        )
        sr = script.run()
        assert sr.get("select_slider")[0].value == "green"
        assert sr.get("select_slider")[1].value == ("red", "blue")

        sr2 = sr.get("select_slider")[0].set_value("violet").run()
        sr3 = sr2.get("select_slider")[1].set_range("yellow", "orange").run()
        assert sr3.get("select_slider")[0].value == "violet"
        assert sr3.get("select_slider")[1].value == ("orange", "yellow")


class SelectboxTest(InteractiveScriptTests):
    def test_value(self):
        script = self.script_from_string(
            "select_slider_test.py",
            """
            import pandas as pd
            import streamlit as st

            options = ("male", "female")
            st.selectbox("selectbox 1", options, 1)
            st.selectbox("selectbox 2", options, 0)
            st.selectbox("selectbox 3", [])

            lst = ['Python', 'C', 'C++', 'Java', 'Scala', 'Lisp', 'JavaScript', 'Go']
            df = pd.DataFrame(lst)
            st.selectbox("selectbox 4", df)
            """,
        )
        sr = script.run()
        assert sr.get("selectbox")[0].value == "female"
        assert sr.get("selectbox")[1].value == "male"
        assert sr.get("selectbox")[2].value is None
        assert sr.get("selectbox")[3].value == "Python"

        sr2 = sr.get("selectbox")[0].select("female").run()
        sr3 = sr2.get("selectbox")[1].select("female").run()
        sr4 = sr3.get("selectbox")[3].select("JavaScript").run()

        assert sr4.get("selectbox")[0].value == "female"
        assert sr4.get("selectbox")[1].value == "female"
        assert sr4.get("selectbox")[2].value is None
        assert sr4.get("selectbox")[3].value == "JavaScript"

        sr5 = sr4.get("selectbox")[0].select_index(0).run()
        sr6 = sr5.get("selectbox")[3].select_index(5).run()
        assert sr6.get("selectbox")[0].value == "male"
        assert sr6.get("selectbox")[3].value == "Lisp"

        with pytest.raises(ValueError):
            sr6.get("selectbox")[0].select("invalid").run()

        with pytest.raises(IndexError):
            sr6.get("selectbox")[0].select_index(42).run()


class ExceptionTest(InteractiveScriptTests):
    def test_value(self):
        script = self.script_from_string(
            "exception.py",
            """
            import streamlit as st

            st.exception(RuntimeError("foo"))
            """,
        )
        sr = script.run()

        assert sr.get("exception")[0].value == "foo"

    def test_markdown(self):
        script = self.script_from_string(
            "exception2.py",
            """
            import streamlit as st

            st.exception(st.errors.MarkdownFormattedException("# Oh no"))
            """,
        )
        sr = script.run()

        assert sr.get("exception")[0].is_markdown


class TextInputTest(InteractiveScriptTests):
    def test_value(self):
        script = self.script_from_string(
            "text_input.py",
            """
            import streamlit as st

            st.text_input("label")
            st.text_input("with default", value="default", max_chars=20)
            """,
        )
        sr = script.run()

        assert sr.get("text_input")[0].value == ""
        assert sr.get("text_input")[1].value == "default"

        long_string = "".join(["this is a long string fragment."] * 10)
        sr.get("text_input")[0].input(long_string)
        sr2 = sr.get("text_input")[1].input(long_string).run()

        assert sr2.get("text_input")[0].value == long_string
        assert sr2.get("text_input")[1].value == "default"
        # assert sr2.get("text_input")[1].value == long_string[:20]


class TextAreaTest(InteractiveScriptTests):
    def test_value(self):
        script = self.script_from_string(
            "text_area.py",
            """
            import streamlit as st

            st.text_area("label")
            st.text_area("with default", value="default", max_chars=20)
            """,
        )
        sr = script.run()

        assert sr.get("text_area")[0].value == ""
        assert sr.get("text_area")[1].value == "default"

        long_string = "".join(["this is a long string fragment."] * 10)
        sr.get("text_area")[0].input(long_string)
        sr2 = sr.get("text_area")[1].input(long_string).run()

        assert sr2.get("text_area")[0].value == long_string
        assert sr2.get("text_area")[1].value == "default"
