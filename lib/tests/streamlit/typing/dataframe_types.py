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

from __future__ import annotations

from typing import TYPE_CHECKING

from typing_extensions import assert_type

# Perform some "type checking testing"; mypy should flag any assignments that are
# incorrect.
if TYPE_CHECKING:
    import numpy as np
    import pandas as pd

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.arrow import ArrowMixin, DataframeState

    dataframe = ArrowMixin().dataframe

    # Create some test data
    df = pd.DataFrame({"A": [1, 2, 3], "B": ["a", "b", "c"]})
    arr = np.array([[1, 2, 3], [4, 5, 6]])

    # Test return types with on_select="ignore" (default)
    assert_type(dataframe(df), DeltaGenerator)
    assert_type(dataframe(arr), DeltaGenerator)
    assert_type(dataframe(None), DeltaGenerator)
    assert_type(dataframe([[1, 2], [3, 4]]), DeltaGenerator)
    assert_type(dataframe({"col1": [1, 2], "col2": [3, 4]}), DeltaGenerator)

    # Test return types with on_select="rerun"
    assert_type(dataframe(df, on_select="rerun"), DataframeState)
    assert_type(dataframe(arr, on_select="rerun"), DataframeState)
    assert_type(dataframe(None, on_select="rerun"), DataframeState)

    # Test return types with different selection modes
    assert_type(
        dataframe(df, on_select="rerun", selection_mode="single-row"), DataframeState
    )
    assert_type(
        dataframe(df, on_select="rerun", selection_mode="multi-row"), DataframeState
    )
    assert_type(
        dataframe(df, on_select="rerun", selection_mode="single-column"), DataframeState
    )
    assert_type(
        dataframe(df, on_select="rerun", selection_mode="multi-column"), DataframeState
    )
    assert_type(
        dataframe(df, on_select="rerun", selection_mode=["multi-row", "multi-column"]),
        DataframeState,
    )

    # Test return types with callback function
    assert_type(dataframe(df, on_select=lambda: None), DataframeState)

    # Test with various optional parameters
    assert_type(
        dataframe(
            df,
            width=500,
            height=300,
            use_container_width=True,
            hide_index=True,
            column_order=["B", "A"],
            column_config={"A": "Integer values"},
            key="my_table",
            on_select="rerun",
        ),
        DataframeState,
    )
