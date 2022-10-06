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

"""A script for ScriptRunnerTest that uses widgets"""

import time

import streamlit as st

# IMPORTANT: ScriptRunner_test.py expects this file to produce 8 deltas + a
# 1-delta loop. If you change this, please change that file too.

checkbox = st.checkbox("checkbox", False)
st.text("%s" % checkbox)

text_area = st.text_area("text_area", "ahoy!")
st.text("%s" % text_area)

radio = st.radio("radio", ("0", "1", "2"), 0)
st.text("%s" % radio)

button = st.button("button")
st.text("%s" % button)

# Loop forever so that our test can check widget states
# without the scriptrunner shutting down.
placeholder = st.text("loop_forever")
while True:
    time.sleep(0.1)
    placeholder.text("loop_forever")
