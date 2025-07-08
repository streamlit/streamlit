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


import pandas as pd

import streamlit as st

if "rerun_count" not in st.session_state:
    st.session_state["rerun_count"] = 0

st.session_state["rerun_count"] += 1

# Send a ForwardMsg to the client that's long enough that we cache it.
num_small_messages = st.number_input(
    "Number of small messages", value=50, min_value=1, max_value=200
)
kb_message_size = st.number_input(
    "Message KB size", value=50, min_value=1, max_value=200
)


# This string is ~1kb in size if rendered via markdown:
message_1kb = "\n\n".join(
    2
    * [
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus quis neque "
        "eu orci faucibus pellentesque. Vivamus dapibus pellentesque sem, vitae "
        "ultricies sem pharetra at. Curabitur eu congue magna, eu tempor libero. "
        "Donec vitae condimentum odio. Sed neque elit, porttitor eget laoreet "
        "volutpat, imperdiet et leo. Phasellus vel velit sit amet nulla hendrerit "
        "pharetra et non tortor. Lorem ipsum dolor sit amet, consectetur adipiscing "
        "elit. In malesuada sem sit amet felis vestibulum, maximus."
    ]
)

with st.container(height=300):
    for i in range(num_small_messages):
        st.markdown(
            f"**Message {i + 1}:** \n\n" + "\n\n".join(kb_message_size * [message_1kb]),
        )


@st.fragment
def my_fragment():
    st.button("Rerun fragment")
    with st.expander("Message in Fragment", expanded=False):
        st.markdown(
            "**Message in Fragment:** \n\n"
            + "\n\n".join(kb_message_size * [message_1kb]),
        )


my_fragment()

st.button("Re-run")
st.markdown(f"Rerun count: {st.session_state['rerun_count']}")

if st.toggle("Show dataframes"):
    # With the default settings, the dataframe is ~50MB in size.
    num_cols = st.number_input("Number of columns", value=20, min_value=1, max_value=40)
    num_rows = st.number_input(
        "Number of rows", value=100000, min_value=1, max_value=500000
    )

    # Create a large dataframe
    @st.cache_data
    def create_large_dataframe(num_cols: int, num_rows: int) -> pd.DataFrame:
        df = pd.DataFrame({f"col {i}": range(num_rows) for i in range(num_cols)})
        # Make 50% of the columns string columns
        for i in range(num_cols):
            if i % 2 == 0:
                df[f"col {i}"] = df[f"col {i}"].astype(str)
        return df

    df = create_large_dataframe(num_cols, num_rows)

    st.dataframe(df)
    st.data_editor(df)
