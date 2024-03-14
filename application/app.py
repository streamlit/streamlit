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

st.sidebar.page_link("app.py", label="🏠 Main")
st.sidebar.page_link("pages/cookbook.py", label="▶️ CookBook")
st.sidebar.page_link("pages/apps.py", label="▶️ Application", disabled=True)

"""\
# Welcome To Crimson206's AI 🤖 Hub 👻!

Hi, I am a passionate AI engineer.
I have just initialized this project, so there are only few contents here.

I will develop streamlit UI and AI functionalities parallelly, and each component will be archived here as a small example

The small component will go to my **CookBook** 📖, and some integrated applications will go to **Applications**.

My hub is still quite empty. I need your attention and support 🥺, and then, I will pay back with plenty of contents! 😤

"""
