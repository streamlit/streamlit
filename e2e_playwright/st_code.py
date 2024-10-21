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

import streamlit as st

st.code("# This code is awesome!")

st.code("")

code = """
def hello():
    print("Hello, Streamlit!")
"""
st.code(code, language="python")

st.code(code, language="python", line_numbers=True)

st.code("PLAIN TEXT", language=None, line_numbers=True)

st.markdown("```python\n" + code + "\n```")

st.code(
    """
--- main
+++ develop
@@ -52,21 +52,19 @@
     "title": "Democracy index",
     "yAxis": {
         "max": 10,
-        "min": -10,
-        "facetDomain": "shared"
+        "min": -10
     },
""",
    language="diff",
)

with st.expander("`st.code` usage", expanded=True):
    st.code(code, language="python")
    st.code(code, language="python")

with st.expander("`st.markdown` code usage", expanded=True):
    st.markdown("```python\n" + code + "\n```")
    st.markdown("```python\n" + code + "\n```")
    st.markdown("[a link with `code`](https://streamlit.io)")


long_string = "Testing line wrapping: " + "foo bar baz " * 10 + "{EOL}"

wide_code_block = f"""
def foo():
    bar(f"{long_string}")
    return 123
"""

st.code(wide_code_block, wrap_lines=False)
st.code(wide_code_block, wrap_lines=False, line_numbers=True)
st.code(wide_code_block, wrap_lines=True)
st.code(wide_code_block, wrap_lines=True, line_numbers=True)
