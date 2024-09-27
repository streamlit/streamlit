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
from streamlit.elements.lib.event_utils import AttributeDictionary
from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.policies import check_widget_policies
from streamlit.elements.lib.streamlit_plotly_theme import (
    configure_streamlit_plotly_theme,
)
from streamlit.elements.lib.utils import Key, compute_and_register_element_id, to_key
from streamlit.errors import StreamlitAPIException
from streamlit.proto.PlotlyChart_pb2 import PlotlyChart as PlotlyChartProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.runtime.state import WidgetCallback, register_widget

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
    The schema for the Plotly chart selection state.

    The selection state is stored in a dictionary-like object that supports both
    key and attribute notation. Selection states cannot be programmatically
    changed or set through Session State.

    Attributes
    ----------
    points : list[dict[str, Any]]
        The selected data points in the chart, including the data points
        selected by the box and lasso mode. The data includes the values
        associated to each point and a point index used to populate
        ``point_indices``. If additional information has been assigned to your
        points, such as size or legend group, this is also included.

    point_indices : list[int]
        The numerical indices of all selected data points in the chart. The
        details of each identified point are included in ``points``.

    box : list[dict[str, Any]]
        The metadata related to the box selection. This includes the
        coordinates of the selected area.

    lasso : list[dict[str, Any]]
        The metadata related to the lasso selection. This includes the
        coordinates of the selected area.

    Example
    -------
    When working with more complicated graphs, the ``points`` attribute
    displays additional information. Try selecting points in the following
    example:

    >>> import streamlit as st
    >>> import plotly.express as px
    >>>
    >>> df = px.data.iris()
    >>> fig = px.scatter(
    ...     df,
    ...     x="sepal_width",
    ...     y="sepal_length",
    ...     color="species",
    ...     size="petal_length",
    ...     hover_data=["petal_width"],
    ... )
    >>>
    >>> event = st.plotly_chart(fig, key="iris", on_select="rerun")
    >>>
    >>> event.selection

    .. output::
        https://doc-chart-events-plotly-selection-state.streamlit.app
        height: 600px

    This is an example of the selection state when selecting a single point:

    >>> {
    >>>   "points": [
    >>>     {
    >>>       "curve_number": 2,
    >>>       "point_number": 9,
    >>>       "point_index": 9,
    >>>       "x": 3.6,
    >>>       "y": 7.2,
    >>>       "customdata": [
    >>>         2.5
    >>>       ],
    >>>       "marker_size": 6.1,
    >>>       "legendgroup": "virginica"
    >>>     }
    >>>   ],
    >>>   "point_indices": [
    >>>     9
    >>>   ],
    >>>   "box": [],
    >>>   "lasso": []
    >>> }

    """

    points: list[dict[str, Any]]
    point_indices: list[int]
    box: list[dict[str, Any]]
    lasso: list[dict[str, Any]]


class PlotlyState(TypedDict, total=False):
    """
    The schema for the Plotly chart event state.

    The event state is stored in a dictionary-like object that supports both
    key and attribute notation. Event states cannot be programmatically
    changed or set through Session State.

    Only selection events are supported at this time.

    Attributes
    ----------
    selection : dict
        The state of the ``on_select`` event. This attribute returns a
        dictionary-like object that supports both key and attribute notation.
        The attributes are described by the ``PlotlySelectionState`` dictionary
        schema.

    Example
    -------
    Try selecting points by any of the three available methods (direct click,
    box, or lasso). The current selection state is available through Session
    State or as the output of the chart function.

    >>> import streamlit as st
    >>> import plotly.express as px
    >>>
    >>> df = px.data.iris()  # iris is a pandas DataFrame
    >>> fig = px.scatter(df, x="sepal_width", y="sepal_length")
    >>>
    >>> event = st.plotly_chart(fig, key="iris", on_select="rerun")
    >>>
    >>> event

    .. output::
        https://doc-chart-events-plotly-state.streamlit.app
        height: 600px

    """

    selection: PlotlySelectionState


@dataclass
class PlotlyChartSelectionSerde:
    """PlotlyChartSelectionSerde is used to serialize and deserialize the Plotly Chart
    selection state.
    """

    def deserialize(self, ui_value: str | None, widget_id: str = "") -> PlotlyState:
        empty_selection_state: PlotlyState = {
            "selection": {
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

        if "selection" not in selection_state:
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
        selection_mode: SelectionMode | Iterable[SelectionMode] = (
            "points",
            "box",
            "lasso",
        ),
        **kwargs: Any,
    ) -> DeltaGenerator: ...

    @overload
    def plotly_chart(
        self,
        figure_or_data: FigureOrData,
        use_container_width: bool = False,
        *,
        theme: Literal["streamlit"] | None = "streamlit",
        key: Key | None = None,
        on_select: Literal["rerun"] | WidgetCallback = "rerun",
        selection_mode: SelectionMode | Iterable[SelectionMode] = (
            "points",
            "box",
            "lasso",
        ),
        **kwargs: Any,
    ) -> PlotlyState: ...

    @gather_metrics("plotly_chart")
    def plotly_chart(
        self,
        figure_or_data: FigureOrData,
        use_container_width: bool = False,
        *,
        theme: Literal["streamlit"] | None = "streamlit",
        key: Key | None = None,
        on_select: Literal["rerun", "ignore"] | WidgetCallback = "ignore",
        selection_mode: SelectionMode | Iterable[SelectionMode] = (
            "points",
            "box",
            "lasso",
        ),
        **kwargs: Any,
    ) -> DeltaGenerator | PlotlyState:
        """Display an interactive Plotly chart.

        `Plotly <https://plot.ly/python>`_ is a charting library for Python.
        The arguments to this function closely follow the ones for Plotly's
        ``plot()`` function.

        To show Plotly charts in Streamlit, call ``st.plotly_chart`` wherever
        you would call Plotly's ``py.plot`` or ``py.iplot``.

        Parameters
        ----------
        figure_or_data : plotly.graph_objs.Figure, plotly.graph_objs.Data,\
            or dict/list of plotly.graph_objs.Figure/Data

            The Plotly ``Figure`` or ``Data`` object to render. See
            https://plot.ly/python/ for examples of graph descriptions.

        use_container_width : bool
            Whether to override the figure's native width with the width of
            the parent container. If ``use_container_width`` is ``False``
            (default), Streamlit sets the width of the chart to fit its contents
            according to the plotting library, up to the width of the parent
            container. If ``use_container_width`` is ``True``, Streamlit sets
            the width of the figure to match the width of the parent container.

        theme : "streamlit" or None
            The theme of the chart. If ``theme`` is ``"streamlit"`` (default),
            Streamlit uses its own design default. If ``theme`` is ``None``,
            Streamlit falls back to the default behavior of the library.

        key : str
            An optional string to use for giving this element a stable
            identity. If ``key`` is ``None`` (default), this element's identity
            will be determined based on the values of the other parameters.

            Additionally, if selections are activated and ``key`` is provided,
            Streamlit will register the key in Session State to store the
            selection state. The selection state is read-only.

        on_select : "ignore" or "rerun" or callable
            How the figure should respond to user selection events. This
            controls whether or not the figure behaves like an input widget.
            ``on_select`` can be one of the following:

            - ``"ignore"`` (default): Streamlit will not react to any selection
              events in the chart. The figure will not behave like an input
              widget.

            - ``"rerun"``: Streamlit will rerun the app when the user selects
              data in the chart. In this case, ``st.plotly_chart`` will return
              the selection data as a dictionary.

            - A ``callable``: Streamlit will rerun the app and execute the
              ``callable`` as a callback function before the rest of the app.
              In this case, ``st.plotly_chart`` will return the selection data
              as a dictionary.

        selection_mode : "points", "box", "lasso" or an Iterable of these
            The selection mode of the chart. This can be one of the following:

            - ``"points"``: The chart will allow selections based on individual
              data points.
            - ``"box"``: The chart will allow selections based on rectangular
              areas.
            - ``"lasso"``: The chart will allow selections based on freeform
              areas.
            - An ``Iterable`` of the above options: The chart will allow
              selections based on the modes specified.

            All selections modes are activated by default.

        **kwargs
            Any argument accepted by Plotly's ``plot()`` function.

        Returns
        -------
        element or dict
            If ``on_select`` is ``"ignore"`` (default), this command returns an
            internal placeholder for the chart element. Otherwise, this command
            returns a dictionary-like object that supports both key and
            attribute notation. The attributes are described by the
            ``PlotlyState`` dictionary schema.

        Example
        -------
        The example below comes straight from the examples at
        https://plot.ly/python. Note that ``plotly.figure_factory`` requires
        ``scipy`` to run.

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
           height: 550px

        """
        import plotly.io
        import plotly.tools

        # NOTE: "figure_or_data" is the name used in Plotly's .plot() method
        # for their main parameter. I don't like the name, but it's best to
        # keep it in sync with what Plotly calls it.

        if "sharing" in kwargs:
            show_deprecation_warning(
                "The `sharing` parameter has been deprecated and will be removed "
                "in a future release. Plotly charts will always be rendered using "
                "Streamlit's offline mode."
            )

        if theme not in ["streamlit", None]:
            raise StreamlitAPIException(
                f'You set theme="{theme}" while Streamlit charts only support '
                "theme=”streamlit” or theme=None to fallback to the default "
                "library theme."
            )

        if on_select not in ["ignore", "rerun"] and not callable(on_select):
            raise StreamlitAPIException(
                f"You have passed {on_select} to `on_select`. But only 'ignore', "
                "'rerun', or a callable is supported."
            )

        key = to_key(key)
        is_selection_activated = on_select != "ignore"

        if is_selection_activated:
            # Run some checks that are only relevant when selections are activated

            is_callback = callable(on_select)
            check_widget_policies(
                self.dg,
                key,
                on_change=cast(WidgetCallback, on_select) if is_callback else None,
                default_value=None,
                writes_allowed=False,
                enable_check_callback_rules=is_callback,
            )

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
        plotly_chart_proto.id = compute_and_register_element_id(
            "plotly_chart",
            user_key=key,
            form_id=plotly_chart_proto.form_id,
            plotly_spec=plotly_chart_proto.spec,
            plotly_config=plotly_chart_proto.config,
            selection_mode=selection_mode,
            is_selection_activated=is_selection_activated,
            theme=theme,
            use_container_width=use_container_width,
        )

        if is_selection_activated:
            # Selections are activated, treat plotly chart as a widget:
            plotly_chart_proto.selection_mode.extend(
                parse_selection_mode(selection_mode)
            )

            serde = PlotlyChartSelectionSerde()

            widget_state = register_widget(
                plotly_chart_proto.id,
                on_change_handler=on_select if callable(on_select) else None,
                deserializer=serde.deserialize,
                serializer=serde.serialize,
                ctx=ctx,
                value_type="string_value",
            )

            self.dg._enqueue("plotly_chart", plotly_chart_proto)
            return cast(PlotlyState, widget_state.value)
        else:
            return self.dg._enqueue("plotly_chart", plotly_chart_proto)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
