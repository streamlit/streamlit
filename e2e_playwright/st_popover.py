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
import pandas as pd

import streamlit as st

# Create random dataframe:
np.random.seed(0)
df = pd.DataFrame(np.random.randn(50, 5), columns=["a", "b", "c", "d", "e"])

st.popover("popover 1 (empty)")

with st.popover("popover 2 (use_container_width)", width="stretch"):
    st.markdown("Hello")

with st.popover(
    "popover 9 (use_container_width) with help",
    width="stretch",
    help="help text",
):
    st.markdown("Hello")

with st.popover(
    "popover 3 (with widgets)",
):
    st.markdown("Hello World 👋")
    text = st.text_input("Text input")
    col1, col2, col3 = st.columns(3)
    col1.text_input("Column 1")
    col2.text_input("Column 2")
    col3.text_input("Column 3")
    st.selectbox("Selectbox", ["a", "b", "c"])

with st.popover("popover 4 (with dataframe)", help="help text"):
    st.markdown("Popover with dataframe")
    st.dataframe(df, use_container_width=True)
    st.image(np.repeat(0, 100).reshape(10, 10))

with st.sidebar.popover("popover 5 (in sidebar)"):
    st.markdown("Popover in sidebar with dataframe")
    st.dataframe(df, use_container_width=True)

with st.popover("popover 6 (disabled)", disabled=True):
    st.markdown("Hello World 👋")

with st.popover("popover 7 (emoji)", icon="🦄"):
    st.markdown("Hello unicorn")

with st.popover("popover 8 (material icon)", icon=":material/thumb_up:"):
    st.markdown("Hello thumb up")

with st.container(border=True, key="test_width=content"):
    with st.popover("popover 10 (width=content)", width="content"):
        st.markdown("Content width")

    # TODO (lawilby): This is just to add height to capture the popover expanded
    # until container height is merged and we can use that.
    st.write("")
    st.write("")
    st.write("")
    st.write("")
    st.write("")

with st.container(border=True, key="test_width=stretch"):
    with st.popover("popover 11 (width=stretch)", width="stretch"):
        st.markdown("Stretch width")

    # TODO (lawilby): This is just to add height to capture the popover expanded
    # until container height is merged and we can use that.
    st.write("")
    st.write("")
    st.write("")
    st.write("")
    st.write("")

with st.container(border=True, key="test_width=500px"):
    with st.popover("popover 12 (width=500px)", width=500):
        st.markdown("500px width")

    # TODO (lawilby): This is just to add height to capture the popover expanded
    # until container height is merged and we can use that.
    st.write("")
    st.write("")
    st.write("")
    st.write("")
    st.write("")

with st.container(border=True, key="test_width=content_help"):
    with st.popover(
        "popover 13 (width=content + help)",
        width="content",
        help="This is content width with help",
    ):
        st.markdown("Content width with help tooltip")

    # TODO (lawilby): This is just to add height to capture the popover expanded
    # until container height is merged and we can use that.
    st.write("")
    st.write("")
    st.write("")
    st.write("")
    st.write("")

with st.container(border=True, key="test_width=stretch_help"):
    with st.popover(
        "popover 14 (width=stretch + help)",
        width="stretch",
        help="This is stretch width with help",
    ):
        st.markdown("Stretch width with help tooltip")

    # TODO (lawilby): This is just to add height to capture the popover expanded
    # until container height is merged and we can use that.
    st.write("")
    st.write("")
    st.write("")
    st.write("")
    st.write("")

with st.container(border=True, key="test_width=180px_help"):
    with st.popover(
        "popover 15 (width=500px + help)",
        width=500,
        help="This is 500px width with help",
    ):
        st.markdown("500px width with help tooltip")

    # TODO (lawilby): This is just to add height to capture the popover expanded
    # until container height is merged and we can use that.
    st.write("")
    st.write("")
    st.write("")
    st.write("")
    st.write("")

col1, col2 = st.columns(2, key="test_columns")
with col1:
    with st.popover("popover 16 (in column 1)", width="stretch"):
        st.markdown("Popover in column 1")
with col2:
    with st.popover("popover 17 (in column 2)"):
        st.markdown("Popover in column 2")

with st.container(border=True, key="test_deprecated_use_container_width=True"):
    with st.popover("popover 18 (use_container_width=True)", use_container_width=True):
        st.markdown("Using deprecated use_container_width=True")

    with st.popover(
        "popover 19 (use_container_width=True + help)",
        use_container_width=True,
        help="Deprecated parameter with help",
    ):
        st.markdown("Using deprecated use_container_width=True with help")

with st.container(border=True, key="test_deprecated_use_container_width=False"):
    with st.popover(
        "popover 20 (use_container_width=False)", use_container_width=False
    ):
        st.markdown("Using deprecated use_container_width=False")

    with st.popover(
        "popover 21 (use_container_width=False + help)",
        use_container_width=False,
        help="Deprecated parameter with help",
    ):
        st.markdown("Using deprecated use_container_width=False with help")


with st.expander("Output"):
    st.markdown(text)
