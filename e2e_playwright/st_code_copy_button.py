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

# Create a long line of code that will trigger horizontal overflow
# The "END" token at the end is crucial for checking visibility
long_line = """print('This is a very long line of code that
should extend well beyond the width of the container to test
the scroll behavior and ensure the copy button does not overlap
the content at the end of the line.') # END"""

st.code(long_line, language="python")
