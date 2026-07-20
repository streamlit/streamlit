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

# Perform type checking tests for the vega-related chart commands.
#
# The built-in charts (st.line_chart, st.area_chart, st.bar_chart, and
# st.scatter_chart) always return a DeltaGenerator.
#
# st.altair_chart and st.vega_lite_chart have overloads whose return type
# depends on the on_select parameter:
# - no on_select / on_select="ignore" -> returns DeltaGenerator
# - on_select="rerun" / callable       -> returns VegaLiteState
if TYPE_CHECKING:
    import altair as alt

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.vega_charts import VegaChartsMixin, VegaLiteState

    line_chart = VegaChartsMixin().line_chart
    area_chart = VegaChartsMixin().area_chart
    bar_chart = VegaChartsMixin().bar_chart
    scatter_chart = VegaChartsMixin().scatter_chart
    altair_chart = VegaChartsMixin().altair_chart
    vega_lite_chart = VegaChartsMixin().vega_lite_chart

    from streamlit.dataframe_util import Data

    data = cast("Data", object())
    chart = cast("alt.Chart", object())

    def my_callback() -> None:
        pass

    def callback_with_args(x: int, y: str) -> None:
        pass

    # =====================================================================
    # st.line_chart return type tests -> DeltaGenerator
    # =====================================================================

    assert_type(line_chart(data), DeltaGenerator)
    assert_type(line_chart(data, x="a"), DeltaGenerator)
    assert_type(line_chart(data, y="b"), DeltaGenerator)
    assert_type(line_chart(data, y=["b", "c"]), DeltaGenerator)
    assert_type(line_chart(data, x_label="X"), DeltaGenerator)
    assert_type(line_chart(data, y_label="Y"), DeltaGenerator)
    assert_type(line_chart(data, color="red"), DeltaGenerator)
    assert_type(line_chart(data, color="#ffaa00"), DeltaGenerator)
    assert_type(line_chart(data, color=(255, 0, 0)), DeltaGenerator)
    assert_type(line_chart(data, color=["#f00", "#00f"]), DeltaGenerator)
    assert_type(line_chart(data, color=None), DeltaGenerator)
    assert_type(line_chart(data, width="stretch"), DeltaGenerator)
    assert_type(line_chart(data, width="content"), DeltaGenerator)
    assert_type(line_chart(data, width=500), DeltaGenerator)
    assert_type(line_chart(data, height="content"), DeltaGenerator)
    assert_type(line_chart(data, height="stretch"), DeltaGenerator)
    assert_type(line_chart(data, height=400), DeltaGenerator)
    assert_type(line_chart(data, use_container_width=True), DeltaGenerator)
    assert_type(line_chart(data, use_container_width=None), DeltaGenerator)
    assert_type(
        line_chart(
            data,
            x="a",
            y=["b", "c"],
            x_label="X",
            y_label="Y",
            color=["#f00", "#00f"],
            width=500,
            height=400,
            use_container_width=None,
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # st.area_chart return type tests -> DeltaGenerator
    # =====================================================================

    assert_type(area_chart(data), DeltaGenerator)
    assert_type(area_chart(data, x="a", y="b"), DeltaGenerator)
    assert_type(area_chart(data, color="green"), DeltaGenerator)
    assert_type(area_chart(data, stack=True), DeltaGenerator)
    assert_type(area_chart(data, stack="normalize"), DeltaGenerator)
    assert_type(area_chart(data, stack="center"), DeltaGenerator)
    assert_type(area_chart(data, stack="layered"), DeltaGenerator)
    assert_type(area_chart(data, stack=None), DeltaGenerator)
    assert_type(
        area_chart(
            data,
            x="a",
            y=["b", "c"],
            x_label="X",
            y_label="Y",
            color=["#f00", "#00f"],
            stack="normalize",
            width="stretch",
            height="content",
            use_container_width=True,
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # st.bar_chart return type tests -> DeltaGenerator
    # =====================================================================

    assert_type(bar_chart(data), DeltaGenerator)
    assert_type(bar_chart(data, x="a", y="b"), DeltaGenerator)
    assert_type(bar_chart(data, color="blue"), DeltaGenerator)
    assert_type(bar_chart(data, horizontal=True), DeltaGenerator)
    assert_type(bar_chart(data, sort=False), DeltaGenerator)
    assert_type(bar_chart(data, sort="a"), DeltaGenerator)
    assert_type(bar_chart(data, stack="layered"), DeltaGenerator)
    assert_type(bar_chart(data, stack=None), DeltaGenerator)
    assert_type(
        bar_chart(
            data,
            x="a",
            y=["b", "c"],
            x_label="X",
            y_label="Y",
            color=["#f00", "#00f"],
            horizontal=True,
            sort=False,
            stack="center",
            width=500,
            height=400,
            use_container_width=None,
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # st.scatter_chart return type tests -> DeltaGenerator
    # =====================================================================

    assert_type(scatter_chart(data), DeltaGenerator)
    assert_type(scatter_chart(data, x="a", y="b"), DeltaGenerator)
    assert_type(scatter_chart(data, color="violet"), DeltaGenerator)
    assert_type(scatter_chart(data, size="col"), DeltaGenerator)
    assert_type(scatter_chart(data, size=100), DeltaGenerator)
    assert_type(scatter_chart(data, size=12.5), DeltaGenerator)
    assert_type(scatter_chart(data, size=None), DeltaGenerator)
    assert_type(
        scatter_chart(
            data,
            x="a",
            y=["b", "c"],
            x_label="X",
            y_label="Y",
            color=["#f00", "#00f"],
            size="col",
            width="content",
            height="stretch",
            use_container_width=True,
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # st.altair_chart return type tests
    # (no on_select / on_select="ignore" -> DeltaGenerator)
    # =====================================================================

    assert_type(altair_chart(chart), DeltaGenerator)
    assert_type(altair_chart(chart, on_select="ignore"), DeltaGenerator)
    assert_type(
        altair_chart(chart, on_select="ignore", width="stretch"), DeltaGenerator
    )
    assert_type(altair_chart(chart, on_select="ignore", width=None), DeltaGenerator)
    assert_type(altair_chart(chart, on_select="ignore", height=400), DeltaGenerator)
    assert_type(altair_chart(chart, on_select="ignore", theme=None), DeltaGenerator)
    assert_type(altair_chart(chart, on_select="ignore", key="c"), DeltaGenerator)
    assert_type(altair_chart(chart, on_select="ignore", key=1), DeltaGenerator)
    assert_type(
        altair_chart(chart, on_select="ignore", use_container_width=True),
        DeltaGenerator,
    )
    assert_type(
        altair_chart(chart, on_select="ignore", selection_mode="points"),
        DeltaGenerator,
    )

    # on_select="rerun" / callable -> VegaLiteState
    assert_type(altair_chart(chart, on_select="rerun"), VegaLiteState)
    assert_type(altair_chart(chart, on_select=my_callback), VegaLiteState)
    assert_type(altair_chart(chart, on_select=callback_with_args), VegaLiteState)
    assert_type(altair_chart(chart, on_select=lambda: None), VegaLiteState)
    assert_type(
        altair_chart(chart, on_select="rerun", selection_mode=["p1", "p2"]),
        VegaLiteState,
    )
    assert_type(
        altair_chart(
            chart,
            width=600,
            height=400,
            theme="streamlit",
            key="selectable",
            use_container_width=None,
            on_select="rerun",
            selection_mode=("p1", "p2"),
        ),
        VegaLiteState,
    )

    # =====================================================================
    # st.vega_lite_chart return type tests
    # (no on_select / on_select="ignore" -> DeltaGenerator)
    # =====================================================================

    spec = {"mark": "bar"}

    assert_type(vega_lite_chart(data), DeltaGenerator)
    assert_type(vega_lite_chart(data, spec), DeltaGenerator)
    assert_type(vega_lite_chart(data, spec=spec), DeltaGenerator)
    assert_type(vega_lite_chart(data, spec, on_select="ignore"), DeltaGenerator)
    assert_type(vega_lite_chart(data, spec, width=None), DeltaGenerator)
    assert_type(vega_lite_chart(data, spec, height="content"), DeltaGenerator)
    assert_type(vega_lite_chart(data, spec, theme="streamlit"), DeltaGenerator)
    assert_type(vega_lite_chart(data, spec, key=None), DeltaGenerator)
    assert_type(vega_lite_chart(data, spec, use_container_width=False), DeltaGenerator)

    # on_select="rerun" / callable -> VegaLiteState
    assert_type(vega_lite_chart(data, spec, on_select="rerun"), VegaLiteState)
    assert_type(vega_lite_chart(data, spec, on_select=my_callback), VegaLiteState)
    assert_type(
        vega_lite_chart(data, spec, on_select="rerun", selection_mode="points"),
        VegaLiteState,
    )
    assert_type(
        vega_lite_chart(
            data,
            spec,
            width=600,
            height=400,
            theme=None,
            key="selectable",
            use_container_width=None,
            on_select="rerun",
            selection_mode=["p1", "p2"],
        ),
        VegaLiteState,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Built-in charts do not accept None for width (only Width, not Width | None).
    line_chart(data, width=None)  # type: ignore[arg-type]

    # Invalid width / height values (only int or "stretch" / "content").
    bar_chart(data, width="invalid")  # type: ignore[arg-type]
    scatter_chart(data, height=None)  # type: ignore[arg-type]

    # Invalid stack value for area_chart.
    area_chart(data, stack="invalid")  # type: ignore[arg-type]

    # Invalid theme value for altair_chart (only "streamlit" or None).
    altair_chart(chart, theme="dark")  # type: ignore[call-overload]

    # Invalid on_select literal (only "ignore" / "rerun" or a callable).
    altair_chart(chart, on_select="invalid")  # type: ignore[call-overload]
    vega_lite_chart(data, spec, on_select="invalid")  # type: ignore[call-overload]
