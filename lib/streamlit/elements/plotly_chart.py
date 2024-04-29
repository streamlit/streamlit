# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

"""Streamlit support for Plotly charts."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import (
    TYPE_CHECKING,
    Any,
    Dict,
    Final,
    Iterable,
    List,
    Literal,
    TypedDict,
    Union,
    cast,
    overload,
)

from typing_extensions import TypeAlias

from streamlit import type_util
from streamlit.deprecation_util import show_deprecation_warning
from streamlit.elements.form import current_form_id
from streamlit.elements.lib.event_utils import AttributeDictionary
from streamlit.elements.lib.streamlit_plotly_theme import (
    configure_streamlit_plotly_theme,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.PlotlyChart_pb2 import PlotlyChart as PlotlyChartProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.state import WidgetCallback, register_widget
from streamlit.runtime.state.common import compute_widget_id
from streamlit.type_util import Key, to_key

if TYPE_CHECKING:
    import matplotlib
    import plotly.graph_objs as go
    from plotly.basedatatypes import BaseFigure

    from streamlit.delta_generator import DeltaGenerator

# We need to configure the Plotly theme before any Plotly figures are created:
configure_streamlit_plotly_theme()

_AtomicFigureOrData: TypeAlias = Union[
    "go.Figure",
    "go.Data",
]
FigureOrData: TypeAlias = Union[
    _AtomicFigureOrData,
    List[_AtomicFigureOrData],
    # It is kind of hard to figure out exactly what kind of dict is supported
    # here, as plotly hasn't embraced typing yet. This version is chosen to
    # align with the docstring.
    Dict[str, _AtomicFigureOrData],
    "BaseFigure",
    "matplotlib.figure.Figure",
]

SelectionMode: TypeAlias = Literal["lasso", "points", "box"]
_SELECTION_MODES: Final[set[SelectionMode]] = {"lasso", "points", "box"}


class PlotlySelectionState(TypedDict, total=False):
    """
    A dictionary representing the current selection state of the plotly chart.

    Attributes
    ----------
    points : list[dict[str, Any]]
        The selected data points in the chart, this also includes
        the the data points selected by the box and lasso mode.

    point_indices : list[int]
        The numerical indices of all selected data points in the chart,
        this also includes the indices of the points selected by the box
        and lasso mode.

    box : list[dict[str, Any]]
        The metadata related to the box selection. This includes the
        coordinates of the selected area.

    lasso : list[dict[str, Any]]
        The metadata related to the lasso selection. This includes the
        coordinates of the selected area.
    """

    points: list[dict[str, Any]]
    point_indices: list[int]
    box: list[dict[str, Any]]
    lasso: list[dict[str, Any]]


class PlotlyState(TypedDict, total=False):
    """
    A dictionary representing the current selection state of the plotly chart.

    Attributes
    ----------
    select : PlotlySelectionState
        The state of the `on_select` event.
    """

    select: PlotlySelectionState


@dataclass
class PlotlyChartSelectionSerde:
    """PlotlyChartSelectionSerde is used to serialize and deserialize the Plotly Chart selection state."""

    def deserialize(self, ui_value: str | None, widget_id: str = "") -> PlotlyState:
        empty_selection_state: PlotlyState = {
            "select": {
                "points": [],
                "point_indices": [],
                "box": [],
                "lasso": [],
            },
        }

        selection_state = (
            empty_selection_state
            if ui_value is None
            else cast(PlotlyState, AttributeDictionary(json.loads(ui_value)))
        )

        if "select" not in selection_state:
            selection_state = empty_selection_state

        return cast(PlotlyState, AttributeDictionary(selection_state))

    def serialize(self, selection_state: PlotlyState) -> str:
        return json.dumps(selection_state, default=str)


def parse_selection_mode(
    selection_mode: SelectionMode | Iterable[SelectionMode],
) -> set[PlotlyChartProto.SelectionMode.ValueType]:
    """Parse and check the user provided selection modes."""
    if isinstance(selection_mode, str):
        # Only a single selection mode was passed
        selection_mode_set = {selection_mode}
    else:
        # Multiple selection modes were passed
        selection_mode_set = set(selection_mode)

    if not selection_mode_set.issubset(_SELECTION_MODES):
        raise StreamlitAPIException(
            f"Invalid selection mode: {selection_mode}. "
            f"Valid options are: {_SELECTION_MODES}"
        )

    parsed_selection_modes = []
    for selection_mode in selection_mode_set:
        if selection_mode == "points":
            parsed_selection_modes.append(PlotlyChartProto.SelectionMode.POINTS)
        elif selection_mode == "lasso":
            parsed_selection_modes.append(PlotlyChartProto.SelectionMode.LASSO)
        elif selection_mode == "box":
            parsed_selection_modes.append(PlotlyChartProto.SelectionMode.BOX)
    return set(parsed_selection_modes)


class PlotlyMixin:
    @overload
    def plotly_chart(
        self,
        figure_or_data: FigureOrData,
        use_container_width: bool = False,
        *,
        theme: Literal["streamlit"] | None = "streamlit",
        key: Key | None = None,
        on_select: Literal["ignore"],  # No default value here to make it work with mypy
        selection_mode: SelectionMode
        | Iterable[SelectionMode] = ("points", "box", "lasso"),
        **kwargs: Any,
    ) -> DeltaGenerator:
        ...

    @overload
    def plotly_chart(
        self,
        figure_or_data: FigureOrData,
        use_container_width: bool = False,
        *,
        theme: Literal["streamlit"] | None = "streamlit",
        key: Key | None = None,
        on_select: Literal["rerun"] | WidgetCallback = "rerun",
        selection_mode: SelectionMode
        | Iterable[SelectionMode] = ("points", "box", "lasso"),
        **kwargs: Any,
    ) -> PlotlyState:
        ...

    @gather_metrics("plotly_chart")
    def plotly_chart(
        self,
        figure_or_data: FigureOrData,
        use_container_width: bool = False,
        *,
        theme: Literal["streamlit"] | None = "streamlit",
        key: Key | None = None,
        on_select: Literal["rerun", "ignore"] | WidgetCallback = "ignore",
        selection_mode: SelectionMode
        | Iterable[SelectionMode] = ("points", "box", "lasso"),
        **kwargs: Any,
    ) -> DeltaGenerator | PlotlyState:
        """Display an interactive Plotly chart.

        Plotly is a charting library for Python. The arguments to this function
        closely follow the ones for Plotly's `plot()` function. You can find
        more about Plotly at https://plot.ly/python.

        To show Plotly charts in Streamlit, call `st.plotly_chart` wherever you
        would call Plotly's `py.plot` or `py.iplot`.

        Parameters
        ----------
        figure_or_data : plotly.graph_objs.Figure, plotly.graph_objs.Data,\
            dict/list of plotly.graph_objs.Figure/Data

            See https://plot.ly/python/ for examples of graph descriptions.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the figure's native `width` value.

        theme : "streamlit" or None
            The theme of the chart. Currently, we only support "streamlit" for the Streamlit
            defined design or None to fallback to the default behavior of the library.

        key : str
            An optional string to use as the unique key for this element when used in combination
            with ```on_select```. If this is omitted, a key will be generated for the widget based
            on its content. Multiple widgets of the same type may not share the same key.

        on_select : "ignore" or "rerun" or callable
            Controls the behavior in response to selection events on the charts. Can be one of:
            - "ignore" (default): Streamlit will not react to any selection events in the chart.
            - "rerun: Streamlit will rerun the app when the user selects data in the chart. In this case,
              ```st.plotly_chart``` will return the selection data as a dictionary.
            - callable: If a callable is provided, Streamlit will rerun and execute the callable as a
              callback function before the rest of the app. The selection data can be retrieved through
              session state by setting the key parameter.

        selection_mode : "points", "box", "lasso" or an iterable of these
            The selection mode of the table. Can be one of:
            - "points": The chart will allow selections based on individual data points.
            - "box": The chart will allow selections based on rectangular areas.
            - "lasso": The chart will allow selections based on freeform areas.
            - An iterable of the above options: The chart will allow selections based on the modes specified.

            All selections modes are activated by default.

        **kwargs
            Any argument accepted by Plotly's `plot()` function.

        Example
        -------
        The example below comes straight from the examples at
        https://plot.ly/python:

        >>> import streamlit as st
        >>> import numpy as np
        >>> import plotly.figure_factory as ff
        >>>
        >>> # Add histogram data
        >>> x1 = np.random.randn(200) - 2
        >>> x2 = np.random.randn(200)
        >>> x3 = np.random.randn(200) + 2
        >>>
        >>> # Group data together
        >>> hist_data = [x1, x2, x3]
        >>>
        >>> group_labels = ['Group 1', 'Group 2', 'Group 3']
        >>>
        >>> # Create distplot with custom bin_size
        >>> fig = ff.create_distplot(
        ...         hist_data, group_labels, bin_size=[.1, .25, .5])
        >>>
        >>> # Plot!
        >>> st.plotly_chart(fig, use_container_width=True)

        .. output::
           https://doc-plotly-chart.streamlit.app/
           height: 400px

        """
        import plotly.io
        import plotly.tools

        # NOTE: "figure_or_data" is the name used in Plotly's .plot() method
        # for their main parameter. I don't like the name, but it's best to
        # keep it in sync with what Plotly calls it.

        if "sharing" in kwargs:
            show_deprecation_warning(
                "The `sharing` parameter has been deprecated and will be removed in a future release. "
                "Plotly charts will always be rendered using Streamlit's offline mode."
            )

        if theme not in ["streamlit", None]:
            raise StreamlitAPIException(
                f'You set theme="{theme}" while Streamlit charts only support theme=”streamlit” or theme=None to fallback to the default library theme.'
            )

        if on_select not in ["ignore", "rerun"] and not callable(on_select):
            raise StreamlitAPIException(
                f"You have passed {on_select} to `on_select`. But only 'ignore', 'rerun', or a callable is supported."
            )

        key = to_key(key)
        is_selection_activated = on_select != "ignore"

        if is_selection_activated:
            # Run some checks that are only relevant when selections are activated

            # Import here to avoid circular imports
            from streamlit.elements.utils import (
                check_cache_replay_rules,
                check_callback_rules,
                check_session_state_rules,
            )

            check_cache_replay_rules()
            if callable(on_select):
                check_callback_rules(self.dg, on_select)
            check_session_state_rules(default_value=None, key=key, writes_allowed=False)

        if type_util.is_type(figure_or_data, "matplotlib.figure.Figure"):
            # Convert matplotlib figure to plotly figure:
            figure = plotly.tools.mpl_to_plotly(figure_or_data)
        else:
            figure = plotly.tools.return_figure_from_figure_or_data(
                figure_or_data, validate_figure=True
            )

        plotly_chart_proto = PlotlyChartProto()
        plotly_chart_proto.use_container_width = use_container_width
        plotly_chart_proto.theme = theme or ""
        plotly_chart_proto.form_id = current_form_id(self.dg)

        config = dict(kwargs.get("config", {}))
        # Copy over some kwargs to config dict. Plotly does the same in plot().
        config.setdefault("showLink", kwargs.get("show_link", False))
        config.setdefault("linkText", kwargs.get("link_text", False))

        plotly_chart_proto.spec = plotly.io.to_json(figure, validate=False)
        plotly_chart_proto.config = json.dumps(config)

        ctx = get_script_run_ctx()

        # We are computing the widget id for all plotly uses
        # to also allow non-widget Plotly charts to keep their state
        # when the frontend component gets unmounted and remounted.
        plotly_chart_proto.id = compute_widget_id(
            "plotly_chart",
            user_key=key,
            key=key,
            plotly_spec=plotly_chart_proto.spec,
            plotly_config=plotly_chart_proto.config,
            selection_mode=selection_mode,
            is_selection_activated=is_selection_activated,
            theme=theme,
            form_id=plotly_chart_proto.form_id,
            use_container_width=use_container_width,
            page=ctx.page_script_hash if ctx else None,
        )

        if is_selection_activated:
            # Selections are activated, treat plotly chart as a widget:
            plotly_chart_proto.selection_mode.extend(
                parse_selection_mode(selection_mode)
            )

            serde = PlotlyChartSelectionSerde()

            widget_state = register_widget(
                "plotly_chart",
                plotly_chart_proto,
                user_key=key,
                on_change_handler=on_select if callable(on_select) else None,
                deserializer=serde.deserialize,
                serializer=serde.serialize,
                ctx=ctx,
            )

            self.dg._enqueue("plotly_chart", plotly_chart_proto)
            return cast(PlotlyState, widget_state.value)
        else:
            return self.dg._enqueue("plotly_chart", plotly_chart_proto)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
