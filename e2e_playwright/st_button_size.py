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

from typing import Literal

import streamlit as st
from streamlit.delta_generator import DeltaGenerator

Size = Literal["xxsmall", "xsmall", "small", "medium", "large"]
SIZES: list[Size] = ["xxsmall", "xsmall", "small", "medium", "large"]


def row(command: str) -> list[DeltaGenerator]:
    """Render one container with the command at every size, plus a default."""
    with st.container(key=f"{command}_sizes"):
        return st.columns(len(SIZES) + 1)


cols = row("button")
cols[0].button("Default", key="button_default")
for col, size in zip(cols[1:], SIZES, strict=True):
    col.button(size, size=size, key=f"button_{size}")

cols = row("button_primary")
for col, size in zip(cols[1:], SIZES, strict=True):
    col.button(size, size=size, type="primary", key=f"button_primary_{size}")

cols = row("button_tertiary")
for col, size in zip(cols[1:], SIZES, strict=True):
    col.button(size, size=size, type="tertiary", key=f"button_tertiary_{size}")

cols = row("button_icon_only")
for col, size in zip(cols[1:], SIZES, strict=True):
    col.button("", icon=":material/add:", size=size, key=f"button_icon_only_{size}")

cols = row("button_icon_label")
for col, size in zip(cols[1:], SIZES, strict=True):
    col.button(size, icon=":material/add:", size=size, key=f"button_icon_label_{size}")

cols = row("download_button")
cols[0].download_button("Default", "data", key="download_button_default")
for col, size in zip(cols[1:], SIZES, strict=True):
    col.download_button(size, "data", size=size, key=f"download_button_{size}")

cols = row("link_button")
cols[0].link_button("Default", "https://streamlit.io", key="link_button_default")
for col, size in zip(cols[1:], SIZES, strict=True):
    col.link_button(size, "https://streamlit.io", size=size, key=f"link_button_{size}")

with st.form("size_form"):
    cols = row("form_submit_button")
    cols[0].form_submit_button("Default", key="form_submit_button_default")
    for col, size in zip(cols[1:], SIZES, strict=True):
        col.form_submit_button(size, size=size, key=f"form_submit_button_{size}")

with st.container(key="button_wrapped_label"):
    st.button(
        "A long label that wraps onto several lines in a narrow button",
        size="xxsmall",
        key="button_wrapped_xxsmall",
        width=140,
        wrap=True,
    )
