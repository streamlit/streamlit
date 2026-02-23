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

from __future__ import annotations

import streamlit as st

flat_options = ["Apple", "Banana", "Cherry"]

grouped_options = {
    "Fruits": ["Apple", "Banana"],
    "Vegetables": ["Carrot", "Pea"],
}

# 1. Single named color applied to all tags
i1 = st.multiselect(
    "single-named-color",
    flat_options,
    default=["Apple", "Banana"],
    color="blue",
)
st.text(f"value 1: {i1}")

# 2. Single hex color applied to all tags
i2 = st.multiselect(
    "single-hex-color",
    flat_options,
    default=["Apple", "Banana"],
    color="#ff6347",
)
st.text(f"value 2: {i2}")

# 3. Single rgb color applied to all tags
i3 = st.multiselect(
    "single-rgb-color",
    flat_options,
    default=["Apple", "Banana"],
    color="rgb(75, 0, 130)",
)
st.text(f"value 3: {i3}")

# 4. Per-option colors (flat list)
i4 = st.multiselect(
    "per-option-colors",
    flat_options,
    default=flat_options,
    color=["red", "#228B22", "rgb(65, 105, 225)"],
)
st.text(f"value 4: {i4}")

# 5. Per-group colors (grouped options)
i5 = st.multiselect(
    "per-group-colors",
    grouped_options,
    default=["Apple", "Banana", "Carrot", "Pea"],
    color=["orange", "green"],
    search_type="group-fuzzy",
)
st.text(f"value 5: {i5}")

# 6. No color (default styling baseline)
i6 = st.multiselect(
    "no-color-baseline",
    flat_options,
    default=["Apple", "Banana"],
)
st.text(f"value 6: {i6}")

# 7. Color with accept_new_options (user-created tags should not get custom color)
i7 = st.multiselect(
    "color-with-accept-new",
    flat_options,
    default=["Apple"],
    color="violet",
    accept_new_options=True,
)
st.text(f"value 7: {i7}")

# 8. Color on a disabled multiselect
i8 = st.multiselect(
    "color-disabled",
    flat_options,
    default=["Apple", "Banana"],
    color="green",
    disabled=True,
)
st.text(f"value 8: {i8}")
