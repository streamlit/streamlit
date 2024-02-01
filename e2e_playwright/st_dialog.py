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

import numpy as np
import pandas as pd

import streamlit as st

dialog = st.dialog("Test Dialog with Images")
with dialog:
    st.write("Hello!")
    st.slider("Slide me!", 0, 10)

    # render a dataframe
    st.dataframe(
        pd.DataFrame(np.zeros((1000, 6)), columns=["A", "B", "C", "D", "E", "F"])
    )

    # render multiple images. This will make the Close button to go out of
    # screen and allows scrollability of the dialog
    for i in range(0, 3):
        st.image(np.repeat(0, 1000000).reshape(1000, 1000))

    if st.button("Submit", key="dialog-btn"):
        dialog.close()


if st.button("Open Dialog with Images"):
    dialog.open()

# We use this dialog for a screenshot test as loading images via the browser
#   is non-deterministic
dialog = st.dialog("Simple Dialog")
with dialog:
    st.write("Hello again!")
    st.text_input("Enter something!")

    if st.button("Submit", key="dialog2-btn"):
        dialog.close()


if st.button("Open Dialog without Images"):
    dialog.open()
