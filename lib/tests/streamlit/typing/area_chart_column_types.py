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

"""Type tests for st.column_config.AreaChartColumn."""

from __future__ import annotations

from typing import TYPE_CHECKING, assert_type

if TYPE_CHECKING:
    from streamlit.elements.lib.column_config_utils import ColumnConfigMappingInput
    from streamlit.elements.lib.column_types import (
        AreaChartColumn,
        ColumnConfig,
        ColumnWidth,
    )

    # =====================================================================
    # st.column_config.AreaChartColumn return type tests
    # =====================================================================

    # Basic usage - returns ColumnConfig
    assert_type(AreaChartColumn(), ColumnConfig)
    assert_type(AreaChartColumn("Sales"), ColumnConfig)
    assert_type(AreaChartColumn(label="Sales"), ColumnConfig)

    # =====================================================================
    # Test label parameter (str or None)
    # =====================================================================

    assert_type(AreaChartColumn(label=None), ColumnConfig)
    assert_type(AreaChartColumn(label="Sales (last 6 months)"), ColumnConfig)
    assert_type(AreaChartColumn(""), ColumnConfig)

    # =====================================================================
    # Test width parameter ("small", "medium", "large", int, or None)
    # =====================================================================

    assert_type(AreaChartColumn(width=None), ColumnConfig)
    assert_type(AreaChartColumn(width="small"), ColumnConfig)
    assert_type(AreaChartColumn(width="medium"), ColumnConfig)
    assert_type(AreaChartColumn(width="large"), ColumnConfig)
    assert_type(AreaChartColumn(width=100), ColumnConfig)

    pixel_width: int = 120
    assert_type(AreaChartColumn(width=pixel_width), ColumnConfig)

    flexible_width: ColumnWidth | None = "medium"
    assert_type(AreaChartColumn(width=flexible_width), ColumnConfig)

    # =====================================================================
    # Test help parameter (str or None)
    # =====================================================================

    assert_type(AreaChartColumn(help=None), ColumnConfig)
    assert_type(
        AreaChartColumn(help="The sales volume in the last 6 months"), ColumnConfig
    )

    # =====================================================================
    # Test pinned parameter (bool or None)
    # =====================================================================

    assert_type(AreaChartColumn(pinned=None), ColumnConfig)
    assert_type(AreaChartColumn(pinned=True), ColumnConfig)
    assert_type(AreaChartColumn(pinned=False), ColumnConfig)

    pinned: bool | None = False
    assert_type(AreaChartColumn(pinned=pinned), ColumnConfig)

    # =====================================================================
    # Test y_min and y_max parameters (int, float, or None)
    # =====================================================================

    assert_type(AreaChartColumn(y_min=None), ColumnConfig)
    assert_type(AreaChartColumn(y_min=0), ColumnConfig)
    assert_type(AreaChartColumn(y_min=0.5), ColumnConfig)
    assert_type(AreaChartColumn(y_max=None), ColumnConfig)
    assert_type(AreaChartColumn(y_max=100), ColumnConfig)
    assert_type(AreaChartColumn(y_max=100.5), ColumnConfig)

    y_bound: int | float | None = 0
    assert_type(AreaChartColumn(y_min=y_bound, y_max=y_bound), ColumnConfig)

    # =====================================================================
    # Test color parameter ("auto", "auto-inverse", palette, CSS color, or None)
    # =====================================================================

    assert_type(AreaChartColumn(color=None), ColumnConfig)
    assert_type(AreaChartColumn(color="auto"), ColumnConfig)
    assert_type(AreaChartColumn(color="auto-inverse"), ColumnConfig)
    assert_type(AreaChartColumn(color="red"), ColumnConfig)
    assert_type(AreaChartColumn(color="grey"), ColumnConfig)
    assert_type(AreaChartColumn(color="primary"), ColumnConfig)
    assert_type(AreaChartColumn(color="#483d8b"), ColumnConfig)
    assert_type(AreaChartColumn(color="rgb(72, 61, 139)"), ColumnConfig)

    # CSS colors are open-ended strings, so a non-literal str is valid.
    color: str | None = "#483d8b"
    assert_type(AreaChartColumn(color=color), ColumnConfig)

    # =====================================================================
    # Test all parameters combined
    # =====================================================================

    assert_type(
        AreaChartColumn(
            "Sales (last 6 months)",
            width="medium",
            help="The sales volume in the last 6 months",
            pinned=False,
            y_min=0,
            y_max=100.0,
            color="auto",
        ),
        ColumnConfig,
    )

    # The result is accepted by st.dataframe / st.data_editor column_config.
    _column_config: ColumnConfigMappingInput = {
        "sales": AreaChartColumn(
            "Sales (last 6 months)",
            width="medium",
            help="The sales volume in the last 6 months",
            pinned=False,
            y_min=0,
            y_max=100,
            color="#483d8b",
        )
    }

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Only label is positional.
    AreaChartColumn("Sales", "medium")  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]

    # width is "small" | "medium" | "large" | int, not element layout widths.
    AreaChartColumn(width="stretch")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    AreaChartColumn(width=100.5)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    plain_width: str = "small"
    AreaChartColumn(width=plain_width)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # y bounds are numbers.
    AreaChartColumn(y_min="0")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # color is a string (palette name, "auto", or CSS color), not a number.
    AreaChartColumn(color=1)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Chart columns are not editable and have no alignment parameter.
    AreaChartColumn(alignment="center")  # type: ignore[call-arg]  # ty: ignore[unknown-argument]
    AreaChartColumn(disabled=True)  # type: ignore[call-arg]  # ty: ignore[unknown-argument]
