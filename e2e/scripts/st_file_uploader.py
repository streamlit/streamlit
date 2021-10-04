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

single_file = st.file_uploader("Drop a file:", type=["txt"], key="single")
if single_file is None:
    st.text("No upload")
else:
    st.text(single_file.read())

if st._is_running_with_streamlit:
    st.write(repr(st.session_state.single) == repr(single_file))

multiple_files = st.file_uploader(
    "Drop multiple files:",
    type=["txt"],
    accept_multiple_files=True,
    key="multiple",
)
if multiple_files is None:
    st.text("No upload")
else:
    files = [file.read().decode() for file in multiple_files]
    st.text("\n".join(files))

if st._is_running_with_streamlit:
    st.write(repr(st.session_state.multiple) == repr(multiple_files))

with st.form("foo"):
    form_file = st.file_uploader("Inside form:", type=["txt"])
    st.form_submit_button("Submit")
    if form_file is None:
        st.text("No upload")
    else:
        st.text(form_file.read())
