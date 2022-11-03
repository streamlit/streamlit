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
from tests.streamlit import pyspark_mocks

pyspark_dataframe = pyspark_mocks.DataFrame(is_numpy_arr=True, num_of_rows=50000)

st.dataframe(pyspark_dataframe)

st.line_chart(pyspark_dataframe)

st.bar_chart(pyspark_dataframe)

st.area_chart(pyspark_dataframe)

st.table(pyspark_dataframe)
