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


def m():
    st.text("hi!")

    c1, c2, c3 = st.columns(3)
    with c1:
        for i in range(100):
            st.button("help", key=i)

    with c2:
        st.text("hi")

    with c3:
        st.button("hello")


def tr():
    c1, c2 = st.columns(2)
    with c1:
        st.text("hmm")
    with c2:
        st.text("hi")


def main():
    main_page = st.Page("main.py", title="Main")
    help_page = st.Page("try.py", title="Help")

    pg = st.navigation([main_page, help_page])
    pg.run()


if __name__ == "__main__":
    st.set_page_config(layout="wide")

main()
