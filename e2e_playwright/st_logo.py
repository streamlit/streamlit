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

from pathlib import Path

import streamlit as st

# Set random seed to always get the same results in the plotting demo
STATIC_ASSETS_DIR = Path(__file__).parent / "static"


def logo_no_sidebar_subtest():
    st.logo(
        STATIC_ASSETS_DIR / "streamlit-logo.png",
        size="small",
        icon_image=STATIC_ASSETS_DIR / "streamlit-mark.png",
    )


def small_logo_w_sidebar_subtest():
    st.logo(
        STATIC_ASSETS_DIR / "streamlit-logo.png",
        size="small",
        icon_image=STATIC_ASSETS_DIR / "streamlit-mark.png",
    )
    st.sidebar.write("Hi")


def medium_logo_w_sidebar_subtest():
    st.logo(
        STATIC_ASSETS_DIR / "streamlit-logo.png",
        size="medium",
        icon_image=STATIC_ASSETS_DIR / "streamlit-mark.png",
    )
    st.sidebar.write("Hi")


def large_logo_w_sidebar_subtest():
    st.logo(
        STATIC_ASSETS_DIR / "streamlit-logo.png",
        size="large",
        icon_image=STATIC_ASSETS_DIR / "streamlit-mark.png",
    )
    st.sidebar.write("Hi")


# NOTE: Must be run last, since st.navigation will linger in all other tests.
def logo_w_sidebar_and_nav_subtest():
    st.logo(
        STATIC_ASSETS_DIR / "streamlit-logo.png",
        size="small",
        icon_image=STATIC_ASSETS_DIR / "streamlit-mark.png",
    )
    st.sidebar.write("Hi")
    st.navigation(
        [
            st.Page("multipage_apps_v2/page_2.py"),
            st.Page("multipage_apps_v2/page_3.py"),
        ]
    )


SUBTESTS = {k: v for k, v in globals().items() if k.endswith("_subtest")}

subtest = SUBTESTS[st.selectbox("Test to run", SUBTESTS.keys())]

subtest()
