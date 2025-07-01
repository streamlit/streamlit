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

import streamlit as st

st.set_page_config(page_title="PDF Custom Component Test", page_icon="📄")

st.title("📄 PDF Custom Component Test")

# Test with URL
st.header("Test with URL")
url = "https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf"
st.pdf(url)

# Test with file upload
st.header("Test with File Upload")
uploaded_file = st.file_uploader("Choose a PDF file", type="pdf")
if uploaded_file is not None:
    st.pdf(uploaded_file)

# Test different sizes
st.header("Test with Different Sizes")
col1, col2 = st.columns(2)

with col1:
    st.subheader("Fixed Width")
    if uploaded_file is not None:
        st.pdf(uploaded_file, width=400, height=600)

with col2:
    st.subheader("Stretch Width")
    if uploaded_file is not None:
        st.pdf(uploaded_file, width="stretch", height=400)
