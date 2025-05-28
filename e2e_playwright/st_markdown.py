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


def draw_header_test(join_output: bool) -> None:
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

with st.container():
    st.text("Headers with bold syntax")

    strings = [
        "# Bold **header1**",
        "## Bold **header2**",
        "### Bold **header3**",
        "#### Bold **header4**",
        "##### Bold **header5**",
        "###### Bold **header6**",
    ]
    for string in strings:
        st.markdown(string)

"---"

with st.container(key="latex_elements"):
    st.latex(r"\LaTeX")

    st.latex(
        r"""
        a + ar + a r^2 + a r^3 + \cdots + a r^{n-1} =
        \sum_{k=0}^{n-1} ar^k =
        a \left(\frac{1-r^{n}}{1-r}\right)
        """,
        help="foo",
    )

    try:
        import sympy

        a, b = sympy.symbols("a b")
        out = a + b  # type: ignore[operator]
    except Exception:
        out = "a + b"

    st.latex(out)

    st.latex(
        "this is a very long formula this is a very long formula this is a very long "
        "formula this is a very long formula this is a very long formula"
    )

    st.latex(
        "this is a very long formula this is a very long formula this is a very long "
        "formula this is a very long formula this is a very long formula",
        help="foo",
    )

    st.latex(
        r"""
    \text{This is a longer LaTeX equation demonstrating fixed width: }
    \int_{a}^{b} f(x) \, dx = F(b) - F(a) \text{ where } F'(x) = f(x)
    \text{ and } a \leq x \leq b
""",
        width=300,
    )
    st.latex("ax^2 + bx + c = 0", width="stretch")
    st.latex("ax^2 + bx + c = 0", width="content")

"---"

with st.container(key="badge_elements"):
    st.badge("Simple badge")
    st.badge("Green badge with emoji", icon="🚀", color="green")
    st.badge("Red badge with material icon", icon=":material/warning:", color="red")
    st.badge(
        "This is a very long badge that should be ellipsized when it exceeds the container width. "
        "It contains enough text to demonstrate how badges handle overflow and text wrapping in the "
        "Streamlit interface.",
    )
    st.markdown(
        ":blue-badge[Blue markdown badge] :green-badge[🌱 Green markdown badge]"
    )

"---"

st.markdown(
    "Images in markdown should stay inside the container width:\n\n![image](./app/static/streamlit-logo.png)"
)

"---"

st.container(key="mixed_markdown").markdown(
    r"""
Inline math with $\KaTeX$

$$
ax^2 + bx + c = 0
$$

$$
this is a very long formula this is a very long formula this is a very long formula
this is a very long formula this is a very long formula
$$

> This is a **blockquote**

### :material/home: :streamlit: Some header

| Col1      | Col2        |
| --------- | ----------- |
| Some      | :material/description: :streamlit: Data        |

- :small[small], :small[:red[small red]], :blue[blue], :green[green], :red[red], :violet[violet], :orange[orange],
  :gray[gray], :grey[grey], :rainbow[rainbow], :primary[primary]
- :blue-background[blue], :green-background[green], :red-background[red], :violet-background[violet],
  :orange-background[orange], :gray-background[gray], :grey-background[grey], :primary-background[primary],
  :rainbow-background[rainbow]
- [x] :blue-badge[blue], :green-badge[green], :red-badge[red], :orange-badge[orange],
  :violet-badge[violet], :gray-badge[gray], :grey-badge[grey], :primary-badge[primary]
- [ ] Material icons :red[:material/local_fire_department:] :green-background[:material/celebration: Yay]
  and Streamlit logo :streamlit: :red-background[:streamlit:]
- <- -> <-> -- >= <= ~= https://example.com-> `code <- -> <-> -- >= <= ~=` $a <- -> <-> -- >= <= ~= b$

:blue-background[**Bold and blue**], :red-background[*Italic and red*],
:rainbow-background[[Link](http://example.com) and rainbow],
:green-background[LaTeX and green: $ax^2 + bx + c = 0$]

:violet-background[This is a repeating multiline string that wraps within purple background.
This is a repeating multiline string that wraps within purple background.]
"""
)
