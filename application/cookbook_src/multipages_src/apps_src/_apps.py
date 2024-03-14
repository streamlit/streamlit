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


def display():

    # Provide links to lower and higher level pages in sidebar
    # It can be functionized if you don't want to write every time.
    st.sidebar.page_link("app.py", label="🏠 Main")

    st.sidebar.title("Applications")
    st.sidebar.header("Design your own structure.")
    st.sidebar.write(
        "I will use the selectbox to go to an app, and multi-select button for descriptions."
    )

    st.sidebar.page_link("pages/cookbook/multipages.py", label="◀️ Nested Multipages")

    selected = st.sidebar.selectbox(
        label="Select an app to use.", options=["idle", "App1", "App2"]
    )
    _switch_to_app(selected)

    # main page
    st.title("If you choose apps, the descriptions of the selected will show up.")
    selected = st.multiselect(
        label="Select Apps for descriiptions.", options=["App1", "App2"]
    )
    _describe_apps(selected)


def _switch_to_app(selected):
    if selected == "App1":
        st.switch_page("pages/cookbook/multipages/apps/app1.py")
    elif selected == "App2":
        st.switch_page("pages/cookbook/multipages/apps/app2.py")
    elif selected == "idle":
        pass


def _describe_apps(selected):
    for key, description in _descriptions.items():
        if key in selected:
            st.header(key)
            st.write(description)


_descriptions = {
    "App1": "Write the description of App1.",
    "App2": "Write the description of App2.",
}
