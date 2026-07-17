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

# Perform type checking tests for st.column_config.ButtonColumn.
# The return type depends on whether a key is provided:
# - Without key: returns ColumnConfig
# - With key: returns ButtonColumnResult
if TYPE_CHECKING:
    from streamlit.elements.lib.column_types import (
        ButtonColumn,
        ButtonColumnResult,
        ColumnConfig,
    )

    # =====================================================================
    # Return type tests - verify overload resolution
    # =====================================================================

    # Without key - returns ColumnConfig
    assert_type(ButtonColumn(), ColumnConfig)
    assert_type(ButtonColumn("Actions"), ColumnConfig)
    assert_type(ButtonColumn(label="Actions"), ColumnConfig)

    # With key - returns ButtonColumnResult
    assert_type(ButtonColumn(key="btn_click"), ButtonColumnResult)
    assert_type(ButtonColumn("Actions", key="btn_click"), ButtonColumnResult)

    # =====================================================================
    # Test label parameter (str or None) - without key
    # =====================================================================

    assert_type(ButtonColumn(label=None), ColumnConfig)
    assert_type(ButtonColumn(label="Actions"), ColumnConfig)
    assert_type(ButtonColumn(""), ColumnConfig)

    # =====================================================================
    # Test width parameter ("small", "medium", "large", int, or None)
    # =====================================================================

    assert_type(ButtonColumn(width=None), ColumnConfig)
    assert_type(ButtonColumn(width="small"), ColumnConfig)
    assert_type(ButtonColumn(width="medium"), ColumnConfig)
    assert_type(ButtonColumn(width="large"), ColumnConfig)
    assert_type(ButtonColumn(width=100), ColumnConfig)

    # =====================================================================
    # Test help parameter (str or None)
    # =====================================================================

    assert_type(ButtonColumn(help=None), ColumnConfig)
    assert_type(ButtonColumn(help="Click to perform action"), ColumnConfig)

    # =====================================================================
    # Test pinned parameter (bool or None)
    # =====================================================================

    assert_type(ButtonColumn(pinned=None), ColumnConfig)
    assert_type(ButtonColumn(pinned=True), ColumnConfig)
    assert_type(ButtonColumn(pinned=False), ColumnConfig)

    # =====================================================================
    # Test alignment parameter ("left", "center", "right", or None)
    # =====================================================================

    assert_type(ButtonColumn(alignment=None), ColumnConfig)
    assert_type(ButtonColumn(alignment="left"), ColumnConfig)
    assert_type(ButtonColumn(alignment="center"), ColumnConfig)
    assert_type(ButtonColumn(alignment="right"), ColumnConfig)

    # =====================================================================
    # Test type parameter ("primary", "secondary", "tertiary")
    # =====================================================================

    assert_type(ButtonColumn(type="primary"), ColumnConfig)
    assert_type(ButtonColumn(type="secondary"), ColumnConfig)
    assert_type(ButtonColumn(type="tertiary"), ColumnConfig)

    # =====================================================================
    # Test on_click callback (requires key for ButtonColumnResult)
    # =====================================================================

    def my_callback() -> None:
        pass

    def callback_with_args(x: int, y: str) -> None:
        pass

    # on_click with key - returns ButtonColumnResult
    assert_type(ButtonColumn(on_click=my_callback, key="click"), ButtonColumnResult)
    assert_type(
        ButtonColumn(on_click=callback_with_args, key="click"), ButtonColumnResult
    )
    assert_type(ButtonColumn(on_click=lambda: None, key="click"), ButtonColumnResult)
    assert_type(ButtonColumn(on_click=None, key="click"), ButtonColumnResult)

    # =====================================================================
    # Test args and kwargs (requires key)
    # =====================================================================

    assert_type(
        ButtonColumn(on_click=callback_with_args, args=(1, "a"), key="click"),
        ButtonColumnResult,
    )
    assert_type(
        ButtonColumn(
            on_click=callback_with_args, kwargs={"x": 1, "y": "a"}, key="click"
        ),
        ButtonColumnResult,
    )
    assert_type(
        ButtonColumn(
            on_click=callback_with_args, args=(1, "a"), kwargs={}, key="click"
        ),
        ButtonColumnResult,
    )

    # =====================================================================
    # Test all parameters combined
    # =====================================================================

    # Without key - returns ColumnConfig
    assert_type(
        ButtonColumn(
            label="Actions",
            width="medium",
            help="Click to perform action",
            pinned=False,
            alignment="center",
            type="primary",
        ),
        ColumnConfig,
    )

    # With key - returns ButtonColumnResult
    assert_type(
        ButtonColumn(
            label="Actions",
            width="medium",
            help="Click to perform action",
            pinned=False,
            alignment="center",
            type="primary",
            on_click=my_callback,
            args=None,
            kwargs=None,
            key="action_click",
        ),
        ButtonColumnResult,
    )
