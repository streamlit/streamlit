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

st.header("Dynamic form - full app only runs on submit")

states = {
    "USA": ["", "California", "Washington", "New Jersey"],
    "Canada": ["", "Quebec", "Ontario", "British Columbia"],
    "Germany": ["", "Brandenberg", "Hesse", "Bavaria"],
}


@st.experimental_fragment
def get_location():
    with st.container(border=True):
        st.subheader("Enter your location")

        city = None
        state = None

        country = st.selectbox("Country", ["", "USA", "Canada", "Germany"])

        if country:
            state = st.selectbox("State", states[country])
        if state:
            city = st.text_input("City")

        submit_enabled = city and state and country
        if st.button("Submit", type="primary", disabled=not submit_enabled):
            if len(city) < 8:
                st.warning(f"City name {city} must be at least 8 characters")
            else:
                st.session_state.new_location = dict(
                    country=country, state=state, city=city
                )
                st.rerun()


get_location()

if "new_location" in st.session_state:
    result = st.session_state.pop("new_location")
    st.success("We have recorded your location, thank you!")
    "Response:"
    st.json(result)
