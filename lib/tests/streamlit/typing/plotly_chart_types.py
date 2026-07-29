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

# Perform type checking tests for st.plotly_chart.
# The return type depends on the on_select parameter:
# - no on_select / on_select="rerun" / callable -> returns PlotlyState
# - on_select="ignore" -> returns DeltaGenerator
# Note: because the "ignore" overload has no default value, omitting on_select
# resolves to the "rerun" overload and therefore returns PlotlyState.
if TYPE_CHECKING:
    import plotly.graph_objs as go
    from matplotlib.figure import Figure as MatplotlibFigure
    from plotly.basedatatypes import BaseFigure

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.plotly_chart import PlotlyMixin, PlotlyState

    plotly_chart = PlotlyMixin().plotly_chart

    # Create some test figures/data
    fig = cast("go.Figure", object())
    data = cast("go.Data", object())
    base_fig = cast("BaseFigure", object())
    mpl_fig = cast("MatplotlibFigure", object())

    # =====================================================================
    # Basic return type tests with different figure inputs
    # (no on_select -> resolves to the "rerun" overload -> PlotlyState)
    # =====================================================================

    assert_type(plotly_chart(fig), PlotlyState)
    assert_type(plotly_chart(data), PlotlyState)
    assert_type(plotly_chart(base_fig), PlotlyState)
    assert_type(plotly_chart(mpl_fig), PlotlyState)
    assert_type(plotly_chart([fig, data]), PlotlyState)
    assert_type(plotly_chart({"data": data}), PlotlyState)

    # =====================================================================
    # Return type tests with on_select="ignore" -> DeltaGenerator
    # =====================================================================

    assert_type(plotly_chart(fig, on_select="ignore"), DeltaGenerator)
    assert_type(plotly_chart(data, on_select="ignore"), DeltaGenerator)
    assert_type(plotly_chart(base_fig, on_select="ignore"), DeltaGenerator)
    assert_type(plotly_chart([fig, data], on_select="ignore"), DeltaGenerator)
    assert_type(plotly_chart({"data": data}, on_select="ignore"), DeltaGenerator)

    # =====================================================================
    # Return type tests with on_select="rerun" -> PlotlyState
    # =====================================================================

    assert_type(plotly_chart(fig, on_select="rerun"), PlotlyState)

    # =====================================================================
    # Return type tests with callback function -> PlotlyState
    # =====================================================================

    def my_callback() -> None:
        pass

    def callback_with_args(x: int, y: str) -> None:
        pass

    assert_type(plotly_chart(fig, on_select=my_callback), PlotlyState)
    assert_type(plotly_chart(fig, on_select=callback_with_args), PlotlyState)
    assert_type(plotly_chart(fig, on_select=lambda: None), PlotlyState)

    # =====================================================================
    # Test width parameter ("stretch", "content", or int)
    # =====================================================================

    assert_type(plotly_chart(fig, on_select="ignore", width="stretch"), DeltaGenerator)
    assert_type(plotly_chart(fig, on_select="ignore", width="content"), DeltaGenerator)
    assert_type(plotly_chart(fig, on_select="ignore", width=500), DeltaGenerator)
    assert_type(plotly_chart(fig, width=500, on_select="rerun"), PlotlyState)

    # =====================================================================
    # Test height parameter ("content", "stretch", or int)
    # =====================================================================

    assert_type(plotly_chart(fig, on_select="ignore", height="content"), DeltaGenerator)
    assert_type(plotly_chart(fig, on_select="ignore", height="stretch"), DeltaGenerator)
    assert_type(plotly_chart(fig, on_select="ignore", height=400), DeltaGenerator)
    assert_type(plotly_chart(fig, height=400, on_select="rerun"), PlotlyState)

    # =====================================================================
    # Test theme parameter ("streamlit" or None)
    # =====================================================================

    assert_type(
        plotly_chart(fig, on_select="ignore", theme="streamlit"), DeltaGenerator
    )
    assert_type(plotly_chart(fig, on_select="ignore", theme=None), DeltaGenerator)
    assert_type(plotly_chart(fig, theme="streamlit", on_select="rerun"), PlotlyState)

    # =====================================================================
    # Test use_container_width parameter (deprecated bool or None)
    # =====================================================================

    assert_type(
        plotly_chart(fig, use_container_width=True, on_select="ignore"), DeltaGenerator
    )
    assert_type(
        plotly_chart(fig, use_container_width=False, on_select="ignore"), DeltaGenerator
    )
    assert_type(
        plotly_chart(fig, use_container_width=None, on_select="ignore"), DeltaGenerator
    )
    assert_type(
        plotly_chart(fig, use_container_width=True, on_select="rerun"), PlotlyState
    )

    # =====================================================================
    # Test key parameter (str, int, or None)
    # =====================================================================

    assert_type(plotly_chart(fig, on_select="ignore", key="my_chart"), DeltaGenerator)
    assert_type(plotly_chart(fig, on_select="ignore", key=123), DeltaGenerator)
    assert_type(plotly_chart(fig, on_select="ignore", key=None), DeltaGenerator)
    assert_type(plotly_chart(fig, key="my_chart", on_select="rerun"), PlotlyState)

    # =====================================================================
    # Test selection_mode parameter - single modes
    # =====================================================================

    assert_type(
        plotly_chart(fig, on_select="rerun", selection_mode="points"), PlotlyState
    )
    assert_type(plotly_chart(fig, on_select="rerun", selection_mode="box"), PlotlyState)
    assert_type(
        plotly_chart(fig, on_select="rerun", selection_mode="lasso"), PlotlyState
    )

    # =====================================================================
    # Test selection_mode parameter - combined modes (Iterable)
    # =====================================================================

    assert_type(
        plotly_chart(fig, on_select="rerun", selection_mode=["points", "box"]),
        PlotlyState,
    )
    assert_type(
        plotly_chart(fig, on_select="rerun", selection_mode=("points", "box", "lasso")),
        PlotlyState,
    )

    # =====================================================================
    # Test config parameter (dict or None)
    # =====================================================================

    assert_type(
        plotly_chart(fig, on_select="ignore", config={"scrollZoom": False}),
        DeltaGenerator,
    )
    assert_type(plotly_chart(fig, on_select="ignore", config=None), DeltaGenerator)
    assert_type(
        plotly_chart(fig, config={"displayModeBar": True}, on_select="rerun"),
        PlotlyState,
    )

    # =====================================================================
    # Test with all parameters combined (on_select="ignore" -> DeltaGenerator)
    # =====================================================================

    assert_type(
        plotly_chart(
            fig,
            use_container_width=None,
            width="stretch",
            height="content",
            theme="streamlit",
            key="full_chart",
            on_select="ignore",
            selection_mode=("points", "box", "lasso"),
            config={"scrollZoom": False},
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Test with all parameters combined (on_select="rerun" -> PlotlyState)
    # =====================================================================

    assert_type(
        plotly_chart(
            fig,
            use_container_width=None,
            width=600,
            height=400,
            theme=None,
            key="selectable_chart",
            on_select="rerun",
            selection_mode=["points", "box"],
            config={"displayModeBar": True},
        ),
        PlotlyState,
    )

    # =====================================================================
    # Test with all parameters combined (on_select=callback -> PlotlyState)
    # =====================================================================

    assert_type(
        plotly_chart(
            fig,
            use_container_width=None,
            width="content",
            height="stretch",
            theme="streamlit",
            key="callback_chart",
            on_select=my_callback,
            selection_mode="points",
            config=None,
        ),
        PlotlyState,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid theme value (only "streamlit" or None)
    plotly_chart(fig, theme="dark")  # type: ignore[call-overload]

    # Invalid width / height values (only int or "stretch" / "content")
    plotly_chart(fig, width="invalid")  # type: ignore[call-overload]
    plotly_chart(fig, height=None)  # type: ignore[call-overload]

    # Invalid selection_mode value
    plotly_chart(fig, on_select="rerun", selection_mode="invalid")  # type: ignore[call-overload]
