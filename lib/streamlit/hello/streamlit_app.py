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

from pathlib import Path

import streamlit as st

dir_path = Path(__file__).parent


def run():
    page = st.navigation(
        [
            st.Page(dir_path / "Hello.py", icon=":material/waving_hand:"),
            st.Page(dir_path / "Animation_Demo.py", icon=":material/animation:"),
            st.Page(dir_path / "Plotting_Demo.py", icon=":material/show_chart:"),
            st.Page(dir_path / "Mapping_Demo.py", icon=":material/public:"),
            st.Page(dir_path / "Dataframe_Demo.py", icon=":material/table:"),
        ]
    )

    page.run()


if __name__ == "__main__":
    run()
