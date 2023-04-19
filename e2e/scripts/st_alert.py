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

st.error("This is an error")
st.warning("This is a warning")
st.info("This is an info message")
st.success("This is a success message")

# This is here so we can test the distance between alert messages and
# elements above/below them.
st.write("Some non-alert text!")

st.error("This is an error", icon="🚨")
st.warning("This is a warning", icon="⚠️")
st.info("This is an info message", icon="👉🏻")
st.success("This is a success message", icon="✅")

# Verify that line-wrapping works as expected both with and without break words.
st.error("A" + 100 * "H")
st.error("If I repeat myself enough the line should " + 20 * "wrap ")

# Verify that code blocks with long lines don't overflow the alert.

text = """
Here is some code:
```
import streamlit as st
st.write("Hello world!")
# this is a very long comment just to demonstrate the overflowing behavior it goes on and on and on
```
"""
st.info(text)
