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

st.title("Input Elements in Horizontal Containers")

st.subheader("Buttons with various label lengths")

with st.container(direction="horizontal", border=True):
    # Very short button
    st.button("A", width="stretch")

    # Short button
    st.button("OK", width="stretch")

    # Medium button
    st.button("Submit", width="stretch")

    # Longer button
    st.button("Download File", width="stretch")

    # Very long button
    st.button(
        "This is a really long button label that should test wrapping", width="stretch"
    )

    # Single character
    st.button("X", width="stretch")


st.subheader("Boolean input elements")

with st.container(direction="horizontal", border=True):
    st.checkbox("Enable notifications", width="stretch")
    st.checkbox("Auto-save", width="stretch")
    st.checkbox("Dark mode", width="stretch")
    st.toggle("WiFi", width="stretch")
    st.toggle("Bluetooth", width="stretch")
    st.toggle("Location", width="stretch")

with st.container(direction="horizontal", border=True):
    st.checkbox("", width="stretch", key="checkbox1")
    st.checkbox("", width="stretch", key="checkbox2")
    st.checkbox("", width="stretch", key="checkbox3")
    st.checkbox("", width="stretch", key="checkbox4")
    st.checkbox("", width="stretch", key="checkbox5")
    st.checkbox("", width="stretch", key="checkbox6")

st.subheader("Selection input elements")
with st.container(direction="horizontal", border=True):
    st.selectbox("Country", ["USA", "Canada", "Mexico"], width="stretch")
    st.selectbox("State", ["CA", "NY", "TX"], width="stretch")
    st.selectbox("City", ["San Francisco", "New York", "Los Angeles"], width="stretch")

with st.container(direction="horizontal", border=True):
    st.multiselect(
        "Languages", ["Python", "JavaScript", "Java", "C++"], width="stretch"
    )
    st.multiselect("Frameworks", ["Streamlit", "React", "Django"], width="stretch")

with st.container(direction="horizontal", border=True):
    st.radio("Size", ["Small", "Medium", "Large"], horizontal=True, width="stretch")
    st.radio("Color", ["Red", "Green", "Blue"], horizontal=True, width="stretch")
    st.radio(
        "Shape", ["Circle", "Square", "Triangle"], horizontal=True, width="stretch"
    )

with st.container(direction="horizontal", border=True):
    st.pills(
        "Categories",
        ["Work", "Personal", "Urgent"],
        selection_mode="multi",
        width="stretch",
    )
    st.pills("Priority", ["Low", "Medium", "High"], width="stretch")

with st.container(direction="horizontal", border=True):
    st.segmented_control("View", ["List", "Grid", "Card"], width="stretch")
    st.segmented_control("Sort", ["Name", "Date", "Size"], width="stretch")

st.subheader("Number and date input elements")

with st.container(direction="horizontal", border=True):
    st.number_input("Age", min_value=0, max_value=120, width="stretch")
    st.date_input("Start Date", width="stretch")
    st.time_input("Start Time", width="stretch")


st.subheader("Text input elements")

with st.container(direction="horizontal", border=True):
    st.text_input("Email", width="stretch")
    st.text_input("Phone", width="stretch")
    st.text_input("ZIP Code", width="stretch")

with st.container(direction="horizontal", border=True):
    st.text_area("Description", height=80, width="stretch")
    st.text_area("Notes", height=80, width="stretch")

st.subheader("Specialized input elements")

with st.container(direction="horizontal", border=True):
    st.color_picker("Primary Color", width="stretch")
    st.feedback("thumbs", width="stretch")
    st.slider("Brightness", 0, 100, 75, width="stretch")
    st.select_slider("Quality", ["Low", "Medium", "High", "Ultra"], width="stretch")

st.subheader("File and media input elements")

with st.container(direction="horizontal", border=True):
    st.audio_input("Voice Note", width="stretch")
    st.camera_input("Profile Picture", width="stretch")
    st.file_uploader("Upload Document", type=["pdf", "docx"], width="stretch")

st.subheader("Mixed input scenarios")

with st.container(direction="horizontal", border=True):
    st.button("Save", width="stretch")
    st.selectbox("Format", ["PDF", "DOCX", "TXT"], width="stretch")
    st.checkbox("Include metadata", width="stretch")

with st.container(direction="horizontal", border=True):
    st.text_input("Search", width="stretch")
    st.button("🔍", width="content")

with st.container(direction="horizontal", border=True):
    st.markdown("**Filter:**", width="content")
    st.multiselect("Tags", ["tag1", "tag2", "tag3"], width="stretch")
    st.button("Apply", width="content")

with st.container(direction="horizontal", border=True):
    st.number_input("Min Price", min_value=0, width="stretch")
    st.markdown("to", width="content")
    st.number_input("Max Price", min_value=0, width="stretch")

with st.container(direction="horizontal", border=True):
    st.date_input("From", width="stretch")
    st.time_input("At", width="stretch")
    st.selectbox("Timezone", ["UTC", "EST", "PST"], width="stretch")

st.subheader("Input elements with labels and help")

with st.container(direction="horizontal", border=True):
    st.markdown("**User Info**", width="content")
    st.text_input("Username", help="Choose a unique username", width="stretch")
    st.text_input("Email", help="We'll never share your email", width="stretch")
