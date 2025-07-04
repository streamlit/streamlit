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

st.header("📊 Random App Content")
st.radio("**Example Main Content**", ["Home", "About", "Contact"])
st.slider("**Example Slider**", 0, 100, 50)
st.divider()

with st.sidebar:
    st.subheader("Having fun yet?")
    st.slider("Amount of fun", 0, 1000, 450)

pg = st.navigation(
    {
        "Overview": [
            st.Page(
                "pages/02_page2.py",
                title="Home Page",
                default=True,
                icon=":material/home:",
            ),
            st.Page(
                "pages/03_page3.py", title="Plant Page", icon=":material/potted_plant:"
            ),
        ],
        "Random": [
            st.Page("pages/09_logo_page.py", title="Logo Page", icon=":material/star:"),
            st.Page(
                "pages/06_page_6.py",
                title="Star Page",
                icon=":material/star_border:",
            ),
            st.Page(
                "pages/07_page_7.py",
                title="Animal Page",
                icon=":material/pets:",
            ),
            st.Page(
                "pages/08_slow_page.py",
                title="Random Page",
                icon=":material/rocket_launch:",
            ),
            st.Page(
                "pages/04_page_with_duplicate_name.py",
                title="Time Page",
                icon=":material/access_time:",
            ),
            st.Page(
                "pages/06_page_6.py",
                title="Events Page",
                url_path="events",
                icon=":material/emoji_events:",
            ),
        ],
    }
)

pg.run()

st.write("End of Main Page")
