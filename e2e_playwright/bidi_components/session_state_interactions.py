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


import streamlit as st
from streamlit.components.v2.bidi_component import ComponentResult

interactive_text_input_definition = st.components.v2.component(
    "interactive_text_input",
    html="""
    <label for='txt'>Enter text:</label>
    <input id='txt' type='text' />
    """,
    js="""
    export default function(component) {
        const { setStateValue, parentElement, data, key } = component;

        const label = parentElement.querySelector('label');
        label.innerText = data.label;

        const input = parentElement.querySelector('input');
        // Set input value from data if changed
        if (input.value !== data.value) {
            input.value = data.value ?? '';
        };

        // Update value on Enter (submit)
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                setStateValue('value', e.target.value);
            }
        };
    }
    """,
)


def interactive_text_input(label: str, initial_value: str, key: str) -> ComponentResult:
    component_state = st.session_state.get(key, {})
    data = {
        "label": label,
        "value": component_state.get("value", initial_value),
    }
    result = interactive_text_input_definition(data=data, key=key)

    return result


if st.button("Make it say Hello World"):
    st.session_state["my_text_input"]["value"] = "Hello World"

if st.button("Clear text"):
    st.session_state["my_text_input"]["value"] = ""

user_input = interactive_text_input(
    "Enter something", "Initial Text", key="my_text_input"
)

st.write("You entered:", user_input)

if st.button("Should throw an error"):
    st.session_state.my_text_input.value = 12345

st.write(st.session_state)
