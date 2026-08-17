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

from typing import TYPE_CHECKING

from typing_extensions import assert_type

# Perform type checking tests for st.filter_bar.
# The return type is always pd.DataFrame regardless of input type.
if TYPE_CHECKING:
    import pandas as pd

    from streamlit.elements.widgets.filter_bar import (
        FilterBarMixin,
        FilterBarState,
        FilterConfig,
    )

    filter_bar = FilterBarMixin().filter_bar

    # =====================================================================
    # Return type: always pd.DataFrame
    # =====================================================================

    df = pd.DataFrame({"A": [1, 2, 3], "B": ["a", "b", "c"]})

    assert_type(filter_bar(df), pd.DataFrame)

    # =====================================================================
    # FilterConfig construction
    # =====================================================================

    config_default = FilterConfig()
    config_typed = FilterConfig(type="multiselect", options=["a", "b"])
    config_range = FilterConfig(type="range", min_value=0, max_value=100)
    config_operators = FilterConfig(operators=["contains", "equals"])
    config_format = FilterConfig(format_func=str)

    # =====================================================================
    # With all optional parameters (return type unchanged)
    # =====================================================================

    assert_type(
        filter_bar(
            df,
            columns=["A", "B"],
            label="Filters",
            help="Help text",
            placeholder="Add filter",
            expanded=False,
            disabled=True,
            key="my_filter",
            on_change=lambda: None,
            label_visibility="collapsed",
            width="content",
        ),
        pd.DataFrame,
    )

    # disabled as Sequence[str]
    assert_type(filter_bar(df, disabled=["A"]), pd.DataFrame)

    # columns as mapping
    assert_type(
        filter_bar(df, columns={"A": FilterConfig(), "B": None}),
        pd.DataFrame,
    )

    # =====================================================================
    # FilterBarState attribute access
    # =====================================================================

    state = FilterBarState({})
    assert_type(state.active_filters, list[str])
    assert_type(state.logic, str)
