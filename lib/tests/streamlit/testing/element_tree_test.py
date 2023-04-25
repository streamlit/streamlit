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

from datetime import date, datetime, time

import pytest

from streamlit.elements.markdown import MARKDOWN_HORIZONTAL_RULE_EXPRESSION
from streamlit.testing.script_interactions import InteractiveScriptTests


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
        assert sr.button[0].value == False
        assert sr.button[1].value == False

        sr2 = sr.button[0].click().run()
        assert sr2.button[0].value == True
        assert sr2.button[1].value == False

        sr3 = sr2.run()
        assert sr3.button[0].value == False
        assert sr3.button[1].value == False


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
        assert sr.checkbox
        assert sr.checkbox[0].value == False
        assert sr.checkbox[1].value == True

        sr2 = sr.checkbox[0].check().run()
        assert sr2.checkbox[0].value == True
        assert sr2.checkbox[1].value == True

        sr3 = sr2.checkbox[1].uncheck().run()
        assert sr3.checkbox[0].value == True
        assert sr3.checkbox[1].value == False


class ColorPickerTest(InteractiveScriptTests):
    def test_value(self):
        script = self.script_from_string(
            "color_picker.py",
            """
            import streamlit as st

            st.color_picker("what is your favorite color?")
            st.color_picker("short hex", value="#ABC")
            st.color_picker("invalid", value="blue")
            """,
        )
        sr = script.run()
        assert len(sr.color_picker) == 2
        assert [c.value for c in sr.color_picker] == ["#000000", "#ABC"]
        assert "blue" in sr.exception[0].value

        sr2 = sr.color_picker[0].pick("#123456").run()
        assert sr2.color_picker[0].value == "#123456"


class DateInputTest(InteractiveScriptTests):
    def test_value(self):
        script = self.script_from_string(
            "date_input.py",
            """
            import streamlit as st
            import datetime

            st.date_input("date", value=datetime.date(2023, 4, 17))
            st.date_input("datetime", value=datetime.datetime(2023, 4, 17, 11))
            st.date_input("range", value=(datetime.date(2020, 1, 1), datetime.date(2030, 1, 1)))
            """,
        )
        sr = script.run()
        assert not sr.exception
        assert [d.value for d in sr.date_input] == [
            date(2023, 4, 17),
            datetime(2023, 4, 17).date(),
            (date(2020, 1, 1), date(2030, 1, 1)),
        ]
        ds = sr.date_input
        ds[0].set_value(date(2023, 5, 1))
        ds[1].set_value(datetime(2023, 1, 1))
        ds[2].set_value((date(2023, 1, 1), date(2024, 1, 1)))

        sr2 = sr.run()
        assert [d.value for d in sr2.date_input] == [
            date(2023, 5, 1),
            date(2023, 1, 1),
            (date(2023, 1, 1), date(2024, 1, 1)),
        ]


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

        assert sr.exception[0].value == "foo"

    def test_markdown(self):
        script = self.script_from_string(
            "exception2.py",
            """
            import streamlit as st

            st.exception(st.errors.MarkdownFormattedException("# Oh no"))
            """,
        )
        sr = script.run()

        assert sr.exception[0].is_markdown


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

        assert len(sr.title) == 3
        assert sr.title[1].tag == "h1"
        assert sr.title[1].anchor == "anchor text"
        assert sr.title[1].value == "This is a title with anchor"
        assert sr.title[2].hide_anchor

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

        assert len(sr.header) == 3
        assert sr.header[1].tag == "h2"
        assert sr.header[1].anchor == "header anchor text"
        assert sr.header[1].value == "This is a header with anchor"
        assert sr.header[2].hide_anchor

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

        assert len(sr.subheader) == 3
        assert sr.subheader[1].tag == "h3"
        assert sr.subheader[1].anchor == "subheader anchor text"
        assert sr.subheader[1].value == "This is a subheader with anchor"
        assert sr.subheader[2].hide_anchor

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

        assert len(sr.title) == 2
        assert len(sr.header) == 2
        assert len(sr.subheader) == 2


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

        assert sr.markdown
        assert sr.markdown[0].type == "markdown"
        assert sr.markdown[0].value == "**This is a markdown**"

    def test_caption(self):
        script = self.script_from_string(
            "caption_element.py",
            """
            import streamlit as st

            st.caption("This is a caption")
            """,
        )
        sr = script.run()

        assert sr.caption
        assert sr.caption[0].type == "caption"
        assert sr.caption[0].value == "This is a caption"
        assert sr.caption[0].is_caption

    def test_code(self):
        script = self.script_from_string(
            "code_element.py",
            """
            import streamlit as st

            st.code("import streamlit as st")
            """,
        )
        sr = script.run()

        assert sr.code
        assert sr.code[0].type == "code"
        assert sr.code[0].value == "import streamlit as st"

    def test_latex(self):
        script = self.script_from_string(
            "latex_element.py",
            """
            import streamlit as st

            st.latex("E=mc^2")
            """,
        )
        sr = script.run()

        assert sr.latex
        assert sr.latex[0].type == "latex"
        assert sr.latex[0].value == "$$\nE=mc^2\n$$"

    def test_divider(self):
        script = self.script_from_string(
            "divider_element.py",
            """
            import streamlit as st

            st.divider()
            """,
        )
        sr = script.run()

        assert sr.divider
        assert sr.divider[0].type == "divider"
        assert sr.divider[0].value == MARKDOWN_HORIZONTAL_RULE_EXPRESSION

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

        assert len(sr.markdown) == 2
        assert len(sr.caption) == 2
        assert len(sr.code) == 2
        assert len(sr.latex) == 2


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
        assert sr.multiselect[0].value == []
        assert sr.multiselect[1].value == ["two"]

        sr2 = sr.multiselect[0].select("b").run()
        assert sr2.multiselect[0].value == ["b"]
        assert sr2.multiselect[1].value == ["two"]

        sr3 = sr2.multiselect[1].select("zero").select("one").run()
        assert sr3.multiselect[0].value == ["b"]
        assert set(sr3.multiselect[1].value) == set(["zero", "one", "two"])

        sr4 = sr3.multiselect[0].unselect("b").run()
        assert sr4.multiselect[0].value == []
        assert set(sr3.multiselect[1].value) == set(["zero", "one", "two"])


class NumberInputTest(InteractiveScriptTests):
    def test_value(self):
        script = self.script_from_string(
            "number_input.py",
            """
            import streamlit as st

            st.number_input("int", min_value=-10, max_value=10)
            st.number_input("float", min_value=-1.0, max_value=100.0)
            """,
        )
        sr = script.run()
        assert sr.number_input[0].value == -10
        assert sr.number_input[1].value == -1.0

        sr2 = sr.number_input[0].increment().run().number_input[1].increment().run()
        assert sr2.number_input[0].value == -9
        assert sr2.number_input[1].value == -0.99

        sr3 = sr2.number_input[0].decrement().run().number_input[1].decrement().run()
        assert sr3.number_input[0].value == -10
        assert sr3.number_input[1].value == -1.0

        sr4 = sr3.number_input[0].decrement().run().number_input[1].decrement().run()
        assert sr4.number_input[0].value == -10
        assert sr4.number_input[1].value == -1.0


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
        assert sr.selectbox[0].value == "female"
        assert sr.selectbox[1].value == "male"
        assert sr.selectbox[2].value is None
        assert sr.selectbox[3].value == "Python"

        sr2 = sr.selectbox[0].select("female").run()
        sr3 = sr2.selectbox[1].select("female").run()
        sr4 = sr3.selectbox[3].select("JavaScript").run()

        assert sr4.selectbox[0].value == "female"
        assert sr4.selectbox[1].value == "female"
        assert sr4.selectbox[2].value is None
        assert sr4.selectbox[3].value == "JavaScript"

        sr5 = sr4.selectbox[0].select_index(0).run()
        sr6 = sr5.selectbox[3].select_index(5).run()
        assert sr6.selectbox[0].value == "male"
        assert sr6.selectbox[3].value == "Lisp"

        with pytest.raises(ValueError):
            sr6.selectbox[0].select("invalid").run()

        with pytest.raises(IndexError):
            sr6.selectbox[0].select_index(42).run()


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
        assert sr.select_slider[0].value == "green"
        assert sr.select_slider[1].value == ("red", "blue")

        sr2 = sr.select_slider[0].set_value("violet").run()
        sr3 = sr2.select_slider[1].set_range("yellow", "orange").run()
        assert sr3.select_slider[0].value == "violet"
        assert sr3.select_slider[1].value == ("orange", "yellow")


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
        s = sr.slider
        assert s[0].value == 0
        assert s[1].value == 10
        assert s[2].value == (time(11, 30), time(12, 45))
        assert s[3].value == datetime(2020, 1, 1, 9, 30)
        assert s[4].value == 0.0

        sr2 = sr.slider[1].set_value(50).run()
        sr3 = sr2.slider[2].set_range(time(12, 0), time(12, 15)).run()
        sr4 = sr3.slider[3].set_value(datetime(2020, 1, 10, 8, 0)).run()
        sr5 = sr4.slider[4].set_value(0.1).run()
        s = sr5.slider
        assert s[0].value == 0
        assert s[1].value == 50
        assert s[2].value == (time(12, 0), time(12, 15))
        assert s[3].value == datetime(2020, 1, 10, 8, 0)
        assert s[4].value == 0.1


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

        assert sr.text_area[0].value == ""
        assert sr.text_area[1].value == "default"

        long_string = "".join(["this is a long string fragment."] * 10)
        sr.text_area[0].input(long_string)
        sr2 = sr.text_area[1].input(long_string).run()

        assert sr2.text_area[0].value == long_string
        assert sr2.text_area[1].value == "default"


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

        assert sr.text_input[0].value == ""
        assert sr.text_input[1].value == "default"

        long_string = "".join(["this is a long string fragment."] * 10)
        sr.text_input[0].input(long_string)
        sr2 = sr.text_input[1].input(long_string).run()

        assert sr2.text_input[0].value == long_string
        assert sr2.text_input[1].value == "default"
        # assert sr2.text_input[1].value == long_string[:20]


class TimeInputTest(InteractiveScriptTests):
    def test_value(self):
        script = self.script_from_string(
            "time_input.py",
            """
            import streamlit as st
            import datetime

            st.time_input("time", value=datetime.time(8, 30))
            st.time_input("datetime", value=datetime.datetime(2000,1,1, hour=17), step=3600)
            st.time_input("timedelta step", value=datetime.time(2), step=datetime.timedelta(minutes=1))
            """,
        )
        sr = script.run()
        assert not sr.exception
        assert [t.value for t in sr.time_input] == [
            time(8, 30),
            time(17),
            time(2),
        ]
        tis = sr.time_input
        tis[0].increment()
        tis[1].decrement()
        tis[2].increment()
        sr2 = sr.run()
        assert [t.value for t in sr2.time_input] == [
            time(8, 45),
            time(16),
            time(2, 1),
        ]
