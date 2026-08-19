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

"""Test app for st.mermaid_chart E2E tests."""

import streamlit as st

st.header("Mermaid Chart Types")

st.subheader("Flowchart")
st.mermaid_chart("""
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[OK]
    B -->|No| D[Cancel]
    C --> E[End]
    D --> E
""")

st.subheader("Sequence Diagram")
st.mermaid_chart("""
sequenceDiagram
    participant User
    participant App
    participant Server
    User->>App: Click button
    App->>Server: API request
    Server-->>App: Response
    App-->>User: Update UI
""")

st.subheader("Class Diagram")
st.mermaid_chart("""
classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal : +int age
    Animal : +String gender
    Animal: +isMammal()
    class Duck{
        +String beakColor
        +swim()
        +quack()
    }
    class Fish{
        -int sizeInFeet
        -canEat()
    }
""")

st.subheader("State Diagram")
st.mermaid_chart("""
stateDiagram-v2
    [*] --> Still
    Still --> [*]
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]
""")

st.subheader("Pie Chart")
st.mermaid_chart("""
pie title Favorite Pets
    "Dogs" : 386
    "Cats" : 325
    "Birds" : 89
""")

st.subheader("Gantt Chart")
st.mermaid_chart("""
gantt
    title Project Schedule
    dateFormat  YYYY-MM-DD
    section Planning
    Research       :a1, 2024-01-01, 7d
    Design         :a2, after a1, 5d
    section Development
    Implementation :b1, after a2, 14d
    Testing        :b2, after b1, 7d
""")

st.subheader("Mind Map")
st.mermaid_chart("""
mindmap
    root((Streamlit))
        Elements
            Text
            Data
            Charts
        Widgets
            Input
            Selection
            Media
        Layout
            Columns
            Tabs
            Containers
""")

# Sizing regression cases (kept last so existing snapshot indices are stable).
st.subheader("Content width")
st.mermaid_chart("graph LR\n    A --> B --> C", width="content")

st.subheader("Tall diagram")
st.mermaid_chart("graph TD\n" + "\n".join(f"    N{i} --> N{i + 1}" for i in range(12)))
