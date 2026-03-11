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

# Perform type checking tests for st.dataframe.
# The return type depends on the on_select parameter:
# - on_select="ignore" (default) -> returns DeltaGenerator
# - on_select="rerun" or callable -> returns DataframeState
if TYPE_CHECKING:
    import numpy as np
    import pandas as pd

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.arrow import ArrowMixin, DataframeState

    dataframe = ArrowMixin().dataframe

    # Create some test data
    df = pd.DataFrame({"A": [1, 2, 3], "B": ["a", "b", "c"]})
    arr = np.array([[1, 2, 3], [4, 5, 6]])

    # =====================================================================
    # Basic return type tests with different data types (on_select="ignore")
    # =====================================================================

    # DataFrame input
    assert_type(dataframe(df), DeltaGenerator)

    # NumPy array input
    assert_type(dataframe(arr), DeltaGenerator)

    # None input
    assert_type(dataframe(None), DeltaGenerator)
    assert_type(dataframe(), DeltaGenerator)

    # List input
    assert_type(dataframe([[1, 2], [3, 4]]), DeltaGenerator)

    # Dict input
    assert_type(dataframe({"col1": [1, 2], "col2": [3, 4]}), DeltaGenerator)

    # =====================================================================
    # Return type tests with on_select="rerun"
    # =====================================================================

    assert_type(dataframe(df, on_select="rerun"), DataframeState)
    assert_type(dataframe(arr, on_select="rerun"), DataframeState)
    assert_type(dataframe(None, on_select="rerun"), DataframeState)
    assert_type(dataframe([[1, 2], [3, 4]], on_select="rerun"), DataframeState)
    assert_type(dataframe({"col1": [1, 2]}, on_select="rerun"), DataframeState)

    # =====================================================================
    # Return type tests with callback function
    # =====================================================================

    def my_callback() -> None:
        pass

    def callback_with_args(x: int, y: str) -> None:
        pass

    assert_type(dataframe(df, on_select=my_callback), DataframeState)
    assert_type(dataframe(df, on_select=callback_with_args), DataframeState)
    assert_type(dataframe(df, on_select=lambda: None), DataframeState)

    # =====================================================================
    # Test width parameter ("stretch", "content", or int)
    # =====================================================================

    assert_type(dataframe(df, width="stretch"), DeltaGenerator)
    assert_type(dataframe(df, width="content"), DeltaGenerator)
    assert_type(dataframe(df, width=500), DeltaGenerator)
    assert_type(dataframe(df, width=500, on_select="rerun"), DataframeState)

    # =====================================================================
    # Test height parameter ("auto", "content", "stretch", or int)
    # =====================================================================

    assert_type(dataframe(df, height="auto"), DeltaGenerator)
    assert_type(dataframe(df, height="content"), DeltaGenerator)
    assert_type(dataframe(df, height="stretch"), DeltaGenerator)
    assert_type(dataframe(df, height=400), DeltaGenerator)
    assert_type(dataframe(df, height=400, on_select="rerun"), DataframeState)

    # =====================================================================
    # Test use_container_width parameter (deprecated but still typed)
    # =====================================================================

    assert_type(dataframe(df, use_container_width=True), DeltaGenerator)
    assert_type(dataframe(df, use_container_width=False), DeltaGenerator)
    assert_type(dataframe(df, use_container_width=None), DeltaGenerator)
    assert_type(
        dataframe(df, use_container_width=True, on_select="rerun"), DataframeState
    )

    # =====================================================================
    # Test hide_index parameter (bool or None)
    # =====================================================================

    assert_type(dataframe(df, hide_index=True), DeltaGenerator)
    assert_type(dataframe(df, hide_index=False), DeltaGenerator)
    assert_type(dataframe(df, hide_index=None), DeltaGenerator)
    assert_type(dataframe(df, hide_index=True, on_select="rerun"), DataframeState)

    # =====================================================================
    # Test column_order parameter (Iterable[str] or None)
    # =====================================================================

    assert_type(dataframe(df, column_order=["A", "B"]), DeltaGenerator)
    assert_type(dataframe(df, column_order=["B", "A"]), DeltaGenerator)
    assert_type(dataframe(df, column_order=("A",)), DeltaGenerator)
    assert_type(dataframe(df, column_order=None), DeltaGenerator)
    assert_type(dataframe(df, column_order=["A"], on_select="rerun"), DataframeState)

    # =====================================================================
    # Test column_config parameter (dict or None)
    # =====================================================================

    assert_type(dataframe(df, column_config=None), DeltaGenerator)
    assert_type(dataframe(df, column_config={"A": "Integer values"}), DeltaGenerator)
    assert_type(dataframe(df, column_config={"A": None}), DeltaGenerator)
    assert_type(
        dataframe(df, column_config={"A": "Integers"}, on_select="rerun"),
        DataframeState,
    )

    # =====================================================================
    # Test key parameter (str, int, or None)
    # =====================================================================

    assert_type(dataframe(df, key="my_dataframe"), DeltaGenerator)
    assert_type(dataframe(df, key=123), DeltaGenerator)
    assert_type(dataframe(df, key=None), DeltaGenerator)
    assert_type(dataframe(df, key="my_df", on_select="rerun"), DataframeState)

    # =====================================================================
    # Test on_select parameter (determines return type)
    # =====================================================================

    # "ignore" (default) returns DeltaGenerator
    assert_type(dataframe(df, on_select="ignore"), DeltaGenerator)

    # "rerun" returns DataframeState
    assert_type(dataframe(df, on_select="rerun"), DataframeState)

    # =====================================================================
    # Test selection_mode parameter - single modes
    # =====================================================================

    # Row selection modes
    assert_type(
        dataframe(df, on_select="rerun", selection_mode="single-row"), DataframeState
    )
    assert_type(
        dataframe(df, on_select="rerun", selection_mode="multi-row"), DataframeState
    )

    # Column selection modes
    assert_type(
        dataframe(df, on_select="rerun", selection_mode="single-column"), DataframeState
    )
    assert_type(
        dataframe(df, on_select="rerun", selection_mode="multi-column"), DataframeState
    )

    # Cell selection modes
    assert_type(
        dataframe(df, on_select="rerun", selection_mode="single-cell"), DataframeState
    )
    assert_type(
        dataframe(df, on_select="rerun", selection_mode="multi-cell"), DataframeState
    )

    # =====================================================================
    # Test selection_mode parameter - combined modes (Iterable)
    # =====================================================================

    assert_type(
        dataframe(df, on_select="rerun", selection_mode=["multi-row", "multi-column"]),
        DataframeState,
    )
    assert_type(
        dataframe(
            df, on_select="rerun", selection_mode=["single-row", "single-column"]
        ),
        DataframeState,
    )
    assert_type(
        dataframe(
            df,
            on_select="rerun",
            selection_mode=["multi-row", "multi-column", "multi-cell"],
        ),
        DataframeState,
    )
    assert_type(
        dataframe(df, on_select="rerun", selection_mode=("multi-row", "multi-column")),
        DataframeState,
    )

    # =====================================================================
    # Test selection_default parameter
    # =====================================================================

    assert_type(
        dataframe(df, on_select="rerun", selection_default=None), DataframeState
    )
    assert_type(
        dataframe(df, on_select="rerun", selection_default={"selection": {"rows": []}}),
        DataframeState,
    )
    assert_type(
        dataframe(
            df, on_select="rerun", selection_default={"selection": {"rows": [0, 1]}}
        ),
        DataframeState,
    )
    assert_type(
        dataframe(
            df,
            on_select="rerun",
            selection_mode="multi-column",
            selection_default={"selection": {"columns": ["A"]}},
        ),
        DataframeState,
    )

    # =====================================================================
    # Test row_height parameter (int or None)
    # =====================================================================

    assert_type(dataframe(df, row_height=35), DeltaGenerator)
    assert_type(dataframe(df, row_height=50), DeltaGenerator)
    assert_type(dataframe(df, row_height=None), DeltaGenerator)
    assert_type(dataframe(df, row_height=35, on_select="rerun"), DataframeState)

    # =====================================================================
    # Test placeholder parameter (str or None)
    # =====================================================================

    assert_type(dataframe(df, placeholder="-"), DeltaGenerator)
    assert_type(dataframe(df, placeholder="N/A"), DeltaGenerator)
    assert_type(dataframe(df, placeholder=None), DeltaGenerator)
    assert_type(dataframe(df, placeholder="-", on_select="rerun"), DataframeState)

    # =====================================================================
    # Test with all parameters combined (on_select="ignore")
    # =====================================================================

    assert_type(
        dataframe(
            df,
            width=500,
            height=300,
            use_container_width=None,
            hide_index=True,
            column_order=["B", "A"],
            column_config={"A": "Integer values", "B": None},
            key="full_dataframe",
            on_select="ignore",
            selection_mode="multi-row",
            selection_default=None,
            row_height=35,
            placeholder="-",
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Test with all parameters combined (on_select="rerun")
    # =====================================================================

    assert_type(
        dataframe(
            df,
            width="stretch",
            height="auto",
            use_container_width=None,
            hide_index=False,
            column_order=["A", "B"],
            column_config={"A": "Integer values"},
            key="selectable_dataframe",
            on_select="rerun",
            selection_mode=["multi-row", "multi-column"],
            selection_default={"selection": {"rows": [0], "columns": ["A"]}},
            row_height=40,
            placeholder="N/A",
        ),
        DataframeState,
    )

    # =====================================================================
    # Test with all parameters combined (on_select=callback)
    # =====================================================================

    assert_type(
        dataframe(
            df,
            width="content",
            height="content",
            use_container_width=None,
            hide_index=None,
            column_order=None,
            column_config=None,
            key="callback_dataframe",
            on_select=my_callback,
            selection_mode="single-row",
            selection_default=None,
            row_height=None,
            placeholder=None,
        ),
        DataframeState,
    )
