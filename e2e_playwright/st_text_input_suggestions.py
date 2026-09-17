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

from uuid import uuid4

import streamlit as st

FRUITS = ["apple", "apricot", "avocado", "banana", "blueberry"]


def suggest_fruits(text: str) -> list[str]:
    query = text.lower()
    return [name for name in FRUITS if name.startswith(query)]


st.text_input("Fruit search", autocomplete=suggest_fruits, key="fruit")
st.write("committed fruit:", st.session_state.get("fruit", ""))


def failing_source(_text: str) -> list[str]:
    raise RuntimeError("source failed")


st.text_input("Failing source", autocomplete=failing_source, key="failing")
st.write("failing value:", st.session_state.get("failing", ""))

with st.form("suggest_form"):
    st.text_input("Form fruit", autocomplete=suggest_fruits, key="form_fruit")
    form_submitted = st.form_submit_button("Submit form")
st.write("form submitted:", form_submitted)
st.write("form fruit value:", st.session_state.get("form_fruit", ""))

if "body_token" not in st.session_state:
    st.session_state.body_token = str(uuid4())
st.write("body token:", st.session_state.body_token)


@st.fragment
def fragment_search() -> None:
    st.text_input("Fragment fruit", autocomplete=suggest_fruits, key="frag_fruit")
    st.write("fragment fruit value:", st.session_state.get("frag_fruit", ""))


fragment_search()

st.text_input("Live fruit", autocomplete=suggest_fruits, live=True, key="live_fruit")
st.write("live fruit value:", st.session_state.get("live_fruit", ""))

st.text_input(
    "Short fruit", autocomplete=suggest_fruits, max_chars=5, key="short_fruit"
)
st.write("short fruit value:", st.session_state.get("short_fruit", ""))

st.text_input(
    "Disabled fruit",
    autocomplete=suggest_fruits,
    disabled=True,
    key="disabled_fruit",
)


@st.dialog("Suggestions dialog")
def suggestions_dialog() -> None:
    st.text_input("Dialog fruit", autocomplete=suggest_fruits, key="dialog_fruit")


if st.button("Open dialog"):
    suggestions_dialog()
