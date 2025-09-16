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

import numpy as np

import streamlit as st

np.random.seed(0)


# Create random sparkline data:
def generate_sparkline_data(
    length: int = 30, drift: float = 0.1, volatility: float = 10
) -> list[float]:
    random_changes = np.random.normal(loc=drift, scale=volatility, size=length)
    initial_value = np.random.normal(loc=50, scale=5)
    data = initial_value + np.cumsum(random_changes)
    return data.tolist()  # type: ignore


st.set_page_config(initial_sidebar_state="expanded", layout="wide")

# Better show the app content by minimizing the dead space
st.html("""
    <style>
        .stMainBlockContainer {
            padding-top: 4rem;
        }
    </style>
""")

st.header("Custom Text Colors :rainbow[App]")


def page1():
    pass


def page2():
    pass


st.navigation(
    [
        st.Page(page1, title="Page 1", icon=":material/home:"),
        st.Page(page2, title="Page 2", icon=":material/settings:"),
    ]
)


@st.dialog("My Dialog")
def my_dialog():
    st.write("Hello World")


col1, col2, col3, col4 = st.columns(4)

with col1:
    if st.button("Open Dialog", width="stretch"):
        my_dialog()
    st.segmented_control(
        "Segmented Control",
        options=["Option 1", "Option 2"],
        default="Option 1",
        label_visibility="collapsed",
    )
    st.button("Primary Button", type="primary")
    st.divider()
    st.write("**Alerts:**")
    st.info("Info")
    st.warning("Warning")
    st.error("Error")
    st.success("Success")

    st.write("Badges:")
    c1, c2, c3 = st.columns(3)
    with c1:
        st.badge("Blue", color="blue")
        st.badge("Green", color="green")
        st.badge("Gray", color="gray")
    with c2:
        st.badge("Yellow", color="yellow")
        st.badge("Red", color="red")
    with c3:
        st.badge("Violet", color="violet")
        st.badge("Orange", color="orange")

with col2:
    with st.expander("Expander", expanded=True):
        st.write("Chat Message avatars (main colors):")
        user_message = st.chat_message(name="User")
        user_message.write("Hello Kevin!")
        assistant_message = st.chat_message(name="Assistant")
        assistant_message.write("Hello :dog:")

    st.container(key="markdown").markdown(
        r"""
    Text colors for markdown:
    - :blue[blue], :green[green], :yellow[yellow], :red[red],
    :violet[violet], :orange[orange], :gray[gray],
    :grey[grey], :primary[primary], :rainbow[rainbow]
    """
    )
    st.container(key="badge_markdown").markdown(
        r"""
    Markdown badges:
    - :blue-badge[blue], :green-badge[green], :yellow-badge[yellow], :red-badge[red], :violet-badge[violet],
    :orange-badge[orange], :gray-badge[gray], :primary-badge[primary]
    """
    )

with col3:
    st.subheader("Dividers - Main Colors:")
    st.subheader("Red test", divider="red")
    st.subheader("Orange test", divider="orange")
    st.subheader("Yellow test", divider="yellow")
    st.subheader("Green test", divider="green")
    st.subheader("Blue test", divider="blue")
    st.subheader("Violet test", divider="violet")
    st.subheader("Gray test", divider="gray")

with st.sidebar:
    st.subheader("Text colors:")
    st.container(key="sidebar_markdown").markdown(
        r"""
    Markdown text colors:
    - :blue[blue], :green[green], :yellow[yellow], :red[red],
    :violet[violet], :orange[orange], :gray[gray],
    :grey[grey], :primary[primary], :rainbow[rainbow]
    """
    )
    st.write("**Badges:**")
    c1, c2, c3 = st.columns(3)
    with c1:
        st.badge("Blue", color="blue")
        st.badge("Green", color="green")
        st.badge("Gray", color="gray")
    with c2:
        st.badge("Yellow", color="yellow")
        st.badge("Red", color="red")
    with c3:
        st.badge("Violet", color="violet")
        st.badge("Orange", color="orange")

    st.subheader("Dividers - Main Colors:")
    st.subheader("Red test", divider="red")
    st.subheader("Orange test", divider="orange")
    st.subheader("Yellow test", divider="yellow")
    st.subheader("Green test", divider="green")
    st.subheader("Blue test", divider="blue")
    st.subheader("Violet test", divider="violet")
    st.subheader("Gray test", divider="gray")


with col4:
    st.metric(
        "User growth",
        123,
        123,
        delta_color="normal",
        chart_data=generate_sparkline_data(),
        chart_type="bar",
        border=True,
    )

    st.metric(
        "S&P 500",
        -4.56,
        -50,
        chart_data=generate_sparkline_data(),
        chart_type="area",
        border=True,
    )

    st.metric(
        "Apples I've eaten",
        "23k",
        " -20",
        delta_color="off",
        chart_data=generate_sparkline_data(),
        chart_type="line",
        border=True,
    )
