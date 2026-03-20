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

# Perform some "type checking testing"; mypy should flag any assignments that are
# incorrect.
if TYPE_CHECKING:
    import numpy as np
    import pandas as pd

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.table import TableMixin

    table = TableMixin().table

    # Create some test data
    df = pd.DataFrame({"A": [1, 2, 3], "B": ["a", "b", "c"]})
    arr = np.array([[1, 2, 3], [4, 5, 6]])

    # Test basic return type
    assert_type(table(df), DeltaGenerator)
    assert_type(table(arr), DeltaGenerator)
    assert_type(table(None), DeltaGenerator)
    assert_type(table([[1, 2], [3, 4]]), DeltaGenerator)
    assert_type(table({"col1": [1, 2], "col2": [3, 4]}), DeltaGenerator)

    # Test hide_index parameter types
    assert_type(table(df, hide_index=None), DeltaGenerator)
    assert_type(table(df, hide_index=True), DeltaGenerator)
    assert_type(table(df, hide_index=False), DeltaGenerator)

    # Test hide_header parameter types
    assert_type(table(df, hide_header=None), DeltaGenerator)
    assert_type(table(df, hide_header=True), DeltaGenerator)
    assert_type(table(df, hide_header=False), DeltaGenerator)

    # Test border parameter types
    assert_type(table(df, border=True), DeltaGenerator)
    assert_type(table(df, border=False), DeltaGenerator)
    assert_type(table(df, border="horizontal"), DeltaGenerator)

    # Test width and height parameter types
    assert_type(table(df, width="stretch"), DeltaGenerator)
    assert_type(table(df, width="content"), DeltaGenerator)
    assert_type(table(df, width=500), DeltaGenerator)
    assert_type(table(df, height="stretch"), DeltaGenerator)
    assert_type(table(df, height="content"), DeltaGenerator)
    assert_type(table(df, height=300), DeltaGenerator)

    # Test combined parameters
    assert_type(
        table(
            df,
            border="horizontal",
            width=500,
            height=300,
            hide_index=True,
            hide_header=False,
        ),
        DeltaGenerator,
    )
