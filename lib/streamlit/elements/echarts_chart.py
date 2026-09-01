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

import copy
import json
import re
from collections.abc import Iterator, Mapping
from dataclasses import dataclass
from typing import (
    TYPE_CHECKING,
    Any,
    Final,
    Literal,
    Protocol,
    TypeAlias,
    cast,
    overload,
)

from streamlit import dataframe_util
from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.layout_utils import (
    Height,
    LayoutConfig,
    Width,
    validate_height,
    validate_width,
)
from streamlit.elements.lib.policies import check_widget_policies
from streamlit.elements.lib.utils import Key, compute_and_register_element_id, to_key
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitInvalidParameterTypeError,
    StreamlitValueError,
)
from streamlit.proto.EChartsChart_pb2 import EChartsChart as EChartsChartProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.runtime.state import WidgetCallback, register_widget
from streamlit.util import ReadOnlyAttributeDictionary

if TYPE_CHECKING:
    import pandas as pd

    from streamlit.delta_generator import DeltaGenerator


# ECharts option objects have no intrinsic dimensions, so "content" width/height
# resolve to these fixed defaults (unless a pyecharts chart exposes its own).
_DEFAULT_CONTENT_WIDTH: Final = 700
_DEFAULT_CONTENT_HEIGHT: Final = 400

# Series types provided by the separate ECharts GL extension, which is not
# bundled. ECharts renders an empty chart for these and only logs to the browser
# console, so they are rejected in Python where the cause can be explained.
_GL_SERIES_TYPES: Final = frozenset(
    {
        "bar3D",
        "flowGL",
        "globe",
        "graphGL",
        "line3D",
        "lines3D",
        "linesGL",
        "map3D",
        "polygons3D",
        "scatter3D",
        "scatterGL",
        "surface",
    }
)

# Bare ``function (...)`` in a JSON string (pyecharts ``dump_options``). A
# substring match on ``"function"`` is too broad — it would treat a parse
# failure whose payload merely contains the word "function" as a callback.
_BARE_JS_FUNCTION: Final = re.compile(r"\bfunction\s*\(")


class EChartsCompatible(Protocol):
    """Duck-typed protocol for objects convertible to an ECharts option.

    ``pyecharts`` charts implement ``dump_options`` to emit a JSON string, so
    they satisfy this protocol without ``pyecharts`` being a Streamlit
    dependency.
    """

    def dump_options(self) -> str: ...


# Input accepted by ``st.echarts_chart``: an option ``Mapping``, a JSON string,
# or a duck-typed ``pyecharts`` chart.
EChartsOptions: TypeAlias = Mapping[str, Any] | str | EChartsCompatible


class EChartsSelectionState(ReadOnlyAttributeDictionary):
    """
    The schema for the ECharts chart selection state.

    The selection state is stored in a dictionary-like object that supports both
    key and attribute notation. Selection states cannot be programmatically
    changed or set through Session State.

    Attributes
    ----------
    points : list[dict[str, Any]]
        The selected data items in the chart, including the items selected by
        the box and lasso modes. Each item identifies its series (through
        ``series_index`` and ``series_name``) and its ``data_index``, along with
        the item's ``name`` and ``value``. The per-item ``series_index``
        disambiguates selections in multi-series charts.

        Items selected by clicking a point additionally carry
        ``component_type``, ``series_type``, ``series_name``, ``name``,
        ``value``, and ``data`` when those can be resolved from the option.
        Access them with ``dict.get()``: dataset-driven series don't expose
        per-item names or values, so the keys can be missing. Items derived
        from a box or lasso selection carry the fields ECharts reports for a
        brushed data item (``component_type``, ``series_index``, and
        ``data_index``).

    point_indices : list[int]
        The ``data_index`` values of all selected data items. This is convenient
        for the common single-series case and mirrors ``PlotlyState``.

        .. note::
            This is reliable only for single-series charts. ECharts
            ``data_index`` is series-local, so in multi-series charts the same
            index can refer to different points across series. For multi-series
            charts, use ``points[].series_index`` (or ``series_name``) together
            with ``points[].data_index`` to disambiguate.

    box : list[dict[str, Any]]
        The metadata related to the box (rectangle) selections. This includes
        the coordinates of the selected areas.

    lasso : list[dict[str, Any]]
        The metadata related to the lasso (freeform) selections. This includes
        the coordinates of the selected areas.

    """

    points: list[dict[str, Any]]
    point_indices: list[int]
    box: list[dict[str, Any]]
    lasso: list[dict[str, Any]]

    @overload
    def __getitem__(self, key: Literal["points"]) -> list[dict[str, Any]]: ...

    @overload
    def __getitem__(self, key: Literal["point_indices"]) -> list[int]: ...

    @overload
    def __getitem__(self, key: Literal["box"]) -> list[dict[str, Any]]: ...

    @overload
    def __getitem__(self, key: Literal["lasso"]) -> list[dict[str, Any]]: ...

    @overload
    def __getitem__(self, key: Any) -> Any: ...

    def __getitem__(self, key: Any) -> Any:
        return super().__getitem__(key)


class EChartsState(ReadOnlyAttributeDictionary):
    """
    The schema for the ECharts chart event state.

    To use this type in an annotation, import it from ``streamlit.typing``.

    The event state is stored in a dictionary-like object that supports both
    key and attribute notation. Event states cannot be programmatically
    changed or set through Session State.

    Only selection events are supported at this time.

    Attributes
    ----------
    selection : dict
        The state of the ``on_select`` event. This attribute returns a
        dictionary-like object that supports both key and attribute notation.
        The attributes are described by the ``EChartsSelectionState`` dictionary
        schema.

    """

    selection: EChartsSelectionState

    # ReadOnlyAttributeDictionary routes attribute access through __getitem__,
    # so the override below is enough to return EChartsSelectionState. Use
    # dict.__getitem__ for the selection key so the read-only base class does
    # not re-wrap the already-typed nested instance.
    @overload
    def __getitem__(self, key: Literal["selection"]) -> EChartsSelectionState: ...

    @overload
    def __getitem__(self, key: Any) -> Any: ...

    def __getitem__(self, key: Any) -> Any:
        if key == "selection":
            item = dict.__getitem__(self, key)
            if not isinstance(item, EChartsSelectionState):
                item = EChartsSelectionState(item)
                # Cache via dict.__setitem__ — ReadOnlyAttributeDictionary
                # blocks normal mutation, but storing the wrapped instance
                # keeps identity stable across accesses.
                dict.__setitem__(self, key, item)
            return item
        return super().__getitem__(key)


@dataclass
class EChartsChartSelectionSerde:
    """EChartsChartSelectionSerde is used to serialize and deserialize the
    ECharts chart selection state.
    """

    def deserialize(self, ui_value: str | None) -> EChartsState:
        empty_selection_state: dict[str, Any] = {
            "selection": {
                "points": [],
                "point_indices": [],
                "box": [],
                "lasso": [],
            },
        }

        selection_state: Any = (
            empty_selection_state if ui_value is None else json.loads(ui_value)
        )

        if "selection" not in selection_state:  # pragma: no cover - defensive
            selection_state = empty_selection_state

        # Eagerly wrap selection so bracket access returns a stable typed
        # instance instead of creating a shallow copy on every access.
        selection_state["selection"] = EChartsSelectionState(
            selection_state["selection"]
        )
        return EChartsState(selection_state)

    def serialize(self, selection_state: EChartsState) -> str:
        # The selection state is already JSON-clean (produced by the frontend),
        # so no ``default`` fallback is needed here.
        return json.dumps(selection_state)


def _js_callback_error() -> StreamlitAPIException:
    return StreamlitAPIException(
        "The provided ECharts options contain JavaScript callbacks (e.g. "
        "`function` values or `JsCode`), which are not supported by "
        "`st.echarts_chart` in v1. Only JSON-compatible option objects are "
        "supported. Use ECharts string-template formatters instead of "
        "JavaScript functions.",
        error_id="echarts-js-callbacks-not-supported",
    )


def _loads_json_option(raw: str) -> Any:
    """Parse a raw JSON option string, raising a helpful error on failure."""
    # ``dump_options_with_quotes`` produces valid JSON that still embeds the
    # ``--x_x--`` sentinel, so this check must run before ``json.loads``.
    if "--x_x--" in raw:
        raise _js_callback_error()
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError, ValueError) as ex:
        if _BARE_JS_FUNCTION.search(raw) is not None or "=>" in raw:
            raise _js_callback_error() from ex
        raise StreamlitAPIException(
            "The provided ECharts options could not be parsed as JSON. "
            "`st.echarts_chart` only supports JSON-compatible option objects in v1.",
            error_id="echarts-options-invalid-json",
        ) from ex


def _dataframe_to_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Convert a dataframe to JSON-native records (array of objects).

    Uses pandas' JSON serialization to normalize datetimes (to ISO strings),
    NaN/NaT (to ``null``), and numpy scalar types into JSON-native values so the
    result can be strictly serialized without a ``default`` fallback.
    """
    records = json.loads(df.to_json(orient="records", date_format="iso"))
    return cast("list[dict[str, Any]]", records)


def _convert_single_dataset(dataset: dict[str, Any]) -> None:
    """Convert a single ``dataset`` dict's dataframe-like ``source`` in place."""
    source = dataset.get("source")
    if source is None or not dataframe_util.is_dataframe_like(source):
        return

    df = dataframe_util.convert_anything_to_pandas_df(source)
    labels = [str(column) for column in df.columns]
    if len(labels) != len(set(labels)):
        raise StreamlitAPIException(
            "The provided ECharts dataset has duplicate column labels after "
            'converting them to strings (for example both `1` and `"1"`). '
            "Rename the columns so each label is unique.",
            error_id="echarts-dataset-duplicate-columns",
        )
    dataset["source"] = _dataframe_to_records(df)
    # Preserve column order via ``dimensions`` unless the user set it explicitly.
    if "dimensions" not in dataset:
        dataset["dimensions"] = labels


def _iter_option_variants(option: dict[str, Any]) -> Iterator[dict[str, Any]]:
    """Yield the option itself plus the variants of a timeline spec.

    Timeline specs keep the chart under ``baseOption`` and per-tick overrides
    under ``options``, so series can live in any of the three places.
    """
    yield option
    base_option = option.get("baseOption")
    if isinstance(base_option, dict):
        yield base_option
    for timeline_option in option.get("options") or []:
        if isinstance(timeline_option, dict):
            yield timeline_option


def _iter_series(option: dict[str, Any]) -> Iterator[dict[str, Any]]:
    """Yield every series config in an option, across all timeline variants."""
    for variant in _iter_option_variants(option):
        series = variant.get("series")
        if isinstance(series, dict):
            yield series
        elif isinstance(series, list):
            for entry in series:
                if isinstance(entry, dict):
                    yield entry


def _validate_supported_features(option: dict[str, Any]) -> None:
    """Reject option features that v1 cannot render.

    ECharts fails these late and unhelpfully — GL series draw nothing at all and
    only log to the browser console, while geo charts raise an internal
    ``TypeError`` — so they are caught here where the message can name the cause.
    """
    uses_geo = any(
        "geo" in variant for variant in _iter_option_variants(option)
    ) or any(series.get("coordinateSystem") == "geo" for series in _iter_series(option))

    for series in _iter_series(option):
        series_type = series.get("type")
        if series_type in _GL_SERIES_TYPES:
            raise StreamlitAPIException(
                f"The provided ECharts options use the `{series_type}` series, which "
                "requires the ECharts GL extension. `st.echarts_chart` does not "
                "support 3D or WebGL charts.",
                error_id="echarts-gl-series-not-supported",
            )
        if series_type == "map":
            uses_geo = True
        if series_type == "custom":
            raise StreamlitAPIException(
                "The provided ECharts options use a `custom` series, which requires "
                "a JavaScript `renderItem` callback. `st.echarts_chart` only "
                "supports JSON-compatible option objects, so custom series are not "
                "supported.",
                error_id="echarts-custom-series-not-supported",
            )

    if uses_geo:
        raise StreamlitAPIException(
            "The provided ECharts options use a map or geo coordinate system, which "
            "requires registering GeoJSON map data. `st.echarts_chart` does not "
            "support map charts.",
            error_id="echarts-map-charts-not-supported",
        )


def _convert_dataset_sources(option: dict[str, Any]) -> None:
    """Convert dataframe-like ``dataset.source`` values into JSON records.

    ECharts' ``dataset`` can be a single object or a list of objects; both are
    supported here (mirroring how ``st.vega_lite_chart`` ingests dataframes).
    """
    dataset = option.get("dataset")
    if isinstance(dataset, dict):
        _convert_single_dataset(dataset)
    elif isinstance(dataset, list):
        for entry in dataset:
            if isinstance(entry, dict):
                _convert_single_dataset(entry)


def _normalize_options(options: EChartsOptions) -> dict[str, Any]:
    """Normalize the ``options`` input into a JSON-compatible option dict.

    Accepts a Python ``Mapping``, a JSON string, or a duck-typed ``pyecharts``
    chart (an object with a callable ``dump_options`` method). Dataframe-like
    ``dataset.source`` values are converted to JSON records.
    """
    if isinstance(options, str):
        option = _loads_json_option(options)
    elif isinstance(options, Mapping):
        # Deep-copy before any mutation so the user's object is left untouched.
        option = copy.deepcopy(dict(options))
    elif callable(getattr(options, "dump_options", None)):
        # Duck-typed pyecharts chart (detected without importing pyecharts).
        option = _loads_json_option(options.dump_options())
    else:
        raise StreamlitInvalidParameterTypeError(
            "options",
            type(options).__name__,
            ["dict", "str", "pyecharts chart"],
        )

    if not isinstance(option, dict):
        raise StreamlitInvalidParameterTypeError(
            "options",
            type(option).__name__,
            ["dict"],
            detail="ECharts options must be a JSON object (mapping).",
        )

    _validate_supported_features(option)
    _convert_dataset_sources(option)
    return option


def _serialize_options(option: dict[str, Any]) -> str:
    """Strictly serialize the option dict to JSON for ``proto.spec``.

    ``allow_nan=False`` and the absence of a ``default`` fallback ensure that JS
    callbacks, arbitrary Python objects, and non-finite numbers surface a helpful
    error instead of being silently stringified.
    """
    try:
        return json.dumps(option, allow_nan=False)
    except (TypeError, ValueError) as ex:
        raise StreamlitAPIException(
            "The provided ECharts options are not JSON-serializable. "
            "`st.echarts_chart` only supports JSON-compatible option objects in "
            "v1: JavaScript callbacks, arbitrary Python objects, and non-finite "
            "numbers (NaN/Infinity) are not supported.",
            error_id="echarts-options-not-json-serializable",
        ) from ex


def _extract_pixel_dimension(value: Any) -> int | None:
    """Return a positive pixel dimension from an int/float or a ``"<n>px"`` string."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)) and value > 0:
        return int(value)
    if isinstance(value, str):
        match = re.match(r"^\s*(\d+(?:\.\d+)?)\s*px\s*$", value)
        if match:
            return int(float(match.group(1)))
    return None


def _resolve_content_width(width: Width, options: Any) -> Width:
    """Resolve "content" width, preferring a pyecharts chart's own width.

    For content width, we use a pyecharts chart's own ``width`` (e.g.
    ``"900px"``) when available; raw ECharts options have no intrinsic width, so
    they resolve to a fixed default of 700 pixels.
    """
    if width != "content":
        return width

    dimension = _extract_pixel_dimension(getattr(options, "width", None))
    if dimension is not None:
        return dimension

    return _DEFAULT_CONTENT_WIDTH


def _resolve_content_height(height: Height, options: Any) -> Height:
    """Resolve "content" height, preferring a pyecharts chart's own height.

    For content height, we use a pyecharts chart's own ``height`` (e.g.
    ``"500px"``) when available; raw ECharts options have no intrinsic height, so
    they resolve to a fixed default of 400 pixels.
    """
    if height != "content":
        return height

    dimension = _extract_pixel_dimension(getattr(options, "height", None))
    if dimension is not None:
        return dimension

    return _DEFAULT_CONTENT_HEIGHT


class EChartsMixin:
    @overload
    def echarts_chart(
        self,
        options: EChartsOptions,
        *,
        width: Width = "stretch",
        height: Height = "content",
        theme: Literal["streamlit"] | None = "streamlit",
        key: Key | None = None,
        on_select: Literal["ignore"] = "ignore",
        renderer: Literal["canvas", "svg"] = "canvas",
    ) -> DeltaGenerator: ...

    @overload
    def echarts_chart(
        self,
        options: EChartsOptions,
        *,
        width: Width = "stretch",
        height: Height = "content",
        theme: Literal["streamlit"] | None = "streamlit",
        key: Key | None = None,
        # No default: omitted on_select must match the "ignore" overload.
        on_select: Literal["rerun"] | WidgetCallback,
        renderer: Literal["canvas", "svg"] = "canvas",
    ) -> EChartsState: ...

    @gather_metrics("echarts_chart")
    def echarts_chart(
        self,
        options: EChartsOptions,
        *,
        width: Width = "stretch",
        height: Height = "content",
        theme: Literal["streamlit"] | None = "streamlit",
        key: Key | None = None,
        on_select: Literal["rerun", "ignore"] | WidgetCallback = "ignore",
        renderer: Literal["canvas", "svg"] = "canvas",
    ) -> DeltaGenerator | EChartsState:
        r"""Display an interactive Apache ECharts chart.

        `Apache ECharts <https://echarts.apache.org/>`_ is a powerful, open-source
        charting library with a large catalog of chart types (including gauges,
        sunbursts, sankey, graph/network, candlestick, radar, and more).

        To show an ECharts chart in Streamlit, pass an ECharts
        `option object <https://echarts.apache.org/en/option.html>`_ as a Python
        dictionary (the same JSON you would pass to ``setOption`` in JavaScript),
        a JSON string, or a ``pyecharts`` chart instance.

        .. note::
            ``st.echarts_chart`` supports only JSON-compatible option objects.
            Embedding JavaScript callbacks (e.g. ``formatter`` functions or
            ``renderItem``) is not supported. Most formatting needs are covered
            by ECharts' string-template formatters (e.g. ``"formatter": "{b}: {c}"``).

            Consequently, three families of ECharts charts are unavailable and
            raise an error: ``custom`` series (which require a ``renderItem``
            callback), map and geo charts (which require registering GeoJSON map
            data), and 3D or WebGL charts from the ECharts GL extension
            (``bar3D``, ``scatter3D``, ``globe``, and similar).

        Parameters
        ----------
        options : dict, str, or pyecharts chart
            The ECharts option object to render. This can be one of the following:

            - A Python ``dict`` matching the ECharts option object structure.
            - A JSON ``str`` (handy for copy-pasting an option from the ECharts
              examples gallery).
            - A ``pyecharts`` chart instance, which is detected through duck
              typing (the presence of a ``dump_options`` method) and converted
              automatically. ``pyecharts`` is not a Streamlit dependency.

            If your option object includes a ``dataset`` with a dataframe-like
            ``source`` (pandas, Polars, PyArrow, and others), Streamlit converts
            it to JSON records and preserves the column order through
            ``dataset.dimensions`` when you haven't set it.

        width : "stretch", "content", or int
            The width of the chart element. This can be one of the following:

            - ``"stretch"`` (default): The width of the element matches the
              width of the parent container.
            - ``"content"``: The width of the element matches the width of its
              content, but doesn't exceed the width of the parent container. For
              ``pyecharts`` charts, the chart's own width is used when available;
              otherwise, a fixed default of 700 pixels is used because ECharts
              options have no intrinsic width.
            - An integer specifying the width in pixels: The element has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the element matches the width
              of the parent container.

        height : "content", "stretch", or int
            The height of the chart element. This can be one of the following:

            - ``"content"`` (default): The height of the element matches the
              height of its content. For ``pyecharts`` charts, the chart's own
              height is used when available; otherwise, a fixed default of 400
              pixels is used because ECharts options have no intrinsic height.
            - ``"stretch"``: The height of the element matches the height of
              its content or the height of the parent container, whichever is
              larger. If the element is not in a parent container, the height
              of the element matches the height of its content.
            - An integer specifying the height in pixels: The element has a
              fixed height.

        theme : "streamlit" or None
            The theme of the chart. If ``theme`` is ``"streamlit"`` (default),
            Streamlit uses its own design default. If ``theme`` is ``None``,
            Streamlit falls back to ECharts' built-in default theme and leaves
            your ``options`` untouched, except that display-only charts (when
            ``on_select="ignore"``) still reset the series hover cursor to
            ``"default"`` so the chart does not look clickable. Set
            ``series.cursor`` yourself to override that cursor default; it is
            independent of theming and does not rewrite any other option keys.

            The ``"streamlit"`` theme can be partially customized through the
            configuration options ``theme.chartCategoricalColors`` and
            ``theme.chartSequentialColors``. Font configuration options are
            also applied.

        key : str, int, or None
            An optional string to use for giving this element a stable
            identity. ``key`` only affects identity when selections are
            activated (``on_select`` is ``"rerun"`` or a callback). Display-only
            charts (``on_select="ignore"``) do not compute an element ID, so
            ``key`` is ignored.

            If selections are activated and ``key`` is provided, Streamlit
            will register the key in Session State to store the selection
            state. The selection state is read-only. For more details, see
            `Widget behavior
            <https://docs.streamlit.io/develop/concepts/architecture/widget-behavior>`_.

            Additionally, when selections are activated and ``key`` is
            provided, it is also emitted as a CSS class name prefixed with
            ``st-key-``.

        on_select : "ignore", "rerun", or callable
            How the chart should respond to user selection events. This
            controls whether or not the chart behaves like an input widget.
            ``on_select`` can be one of the following:

            - ``"ignore"`` (default): Streamlit will not react to any selection
              events in the chart. The chart will not behave like an input
              widget.

            - ``"rerun"``: Streamlit will rerun the app when the user selects
              data in the chart. In this case, ``st.echarts_chart`` will return
              the selection data as a dictionary.

            - A ``callable``: Streamlit will rerun the app and execute the
              ``callable`` as a callback function before the rest of the app.
              In this case, ``st.echarts_chart`` will return the selection data
              as a dictionary.

            When ``on_select`` is not ``"ignore"``, Streamlit returns whatever
            selections you enable in your ``options``. Enable point selection by
            setting ``selectedMode`` on a series (for example,
            ``{"type": "bar", "selectedMode": "multiple", "data": [...]}``), and
            enable box/lasso selection by adding a
            `brush <https://echarts.apache.org/en/option.html#brush>`_ component.
            The selected points and brushed regions are returned in the
            ``EChartsState`` and re-applied visually after reruns. If your
            ``options`` don't enable any selection, no selection is returned even
            when ``on_select`` is active.

        renderer : "canvas" or "svg"
            The renderer passed to ECharts. This can be one of the following:

            - ``"canvas"`` (default): Best for large datasets.
            - ``"svg"``: Produces real DOM nodes that are better for printing,
              sharp scaling, and accessibility.

        Returns
        -------
        element or EChartsState
            If ``on_select`` is ``"ignore"`` (default), this command returns an
            internal placeholder for the chart element. Otherwise, this command
            returns an ``EChartsState`` object. This object is dictionary-like
            and supports both key and attribute notation. To use this type in
            an annotation, import it from ``streamlit.typing``.

        Examples
        --------
        **Example 1: Basic bar chart**

        .. code-block:: python
           :filename: streamlit_app.py

           import streamlit as st

           st.echarts_chart(
               {
                   "xAxis": {"type": "category", "data": ["A", "B", "C", "D", "E"]},
                   "yAxis": {"type": "value"},
                   "series": [{"type": "bar", "data": [5, 20, 36, 10, 10]}],
               }
           )

        .. output::
           https://doc-echarts-chart.streamlit.app/
           height: 400px

        **Example 2: Point selections driving the app**

        Set ``on_select="rerun"`` to make the chart behave like an input widget,
        and enable point selection in your ``options`` by setting
        ``selectedMode`` on the series. Streamlit returns the selected points.

        .. code-block:: python
           :filename: streamlit_app.py

           import streamlit as st

           options = {
               "xAxis": {
                   "type": "category",
                   "data": ["Mon", "Tue", "Wed", "Thu", "Fri"],
               },
               "yAxis": {"type": "value"},
               "series": [
                   {
                       "type": "bar",
                       "selectedMode": "multiple",
                       "data": [120, 200, 150, 80, 70],
                   }
               ],
           }

           event = st.echarts_chart(options, key="sales", on_select="rerun")

           st.write("You selected:", event.selection.points)

        .. output::
           https://doc-echarts-chart-selection.streamlit.app/
           height: 500px

        """
        validate_width(width, allow_content=True)
        validate_height(height, allow_content=True)

        if theme not in {"streamlit", None}:
            raise StreamlitValueError("theme", ["'streamlit'", "None"])

        if renderer not in {"canvas", "svg"}:
            raise StreamlitValueError("renderer", ["'canvas'", "'svg'"])

        if on_select not in {"ignore", "rerun"} and not callable(on_select):
            raise StreamlitValueError(
                "on_select", ["'rerun'", "'ignore'", "a callback function"]
            )

        key = to_key(key)
        is_selection_activated = on_select != "ignore"

        if is_selection_activated:
            # Run some checks that are only relevant when selections are activated
            is_callback = callable(on_select)
            check_widget_policies(
                self.dg,
                key,
                on_change=cast("WidgetCallback", on_select)  # ty: ignore[redundant-cast]
                if is_callback
                else None,
                default_value=None,
                writes_allowed=False,
                enable_check_callback_rules=is_callback,
            )

        normalized_options = _normalize_options(options)

        echarts_chart_proto = EChartsChartProto()
        echarts_chart_proto.spec = _serialize_options(normalized_options)
        echarts_chart_proto.theme = theme or ""
        echarts_chart_proto.renderer = (
            EChartsChartProto.Renderer.SVG
            if renderer == "svg"
            else EChartsChartProto.Renderer.CANVAS
        )

        # The backend only resolves the "content" default; the frontend handles
        # the actual layout.
        final_width = _resolve_content_width(width, options)
        final_height = _resolve_content_height(height, options)

        ctx = get_script_run_ctx()

        if is_selection_activated:
            # Selections are activated, treat the ECharts chart as a widget. The
            # element ID is only computed in this case (following the Vega-Lite
            # pattern); display-only charts intentionally have no ID.
            echarts_chart_proto.form_id = current_form_id(self.dg)
            echarts_chart_proto.id = compute_and_register_element_id(
                "echarts_chart",
                user_key=key,
                # With a key, the identity stays stable across data changes; only
                # the selection-relevant params participate. Without a key, all
                # params (including the normalized spec) participate, so a data
                # change resets the selection.
                key_as_main_identity={"renderer"},
                dg=self.dg,
                spec=echarts_chart_proto.spec,
                theme=theme,
                renderer=renderer,
                width=width,
                height=height,
            )

            serde = EChartsChartSelectionSerde()

            widget_state = register_widget(
                echarts_chart_proto.id,
                on_change_handler=on_select if callable(on_select) else None,
                deserializer=serde.deserialize,
                serializer=serde.serialize,
                ctx=ctx,
                value_type="string_value",
            )

            layout_config = LayoutConfig(width=final_width, height=final_height)
            self.dg._enqueue(
                "echarts_chart", echarts_chart_proto, layout_config=layout_config
            )
            return widget_state.value

        layout_config = LayoutConfig(width=final_width, height=final_height)
        return self.dg._enqueue(
            "echarts_chart", echarts_chart_proto, layout_config=layout_config
        )

    @property
    def dg(self) -> DeltaGenerator:
        """The associated DeltaGenerator."""
        return cast("DeltaGenerator", self)
