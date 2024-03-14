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
    st.sidebar.page_link("app.py", label="🏠 Main")

    st.sidebar.title("Welcome to the Cookbook page!")
    st.sidebar.write(
        "Under this branch, I will showcase uint UI implementation examples and simple Apps requiring endpoints."
    )

    st.sidebar.page_link("pages/cookbook/multipages.py", label="▶️ Nested Multipages")

    # main page
    st.markdown(_page)


_page = """\
# Streamlit App Cookbook 📖

I will continuously update new component recipes here.
Visit from time to time, and look around different UI or AI elements.

## Publish Plan

I won't take much time for docs for a while, but focus on developing.
Please understand the minial documents.


## Multipages

Check the Nested Multipages example.

This structure is not possible with the current version of streamlit.
I am planning to make a pull request. If this idea is not accepted, I will consider publishing a patch package.

I will write more details in a post exclusively for this component.\
"""
