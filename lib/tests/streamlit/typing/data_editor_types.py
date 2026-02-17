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

# Perform type checking tests for st.data_editor.
# The return type depends on the data parameter:
# - pd.DataFrame/pd.Series -> returns the same type (via DataFrameGenericAlias)
# - list/dict/set -> returns the same type with preserved generics
# - Other types (pd.Index, np.ndarray, tuple, etc.) -> returns pd.DataFrame
if TYPE_CHECKING:
    import numpy as np
    import pandas as pd

    from streamlit.elements.widgets.data_editor import DataEditorMixin

    data_editor = DataEditorMixin().data_editor

    # =====================================================================
    # Return type tests based on data parameter type
    # =====================================================================

    df = pd.DataFrame({"A": [1, 2, 3], "B": ["a", "b", "c"]})

    # pd.DataFrame returns pd.DataFrame (matches DataFrameGenericAlias via iloc)
    assert_type(data_editor(df), pd.DataFrame)

    # pd.Series returns pd.Series with preserved type parameter
    series_int: pd.Series[int] = pd.Series([1, 2, 3])
    series_str: pd.Series[str] = pd.Series(["a", "b", "c"])
    assert_type(data_editor(series_int), pd.Series[int])
    assert_type(data_editor(series_str), pd.Series[str])

    # pd.Index falls through to Any overload -> returns pd.DataFrame
    # (Index.iloc doesn't return _iLocIndexer, so it doesn't match DataFrameGenericAlias)
    index: pd.Index[int] = pd.Index([1, 2, 3])
    assert_type(data_editor(index), pd.DataFrame)

    # np.ndarray falls through to Any overload -> returns pd.DataFrame
    arr = np.array([[1, 2, 3], [4, 5, 6]])
    assert_type(data_editor(arr), pd.DataFrame)

    # list returns list with preserved type parameter
    assert_type(data_editor([[1, 2], [3, 4]]), list[list[int]])
    list_data: list[dict[str, int]] = [{"a": 1}, {"a": 2}]
    assert_type(data_editor(list_data), list[dict[str, int]])

    # dict returns dict with preserved type parameters
    assert_type(data_editor({"col1": [1, 2], "col2": [3, 4]}), dict[str, list[int]])
    dict_data: dict[str, list[str]] = {"col1": ["a", "b"]}
    assert_type(data_editor(dict_data), dict[str, list[str]])

    # set returns set with preserved type parameter
    assert_type(data_editor({1, 2, 3}), set[int])
    set_data: set[str] = {"a", "b", "c"}
    assert_type(data_editor(set_data), set[str])

    # Nested tuples fall through to the Any overload -> returns pd.DataFrame
    assert_type(data_editor(((1, 2), (3, 4))), pd.DataFrame)
    tuple_data: tuple[int, int, int] = (1, 2, 3)
    assert_type(data_editor(tuple_data), pd.DataFrame)

    # =====================================================================
    # Test with various optional parameters (return type unchanged)
    # =====================================================================

    assert_type(
        data_editor(
            df,
            width="stretch",
            height=400,
            hide_index=True,
            column_order=["B", "A"],
            column_config={"A": "Integer values"},
            num_rows="dynamic",
            disabled=["B"],
            key="full_editor",
            on_change=lambda: None,
            row_height=35,
            placeholder="-",
        ),
        pd.DataFrame,
    )

    # Return type preserved with optional parameters for non-DataFrame types
    assert_type(data_editor(list_data, num_rows="dynamic"), list[dict[str, int]])
    assert_type(data_editor(dict_data, disabled=True), dict[str, list[str]])
