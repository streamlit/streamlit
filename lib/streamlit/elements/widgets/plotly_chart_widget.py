# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import hashlib
import json
import urllib.parse
from typing import TYPE_CHECKING, Any, Dict, List, Set, Union, cast

import plotly.graph_objs as go
from typing_extensions import Final, Literal, TypeAlias

from streamlit import type_util
from streamlit.elements.form import current_form_id
from streamlit.elements.utils import check_callback_rules, check_session_state_rules
from streamlit.errors import StreamlitAPIException
from streamlit.logger import get_logger
from streamlit.proto.PlotlyChart_pb2 import PlotlyChart as PlotlyChartProto
from streamlit.runtime.legacy_caching import caching
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.state import WidgetCallback, register_widget
from streamlit.runtime.state.common import compute_widget_id
from streamlit.type_util import Key, to_key

if TYPE_CHECKING:
    import matplotlib
    from plotly.basedatatypes import BaseFigure

    from streamlit.delta_generator import DeltaGenerator


try:
    import plotly.io as pio

    import streamlit.elements.lib.streamlit_plotly_theme

    pio.templates.default = "streamlit"
except ModuleNotFoundError:
    # We have imports here because it takes too loo long to load the template default for the first graph to load
    # We do nothing if Plotly is not installed. This is expected since Plotly is an optional dependency.
    pass

LOGGER: Final = get_logger(__name__)

SharingMode: TypeAlias = Literal["streamlit", "private", "public", "secret"]

SHARING_MODES: Set[SharingMode] = {
    # This means the plot will be sent to the Streamlit app rather than to
    # Plotly.
    "streamlit",
    # The three modes below are for plots that should be hosted in Plotly.
    # These are the names Plotly uses for them.
    "private",
    "public",
    "secret",
}

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


class PlotlyWidgetMixin:
    def plotly_chart_widget(
        self,
        figure_or_data: FigureOrData,
        use_container_width: bool = False,
        sharing: SharingMode = "streamlit",
        theme: Union[None, Literal["streamlit"]] = "streamlit",
        key: Key | None = None,
        on_select: bool | None = None,
        on_hover: bool | None = None,
        on_click: bool | None = None,
        on_relayout: bool | None = None,
        on_change: WidgetCallback | None = None,
        **kwargs: Any,
    ) -> "DeltaGenerator":
        """Display an interactive Plotly chart.

        Plotly is a charting library for Python. The arguments to this function
        closely follow the ones for Plotly's `plot()` function. You can find
        more about Plotly at https://plot.ly/python.

        To show Plotly charts in Streamlit, call `st.plotly_chart` wherever you
        would call Plotly's `py.plot` or `py.iplot`.

        Parameters
        ----------
        figure_or_data : plotly.graph_objs.Figure, plotly.graph_objs.Data,
            dict/list of plotly.graph_objs.Figure/Data

            See https://plot.ly/python/ for examples of graph descriptions.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the figure's native `width` value.

        sharing : "streamlit", "private", "secret", or "public"
            Use "streamlit" to insert the plot and all its dependencies
            directly in the Streamlit app using plotly's offline mode (default).
            Use any other sharing mode to send the chart to Plotly chart studio, which
            requires an account. See https://plot.ly/python/chart-studio/ for more information.

        theme : "streamlit" or None
            The theme of the chart. Currently, we only support "streamlit" for the Streamlit
            defined design or None to fallback to the default behavior of the library.

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
        # NOTE: "figure_or_data" is the name used in Plotly's .plot() method
        # for their main parameter. I don't like the name, but it's best to
        # keep it in sync with what Plotly calls it.

        key = to_key(key)
        check_session_state_rules(default_value=None, key=key, writes_allowed=False)
        print(f"{key=}")
        plotly_chart_proto = PlotlyChartProto()
        if theme != "streamlit" and theme != None:
            raise StreamlitAPIException(
                f'You set theme="{theme}" while Streamlit charts only support theme=”streamlit” or theme=None to fallback to the default library theme.'
            )

        # Custom serializer
        def serialize(obj):
            # Here, you might need to implement custom serialization logic for
            # each type to ensure it's converted to a string or byte representation properly.
            if isinstance(obj, (go.Figure, go.Data)):
                return json.dumps(obj, default=str)  # or use obj.to_json() if available
            elif isinstance(obj, list):
                return json.dumps([serialize(sub_obj) for sub_obj in obj])
            elif isinstance(obj, dict):
                return json.dumps({key: serialize(value) for key, value in obj.items()})
            # Add serialization for other types as needed

        # Hash function
        def get_hash(obj):
            serialized_obj = serialize(obj).encode("utf-8")
            return hashlib.sha256(serialized_obj).hexdigest()

        # Example usage
        figure_id = get_hash(figure_or_data)
        plotly_chart_proto.form_id = current_form_id(self.dg)
        marshall(
            plotly_chart_proto,
            figure_or_data,
            use_container_width,
            sharing,
            theme,
            figure_id,
            on_select,
            on_hover,
            on_click,
            on_relayout,
            **kwargs,
        )
        plotly_chart_proto.id = compute_widget_id(
            "plotly_chart_widget",
            plotly_chart_proto,
        )

        def deserialize(ui_value, widget_id=""):
            if ui_value is None:
                return {}
            if isinstance(ui_value, str):
                return json.loads(ui_value)

            return ui_value

        def serialize(v):
            return json.dumps(v, default=str)

        ctx = get_script_run_ctx()

        widget_state = register_widget(
            "plotly_chart_widget",
            plotly_chart_proto,
            user_key=None,
            on_change_handler=None,
            args=None,
            kwargs=None,
            deserializer=deserialize,
            serializer=serialize,
            ctx=ctx,
        )
        self.dg._enqueue("plotly_chart", plotly_chart_proto)
        return widget_state.value

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


def marshall(
    proto: PlotlyChartProto,
    figure_or_data: FigureOrData,
    use_container_width: bool,
    sharing: SharingMode,
    theme: Union[None, Literal["streamlit"]],
    figure_id: str,
    on_select: bool | None,
    on_hover: bool | None,
    on_click: bool | None,
    on_relayout: bool | None,
    **kwargs: Any,
) -> None:
    """Marshall a proto with a Plotly spec.

    See DeltaGenerator.plotly_chart for docs.
    """
    # NOTE: "figure_or_data" is the name used in Plotly's .plot() method
    # for their main parameter. I don't like the name, but its best to keep
    # it in sync with what Plotly calls it.

    import plotly.tools

    if type_util.is_type(figure_or_data, "matplotlib.figure.Figure"):
        figure = plotly.tools.mpl_to_plotly(figure_or_data)

    else:
        figure = plotly.tools.return_figure_from_figure_or_data(
            figure_or_data, validate_figure=True
        )

    if not isinstance(sharing, str) or sharing.lower() not in SHARING_MODES:
        raise ValueError("Invalid sharing mode for Plotly chart: %s" % sharing)

    proto.use_container_width = use_container_width

    if sharing == "streamlit":
        import plotly.utils

        config = dict(kwargs.get("config", {}))
        # Copy over some kwargs to config dict. Plotly does the same in plot().
        config.setdefault("showLink", kwargs.get("show_link", False))
        config.setdefault("linkText", kwargs.get("link_text", False))

        proto.figure.spec = json.dumps(figure, cls=plotly.utils.PlotlyJSONEncoder)
        proto.figure.config = json.dumps(config)

    else:
        url = _plot_to_url_or_load_cached_url(
            figure, sharing=sharing, auto_open=False, **kwargs
        )
        proto.url = _get_embed_url(url)
    proto.theme = theme or ""
    if on_select is None:
        on_select = False
    if on_hover is None:
        on_hover = False
    if on_click is None:
        on_click = False
    if on_relayout is None:
        on_relayout = False
    proto.on_select = on_select
    proto.on_hover = on_hover
    proto.on_click = on_click
    proto.on_relayout = on_relayout
    # proto.figure_id = figure_id


@caching.cache
def _plot_to_url_or_load_cached_url(*args: Any, **kwargs: Any) -> "go.Figure":
    """Call plotly.plot wrapped in st.cache.

    This is so we don't unnecessarily upload data to Plotly's SASS if nothing
    changed since the previous upload.
    """
    try:
        # Plotly 4 changed its main package.
        import chart_studio.plotly as ply
    except ImportError:
        import plotly.plotly as ply

    return ply.plot(*args, **kwargs)


def _get_embed_url(url: str) -> str:
    parsed_url = urllib.parse.urlparse(url)

    # Plotly's embed URL is the normal URL plus ".embed".
    # (Note that our use namedtuple._replace is fine because that's not a
    # private method! It just has an underscore to avoid clashing with the
    # tuple field names)
    parsed_embed_url = parsed_url._replace(path=parsed_url.path + ".embed")

    return urllib.parse.urlunparse(parsed_embed_url)
