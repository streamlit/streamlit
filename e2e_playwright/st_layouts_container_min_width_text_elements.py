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

with st.container(direction="horizontal", border=True):
    st.markdown("Hello", width="stretch")
    st.markdown("Hello", width="stretch")
    st.markdown(
        "Really long test. Reallly long text. Really long text. This is a really long text. This is really long text.",
        width="stretch",
    )
    st.markdown("Hello", width="stretch")
    st.markdown("Hello", width="stretch")
    st.markdown(
        "Really long test. Reallly long text. Really long text.", width="stretch"
    )
    st.markdown("Hello", width="stretch")
    st.markdown("Hello", width="stretch")
    st.markdown(
        "Really long test. Reallly long text. Really long text.", width="stretch"
    )
    st.markdown("Hello", width="stretch")
    st.markdown("Hello", width="stretch")
    st.markdown("Hello", width="stretch")

with st.container(direction="horizontal", border=True):
    st.divider()

with st.container(direction="horizontal", border=True):
    st.markdown("---")
    st.markdown("---")
    st.markdown("---")
    st.markdown("---")

with st.container(direction="horizontal", border=True):
    st.info("Info")
    st.warning("Warning")
    st.error("Error")
    st.success("Success")

with st.container(direction="horizontal", border=True):
    st.help(len, width="stretch")
    st.help(str.split, width="stretch")

with st.container(direction="horizontal", border=True):
    st.title("What's for dessert?")
    st.badge("Strawberry Cheesecake", width="stretch", color="red", icon="🍓")
    st.badge("Chocolate Cake", width="stretch", color="gray", icon="🍫")
    st.badge("Vanilla Cake", width="stretch", color="orange", icon="🍰")
    st.badge("Lemon Cake", width="stretch", color="orange", icon="🍋")
    st.badge("Apple Pie", width="stretch", color="red", icon="🍎")
    st.badge("Pumpkin Pie", width="stretch", color="orange", icon="🎃")
    st.badge("Cherry Pie", width="stretch", color="violet", icon="🍒")
    st.badge("Blueberry Pie", width="stretch", color="blue", icon="🫐")
    st.badge("Raspberry Pie", width="stretch", color="red", icon="🍇")
