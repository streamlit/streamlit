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

from os.path import abspath, dirname, join

import streamlit as st

# Construct test assets path relative to this script file to
# allow its execution with different working directories.
TEST_ASSETS_DIR = join(dirname(abspath(__file__)), "test_assets")
ICON_PATH = join(TEST_ASSETS_DIR, "favicon.ico")

if not ICON_PATH.is_file():
    print(f"Missing favicon at {str(ICON_PATH)}")
    exit(1)

st.set_page_config(page_icon=str(ICON_PATH))
