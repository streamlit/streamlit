# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

"""E2E test app for mermaid charts in st.markdown."""

import streamlit as st

st.header("Mermaid Chart Support")

# Test 1: Simple flowchart
st.subheader("1. Flowchart")
st.markdown(
    """
```mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
```
"""
)

# Test 2: Sequence diagram
st.subheader("2. Sequence Diagram")
st.markdown(
    """
```mermaid
sequenceDiagram
    participant User
    participant App
    User->>App: Click button
    App-->>User: Update UI
```
"""
)

# Test 3: Pie chart
st.subheader("3. Pie Chart")
st.markdown(
    """
```mermaid
pie title Favorite Pets
    "Dogs" : 386
    "Cats" : 325
    "Birds" : 89
```
"""
)

# Test 4: Timeline
st.subheader("4. Timeline")
st.markdown(
    """
```mermaid
timeline
    title History
    2022 : Event A
    2023 : Event B
    2024 : Event C
```
"""
)

# Test 5: Invalid mermaid syntax (should show error)
st.subheader("5. Invalid Syntax")
st.markdown(
    """
```mermaid
this is not valid mermaid syntax
```
"""
)

# Test 6: Regular code block (should not be mermaid)
st.subheader("6. Regular Code Block")
st.markdown(
    """
```python
def hello():
    print("Hello, World!")
```
"""
)
