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

import pandas as pd

import streamlit as st
from streamlit.hello.utils import show_code


def multiline_page() -> None:
    df2 = pd.DataFrame({"test": ["line1\nline2", "another row"]})
    st.data_editor(
        df2,
        column_config={
            "test": st.column_config.TextColumn("Test", multiline=True, max_chars=100),
        },
        hide_index=True,
    )


st.set_page_config(page_title="Multiline page")
st.title("Multiline page")
st.write(
    """
    This is a testing page for the change request to add multiline functionality to st.data_editor for
    the column.
    """
)

multiline_page()
show_code(multiline_page)
