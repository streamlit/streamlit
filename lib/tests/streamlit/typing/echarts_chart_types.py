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
# - no on_select / on_select="rerun" / callable -> returns EChartsState
# - on_select="ignore" -> returns DeltaGenerator
# Note: because the "ignore" overload has no default value, omitting on_select
# resolves to the "rerun" overload and therefore returns EChartsState.
if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.echarts_chart import EChartsMixin, EChartsState

    echarts_chart = EChartsMixin().echarts_chart

    options: dict[str, object] = {"series": [{"type": "bar", "data": [1, 2, 3]}]}
    options_json = '{"series": [{"type": "bar", "data": [1, 2, 3]}]}'

    # =====================================================================
    # Basic return type tests with different option inputs
    # (no on_select -> resolves to the "rerun" overload -> EChartsState)
    # =====================================================================

    assert_type(echarts_chart(options), EChartsState)
    assert_type(echarts_chart(options_json), EChartsState)

    # =====================================================================
    # Return type tests with on_select="ignore" -> DeltaGenerator
    # =====================================================================

    assert_type(echarts_chart(options, on_select="ignore"), DeltaGenerator)
    assert_type(echarts_chart(options_json, on_select="ignore"), DeltaGenerator)

    # =====================================================================
    # Return type tests with on_select="rerun" -> EChartsState
    # =====================================================================

    assert_type(echarts_chart(options, on_select="rerun"), EChartsState)

    # =====================================================================
    # Return type tests with callback function -> EChartsState
    # =====================================================================

    def my_callback() -> None:
        pass

    def callback_with_args(x: int, y: str) -> None:
        pass

    assert_type(echarts_chart(options, on_select=my_callback), EChartsState)
    assert_type(echarts_chart(options, on_select=callback_with_args), EChartsState)
    assert_type(echarts_chart(options, on_select=lambda: None), EChartsState)

    # =====================================================================
    # Test width parameter ("stretch", "content", or int)
    # =====================================================================

    assert_type(
        echarts_chart(options, on_select="ignore", width="stretch"), DeltaGenerator
    )
    assert_type(
        echarts_chart(options, on_select="ignore", width="content"), DeltaGenerator
    )
    assert_type(echarts_chart(options, on_select="ignore", width=500), DeltaGenerator)
    assert_type(echarts_chart(options, width=500, on_select="rerun"), EChartsState)

    # =====================================================================
    # Test height parameter ("content", "stretch", or int)
    # =====================================================================

    assert_type(
        echarts_chart(options, on_select="ignore", height="content"), DeltaGenerator
    )
    assert_type(
        echarts_chart(options, on_select="ignore", height="stretch"), DeltaGenerator
    )
    assert_type(echarts_chart(options, on_select="ignore", height=400), DeltaGenerator)
    assert_type(echarts_chart(options, height=400, on_select="rerun"), EChartsState)

    # =====================================================================
    # Test theme parameter ("streamlit" or None)
    # =====================================================================

    assert_type(
        echarts_chart(options, on_select="ignore", theme="streamlit"), DeltaGenerator
    )
    assert_type(echarts_chart(options, on_select="ignore", theme=None), DeltaGenerator)
    assert_type(
        echarts_chart(options, theme="streamlit", on_select="rerun"), EChartsState
    )

    # =====================================================================
    # Test key parameter (str, int, or None)
    # =====================================================================

    assert_type(
        echarts_chart(options, on_select="ignore", key="my_chart"), DeltaGenerator
    )
    assert_type(echarts_chart(options, on_select="ignore", key=123), DeltaGenerator)
    assert_type(echarts_chart(options, on_select="ignore", key=None), DeltaGenerator)
    assert_type(echarts_chart(options, key="my_chart", on_select="rerun"), EChartsState)

    # =====================================================================
    # Test renderer parameter ("canvas" or "svg")
    # =====================================================================

    assert_type(
        echarts_chart(options, on_select="ignore", renderer="canvas"), DeltaGenerator
    )
    assert_type(
        echarts_chart(options, on_select="ignore", renderer="svg"), DeltaGenerator
    )
    assert_type(echarts_chart(options, renderer="svg", on_select="rerun"), EChartsState)

    # =====================================================================
    # Test selection_mode parameter - single modes
    # =====================================================================

    assert_type(
        echarts_chart(options, on_select="rerun", selection_mode="points"), EChartsState
    )
    assert_type(
        echarts_chart(options, on_select="rerun", selection_mode="box"), EChartsState
    )
    assert_type(
        echarts_chart(options, on_select="rerun", selection_mode="lasso"), EChartsState
    )

    # =====================================================================
    # Test selection_mode parameter - combined modes (Iterable)
    # =====================================================================

    assert_type(
        echarts_chart(options, on_select="rerun", selection_mode=["points", "box"]),
        EChartsState,
    )
    assert_type(
        echarts_chart(
            options, on_select="rerun", selection_mode=("points", "box", "lasso")
        ),
        EChartsState,
    )

    # =====================================================================
    # Test with all parameters combined (on_select="ignore" -> DeltaGenerator)
    # =====================================================================

    assert_type(
        echarts_chart(
            options,
            width="stretch",
            height="content",
            theme="streamlit",
            key="full_chart",
            on_select="ignore",
            selection_mode=("points", "box", "lasso"),
            renderer="canvas",
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Test with all parameters combined (on_select="rerun" -> EChartsState)
    # =====================================================================

    assert_type(
        echarts_chart(
            options,
            width=600,
            height=400,
            theme=None,
            key="selectable_chart",
            on_select="rerun",
            selection_mode=["points", "box"],
            renderer="svg",
        ),
        EChartsState,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid theme value (only "streamlit" or None)
    echarts_chart(options, theme="dark")  # type: ignore[call-overload]

    # Invalid width / height values (only int or "stretch" / "content")
    echarts_chart(options, width="invalid")  # type: ignore[call-overload]
    echarts_chart(options, height=None)  # type: ignore[call-overload]

    # Invalid renderer value (only "canvas" or "svg")
    echarts_chart(options, renderer="webgl")  # type: ignore[call-overload]

    # Invalid selection_mode value
    echarts_chart(options, on_select="rerun", selection_mode="invalid")  # type: ignore[call-overload]
