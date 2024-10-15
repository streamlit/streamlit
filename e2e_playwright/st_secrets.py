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

import os
from typing import Final

import streamlit as st
from streamlit import config, runtime

if runtime.exists():
    original_option = st.get_option("secrets.files")
    st.write("Secret: ", st.secrets["fake"]["FAKE_SECRET"])

    # We are hacking here, but we are setting the secrets file to a different file to determine if it works
    TEST_ASSETS_DIR: Final[str] = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "test_assets"
    )
    alt_secrets_file1 = os.path.join(TEST_ASSETS_DIR, "alt_secrets.toml")
    alt_secrets_file2 = os.path.join(TEST_ASSETS_DIR, "alt_secrets2.toml")
    config.set_option("secrets.files", [alt_secrets_file1])
    st.secrets._secrets = None

    st.write("Alt Secret: ", st.secrets["fake"]["FAKE_SECRET"])
    st.write("Alt Secret From File 2 visible: ", "other-fake" in st.secrets)

    config.set_option("secrets.files", [alt_secrets_file1, alt_secrets_file2])
    st.secrets._secrets = None

    st.write("Alt Secret (Multiple): ", st.secrets["fake"]["FAKE_SECRET"])
    st.write(
        "Alt Secret From File 2 (Multiple): ",
        st.secrets["other-fake"]["OTHER_FAKE_SECRET"],
    )

    # Reset the secrets file to the original to avoid affecting other tests
    config.set_option("secrets.files", original_option)
    st.secrets._secrets = None
