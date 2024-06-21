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

import re

import streamlit as st

st.header("Chat response cell")
st.caption('The "LLM-generated" code runs independently of the rest of the page')


line_chart_response = """
Here, have a line chart,
```python
import streamlit as st
import pandas as pd

app_df = pd.DataFrame([[1, 1, 1], [2, 2, 2], [3, 3, 2], [4, 4, 2], [5, 5, 3]], columns=["day", "apps", "external_apps"])
exclude = st.checkbox("Exclude internal apps")
y = "apps" if not exclude else "external_apps"
st.line_chart(app_df, x="day", y=y)
```
"""


@st.fragment
def parse_and_exec(response):
    code_match = re.search(r"```python\n(.*)\n```", response, re.DOTALL)
    if code_match:
        code = code_match.group(1)
        exec(code)


messages = [
    {"role": "user", "content": "how2LineChartPlz"},
    {"role": "assistant", "content": line_chart_response},
]

for msg in messages:
    st.chat_message(msg["role"]).write(msg["content"])
    parse_and_exec(msg["content"])
