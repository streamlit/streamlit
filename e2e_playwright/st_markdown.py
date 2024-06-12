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

import streamlit as st

# keep the sidebar collapsed by default to prevent render flakiness
st.set_page_config(initial_sidebar_state="collapsed")

st.markdown(
    "This **markdown** is awesome! :sunglasses:", help="This is a help tooltip!"
)

st.markdown("This <b>HTML tag</b> is escaped!")

st.markdown("This <b>HTML tag</b> is not escaped!", unsafe_allow_html=True)

st.markdown("[text]")

st.markdown("[link](href)")

st.markdown("[][]")

st.markdown(r"Inline math with $\KaTeX$")

st.markdown(
    """
$$
ax^2 + bx + c = 0
$$
"""
)

st.markdown(
    """
| Col1      | Col2        |
| --------- | ----------- |
| Some      | Data        |
"""
)

st.markdown(":blue-background[**Bold text within blue background**]")
st.markdown(":red-background[*Italic text within red background*]")
st.markdown(":rainbow-background[[Link](http://example.com) within rainbow background]")
st.markdown(
    ":green-background[LaTeX math within green background: $ax^2 + bx + c = 0$]"
)

st.markdown(
    r"""
Many different markdown formats in one block:

Inline math with $\KaTeX$

$$
ax^2 + bx + c = 0
$$

# Some header 1

| Col1      | Col2        |
| --------- | ----------- |
| Some      | Data        |

Some text
- :blue[blue], :green[green], :red[red], :violet[violet], :orange[orange], :gray[gray], :grey[grey], :rainbow[rainbow]
- :blue-background[blue], :green-background[green], :red-background[red], :violet-background[violet], :orange-background[orange], :gray-background[gray], :grey-background[grey], :rainbow-background[rainbow]

:blue-background[**Bold text within blue background**], :red-background[*Italic text within red background*]

:rainbow-background[[Link](http://example.com) within rainbow background], :green-background[LaTeX math within green background: $ax^2 + bx + c = 0$]

:violet-background[This is a repeating multiline string that wraps within purple background. This is a repeating multiline string that wraps within purple background.]

"""
)


# Headers in markdown tests (originally from the typography-test suite).

with st.container():
    st.markdown("# some really long header " + " ".join(["lol"] * 10))
    st.markdown(
        """
| Col1      | Col2        | Col3        | Col4        |
| --------- | ----------- | ----------- | ----------- |
| Some      | Data        | Data        | Data        |
"""
    )


def draw_header_test(join_output):
    strings = [
        "# Header header1",
        "## Header header2",
        "### Header header3",
        "#### Header header4",
        "##### Header header5",
        "###### Header header6",
        "Quisque vel blandit mi. Fusce dignissim leo purus, in imperdiet lectus suscipit nec.",
    ]

    if join_output:
        st.markdown("\n\n".join(strings))
    else:
        for string in strings:
            st.markdown(string)


draw_header_test(True)

with st.sidebar:
    st.text_input("This is a label", key="1")
    draw_header_test(True)

"---"

with st.container():
    st.text("Headers in single st.markdown command")
    draw_header_test(True)

"---"

with st.container():
    st.text("Headers in multiple st.markdown command")
    draw_header_test(False)

"---"

with st.container():
    st.text("Headers in columns")

    a, b = st.columns(2)

    with a:
        draw_header_test(True)

    with b:
        draw_header_test(False)

"---"

with st.container():
    st.text("Headers in columns with other elements above")

    a, b = st.columns(2)

    with a:
        st.text("This is some text")
        draw_header_test(True)

    with b:
        st.text("This is some text")
        with st.container():
            draw_header_test(False)

"---"

with st.container():
    st.text("Headers in column beside widget")

    a, b = st.columns(2)

    with a:
        st.write("# Header header")
        st.write("## Header header")

    with b:
        st.text_input("This is a label", key="2")

"---"

st.latex(r"\LaTeX")

try:
    import sympy

    a, b = sympy.symbols("a b")
    out = a + b
except Exception:
    out = "a + b"

st.latex(out)

st.latex(
    r"""
    a + ar + a r^2 + a r^3 + \cdots + a r^{n-1} =
    \sum_{k=0}^{n-1} ar^k =
    a \left(\frac{1-r^{n}}{1-r}\right)
    """,
    help="This is example tooltip displayed on latex.",
)

st.markdown(
    "Images in markdown should stay inside the container width:\n\n![image](./app/static/streamlit-logo.png)"
)

st.markdown(
    ":material/add: llo :material/foo: :material/chevron_right: world test/123 :red[foo :blue[bar] baz] :foo bar baz :bar:faz"
)

st.subheader(":material/home: Home")

st.markdown(
    ":material/chevron_right: This text can contain material icons :red[:material/local_fire_department:]"
)


col1, col2 = st.columns(2)
with col1:
    st.button(":material/search: Search")

with col2:
    st.button("Next :material/arrow_forward:")
