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

x = st.camera_input("Label1", help="help1", key="camera_input_1")

if x is not None:
    st.image(x)

y = st.camera_input("Label2", help="help2", disabled=True)

# Add camera inputs with different widths
st.camera_input("Width Stretch", width="stretch", key="camera_stretch", disabled=True)
st.camera_input("Width 300px", width=300, key="camera_300px", disabled=True)

if st.toggle("Update camera input props"):
    cam_val = st.camera_input(
        "Updated dynamic camera input",
        width=300,
        help="updated help",
        key="dynamic_camera_input_with_key",
        on_change=lambda a, param: print(
            f"Updated camera input - callback triggered: {a} {param}"
        ),
        args=("Updated camera arg",),
        kwargs={"param": "updated kwarg param"},
    )
    st.write("Updated camera input value:", cam_val is not None)
else:
    cam_val = st.camera_input(
        "Initial dynamic camera input",
        width="stretch",
        help="initial help",
        key="dynamic_camera_input_with_key",
        on_change=lambda a, param: print(
            f"Initial camera input - callback triggered: {a} {param}"
        ),
        args=("Initial camera arg",),
        kwargs={"param": "initial kwarg param"},
    )
    st.write("Initial camera input value:", cam_val is not None)
