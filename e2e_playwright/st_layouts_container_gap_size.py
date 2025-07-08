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

with st.container(
    border=True,
    gap="small",
    direction="horizontal",
    wrap=False,
    key="container-horizontal-gap-small",
):
    st.html(
        '<div style="background:lightblue">One</div>',
        width="stretch",
    )
    st.html(
        '<div style="background:lightblue">Two</div>',
        width="stretch",
    )
    st.html(
        '<div style="background:lightblue">Three</div>',
        width="stretch",
    )
    st.html(
        '<div style="background:lightblue">Four</div>',
        width="stretch",
    )

with st.container(
    border=True,
    gap="medium",
    direction="horizontal",
    wrap=False,
    key="container-horizontal-gap-medium",
):
    st.html(
        '<div style="background:lightblue">One</div>',
        width="stretch",
    )
    st.html(
        '<div style="background:lightblue">Two</div>',
        width="stretch",
    )
    st.html(
        '<div style="background:lightblue">Three</div>',
        width="stretch",
    )
    st.html(
        '<div style="background:lightblue">Four</div>',
        width="stretch",
    )

with st.container(
    border=True,
    gap="large",
    direction="horizontal",
    wrap=False,
    key="container-horizontal-gap-large",
):
    st.html(
        '<div style="background:lightblue">One</div>',
        width="stretch",
    )
    st.html(
        '<div style="background:lightblue">Two</div>',
        width="stretch",
    )
    st.html(
        '<div style="background:lightblue">Three</div>',
        width="stretch",
    )
    st.html(
        '<div style="background:lightblue">Four</div>',
        width="stretch",
    )

with st.container(
    border=True,
    gap=None,
    direction="horizontal",
    wrap=False,
    key="container-horizontal-gap-none",
):
    st.html(
        '<div style="background:lightblue">One</div>',
        width="stretch",
    )
    st.html(
        '<div style="background:lightblue">Two</div>',
        width="stretch",
    )
    st.html(
        '<div style="background:lightblue">Three</div>',
        width="stretch",
    )
    st.html(
        '<div style="background:lightblue">Four</div>',
        width="stretch",
    )

with st.container(
    border=True, gap="small", direction="vertical", key="container-vertical-gap-small"
):
    st.html(
        '<div style="background:lightblue">One</div>',
        width="stretch",
    )
    st.html(
        '<div style="background:lightblue">Two</div>',
        width="stretch",
    )
    st.html(
        '<div style="background:lightblue">Three</div>',
        width="stretch",
    )

with st.container(
    border=True, gap="medium", direction="vertical", key="container-vertical-gap-medium"
):
    st.html(
        '<div style="background:lightblue">One</div>',
        width="stretch",
    )
    st.html(
        '<div style="background:lightblue">Two</div>',
        width="stretch",
    )
    st.html(
        '<div style="background:lightblue">Three</div>',
        width="stretch",
    )

with st.container(
    border=True, gap="large", direction="vertical", key="container-vertical-gap-large"
):
    st.html(
        '<div style="background:lightblue">One</div>',
        width="stretch",
    )
    st.html(
        '<div style="background:lightblue">Two</div>',
        width="stretch",
    )
    st.html(
        '<div style="background:lightblue">Three</div>',
        width="stretch",
    )

with st.container(
    border=True, gap=None, direction="vertical", key="container-vertical-gap-none"
):
    st.html(
        '<div style="background:lightblue">One</div>',
        width="stretch",
    )
    st.html(
        '<div style="background:lightblue">Two</div>',
        width="stretch",
    )
    st.html(
        '<div style="background:lightblue">Three</div>',
        width="stretch",
    )
