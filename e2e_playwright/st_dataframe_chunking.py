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

from __future__ import annotations

from typing import TYPE_CHECKING

import streamlit as st

if TYPE_CHECKING:
    import pandas as pd


# np.random.seed(0)
# random.seed(0)

# Generate a random dataframe
# df = pd.DataFrame(
#     np.random.randn(5000, 5),
#     columns=("col_%d" % i for i in range(5)),
# )


# def get_data():
#     chunk_size = 500
#     total_rows = df.shape[0]

#     def get_chunk(chunk_index: int) -> pd.DataFrame:
#         time.sleep(0.5)
#         # Get a chunk of data from the database
#         return df.iloc[chunk_index * chunk_size : (chunk_index + 1) * chunk_size]

#     return total_rows, get_chunk


# st.dataframe(get_data)


st.header("Snowflake Table")

# Initialize connection.
conn = st.connection("snowflake")

# Perform query.
# df = conn.query("SELECT * from streamlit.streamlit.menu_clicks;", ttl=600)

enable_chunking = st.toggle("Enable lazy loading", False)

if enable_chunking:

    def get_snowflake_data():
        chunk_size = 500
        df = conn.query(
            "SELECT ROW_COUNT FROM streamlit.information_schema.tables where table_name = 'MENU_CLICKS' and table_schema = 'APPS';"
        )
        # st.dataframe(df)
        total_rows = int(df["ROW_COUNT"].values[0])
        st.caption(f"Scroll to se all {total_rows} rows.")
        print(total_rows)
        # cur = conn.cursor().execute("SELECT * from streamlit.apps.menu_clicks;")
        data_context = {"reached_end": False, "cursor": None}

        def get_chunk(
            chunk_index: int,
        ) -> pd.DataFrame | list[tuple] | list[dict] | None:
            if data_context["reached_end"]:
                return None
            # if (chunk_index * chunk_size) + chunk_size >= total_rows:
            #     data_context["reached_end"] = True
            # use limit and offset
            return conn.query(
                f"SELECT * from streamlit.apps.menu_clicks limit {chunk_size} offset {chunk_index * chunk_size};"
            )
            # _cur = data_context["cursor"]
            # res = _cur.fetchmany(chunk_size)
            # if len(res) == 0:
            #     data_context["reached_end"] = True
            # return res

        return total_rows, get_chunk

    st.dataframe(get_snowflake_data, hide_index=True)
else:
    limit = 200000
    df = conn.query(
        "SELECT ROW_COUNT FROM streamlit.information_schema.tables where table_name = 'MENU_CLICKS' and table_schema = 'APPS';"
    )
    total_rows = int(df["ROW_COUNT"].values[0])
    df = conn.query(f"SELECT * from streamlit.apps.menu_clicks limit {limit};")
    st.caption(
        f"⚠️ Showing {limit} out of {total_rows} " "rows due to data size limitations."
    )
    st.dataframe(df, hide_index=False)
