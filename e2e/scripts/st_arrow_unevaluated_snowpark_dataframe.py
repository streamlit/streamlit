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
from tests.streamlit.snowpark_mocks import DataFrame

snowpark_dataframe = DataFrame(num_of_rows=50000, num_of_cols=4)

st.dataframe(snowpark_dataframe)

st.line_chart(snowpark_dataframe)

st.bar_chart(snowpark_dataframe)

st.area_chart(snowpark_dataframe)
