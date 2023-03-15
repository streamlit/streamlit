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

import streamlit as st

st.markdown(
    """
- :blue[blue]
- :green[green]
- :red[red]
- :violet[violet]
- :orange[orange]
""",
    help="This is example tooltip displayed on markdown.",
)

st.text("Text with tooltip", help="This is example tooltip displayed on text.")

st.latex(
    r"""
    a + ar + a r^2 + a r^3 + \cdots + a r^{n-1} =
    \sum_{k=0}^{n-1} ar^k =
    a \left(\frac{1-r^{n}}{1-r}\right)
    """,
    help="This is example tooltip displayed on latex.",
)

st.caption("Caption with tooltip", help="This is example tooltip displayed on caption.")

st.title("Title with tooltip", help="This is example tooltip displayed on title.")

st.header("Header with tooltip", help="This is example tooltip displayed on header.")

st.subheader(
    "Subheader with tooltip", help="This is example tooltip displayed on subheader."
)
