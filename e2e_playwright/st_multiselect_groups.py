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

grouped_options = {
    "Fruits": ["Apple", "Banana", "Cherry"],
    "Vegetables": ["Asparagus", "Broccoli", "Carrot"],
}

# 1. Grouped with group-fuzzy (groups preserved during search)
i1 = st.multiselect("group-fuzzy search", grouped_options, search_type="group-fuzzy")
st.text(f"value 1: {i1}")

# 2. Grouped with group-exact
i2 = st.multiselect("group-exact search", grouped_options, search_type="group-exact")
st.text(f"value 2: {i2}")

# 3. Grouped with group-contains
i3 = st.multiselect(
    "group-contains search", grouped_options, search_type="group-contains"
)
st.text(f"value 3: {i3}")

# 4. Grouped with group-startswith
i4 = st.multiselect(
    "group-startswith search", grouped_options, search_type="group-startswith"
)
st.text(f"value 4: {i4}")

# 5. Grouped with non-group search type (groups shown when browsing, flat when searching)
i5 = st.multiselect("flat-fuzzy search", grouped_options, search_type="fuzzy")
st.text(f"value 5: {i5}")

# 6. Grouped with max_selections and group-fuzzy
i6 = st.multiselect(
    "group-fuzzy max3",
    grouped_options,
    search_type="group-fuzzy",
    max_selections=3,
)
st.text(f"value 6: {i6}")
