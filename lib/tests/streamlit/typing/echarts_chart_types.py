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

# Perform type checking tests for st.echarts_chart.
# The return type depends on the on_select parameter:
# - no on_select / on_select="ignore" -> returns DeltaGenerator
# - on_select="rerun" / callable -> returns EChartsState
if TYPE_CHECKING:
    from typing import Any

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.echarts_chart import EChartsMixin, EChartsSelectionState
    from streamlit.typing import EChartsState

    echarts_chart = EChartsMixin().echarts_chart

    spec: dict[str, object] = {"series": [{"type": "bar", "data": [1, 2, 3]}]}
    spec_json = '{"series": [{"type": "bar", "data": [1, 2, 3]}]}'

    # =====================================================================
    # Basic return type tests with different option inputs
    # (no on_select -> default "ignore" overload -> DeltaGenerator)
    # =====================================================================

    assert_type(echarts_chart(spec), DeltaGenerator)
    assert_type(echarts_chart(spec_json), DeltaGenerator)

    # =====================================================================
    # Return type tests with on_select="ignore" -> DeltaGenerator
    # =====================================================================

    assert_type(echarts_chart(spec, on_select="ignore"), DeltaGenerator)
    assert_type(echarts_chart(spec_json, on_select="ignore"), DeltaGenerator)

    # =====================================================================
    # Return type tests with on_select="rerun" -> EChartsState
    # =====================================================================

    assert_type(echarts_chart(spec, on_select="rerun"), EChartsState)

    # =====================================================================
    # State member access: attribute and bracket notation are both typed
    # (mirrors dataframe/plotly ReadOnlyAttributeDictionary state).
    # =====================================================================

    echarts_state = echarts_chart(spec, on_select="rerun")
    assert_type(echarts_state.selection, EChartsSelectionState)
    assert_type(echarts_state["selection"], EChartsSelectionState)
    assert_type(echarts_state.selection.selected, list[dict[str, Any]])
    assert_type(echarts_state["selection"]["selected"], list[dict[str, Any]])
    assert_type(echarts_state.selection.areas, list[dict[str, Any]])
    assert_type(echarts_state["selection"]["areas"], list[dict[str, Any]])

    # =====================================================================
    # Return type tests with callback function -> EChartsState
    # =====================================================================

    def my_callback() -> None:
        pass

    def callback_with_args(x: int, y: str) -> None:
        pass

    assert_type(echarts_chart(spec, on_select=my_callback), EChartsState)
    assert_type(echarts_chart(spec, on_select=callback_with_args), EChartsState)
    assert_type(echarts_chart(spec, on_select=lambda: None), EChartsState)

    # =====================================================================
    # Test width parameter ("stretch", "content", or int)
    # =====================================================================

    assert_type(
        echarts_chart(spec, on_select="ignore", width="stretch"), DeltaGenerator
    )
    assert_type(
        echarts_chart(spec, on_select="ignore", width="content"), DeltaGenerator
    )
    assert_type(echarts_chart(spec, on_select="ignore", width=500), DeltaGenerator)
    assert_type(echarts_chart(spec, width=500, on_select="rerun"), EChartsState)

    # =====================================================================
    # Test height parameter ("content", "stretch", or int)
    # =====================================================================

    assert_type(
        echarts_chart(spec, on_select="ignore", height="content"), DeltaGenerator
    )
    assert_type(
        echarts_chart(spec, on_select="ignore", height="stretch"), DeltaGenerator
    )
    assert_type(echarts_chart(spec, on_select="ignore", height=400), DeltaGenerator)
    assert_type(echarts_chart(spec, height=400, on_select="rerun"), EChartsState)

    # =====================================================================
    # Test theme parameter ("streamlit" or None)
    # =====================================================================

    assert_type(
        echarts_chart(spec, on_select="ignore", theme="streamlit"), DeltaGenerator
    )
    assert_type(echarts_chart(spec, on_select="ignore", theme=None), DeltaGenerator)
    assert_type(echarts_chart(spec, theme="streamlit", on_select="rerun"), EChartsState)

    # =====================================================================
    # Test key parameter (str, int, or None)
    # =====================================================================

    assert_type(echarts_chart(spec, on_select="ignore", key="my_chart"), DeltaGenerator)
    assert_type(echarts_chart(spec, on_select="ignore", key=123), DeltaGenerator)
    assert_type(echarts_chart(spec, on_select="ignore", key=None), DeltaGenerator)
    assert_type(echarts_chart(spec, key="my_chart", on_select="rerun"), EChartsState)

    # =====================================================================
    # Test renderer parameter ("canvas" or "svg")
    # =====================================================================

    assert_type(
        echarts_chart(spec, on_select="ignore", renderer="canvas"), DeltaGenerator
    )
    assert_type(echarts_chart(spec, on_select="ignore", renderer="svg"), DeltaGenerator)
    assert_type(echarts_chart(spec, renderer="svg", on_select="rerun"), EChartsState)

    # =====================================================================
    # Test with all parameters combined (on_select="ignore" -> DeltaGenerator)
    # =====================================================================

    assert_type(
        echarts_chart(
            spec,
            width="stretch",
            height="content",
            theme="streamlit",
            key="full_chart",
            on_select="ignore",
            renderer="canvas",
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Test with all parameters combined (on_select="rerun" -> EChartsState)
    # =====================================================================

    assert_type(
        echarts_chart(
            spec,
            width=600,
            height=400,
            theme=None,
            key="selectable_chart",
            on_select="rerun",
            renderer="svg",
        ),
        EChartsState,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid theme value (only "streamlit" or None)
    echarts_chart(spec, theme="dark")  # type: ignore[call-overload]  # ty: ignore[invalid-argument-type]

    # Invalid width / height values (only int or "stretch" / "content")
    echarts_chart(spec, width="invalid")  # type: ignore[call-overload]  # ty: ignore[invalid-argument-type]
    echarts_chart(spec, height=None)  # type: ignore[call-overload]  # ty: ignore[invalid-argument-type]

    # Invalid renderer value (only "canvas" or "svg")
    echarts_chart(spec, renderer="webgl")  # type: ignore[call-overload]  # ty: ignore[invalid-argument-type]

    # Removed parameter: selection is configured in the chart spec, not via a
    # `selection_mode` argument (reserved for future use).
    echarts_chart(  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]
        spec, on_select="rerun", selection_mode="points"
    )
