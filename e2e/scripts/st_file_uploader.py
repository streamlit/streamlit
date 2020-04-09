# Copyright 2018-2020 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import streamlit as st


result = st.file_uploader("Drop a file:", type=["txt"])
# result = st.file_uploader("Drop a file:", type=["txt"], accept_multiple_files=False)
if result is not None:
    st.text(result.getvalue())
else:
    st.text("No upload")

# result = st.file_uploader(
#     "Drop multiple files:", type=["txt"], accept_multiple_files=True
# )
# if result is not None:
#     strings = sorted([s.getvalue() for s in result])
#     st.text("\n".join(strings))
# else:
#     st.text("No upload")
