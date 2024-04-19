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

import numpy as np

import streamlit as st

st.markdown("This **markdown** is awesome! :sunglasses:")

st.markdown("This <b>HTML tag</b> is escaped!")

st.markdown("This <b>HTML tag</b> is not escaped!", unsafe_allow_html=True)

st.markdown("[text]")

st.markdown("[link](href)")

st.markdown("[][]")

st.markdown("Inline math with $\KaTeX$")

st.markdown(
    """
$$
ax^2 + bx + c = 0
$$
"""
)

st.markdown("# Some header 1")
st.markdown("## Some header 2")
st.markdown("### Some header 3")

st.markdown(
    """
| Col1      | Col2        |
| --------- | ----------- |
| Some      | Data        |
"""
)

with st.container():
    st.markdown("# some really long header " + " ".join(["lol"] * 10))
    np.random.seed(0)
    st.table(np.random.randn(10, 20))

with st.container():
    st.title("Some title")
    st.markdown("Some text")

    st.markdown(
        """
    # Some title
    Some text
    """
    )

    st.title(
        """
    Some title
    Some text
    """
    )

    st.markdown("# Some title")
    st.markdown("Some text")

st.markdown(
    """
- :blue[blue]
- :green[green]
- :red[red]
- :violet[violet]
- :orange[orange]
- :gray[gray]
- :grey[grey]
- :rainbow[rainbow]
"""
)

st.markdown(
    """
- :blue-background[blue]
- :green-background[green]
- :red-background[red]
- :violet-background[violet]
- :orange-background[orange]
- :gray-background[gray]
- :grey-background[grey]
- :rainbow-background[rainbow]
"""
)


st.markdown(":blue-background[**Bold text within blue background**]")

st.markdown(":red-background[*Italic text within red background*]")

st.markdown(":rainbow-background[[Link](http://example.com) within rainbow background]")

st.markdown(
    ":green-background[LaTeX math within green background: $ax^2 + bx + c = 0$]"
)
