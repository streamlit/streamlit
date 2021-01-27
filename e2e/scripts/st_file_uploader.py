# Copyright 2018-2021 Streamlit Inc.
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

single_file = st.file_uploader("Drop a file:", type=["txt"])
if single_file is None:
    st.text("No upload")
else:
    st.text(single_file.read())

multiple_files = st.file_uploader(
    "Drop multiple files:", type=["txt"], accept_multiple_files=True
)
if multiple_files is None:
    st.text("No upload")
else:
    files = [file.read().decode() for file in multiple_files]
    st.text("\n".join(files))
