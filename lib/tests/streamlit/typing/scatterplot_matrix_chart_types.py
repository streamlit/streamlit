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

from typing import TYPE_CHECKING, cast

from typing_extensions import assert_type

# Perform type checking tests for st.scatterplot_matrix_chart.
# The return type depends on the on_select parameter:
# - no on_select / on_select="rerun" / callable -> returns ScatterplotMatrixState
# - on_select="ignore" -> returns DeltaGenerator
# Note: because the "ignore" overload has no default value, omitting on_select
# resolves to the "rerun" overload and therefore returns ScatterplotMatrixState.
if TYPE_CHECKING:
    import pandas as pd

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.scatterplot_matrix_chart import (
        ScatterplotMatrixChartMixin,
        ScatterplotMatrixState,
    )

    scatterplot_matrix_chart = ScatterplotMatrixChartMixin().scatterplot_matrix_chart

    df = cast("pd.DataFrame", object())

    # =====================================================================
    # Basic return type tests
    # (no on_select -> resolves to the "rerun" overload -> state)
    # =====================================================================

    assert_type(scatterplot_matrix_chart(df), ScatterplotMatrixState)

    # =====================================================================
    # Return type tests with on_select="ignore" -> DeltaGenerator
    # =====================================================================

    assert_type(scatterplot_matrix_chart(df, on_select="ignore"), DeltaGenerator)

    # =====================================================================
    # Return type tests with on_select="rerun" -> state
    # =====================================================================

    assert_type(scatterplot_matrix_chart(df, on_select="rerun"), ScatterplotMatrixState)

    # =====================================================================
    # Return type tests with callback function -> state
    # =====================================================================

    def my_callback() -> None:
        pass

    assert_type(
        scatterplot_matrix_chart(df, on_select=my_callback), ScatterplotMatrixState
    )
    assert_type(
        scatterplot_matrix_chart(df, on_select=lambda: None), ScatterplotMatrixState
    )

    # =====================================================================
    # Test width ("stretch" or int) and height (int or "stretch")
    # =====================================================================

    assert_type(
        scatterplot_matrix_chart(df, on_select="ignore", width="stretch"),
        DeltaGenerator,
    )
    assert_type(
        scatterplot_matrix_chart(df, on_select="ignore", width=500), DeltaGenerator
    )
    assert_type(
        scatterplot_matrix_chart(df, on_select="ignore", height=400), DeltaGenerator
    )
    assert_type(
        scatterplot_matrix_chart(df, on_select="ignore", height="stretch"),
        DeltaGenerator,
    )
    assert_type(
        scatterplot_matrix_chart(df, height=400, on_select="rerun"),
        ScatterplotMatrixState,
    )

    # =====================================================================
    # Test remaining keyword parameters
    # =====================================================================

    assert_type(
        scatterplot_matrix_chart(
            df,
            columns=["a", "b"],
            label="name",
            title="My matrix",
            query_colors=["#ff0000", "#00ff00"],
            roll_speed=2.0,
            key="my_chart",
            on_select="ignore",
        ),
        DeltaGenerator,
    )
    assert_type(
        scatterplot_matrix_chart(
            df,
            columns=("a", "b"),
            label=None,
            title=None,
            query_colors=None,
            roll_speed=1.0,
            key=123,
            on_select="rerun",
        ),
        ScatterplotMatrixState,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid width / height values
    scatterplot_matrix_chart(df, width="invalid")  # type: ignore[call-overload]
    scatterplot_matrix_chart(df, height="content")  # type: ignore[call-overload]
    scatterplot_matrix_chart(df, height=None)  # type: ignore[call-overload]

    # Invalid on_select value
    scatterplot_matrix_chart(df, on_select="invalid")  # type: ignore[call-overload]
