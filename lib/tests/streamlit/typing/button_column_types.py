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
# The return type is ButtonColumnResult | ColumnConfig since the actual type
# depends on whether a key is provided at runtime.
if TYPE_CHECKING:
    from streamlit.elements.lib.column_types import (
        ButtonColumn,
        ButtonColumnResult,
        ColumnConfig,
    )

    # Type alias for the ButtonColumn return type
    ButtonColumnReturn = ButtonColumnResult | ColumnConfig

    # =====================================================================
    # Return type tests
    # =====================================================================

    # Without key - returns union type (runtime: ColumnConfig)
    assert_type(ButtonColumn(), ButtonColumnReturn)
    assert_type(ButtonColumn("Actions"), ButtonColumnReturn)
    assert_type(ButtonColumn(label="Actions"), ButtonColumnReturn)

    # With key - returns union type (runtime: ButtonColumnResult)
    assert_type(ButtonColumn(key="btn_click"), ButtonColumnReturn)
    assert_type(ButtonColumn("Actions", key="btn_click"), ButtonColumnReturn)

    # =====================================================================
    # Test label parameter (str or None)
    # =====================================================================

    assert_type(ButtonColumn(label=None), ButtonColumnReturn)
    assert_type(ButtonColumn(label="Actions"), ButtonColumnReturn)
    assert_type(ButtonColumn(""), ButtonColumnReturn)

    # =====================================================================
    # Test width parameter ("small", "medium", "large", int, or None)
    # =====================================================================

    assert_type(ButtonColumn(width=None), ButtonColumnReturn)
    assert_type(ButtonColumn(width="small"), ButtonColumnReturn)
    assert_type(ButtonColumn(width="medium"), ButtonColumnReturn)
    assert_type(ButtonColumn(width="large"), ButtonColumnReturn)
    assert_type(ButtonColumn(width=100), ButtonColumnReturn)

    # =====================================================================
    # Test help parameter (str or None)
    # =====================================================================

    assert_type(ButtonColumn(help=None), ButtonColumnReturn)
    assert_type(ButtonColumn(help="Click to perform action"), ButtonColumnReturn)

    # =====================================================================
    # Test pinned parameter (bool or None)
    # =====================================================================

    assert_type(ButtonColumn(pinned=None), ButtonColumnReturn)
    assert_type(ButtonColumn(pinned=True), ButtonColumnReturn)
    assert_type(ButtonColumn(pinned=False), ButtonColumnReturn)

    # =====================================================================
    # Test alignment parameter ("left", "center", "right", or None)
    # =====================================================================

    assert_type(ButtonColumn(alignment=None), ButtonColumnReturn)
    assert_type(ButtonColumn(alignment="left"), ButtonColumnReturn)
    assert_type(ButtonColumn(alignment="center"), ButtonColumnReturn)
    assert_type(ButtonColumn(alignment="right"), ButtonColumnReturn)

    # =====================================================================
    # Test type parameter ("primary", "secondary", "tertiary")
    # =====================================================================

    assert_type(ButtonColumn(type="primary"), ButtonColumnReturn)
    assert_type(ButtonColumn(type="secondary"), ButtonColumnReturn)
    assert_type(ButtonColumn(type="tertiary"), ButtonColumnReturn)

    # =====================================================================
    # Test on_click callback (requires key)
    # =====================================================================

    def my_callback() -> None:
        pass

    def callback_with_args(x: int, y: str) -> None:
        pass

    # on_click with key
    assert_type(ButtonColumn(on_click=my_callback, key="click"), ButtonColumnReturn)
    assert_type(
        ButtonColumn(on_click=callback_with_args, key="click"), ButtonColumnReturn
    )
    assert_type(ButtonColumn(on_click=lambda: None, key="click"), ButtonColumnReturn)
    assert_type(ButtonColumn(on_click=None, key="click"), ButtonColumnReturn)

    # =====================================================================
    # Test args and kwargs (requires key)
    # =====================================================================

    assert_type(
        ButtonColumn(on_click=callback_with_args, args=(1, "a"), key="click"),
        ButtonColumnReturn,
    )
    assert_type(
        ButtonColumn(
            on_click=callback_with_args, kwargs={"x": 1, "y": "a"}, key="click"
        ),
        ButtonColumnReturn,
    )
    assert_type(
        ButtonColumn(
            on_click=callback_with_args, args=(1, "a"), kwargs={}, key="click"
        ),
        ButtonColumnReturn,
    )

    # =====================================================================
    # Test all parameters combined
    # =====================================================================

    # Without key
    assert_type(
        ButtonColumn(
            label="Actions",
            width="medium",
            help="Click to perform action",
            pinned=False,
            alignment="center",
            type="primary",
        ),
        ButtonColumnReturn,
    )

    # With key
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
        ButtonColumnReturn,
    )
