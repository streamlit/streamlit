# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
from streamlit import runtime

# st.session_state can only be accessed while running with streamlit
if runtime.exists():
    if "counter" not in st.session_state:
        st.session_state.counter = 0

    if st.button("click me!"):
        st.session_state.counter += 1

    st.write(f"count: {st.session_state.counter}")

    # TODO(vdonato): Add st.file_uploader and st.camera_input tests once we're able to
    # teach those widgets how to retrieve previously uploaded files after a session
    # disconnect/reconnect.
