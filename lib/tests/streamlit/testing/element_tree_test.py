# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from __future__ import annotations

from datetime import date, datetime, time

import numpy as np
import pandas as pd
import pytest

from streamlit.elements.markdown import MARKDOWN_HORIZONTAL_RULE_EXPRESSION
from streamlit.testing.v1.app_test import AppTest


def test_alert():
    def script():
        import streamlit as st

        st.success("yay we did it", icon="🚨")
        st.info("something happened")
        st.warning("danger danger")
        st.error("something went terribly wrong", icon="💥")

    at = AppTest.from_function(script).run()
    assert at.error[0].value == "something went terribly wrong"
    assert at.error[0].icon == "💥"
    assert at.info[0].value == "something happened"
    assert at.success[0].value == "yay we did it"
    assert at.success[0].icon == "🚨"
    assert at.warning[0].value == "danger danger"

    # Verify that creating the reprs does not throw
    repr(at.error[0])
    repr(at.info[0])
    repr(at.success[0])
    repr(at.warning[0])


def test_button():
    def script():
        import streamlit as st

        st.button("button")
        st.button("second button")

    sr = AppTest.from_function(script).run()
    assert sr.button[0].value is False
    assert sr.button[1].value is False

    sr2 = sr.button[0].click().run()
    assert sr2.button[0].value is True
    assert sr2.button[1].value is False

    sr3 = sr2.run()
    assert sr3.button[0].value is False
    assert sr3.button[1].value is False

    repr(sr.button[0])


def test_chat():
    def script():
        import streamlit as st

        input_text = st.chat_input(placeholder="Type a thing")
        with st.chat_message("user"):
            st.write(input_text)

    at = AppTest.from_function(script).run()
    assert at.chat_input[0].value is None
    msg = at.chat_message[0]
    assert msg.name == "user"
    assert msg.markdown[0].value == "`None`"

    at.chat_input[0].set_value("hi").run()
    assert at.chat_input[0].value == "hi"
    assert at.chat_message[0].markdown[0].value == "hi"

    # verify value resets after use
    at.run()
    assert at.chat_input[0].value is None

    # verify reprs
    repr(at.chat_input[0])
    repr(at.chat_message[0])


def test_checkbox():
    def script():
        import streamlit as st

        st.checkbox("defaults")
        st.checkbox("defaulted on", True)

    at = AppTest.from_function(script).run()
    assert at.checkbox[0].label == "defaults"
    assert at.checkbox.values == [False, True]

    at.checkbox[0].check().run()
    assert at.checkbox.values == [True, True]

    at.checkbox[1].uncheck().run()
    assert at.checkbox.values == [True, False]

    repr(at.checkbox[0])


def test_color_picker():
    def script():
        import streamlit as st

        st.color_picker("what is your favorite color?")
        st.color_picker("short hex", value="#ABC")
        st.color_picker("invalid", value="blue")

    at = AppTest.from_function(script).run()
    assert at.color_picker.len == 2
    assert at.color_picker.values == ["#000000", "#ABC"]
    assert "blue" in at.exception[0].value

    at.color_picker[0].pick("#123456").run()
    assert at.color_picker[0].value == "#123456"

    repr(at.color_picker[0])


def test_columns():
    def script():
        import streamlit as st

        c1, c2 = st.columns(2)
        with c1:
            st.text("c1")
        c2.radio("c2", ["a", "b", "c"])

    at = AppTest.from_function(script).run()
    assert len(at.columns) == 2
    assert at.columns[0].weight == at.columns[1].weight
    assert at.columns[0].text[0].value == "c1"
    assert at.columns[1].radio[0].value == "a"

    repr(at.columns[0])


def test_dataframe():
    def script():
        import numpy as np
        import pandas as pd

        import streamlit as st

        df = pd.DataFrame(
            index=[[0, 1], ["i1", "i2"]],
            columns=[[2, 3, 4], ["c1", "c2", "c3"]],
            data=np.arange(0, 6, 1).reshape(2, 3),
        )
        st.dataframe(df)

    at = AppTest.from_function(script).run()
    d = at.dataframe[0]
    assert d.value.equals(
        pd.DataFrame(
            index=[[0, 1], ["i1", "i2"]],
            columns=[[2, 3, 4], ["c1", "c2", "c3"]],
            data=np.arange(0, 6, 1).reshape(2, 3),
        )
    )

    repr(at.dataframe[0])


def test_date_input():
    def script():
        import datetime

        import streamlit as st

        st.date_input("date", value=datetime.date(2023, 4, 17))
        st.date_input("datetime", value=datetime.datetime(2023, 4, 17, 11))
        st.date_input(
            "range", value=(datetime.date(2020, 1, 1), datetime.date(2030, 1, 1))
        )

    at = AppTest.from_function(script).run()
    assert not at.exception
    assert at.date_input.values == [
        date(2023, 4, 17),
        datetime(2023, 4, 17).date(),
        (date(2020, 1, 1), date(2030, 1, 1)),
    ]
    ds = at.date_input
    ds[0].set_value(date(2023, 5, 1))
    ds[1].set_value(datetime(2023, 1, 1))
    ds[2].set_value((date(2023, 1, 1), date(2024, 1, 1)))

    at.run()
    assert at.date_input.values == [
        date(2023, 5, 1),
        date(2023, 1, 1),
        (date(2023, 1, 1), date(2024, 1, 1)),
    ]

    # Verify that creating the reprs does not throw
    repr(at.date_input[0])


def test_exception():
    script = AppTest.from_string(
        """
        import streamlit as st

        st.exception(RuntimeError("foo"))
        """,
    )
    sr = script.run()

    assert sr.exception[0].value == "foo"

    repr(sr.exception[0])


def test_expander():
    def script():
        import streamlit as st

        with st.expander("expander"):
            st.write("some text")

    at = AppTest.from_function(script).run()
    assert at.markdown[0].value == "some text"


def test_markdown_exception():
    script = AppTest.from_string(
        """
        import streamlit as st

        st.exception(st.errors.MarkdownFormattedException("# Oh no"))
        """,
    )
    sr = script.run()

    assert sr.exception[0].is_markdown

    repr(sr.exception[0])


def test_title():
    script = AppTest.from_string(
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

    repr(sr.title[0])


def test_header():
    script = AppTest.from_string(
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

    repr(sr.header[0])


def test_subheader():
    script = AppTest.from_string(
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

    repr(sr.subheader[0])


def test_heading_elements_by_type():
    script = AppTest.from_string(
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


def test_json():
    def script():
        import streamlit as st

        st.json(["hi", {"foo": "bar"}])

    at = AppTest.from_function(script).run()
    j = at.json[0]
    assert j.value == '["hi", {"foo": "bar"}]'
    assert j.expanded

    repr(j)


def test_markdown():
    script = AppTest.from_string(
        """
        import streamlit as st

        st.markdown("**This is a markdown**")
        """,
    )
    sr = script.run()

    assert sr.markdown
    assert sr.markdown[0].type == "markdown"
    assert sr.markdown[0].value == "**This is a markdown**"

    repr(sr.markdown[0])


def test_caption():
    script = AppTest.from_string(
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

    repr(sr.caption[0])


def test_code():
    script = AppTest.from_string(
        """
        import streamlit as st

        st.code("import streamlit as st")
        """,
    )
    sr = script.run()

    assert sr.code
    assert sr.code[0].type == "code"
    assert sr.code[0].value == "import streamlit as st"

    repr(sr.code[0])


def test_echo():
    script = AppTest.from_string(
        """
        import streamlit as st

        with st.echo():
            st.write("Hello")
        """
    )

    sr = script.run()

    assert sr.code
    assert sr.code[0].type == "code"
    assert sr.code[0].language == "python"
    assert sr.code[0].value == """st.write("Hello")"""


def test_latex():
    script = AppTest.from_string(
        """
        import streamlit as st

        st.latex("E=mc^2")
        """,
    )
    sr = script.run()

    assert sr.latex
    assert sr.latex[0].type == "latex"
    assert sr.latex[0].value == "$$\nE=mc^2\n$$"

    repr(sr.latex[0])


def test_divider():
    script = AppTest.from_string(
        """
        import streamlit as st

        st.divider()
        """,
    )
    sr = script.run()

    assert sr.divider
    assert sr.divider[0].type == "divider"
    assert sr.divider[0].value == MARKDOWN_HORIZONTAL_RULE_EXPRESSION

    repr(sr.divider[0])


def test_markdown_elements_by_type():
    script = AppTest.from_string(
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


def test_menu_button():
    """Test menu_button widget in AppTest."""
    script = AppTest.from_string(
        """
        import streamlit as st

        options = ["Option A", "Option B", "Option C"]
        result = st.menu_button("Actions", options)
        st.write(f"Selected: {result}")
        """,
    )
    sr = script.run()
    # Initial state - no option selected
    assert sr.menu_button[0].value is None
    assert sr.menu_button[0].options == ["Option A", "Option B", "Option C"]
    assert sr.markdown[0].value == "Selected: None"

    # Click an option by value
    sr2 = sr.menu_button[0].click("Option B").run()
    assert sr2.menu_button[0].value == "Option B"
    assert sr2.markdown[0].value == "Selected: Option B"

    # Value resets after use (trigger behavior)
    sr3 = sr2.run()
    assert sr3.menu_button[0].value is None
    assert sr3.markdown[0].value == "Selected: None"

    # Click by index
    sr4 = sr3.menu_button[0].click_index(2).run()
    assert sr4.menu_button[0].value == "Option C"
    assert sr4.markdown[0].value == "Selected: Option C"

    repr(sr.menu_button[0])


def test_menu_button_with_format_func():
    """Test menu_button click_index with non-string options and format_func."""
    script = AppTest.from_string(
        """
        import streamlit as st

        options = [{"id": 1, "name": "first"}, {"id": 2, "name": "second"}]
        result = st.menu_button("Pick", options, format_func=lambda x: x["name"])
        if result:
            st.write(f"ID: {result['id']}")
        else:
            st.write("Nothing selected")
        """,
    )
    sr = script.run()
    assert sr.menu_button[0].value is None
    # Options list contains formatted strings
    assert sr.menu_button[0].options == ["first", "second"]

    # click_index should return the original dict, not the formatted string
    sr2 = sr.menu_button[0].click_index(1).run()
    assert sr2.menu_button[0].value == {"id": 2, "name": "second"}
    assert sr2.markdown[0].value == "ID: 2"


def test_metric():
    def script():
        import streamlit as st

        st.metric("stonks", value=9500, delta=1000)

    at = AppTest.from_function(script).run()
    m = at.metric[0]
    assert m.value == "9500"
    assert m.delta == "1000"

    repr(m)


def test_multiselect():
    script = AppTest.from_string(
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
    assert set(sr3.multiselect[1].value) == {"zero", "one", "two"}

    sr4 = sr3.multiselect[0].unselect("b").run()
    assert sr4.multiselect[0].value == []
    assert set(sr3.multiselect[1].value) == {"zero", "one", "two"}

    # Verify that creating the reprs does not throw
    repr(sr.multiselect[0])


def test_number_input():
    script = AppTest.from_string(
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

    repr(sr.number_input[0])


def test_selectbox():
    script = AppTest.from_string(
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

    with pytest.raises(ValueError, match="not in list"):
        sr6.selectbox[0].select("invalid").run()

    with pytest.raises(IndexError):
        sr6.selectbox[0].select_index(42).run()

    repr(sr.selectbox[0])


def test_format_func():
    # Regression test for #8019
    def script():
        import streamlit as st

        key_to_value = {"key1": "value1", "key2": "value2"}
        st.selectbox(
            "selectbox",
            key_to_value.keys(),
            format_func=lambda key: key_to_value[key],
            key="sb",
        )
        st.radio(
            "radio",
            options=["FOO", "BAR", "BAZ"],
            format_func=lambda x: x.lower(),
            key="r",
        )
        st.multiselect(
            "multi",
            options=[1, 2, 3],
            format_func=lambda x: f"Num: {x}",
            key="m",
        )
        st.select_slider(
            "slider",
            options=[1, 2, 3, 5, 8],
            value=[1, 2],
            format_func=lambda x: str(float(x)),
            key="s",
        )

    at = AppTest.from_function(script).run()

    at.selectbox("sb").select("key1").run()
    assert at.selectbox("sb").value == "key1"

    at.radio("r").set_value("FOO").run()
    assert at.radio("r").value == "FOO"

    at.multiselect("m").select(1).select(2).run()
    assert at.multiselect("m").value == [1, 2]

    at.select_slider("s").set_range(2, 5).run()
    assert at.select_slider("s").value == (2, 5)

    assert not at.exception


def test_select_slider():
    script = AppTest.from_string(
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

    repr(sr.select_slider[0])


def test_select_slider_ints():
    def script():
        import streamlit as st

        st.select_slider("What is your favorite small prime?", options=[2, 3, 5, 7])
        st.select_slider(
            "Best number range?", options=list(range(10)), value=[0, 1], key="range"
        )

    at = AppTest.from_function(script).run()
    assert at.select_slider[0].value == 2
    assert at.select_slider[1].value == (0, 1)

    at.select_slider[0].set_value(5)
    at.select_slider[1].set_value([7, 9]).run()
    assert at.select_slider[0].value == 5
    assert at.select_slider[1].value == (7, 9)


def test_access_methods():
    script = AppTest.from_string(
        """
        import streamlit as st

        st.sidebar.radio("foo", options=["a", "b", "c"])
        st.radio("bar", options=[1, 2, 3])
        """,
    )
    sr = script.run()
    assert len(sr.radio) == 2
    assert sr.sidebar.radio[0].value == "a"
    assert sr.main.radio[0].value == 1

    repr(sr.radio[0])


def test_slider():
    script = AppTest.from_string(
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

    # Verify that creating the reprs does not throw
    repr(sr.slider[0])


def test_status():
    def script():
        import streamlit as st

        # Not using `with` because exiting that changes status to "complete"
        running = st.status("running status", state="running")
        running.text("waiting")

        with st.status("complete status", state="complete"):
            st.text("yay")

        with st.status("error status", state="error"):
            st.text("oh no")

    at = AppTest.from_function(script).run()
    assert len(at.status) == 3
    assert at.status[0].state == "running"
    assert at.status[1].state == "complete"
    assert at.status[2].state == "error"


def test_table():
    def script():
        import numpy as np
        import pandas as pd

        import streamlit as st

        df = pd.DataFrame(
            index=[[0, 1], ["i1", "i2"]],
            columns=[[2, 3, 4], ["c1", "c2", "c3"]],
            data=np.arange(0, 6, 1).reshape(2, 3),
        )
        st.table(df)

    at = AppTest.from_function(script).run()
    df = pd.DataFrame(
        index=[[0, 1], ["i1", "i2"]],
        columns=[[2, 3, 4], ["c1", "c2", "c3"]],
        data=np.arange(0, 6, 1).reshape(2, 3),
    )
    assert at.table[0].value.equals(df)

    repr(at.table[0])


def test_tabs():
    def script():
        import streamlit as st

        t1, t2 = st.tabs(["cat", "dog"])
        with t1:
            st.text("meow")
        t2.text("woof")

    at = AppTest.from_function(script).run()
    assert len(at.tabs) == 2
    assert at.tabs[0].label == "cat"
    assert at.tabs[0].text[0].value == "meow"
    assert at.tabs[1].label == "dog"
    assert at.tabs[1].text[0].value == "woof"

    repr(at.tabs[0])


def test_text_area():
    script = AppTest.from_string(
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

    repr(sr.text_area[0])


def test_text_input():
    script = AppTest.from_string(
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

    repr(sr.text_input[0])


def test_time_input():
    script = AppTest.from_string(
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

    repr(sr.time_input[0])


def test_toast():
    def script():
        import streamlit as st

        st.toast("first")
        st.write("something in the main area")
        st.toast("second")

    at = AppTest.from_function(script).run()
    assert at.toast.len == 2
    assert at.toast.values == ["first", "second"]


def test_toggle():
    def script():
        import streamlit as st

        on = st.toggle("Activate feature")
        if on:
            st.write("Feature activated!")

    at = AppTest.from_function(script).run()
    assert at.toggle[0].value is False

    at.toggle[0].set_value(True).run()
    assert at.toggle[0].value is True

    repr(at.toggle[0])


def test_short_timeout():
    script = AppTest.from_string(
        """
        import time
        import streamlit as st

        st.write("start")
        time.sleep(0.5)
        st.write("end")
        """
    )
    with pytest.raises(RuntimeError):
        script.run(timeout=0.2)


def test_state_access():
    def script():
        import streamlit as st

        if "foo" not in st.session_state:
            st.session_state.foo = "bar"
        st.write(st.session_state.foo)

    at = AppTest.from_function(script).run()
    assert at.markdown[0].value == "bar"

    at.session_state["foo"] = "baz"
    at.run()
    assert at.markdown[0].value == "baz"

    at.session_state.foo = "quux"
    at.run()
    assert at.markdown[0].value == "quux"


def test_feedback_element():
    """Test Feedback widget used by st.feedback."""

    def script():
        import streamlit as st

        # st.feedback creates a feedback widget
        st.feedback("thumbs")
        st.feedback("stars")

    at = AppTest.from_function(script).run()
    # Feedback widgets use their own feedback element
    # The feedback element does not have a select/unselect but we can test it exists
    assert len(at.get("feedback")) == 2

    result = repr(at.get("feedback")[0])
    assert "Feedback" in result


def test_unknown_element():
    """Test UnknownElement handles new/unrecognized element types gracefully."""

    # UnknownElement is used internally when an element type isn't recognized
    # We can't easily test it directly without mocking, but we can verify
    # that accessing elements through the testing framework works
    def script():
        import streamlit as st

        st.write("Hello")

    at = AppTest.from_function(script).run()
    # markdown elements are recognized, not unknown
    assert at.markdown[0].value == "Hello"


def test_element_list_equality():
    """Test ElementList equality comparison."""

    def script():
        import streamlit as st

        st.button("button1")
        st.checkbox("checkbox1")

    at = AppTest.from_function(script).run()

    # Same list should be equal
    buttons1 = at.button
    buttons2 = at.button
    assert buttons1 == buttons2

    # Different lists should not be equal
    assert buttons1 != at.checkbox


def test_widget_list_call_by_key():
    """Test WidgetList can retrieve widget by key."""

    def script():
        import streamlit as st

        st.button("button1", key="btn1")
        st.button("button2", key="btn2")

    at = AppTest.from_function(script).run()

    # Access by key
    btn = at.button("btn1")
    assert btn.label == "button1"

    btn2 = at.button("btn2")
    assert btn2.label == "button2"


def test_widget_list_call_by_key_not_found():
    """Test WidgetList raises KeyError for missing key."""

    def script():
        import streamlit as st

        st.button("button1", key="btn1")

    at = AppTest.from_function(script).run()

    with pytest.raises(KeyError):
        at.button("nonexistent")


def test_file_uploader_single():
    """Test st.file_uploader with single file upload."""

    def script():
        import streamlit as st

        uploaded_file = st.file_uploader("Upload a file")
        if uploaded_file is not None:
            st.write(f"Uploaded: {uploaded_file.name}")
            st.write(f"Size: {uploaded_file.size}")
            st.write(f"Type: {uploaded_file.type}")
            content = uploaded_file.read().decode("utf-8")
            st.write(f"Content: {content}")

    at = AppTest.from_function(script).run()
    assert at.file_uploader[0].value is None
    assert len(at.text) == 0

    # Upload a file
    at.file_uploader[0].set_value(("test.txt", b"Hello, World!", "text/plain"))
    at.run()

    assert at.file_uploader[0].value is not None
    assert at.file_uploader[0].value.name == "test.txt"
    assert at.markdown[0].value == "Uploaded: test.txt"
    assert at.markdown[1].value == "Size: 13"
    assert at.markdown[2].value == "Type: text/plain"
    assert at.markdown[3].value == "Content: Hello, World!"

    # Verify repr does not throw
    repr(at.file_uploader[0])


def _multi_file_script():
    """Shared script for multi-file upload tests."""
    import streamlit as st

    files = st.file_uploader("Upload files", accept_multiple_files=True)
    if files:
        for f in files:
            st.write(f"File: {f.name}")


def test_file_uploader_multiple():
    """Test st.file_uploader with multiple file uploads."""
    at = AppTest.from_function(_multi_file_script).run()
    assert at.file_uploader[0].value == []
    assert at.file_uploader[0].accept_multiple_files is True

    # Upload multiple files using set_value
    at.file_uploader[0].set_value(
        [
            ("file1.txt", b"Content 1", "text/plain"),
            ("file2.txt", b"Content 2", "text/plain"),
        ]
    )
    at.run()

    assert len(at.file_uploader[0].value) == 2
    assert at.markdown[0].value == "File: file1.txt"
    assert at.markdown[1].value == "File: file2.txt"


def test_file_uploader_upload_method():
    """Test st.file_uploader with upload() method for chaining."""
    at = AppTest.from_function(_multi_file_script).run()

    # Use upload() method for chaining
    at.file_uploader[0].upload("doc1.txt", b"Doc 1", "text/plain")
    at.file_uploader[0].upload("doc2.txt", b"Doc 2", "text/plain")
    at.run()

    assert len(at.file_uploader[0].value) == 2
    assert at.markdown[0].value == "File: doc1.txt"
    assert at.markdown[1].value == "File: doc2.txt"


def test_file_uploader_clear():
    """Test st.file_uploader clear() method."""

    def script():
        import streamlit as st

        uploaded = st.file_uploader("Upload a file")
        if uploaded:
            st.write(f"Uploaded: {uploaded.name}")
        else:
            st.write("No file uploaded")

    at = AppTest.from_function(script).run()
    assert at.markdown[0].value == "No file uploaded"

    # Upload a file
    at.file_uploader[0].set_value(("test.txt", b"content", "text/plain"))
    at.run()
    assert at.markdown[0].value == "Uploaded: test.txt"

    # Clear the file
    at.file_uploader[0].clear()
    at.run()
    assert at.markdown[0].value == "No file uploaded"


def test_file_uploader_with_key():
    """Test st.file_uploader can be accessed by key."""

    def script():
        import streamlit as st

        st.file_uploader("First uploader", key="uploader1")
        st.file_uploader("Second uploader", key="uploader2")

    at = AppTest.from_function(script).run()

    assert at.file_uploader("uploader1").label == "First uploader"
    assert at.file_uploader("uploader2").label == "Second uploader"


def test_file_uploader_persists_across_runs():
    """Test that uploaded files persist across subsequent runs without re-setting."""

    def script():
        import streamlit as st

        uploaded_file = st.file_uploader("Upload a file")
        if uploaded_file is not None:
            st.write(f"Uploaded: {uploaded_file.name}")
            content = uploaded_file.read().decode("utf-8")
            st.write(f"Content: {content}")
        else:
            st.write("No file uploaded")

        # Add a button to trigger reruns
        if st.button("Click me"):
            st.write("Button clicked")

    at = AppTest.from_function(script).run()
    assert at.markdown[0].value == "No file uploaded"

    # Upload a file
    at.file_uploader[0].set_value(("test.txt", b"Hello, World!", "text/plain"))
    at.run()

    assert at.file_uploader[0].value is not None
    assert at.file_uploader[0].value.name == "test.txt"
    assert at.markdown[0].value == "Uploaded: test.txt"
    assert at.markdown[1].value == "Content: Hello, World!"

    # Run again WITHOUT re-setting the file - it should persist
    at.run()

    assert at.file_uploader[0].value is not None
    assert at.file_uploader[0].value.name == "test.txt"
    assert at.markdown[0].value == "Uploaded: test.txt"
    assert at.markdown[1].value == "Content: Hello, World!"

    # Click the button and run - file should still persist
    at.button[0].click()
    at.run()

    assert at.file_uploader[0].value is not None
    assert at.file_uploader[0].value.name == "test.txt"
    assert at.markdown[0].value == "Uploaded: test.txt"
    assert "Button clicked" in [m.value for m in at.markdown]


def test_file_uploader_multiple_persists_across_runs():
    """Test that multiple uploaded files persist across subsequent runs."""

    def script():
        import streamlit as st

        files = st.file_uploader("Upload files", accept_multiple_files=True)
        if files:
            for f in files:
                st.write(f"File: {f.name}")
        else:
            st.write("No files uploaded")

    at = AppTest.from_function(_multi_file_script).run()
    assert at.file_uploader[0].value == []

    # Upload multiple files
    at.file_uploader[0].set_value(
        [
            ("file1.txt", b"Content 1", "text/plain"),
            ("file2.txt", b"Content 2", "text/plain"),
        ]
    )
    at.run()

    assert len(at.file_uploader[0].value) == 2
    assert at.markdown[0].value == "File: file1.txt"
    assert at.markdown[1].value == "File: file2.txt"

    # Run again WITHOUT re-setting - files should persist
    at.run()

    assert len(at.file_uploader[0].value) == 2
    assert at.markdown[0].value == "File: file1.txt"
    assert at.markdown[1].value == "File: file2.txt"
