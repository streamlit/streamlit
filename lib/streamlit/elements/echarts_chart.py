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
    get_args,
    overload,
)

from streamlit import dataframe_util
from streamlit.elements.lib import agent_data, agent_spec, column_types
from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.layout_utils import (
    Height,
    LayoutConfig,
    Width,
    validate_height,
    validate_width,
)
from streamlit.elements.lib.policies import check_widget_policies
from streamlit.elements.lib.utils import (
    Key,
    compute_and_register_element_id,
    normalize_alt,
    to_key,
)
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitDataframeConversionError,
    StreamlitInvalidParameterTypeError,
    StreamlitValueError,
)
from streamlit.logger import get_logger
from streamlit.proto.EChartsChart_pb2 import EChartsChart as EChartsChartProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.runtime.state import (
    WidgetCallback,
    register_widget,
    validate_on_change_mode,
)
from streamlit.util import ReadOnlyAttributeDictionary, calc_hash

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


_LOGGER: Final = get_logger(__name__)

# ECharts option objects have no intrinsic dimensions, so "content" width/height
# resolve to these fixed defaults (unless a pyecharts chart exposes its own).
# The height mirrors the frontend's ``theme.sizes.defaultChartHeight`` token, so
# an ECharts chart lines up with the Vega-based charts (``st.line_chart`` and
# friends) that render at exactly that height. There is no matching width: the
# ``defaultChartWidth`` token is a Vega *view* dimension and does not correspond
# to any rendered content width, so this is a plain fallback.
#
# ``defaultChartHeight`` is ``21.875rem`` and therefore scales with
# ``theme.baseFontSize``. ``height="content"`` still sends this hard 350px,
# while ``height="stretch"`` uses the rem-based token as its CSS floor, so the
# two disagree under a non-default base font size. Moving content-height
# resolution to the frontend is out of scope for v1.
_DEFAULT_CONTENT_WIDTH: Final = 700
_DEFAULT_CONTENT_HEIGHT: Final = 350

# pyecharts always populates ``InitOpts`` with these values, even when the author
# never chose a size. Honoring them would make a pyecharts chart render at a
# different size than an equivalent dict spec, so they are treated as "unset".
_PYECHARTS_DEFAULT_WIDTH: Final = "900px"
_PYECHARTS_DEFAULT_HEIGHT: Final = "500px"

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

# Components from the same ECharts GL extension. Unlike the series types above
# these are top-level option keys, so they are matched per option variant.
_GL_COMPONENT_KEYS: Final = frozenset({"geo3D", "globe", "grid3D"})

# Series types from other ECharts extensions that Streamlit doesn't bundle,
# mapped to the package that provides them. This list is best-effort: any other
# third-party series also renders as an empty chart rather than raising.
_EXTENSION_SERIES_TYPES: Final = {
    "liquidFill": "echarts-liquidfill",
    "wordCloud": "echarts-wordcloud",
}

# Bare ``function (...)`` in a JSON string (pyecharts ``dump_options``). A
# substring match on ``"function"`` is too broad — it would treat a parse
# failure whose payload merely contains the word "function" as a callback.
_BARE_JS_FUNCTION: Final = re.compile(r"\bfunction\s*\(")

# pyecharts ``JsCode`` wraps JavaScript as ``--x_x--<code>--x_x--``.
# ``dump_options_with_quotes`` emits that encoding as a JSON string value.
_PYECHARTS_JSCODE_SENTINEL: Final = "--x_x--"

# The named formats a tooltip ``valueFormatter`` string accepts (the same set as
# ``st.metric``). Mirrors ``NAMED_NUMBER_FORMATS`` in the frontend's
# ``util/formatNumber.ts``.
_NAMED_NUMBER_FORMATS: Final = frozenset(get_args(column_types.NumberFormat))

# One token of a printf-style format string: literal text, an escaped ``%%``, or
# a placeholder. The alternatives and their order mirror the parser of the
# frontend's vendored sprintf (``frontend/lib/src/vendor/sprintf.js``), so a
# string this rejects would also fail there.
_PRINTF_TOKEN: Final = re.compile(
    r"[^%]+|%%|(?P<placeholder>%(?:[1-9][0-9]*\$|\([^)]+\))?\+?(?:0|'[^$])?-?"
    r"[,_]?[0-9]*(?:\.[0-9]+)?[b-gijostTuvxX])"
)


class EChartsCompatible(Protocol):
    """Duck-typed protocol for objects convertible to an ECharts option.

    ``pyecharts`` charts implement ``dump_options`` to emit a JSON string, so
    they satisfy this protocol without ``pyecharts`` being a Streamlit
    dependency.
    """

    def dump_options(self) -> str: ...


# Input accepted by ``st.echarts_chart``: an option ``Mapping``, a JSON string,
# or a duck-typed ``pyecharts`` chart.
EChartsSpec: TypeAlias = Mapping[str, Any] | str | EChartsCompatible


class EChartsSelectionState(ReadOnlyAttributeDictionary):
    """
    The schema for the ECharts chart selection state.

    The selection state is stored in a read-only dictionary-like object that
    supports both key and attribute notation. Selection states cannot be
    programmatically changed or set through Session State.

    This is a Streamlit-normalized snapshot of ECharts selection events, not
    the raw ``selectchanged`` or ``brushSelected`` payload. Exposed field
    names use ``snake_case``; ECharts string values, such as
    ``brush_type="lineX"``, remain unchanged.

    Empty series groups that ECharts emits are omitted, so ``selected[0]`` is
    the first series that has a selection, not necessarily series 0. Iterate
    the groups and match ``series_index``. A brush region can appear in
    ``areas`` even when it hits no data (``selected`` is empty).

    Attributes
    ----------
    selected : list[dict[str, Any]]
        The union of native and brushed selections, grouped by ECharts series
        and data type. Each entry contains ``series_index``, ``series_id``,
        ``series_name``, ``data_type``, and ``data_indices``. Series IDs and
        names are ``None`` when they weren't explicitly configured.

        ``data_type`` is ``"main"`` (used when ECharts omits ``dataType``),
        ``"node"``, or ``"edge"``.

        ``data_indices`` is sorted and series-local. For a dataset without
        transforms, it addresses ``dataset.source`` rows. For inline series,
        it addresses ``series.data``. For graph series, ``data_type="node"``
        addresses ``data`` and ``data_type="edge"`` addresses ``links``.

    areas : list[dict[str, Any]]
        The active brush regions. Each entry contains ``brush_index``,
        ``brush_type``, and ``coord_range``. ``brush_type`` is ECharts'
        ``"rect"``, ``"lineX"``, ``"lineY"``, or ``"polygon"``. The shape of
        ``coord_range`` depends on that type: ``"rect"`` uses
        ``[[x0, x1], [y0, y1]]``; ``"lineX"`` and ``"lineY"`` use
        ``[start, end]``; ``"polygon"`` uses ``[[x, y], ...]``. Category-axis
        coordinates are ordinal positions and can include half-indices such
        as ``[0.5, 3.5]``. Regions that ECharts only describes in pixel space
        are omitted, since their geometry can't be mapped back to your data.

    Example
    -------
    Selecting points and a rect brush returns a grouped, series-local payload:

    >>> {
    ...     "selected": [
    ...         {
    ...             "series_index": 0,
    ...             "series_id": "sales",
    ...             "series_name": "Sales",
    ...             "data_type": "main",
    ...             "data_indices": [1, 2, 3],
    ...         },
    ...     ],
    ...     "areas": [
    ...         {
    ...             "brush_index": 0,
    ...             "brush_type": "rect",
    ...             "coord_range": [[0, 2], [10, 20]],
    ...         },
    ...     ],
    ... }

    If ``event`` is the return value of ``st.echarts_chart`` and ``df`` holds
    the data of a single series, filter it with:

    >>> rows = (
    ...     event.selection.selected[0]["data_indices"]
    ...     if event.selection.selected
    ...     else []
    ... )
    >>> filtered_df = df.iloc[rows]

    """

    selected: list[dict[str, Any]]
    areas: list[dict[str, Any]]

    @overload
    def __getitem__(self, key: Literal["selected"]) -> list[dict[str, Any]]: ...

    @overload
    def __getitem__(self, key: Literal["areas"]) -> list[dict[str, Any]]: ...

    @overload
    def __getitem__(self, key: Any) -> Any: ...

    def __getitem__(self, key: Any) -> Any:
        return super().__getitem__(key)


class EChartsState(ReadOnlyAttributeDictionary):
    """
    The schema for the ECharts chart event state.

    To use this type in an annotation, import it from ``streamlit.typing``.

    The event state is stored in a read-only dictionary-like object that
    supports both key and attribute notation. Event states cannot be
    programmatically changed or set through Session State.

    Only selection events are supported at this time.

    ``selection`` is the Streamlit-normalized payload described by
    ``EChartsSelectionState``, not a raw ECharts event.

    Attributes
    ----------
    selection : dict
        The state of the ``on_select`` event. This attribute returns a
        dictionary-like object that supports both key and attribute notation.
        The attributes are described by the ``EChartsSelectionState`` dictionary
        schema.

    Example
    -------
    The event state wraps that selection payload:

    >>> {
    ...     "selection": {
    ...         "selected": [
    ...             {
    ...                 "series_index": 0,
    ...                 "series_id": "sales",
    ...                 "series_name": "Sales",
    ...                 "data_type": "main",
    ...                 "data_indices": [1, 2, 3],
    ...             },
    ...         ],
    ...         "areas": [
    ...             {
    ...                 "brush_index": 0,
    ...                 "brush_type": "rect",
    ...                 "coord_range": [[0, 2], [10, 20]],
    ...             },
    ...         ],
    ...     }
    ... }

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
    """Serialize and deserialize the ECharts chart selection state."""

    def deserialize(self, ui_value: str | None) -> EChartsState:
        empty_selection_state: dict[str, Any] = {
            "selection": {
                "selected": [],
                "areas": [],
            },
        }

        selection_state: Any = (
            empty_selection_state if ui_value is None else json.loads(ui_value)
        )

        if "selection" not in selection_state:  # pragma: no cover - defensive
            selection_state = empty_selection_state
        else:
            selection_state["selection"].setdefault("selected", [])
            selection_state["selection"].setdefault("areas", [])

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
        "The provided ECharts spec contains JavaScript callbacks (e.g. "
        "`function` values or `JsCode`), which `st.echarts_chart` does not "
        "support. Only JSON-compatible option objects are supported. Use "
        "ECharts string-template formatters instead of JavaScript functions.",
        error_id="echarts-js-callbacks-not-supported",
    )


def _unparsed_suffix_looks_like_js_callback(raw: str, ex: BaseException) -> bool:
    """True if a parse failure looks like a JS function rather than bad JSON.

    Restricts the search to the unparsed suffix so a ``=>`` or ``function (``
    inside an already-consumed JSON string (for example an unterminated object
    whose title text contains ``=>``) is not misreported as a callback.
    """
    start = ex.pos if isinstance(ex, json.JSONDecodeError) else 0
    rest = raw[start:]
    return _BARE_JS_FUNCTION.search(rest) is not None or "=>" in rest


def _contains_pyecharts_jscode(value: Any) -> bool:
    """True if any string value is a pyecharts ``JsCode`` encoding.

    ``pyecharts`` wraps JavaScript as ``--x_x--<code>--x_x--``. A label that
    merely contains the sentinel text is not a callback.
    """
    if isinstance(value, str):
        stripped = value.strip()
        return (
            stripped.startswith(_PYECHARTS_JSCODE_SENTINEL)
            and stripped.endswith(_PYECHARTS_JSCODE_SENTINEL)
            and len(stripped) > 2 * len(_PYECHARTS_JSCODE_SENTINEL)
        )
    if isinstance(value, dict):
        return any(_contains_pyecharts_jscode(item) for item in value.values())
    if isinstance(value, (list, tuple)):
        return any(_contains_pyecharts_jscode(item) for item in value)
    return False


def _loads_json_option(raw: str) -> Any:
    """Parse a raw JSON option string, raising a helpful error on failure."""
    try:
        option = json.loads(raw)
    except (json.JSONDecodeError, TypeError, ValueError) as ex:
        if _unparsed_suffix_looks_like_js_callback(raw, ex):
            raise _js_callback_error() from ex
        raise StreamlitAPIException(
            "The provided ECharts spec could not be parsed as JSON. "
            "`st.echarts_chart` only supports JSON-compatible option objects.",
            error_id="echarts-spec-invalid-json",
        ) from ex
    # ``dump_options_with_quotes`` produces valid JSON whose string values
    # still embed the ``--x_x--`` JsCode encoding. Detect that on parsed
    # values so a title that merely mentions the sentinel is accepted.
    if _contains_pyecharts_jscode(option):
        raise _js_callback_error()
    return option


def _convert_single_dataset(
    dataset: dict[str, Any], arrow_datasets: dict[str, bytes]
) -> None:
    """Replace a single ``dataset`` dict's dataframe-like ``source`` in place.

    The serialized table is added to ``arrow_datasets`` under its content
    hash, and ``source`` becomes a ``{"name": <hash>}`` reference to it, so
    identical frames share one entry.
    """
    source = dataset.get("source")
    if source is None or not dataframe_util.is_dataframe_like(source):
        return

    # Dataframe and PyArrow conversions raise plain TypeError and ValueError
    # for unsupported values, such as duplicate pandas column names.
    conversion_errors: tuple[type[BaseException], ...] = (
        StreamlitDataframeConversionError,
        *dataframe_util.get_arrow_conversion_errors(),
        TypeError,
        ValueError,
    )
    try:
        data_bytes = dataframe_util.convert_anything_to_arrow_bytes(source)
    except conversion_errors as ex:
        raise StreamlitDataframeConversionError(
            "The provided ECharts `dataset.source` could not be converted for "
            "display. Convert or drop the columns that cannot be serialized "
            "(for example, cast object columns to strings, or call "
            f"`.sparse.to_dense()` on sparse columns).\n\n{ex}",
            error_id="echarts-dataset-not-arrow-serializable",
        ) from ex

    name = calc_hash(data_bytes)
    arrow_datasets.setdefault(name, data_bytes)
    dataset["source"] = {"name": name}


def _iter_sequence_entries(value: Any, key: str) -> Iterator[Any]:
    """Yield entries of a list-valued option key, or raise if it is malformed."""
    if value is None:
        return
    if not isinstance(value, (list, tuple)):
        raise StreamlitAPIException(
            f"The provided ECharts spec has a `{key}` value that is not a list. "
            "`st.echarts_chart` only supports JSON-compatible option objects.",
            error_id="echarts-spec-invalid-structure",
        )
    yield from value


def _iter_media_options(option: dict[str, Any]) -> Iterator[dict[str, Any]]:
    """Yield each ``media[*].option`` override on an option object."""
    for media_entry in _iter_sequence_entries(option.get("media"), "media"):
        if isinstance(media_entry, dict):
            media_option = media_entry.get("option")
            if isinstance(media_option, dict):
                yield media_option


def _iter_option_variants(option: dict[str, Any]) -> Iterator[dict[str, Any]]:
    """Yield the option itself plus timeline and media variants.

    Timeline specs keep the chart under ``baseOption`` and per-tick overrides
    under ``options``. Responsive specs keep breakpoint overrides under
    ``media[*].option``. Series and datasets can live in any of those places.
    """
    yield option
    yield from _iter_media_options(option)
    base_option = option.get("baseOption")
    if isinstance(base_option, dict):
        yield base_option
        yield from _iter_media_options(base_option)
    for timeline_option in _iter_sequence_entries(option.get("options"), "options"):
        if isinstance(timeline_option, dict):
            yield timeline_option
            yield from _iter_media_options(timeline_option)


def _iter_config_entries(value: Any) -> Iterator[dict[str, Any]]:
    """Yield the dicts of a value that is one dict or a list or tuple of dicts.

    Used for option keys such as ``series`` and ``tooltip``.
    """
    if isinstance(value, dict):
        yield value
    elif isinstance(value, (list, tuple)):
        for entry in value:
            if isinstance(entry, dict):
                yield entry


def _author_aria_label_description(option: dict[str, Any]) -> str | None:
    """Return a non-empty author ``aria.label.description`` if present.

    Walks top-level, timeline, and media option variants. Empty or
    whitespace-only descriptions are ignored.
    """
    for variant in _iter_option_variants(option):
        aria = variant.get("aria")
        if not isinstance(aria, dict):
            continue
        label = aria.get("label")
        if not isinstance(label, dict):
            continue
        description = label.get("description")
        if isinstance(description, str) and description.strip():
            return description
    return None


def _iter_series(option: dict[str, Any]) -> Iterator[dict[str, Any]]:
    """Yield every series config across top-level, timeline, and media variants."""
    for variant in _iter_option_variants(option):
        yield from _iter_config_entries(variant.get("series"))


def _enables_selection(option: dict[str, Any]) -> bool:
    """Return whether the spec configures a selection ECharts can emit.

    Selection is opt-in through the user's own option keys: ``selectedMode`` on
    a series for point selection, or a ``brush`` component for region selection.
    A ``toolbox`` brush feature counts too, since it drives the same brush
    events. Only ``series`` entries are inspected, so ``legend.selectedMode``
    (a different feature that happens to share the name) is not mistaken for
    data selection.
    """
    for variant in _iter_option_variants(option):
        if "brush" in variant:
            return True
        toolbox = variant.get("toolbox")
        # ECharts accepts a single toolbox or a list/tuple of them.
        for entry in toolbox if isinstance(toolbox, (list, tuple)) else [toolbox]:
            if (
                isinstance(entry, dict)
                and isinstance(feature := entry.get("feature"), dict)
                and "brush" in feature
            ):
                return True

    return any(series.get("selectedMode") for series in _iter_series(option))


def _validate_supported_features(option: dict[str, Any]) -> None:
    """Reject option features that v1 cannot render.

    ECharts fails these late and unhelpfully — GL series draw nothing at all and
    only log to the browser console, while geo charts raise an internal
    ``TypeError`` — so they are caught here where the message can name the cause.
    """
    uses_geo = any(
        "geo" in variant for variant in _iter_option_variants(option)
    ) or any(series.get("coordinateSystem") == "geo" for series in _iter_series(option))

    gl_components = sorted(
        component
        for variant in _iter_option_variants(option)
        for component in _GL_COMPONENT_KEYS & variant.keys()
    )
    if gl_components:
        raise StreamlitAPIException(
            f"The provided ECharts spec uses the `{gl_components[0]}` component, "
            "which requires the ECharts GL extension. `st.echarts_chart` does not "
            "support 3D or WebGL charts.",
            error_id="echarts-gl-series-not-supported",
        )

    for series in _iter_series(option):
        series_type = series.get("type")
        if series_type in _GL_SERIES_TYPES:
            raise StreamlitAPIException(
                f"The provided ECharts spec uses the `{series_type}` series, which "
                "requires the ECharts GL extension. `st.echarts_chart` does not "
                "support 3D or WebGL charts.",
                error_id="echarts-gl-series-not-supported",
            )
        if isinstance(series_type, str) and (
            extension := _EXTENSION_SERIES_TYPES.get(series_type)
        ):
            raise StreamlitAPIException(
                f"The provided ECharts spec uses the `{series_type}` series, which "
                f"requires the `{extension}` extension. `st.echarts_chart` bundles "
                "only core ECharts, so this chart would render empty.",
                error_id="echarts-extension-series-not-supported",
            )
        if series_type == "map":
            uses_geo = True
        if series_type == "custom":
            raise StreamlitAPIException(
                "The provided ECharts spec uses a `custom` series, which requires "
                "a JavaScript `renderItem` callback. `st.echarts_chart` only "
                "supports JSON-compatible option objects, so custom series are not "
                "supported.",
                error_id="echarts-custom-series-not-supported",
            )

    if uses_geo:
        raise StreamlitAPIException(
            "The provided ECharts spec uses a map or geo coordinate system, which "
            "requires registering GeoJSON map data. `st.echarts_chart` does not "
            "support map charts.",
            error_id="echarts-map-charts-not-supported",
        )


def _iter_tooltips(option: dict[str, Any]) -> Iterator[dict[str, Any]]:
    """Yield top-level and series tooltip configs across option variants.

    Skips per-data-item tooltips, which the frontend does not convert either.
    """
    for variant in _iter_option_variants(option):
        yield from _iter_config_entries(variant.get("tooltip"))
    for series in _iter_series(option):
        yield from _iter_config_entries(series.get("tooltip"))


def _is_printf_format(value: str) -> bool:
    """Whether ``value`` parses as printf and has at least one placeholder.

    A string without a placeholder (an escaped ``%%`` is not one) would print
    the same text for every value.
    """
    has_placeholder = False
    position = 0
    while position < len(value):
        token = _PRINTF_TOKEN.match(value, position)
        if token is None:
            return False
        has_placeholder = has_placeholder or token["placeholder"] is not None
        position = token.end()
    return has_placeholder


def _is_number_format(value: Any) -> bool:
    """Whether ``value`` is a named number format or a printf-style string."""
    return isinstance(value, str) and (
        value in _NAMED_NUMBER_FORMATS or _is_printf_format(value)
    )


def _warn_on_unsupported_value_formatters(option: dict[str, Any]) -> None:
    """Log tooltip ``valueFormatter`` values that are not number formats.

    ECharts only accepts a function there, which a JSON spec cannot carry, so
    Streamlit reads a string as a number format. The frontend drops any other
    value and keeps the default tooltip formatting, so the chart still renders.
    """
    for tooltip in _iter_tooltips(option):
        value_formatter = tooltip.get("valueFormatter")
        if value_formatter is None or _is_number_format(value_formatter):
            continue
        message = (
            "The provided ECharts spec sets a tooltip `valueFormatter` of "
            f"{value_formatter!r}, which is not a number format, so Streamlit "
            "ignores it and uses the default tooltip formatting. Use a named "
            'format such as "dollar" or "compact", or a printf-style string '
            'such as "%.2f" (for example, "%.2f €" instead of "{value} €").'
        )
        _LOGGER.warning("%s", message, stack_info=True)


def _convert_datasets_in_variant(
    option: dict[str, Any], arrow_datasets: dict[str, bytes]
) -> None:
    """Convert dataframe-like ``dataset.source`` values on a single option variant."""
    dataset = option.get("dataset")
    if isinstance(dataset, dict):
        _convert_single_dataset(dataset, arrow_datasets)
    elif isinstance(dataset, (list, tuple)):
        for entry in dataset:
            if isinstance(entry, dict):
                _convert_single_dataset(entry, arrow_datasets)


def _convert_dataset_sources(option: dict[str, Any]) -> dict[str, bytes]:
    """Replace dataframe-like ``dataset.source`` values with named Arrow datasets.

    ECharts' ``dataset`` can be a single object or a list/tuple of objects;
    both are supported here (mirroring how ``st.vega_lite_chart`` ingests
    dataframes). Timeline specs nest datasets under ``baseOption`` and per-tick
    ``options``, and responsive specs nest them under ``media[*].option``, so
    those variants are converted too.

    Returns the Arrow IPC bytes of each distinct frame keyed by the name left
    in its ``source``, in the order the frames were first found.
    """
    arrow_datasets: dict[str, bytes] = {}
    for variant in _iter_option_variants(option):
        _convert_datasets_in_variant(variant, arrow_datasets)
    return arrow_datasets


def _copy_option_for_normalization(value: Any) -> Any:
    """Copy option dicts we may mutate, leaving dataframe sources in place.

    A full ``deepcopy`` would copy ``dataset.source`` dataframes (wasted work on
    the conversion path) and fail on deepcopy-unsafe sources that
    ``is_dataframe_like`` otherwise accepts. Primitive arrays such as
    ``series.data`` are shared with the input.
    """
    if isinstance(value, dict):
        copied: dict[str, Any] = {}
        for key, item in value.items():
            if key == "source" and dataframe_util.is_dataframe_like(item):
                copied[key] = item
            else:
                copied[key] = _copy_option_for_normalization(item)
        return copied
    if isinstance(value, (list, tuple)):
        if any(isinstance(item, dict) for item in value):
            copied_items = [_copy_option_for_normalization(item) for item in value]
            return copied_items if isinstance(value, list) else tuple(copied_items)
        return value
    return value


def _normalize_spec(spec: EChartsSpec) -> tuple[dict[str, Any], dict[str, bytes]]:
    """Normalize the ``spec`` input into a JSON-compatible ECharts option dict.

    Accepts a Python ``Mapping``, a JSON string, or a duck-typed ``pyecharts``
    chart (an object with a callable ``dump_options`` method). Dataframe-like
    ``dataset.source`` values are replaced with named Arrow datasets, which are
    returned next to the option (see ``_convert_dataset_sources``).
    """
    if isinstance(spec, str):
        option = _loads_json_option(spec)
    elif isinstance(spec, Mapping):
        # Copy option/dataset dicts before mutation so the user's object is
        # left untouched, without deepcopying dataframe sources.
        option = _copy_option_for_normalization(dict(spec))
    elif callable(getattr(spec, "dump_options", None)):
        # Duck-typed pyecharts chart (detected without importing pyecharts).
        option = _loads_json_option(spec.dump_options())
    else:
        raise StreamlitInvalidParameterTypeError(
            "spec",
            type(spec).__name__,
            ["dict", "str", "pyecharts chart"],
        )

    if not isinstance(option, dict):
        raise StreamlitInvalidParameterTypeError(
            "spec",
            type(option).__name__,
            ["dict"],
            detail="An ECharts spec must be a JSON object (mapping).",
        )

    _validate_supported_features(option)
    _warn_on_unsupported_value_formatters(option)
    arrow_datasets = _convert_dataset_sources(option)
    return option, arrow_datasets


def _serialize_option(option: dict[str, Any]) -> str:
    """Strictly serialize the option dict to JSON for ``proto.spec``.

    ``allow_nan=False`` and the absence of a ``default`` fallback ensure that JS
    callbacks, arbitrary Python objects, and non-finite numbers surface a helpful
    error instead of being silently stringified.
    """
    try:
        return json.dumps(option, allow_nan=False, separators=(",", ":"))
    except (TypeError, ValueError) as ex:
        raise StreamlitAPIException(
            "The provided ECharts spec is not JSON-serializable. "
            "`st.echarts_chart` only supports JSON-compatible option objects: "
            "JavaScript callbacks, arbitrary Python objects, and non-finite "
            "numbers (NaN/Infinity) are not supported. Dataframes are converted "
            "automatically only inside `dataset.source`; anywhere else (for "
            "example `series.data`) convert them to plain lists first.",
            error_id="echarts-spec-not-json-serializable",
        ) from ex


def _extract_chart_dimension(
    value: Any, library_default: str, parameter: str
) -> int | Literal["stretch"] | None:
    """Resolve a pyecharts chart's own ``InitOpts`` width or height.

    Returns a positive pixel size, ``"stretch"`` for a full-width/height value,
    or ``None`` when Streamlit's own content default should be used instead.
    """
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int(value) if value > 0 else None
    if not isinstance(value, str):
        return None

    dimension = value.strip()
    if not dimension:
        return None
    if dimension == library_default:
        # pyecharts' own default rather than a size the author chose.
        return None
    if dimension == "100%":
        return "stretch"

    match = re.match(r"^\s*(\d+(?:\.\d+)?)\s*px\s*$", dimension)
    if match:
        pixels = int(float(match.group(1)))
        return pixels if pixels > 0 else None

    # Any other CSS unit (em, vh, a non-100 percentage, ...) has no meaningful
    # translation to Streamlit's sizing, and pyecharts may have set it without
    # the user's involvement, so fall back to the default instead of raising.
    _LOGGER.warning(
        "The pyecharts chart passed to `st.echarts_chart` sets an unsupported "
        "`%s` of %r. Only pixel values and `100%%` are supported, so Streamlit's "
        "default is used instead. Set the `%s` parameter of `st.echarts_chart` "
        "to size the chart explicitly.",
        parameter,
        dimension,
        parameter,
        stack_info=True,
    )
    return None


def _resolve_content_width(width: Width, spec: Any) -> Width:
    """Resolve "content" width, preferring a pyecharts chart's own width.

    For content width, we use a pyecharts chart's explicitly chosen ``width``
    (e.g. ``"640px"``) when there is one; a raw ECharts spec has no intrinsic
    width, so it resolves to a fixed default of 700 pixels.
    """
    if width != "content":
        return width

    dimension = _extract_chart_dimension(
        getattr(spec, "width", None), _PYECHARTS_DEFAULT_WIDTH, "width"
    )
    if dimension is not None:
        return dimension

    return _DEFAULT_CONTENT_WIDTH


def _resolve_content_height(height: Height, spec: Any) -> Height:
    """Resolve "content" height, preferring a pyecharts chart's own height.

    For content height, we use a pyecharts chart's explicitly chosen ``height``
    (e.g. ``"360px"``) when there is one; a raw ECharts spec has no intrinsic
    height, so it resolves to a fixed default of 350 pixels.
    """
    if height != "content":
        return height

    dimension = _extract_chart_dimension(
        getattr(spec, "height", None), _PYECHARTS_DEFAULT_HEIGHT, "height"
    )
    if dimension is not None:
        return dimension

    return _DEFAULT_CONTENT_HEIGHT


def _echarts_data(
    proto: EChartsChartProto, *, coordinates: str
) -> dict[str, Any] | None:
    """Build the agent ``data`` block for an ECharts chart.

    - No Arrow dataset: the option holds all values, so it is reported as
      complete.
    - One dataset: the table is summarized and served like a dataframe, with
      the option (holding its ``{"name": <hash>}`` placeholder) under ``spec``.
    - Several datasets: no single table describes the chart, so none is served.
    """
    datasets = proto.datasets
    if not datasets:
        return agent_data.raw_spec(proto.spec)

    data: dict[str, Any]
    if len(datasets) > 1:
        data = agent_data.unavailable("multiple_datasets")
    else:
        # agent_data.arrow returns None for empty bytes and for bytes that can
        # neither be summarized nor served. A converted dataset is never
        # empty, and in a recording session only server.maxMessageSize
        # prevents serving.
        data = agent_data.arrow(
            datasets[0].data.data, coordinates=coordinates
        ) or agent_data.unavailable("too_large_to_serve")
    spec = agent_data.parse_spec(proto.spec)
    if spec is not None:
        data["spec"] = spec
    return data


class EChartsMixin:
    @overload
    def echarts_chart(
        self,
        spec: EChartsSpec,
        *,
        width: Width = "stretch",
        height: Height = "content",
        theme: Literal["streamlit"] | None = "streamlit",
        key: Key | None = None,
        on_select: Literal["ignore"] = "ignore",
        renderer: Literal["canvas", "svg"] = "canvas",
        alt: str | None = None,
    ) -> DeltaGenerator: ...

    @overload
    def echarts_chart(
        self,
        spec: EChartsSpec,
        *,
        width: Width = "stretch",
        height: Height = "content",
        theme: Literal["streamlit"] | None = "streamlit",
        key: Key | None = None,
        # No default: omitted on_select must match the "ignore" overload.
        on_select: Literal["rerun"] | WidgetCallback,
        renderer: Literal["canvas", "svg"] = "canvas",
        alt: str | None = None,
    ) -> EChartsState: ...

    @gather_metrics("echarts_chart")
    def echarts_chart(
        self,
        spec: EChartsSpec,
        *,
        width: Width = "stretch",
        height: Height = "content",
        theme: Literal["streamlit"] | None = "streamlit",
        key: Key | None = None,
        on_select: Literal["rerun", "ignore"] | WidgetCallback = "ignore",
        renderer: Literal["canvas", "svg"] = "canvas",
        alt: str | None = None,
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
            ``renderItem``) is not supported. Use ECharts' string templates
            instead (e.g. ``"formatter": "{b}: {c}"``). To format tooltip
            values, see the tooltip note below.

            Consequently, three families of ECharts charts are unavailable and
            raise an error: ``custom`` series (which require a ``renderItem``
            callback), map and geo charts (which require registering GeoJSON map
            data), and 3D or WebGL charts from the ECharts GL extension
            (``bar3D``, ``scatter3D``, ``globe``, and similar).

        .. note::
            Strings in the option object (``title.text``, legend names, labels)
            are rendered by ECharts as plain text. Streamlit markdown does not
            apply inside ``spec``. Put formatted copy in |st.markdown|_ next
            to the chart instead.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        .. note::
            Streamlit extends two tooltip options so you can format tooltips
            without JavaScript. Both work in ``tooltip`` and
            ``series[i].tooltip``. Per-item tooltips inside ``series[i].data``
            support neither, so set these options on the series instead:

            - ``valueFormatter`` accepts a number format string, which formats
              each value in the default tooltip. Use a named format
              (``"plain"``, ``"localized"``, ``"dollar"``, ``"euro"``,
              ``"yen"``, ``"percent"``, ``"compact"``, ``"scientific"``,
              ``"engineering"``, ``"accounting"``, or ``"bytes"``) or a
              printf-style format string (e.g. ``"%,d sessions"``). These are
              the same formats as in |st.metric|_. ``"percent"`` multiplies
              values by 100. One format applies to every value of a series, so
              use ``encode.tooltip`` to choose which dimensions the tooltip
              shows. Streamlit ignores any other value, including a malformed
              printf-style string, and the tooltip keeps its default
              formatting.
            - String ``formatter`` templates in tooltips expand the
              ``{@dimension}`` and ``{@[index]}`` placeholders, which ECharts
              otherwise supports only in series labels (e.g.
              ``"{b}: {@[2]} sessions"``). In an axis tooltip, they read the
              first series. Template values are inserted as escaped text,
              without a number format. The template itself is HTML, as in any
              other ECharts tooltip string.

            .. |st.metric| replace:: ``st.metric``
            .. _st.metric: https://docs.streamlit.io/develop/api-reference/data/st.metric

        .. note::
            To keep large charts fast, Streamlit sets two ECharts options when
            your ``spec`` doesn't set them. It counts the items in each
            series' ``data`` or in its dataset's ``source``:

            - ``"large": True`` on ``scatter`` series with at least 20,000
              points and on ``bar`` series with more than 2,000 bars. ECharts
              then draws each series in a few batched paths instead of one
              shape per item, which loads much faster. At these sizes ECharts
              already skips animations. Tooltips still work, but hovering no
              longer highlights an item.
            - ``"showSymbol": False`` on ``line`` series with more than 2,000
              points on a value or time axis, where the symbols would merge
              into a solid band. An axis tooltip
              (``"tooltip": {"trigger": "axis"}``) still marks the hovered
              point.

            Streamlit leaves a series unchanged if these options would change
            how it looks or behaves. For example, it skips series with
            per-item styles or labels, charts with selections (``on_select``,
            ``selectedMode``, or a ``brush``) or a ``visualMap``, and line
            charts with an item tooltip or a ``dataZoom``. To opt out, set the
            option yourself, for example ``"large": False``. For line charts
            with even more points, you can set ``"sampling": "lttb"``, which
            draws a subset of points that keeps the line's shape. Streamlit
            doesn't set it for you because it changes which points are drawn
            and which points tooltips show.

        Parameters
        ----------
        spec : dict, str, or pyecharts chart
            The ECharts option object to render. This can be one of the following:

            - A Python ``dict`` matching the ECharts option object structure.
            - A JSON ``str`` (handy for copy-pasting an option from the ECharts
              examples gallery).
            - A ``pyecharts`` chart instance, which is detected through duck
              typing (the presence of a ``dump_options`` method) and converted
              automatically. ``pyecharts`` is not a Streamlit dependency.

            If your option object includes a ``dataset`` with a dataframe-like
            ``source`` (pandas, Polars, PyArrow, and others), Streamlit passes
            its rows to ECharts and keeps the column order through
            ``dataset.dimensions`` when you haven't set it. The dataframe index
            isn't included, so use ``df.reset_index()`` to plot it. Datetimes
            become ISO-8601 strings (in UTC if timezone-aware), durations become
            milliseconds, and missing values become ``null``. Other non-numeric
            values use the text ``st.dataframe`` shows.

        width : "stretch", "content", or int
            The width of the chart element. This can be one of the following:

            - ``"stretch"`` (default): The width of the element matches the
              width of the parent container.
            - ``"content"``: The width of the element matches the width of its
              content, but doesn't exceed the width of the parent container.
              Because an ECharts spec has no intrinsic width, this is a fixed
              default of 700 pixels, unless a ``pyecharts`` chart sets its own
              width through ``InitOpts`` (``pyecharts``' library default is
              ignored, and ``"100%"`` is treated as ``"stretch"``).
            - An integer specifying the width in pixels: The element has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the element matches the width
              of the parent container.

        height : "content", "stretch", or int
            The height of the chart element. This can be one of the following:

            - ``"content"`` (default): The height of the element matches the
              height of its content. Because an ECharts spec has no intrinsic
              height, this is a fixed default of 350 pixels — matching
              ``st.line_chart`` and the other Vega-based charts — unless a
              ``pyecharts`` chart sets its own height through ``InitOpts``
              (``pyecharts``' library default is ignored, and ``"100%"`` is
              treated as ``"stretch"``).
            - ``"stretch"``: The height of the element matches the height of
              its content or the height of the parent container, whichever is
              larger. If the element is not in a parent container, the height
              of the element matches the height of its content.
            - An integer specifying the height in pixels: The element has a
              fixed height.

        theme : "streamlit" or None
            The theme of the chart. If ``theme`` is ``"streamlit"`` (default),
            Streamlit applies its own colors, fonts, and plot layout. If
            ``theme`` is ``None``, Streamlit leaves your ``spec``'s styling
            untouched and uses ECharts' built-in default theme.

            Two defaults still apply when ``theme`` is ``None``:

            - Accessibility: ``aria.enabled`` stays on so the chart keeps a
              screen-reader description unless you set ``aria`` yourself.
            - Display-only cursor: for charts with ``on_select="ignore"``, a
              missing ``series.cursor`` is set to ``"default"`` so the chart
              does not look clickable. Set ``series.cursor`` yourself to
              override it.

            The ``"streamlit"`` theme can be partially customized through the
            configuration options ``theme.chartCategoricalColors`` and
            ``theme.chartSequentialColors``. Font configuration options are
            also applied, and long tooltip numbers are shortened. Set
            ``tooltip.valueFormatter`` to a number format (for example
            ``"dollar"``) or ``tooltip.formatter`` to a string template (for
            example ``"{b}: {c}"``) to use your own formatting.

        key : str, int, or None
            An optional key that gives this element a stable identity. If this
            is ``None`` (default) and the chart is display-only, identity
            follows its position in the app, so moving it can reset the chart
            and replay its entry animation. If this is ``None`` and selections
            are activated, identity also includes the chart's parameters, so a
            change to the spec, theme, renderer, size, or ``alt`` resets the
            selection.

            If selections are activated and ``key`` is provided, Streamlit
            will register the key in Session State to store the selection
            state, and the selection survives changes to your ``spec``,
            ``theme``, and ``renderer``. Indices are not revalidated against
            the new data, so check them before indexing. The selection state
            is read-only. For more details, see `Widget behavior
            <https://docs.streamlit.io/develop/concepts/architecture/widget-behavior>`_.

            If ``key`` is provided, it will be used as a CSS class name
            prefixed with ``st-key-``, and the chart keeps its identity across
            reruns even when the spec, theme, or renderer changes.

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
            selections you enable in your ``spec``. Enable point selection by
            setting ``selectedMode`` on a series (for example,
            ``{"type": "bar", "selectedMode": "multiple", "data": [...]}``), and
            enable region selection by adding a
            `brush <https://echarts.apache.org/en/option.html#brush>`_ component
            or ``toolbox.feature.brush``. Target an axis on the brush (for
            example, ``"brush": {"xAxisIndex": "all"}``) so its regions are
            reported in ``areas`` and survive resizes. A brush without an
            axis, grid, or geo target only has pixel geometry, so its regions
            are omitted from ``areas`` and dropped when the chart resizes.
            Selected data is grouped by series in ``EChartsState.selection.selected``,
            and brush geometry is returned in ``EChartsState.selection.areas``.
            Selections are re-applied visually after reruns. Double-click the
            chart to clear both point and brush selections. If your ``spec``
            enables neither, the chart still renders but never returns a
            selection, and Streamlit logs a warning.

        renderer : "canvas" or "svg"
            The renderer passed to ECharts. This can be one of the following:

            - ``"canvas"`` (default): Best for large datasets.
            - ``"svg"``: Produces real DOM nodes that are better for printing,
              sharp scaling, and accessibility.

        alt : str or None
            A description of the chart for screen readers and other assistive
            technologies. Streamlit maps this to ECharts'
            ``aria.label.description``, which becomes the chart's accessible
            name. If this is ``None`` (default), ECharts keeps its generated
            data-derived name when ``aria.enabled`` is on.

            An empty or whitespace-only string is treated the same as ``None``
            and is logged so authors notice the dual meaning of ``alt=""``
            across commands (decorative only on ``st.image`` / ``st.pyplot``).

            When both ``alt`` and an author ``aria.label.description`` are set,
            ``alt`` overrides that description for the accessible name. A
            non-empty ``alt`` also keeps the chart named even if the option
            sets ``aria.enabled`` to ``False``. Because ECharts already generates
            a data-derived name, prefer a short, specific description; a vague
            one can be worse than none. This is a short description of the
            chart, not a full text alternative for dense graphics.

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
               },
               alt="Bar chart of categories A through E",
           )

        .. output::
           https://doc-echarts-chart.streamlit.app/
           height: 400px

        **Example 2: Chart from a dataframe**

        Pass a dataframe as ``dataset.source``. Streamlit preserves its column
        order through ``dataset.dimensions``, so ECharts maps the first column
        to the category axis and each remaining column to a series. Hover the
        chart and choose **Show data** to view the dataframe in a table.

        .. code-block:: python
           :filename: streamlit_app.py

           import pandas as pd
           import streamlit as st

           df = pd.DataFrame(
               {
                   "product": ["Matcha", "Milk Tea", "Cocoa"],
                   "2015": [43.3, 83.1, 86.4],
                   "2016": [85.8, 73.4, 65.2],
               }
           )

           st.echarts_chart(
               {
                   "legend": {},
                   "tooltip": {},
                   "dataset": {"source": df},
                   "xAxis": {"type": "category"},
                   "yAxis": {},
                   "series": [{"type": "bar"}, {"type": "bar"}],
               }
           )

        **Example 3: Zoom slider, toolbox, and legend**

        In-chart controls such as ``dataZoom`` and ``toolbox`` are configured
        in the spec. Streamlit's hover toolbar (Show data for dataframe-backed
        charts, download, and fullscreen) is separate from ECharts'
        ``toolbox``: omit ``saveAsImage`` if you only want Streamlit's
        download, or set ``toolbox.left`` so the two don't stack in the
        top-right corner. Place ``legend`` at the top so it doesn't share the
        footer with a bottom ``dataZoom`` slider.

        With an inside ``dataZoom``, the wheel scrolls the page until the
        pointer has rested on the chart, then it zooms or pans. Pinch, or the
        modifier set in ``zoomOnMouseWheel`` or ``moveOnMouseWheel``, does that
        on the first wheel of a new flick. A flick that already started as a
        page scroll keeps scrolling.

        .. code-block:: python
           :filename: streamlit_app.py

           import streamlit as st

           st.echarts_chart(
               {
                   "legend": {"data": ["Revenue", "Cost"], "top": 28},
                   "tooltip": {"trigger": "axis"},
                   "toolbox": {
                       "left": 0,
                       "feature": {
                           "magicType": {"type": ["line", "bar"]},
                           "restore": {},
                       },
                   },
                   "dataZoom": [
                       {"type": "inside"},
                       {"type": "slider"},
                   ],
                   "xAxis": {
                       "type": "category",
                       "data": ["Q1", "Q2", "Q3", "Q4"],
                   },
                   "yAxis": {"type": "value"},
                   "series": [
                       {
                           "name": "Revenue",
                           "type": "line",
                           "data": [820, 932, 901, 934],
                       },
                       {
                           "name": "Cost",
                           "type": "bar",
                           "data": [500, 610, 550, 700],
                       },
                   ],
               }
           )

        .. output::
           https://doc-echarts-chart-controls.streamlit.app/
           height: 450px

        **Example 4: Point selections driving the app**

        Set ``on_select="rerun"`` to make the chart behave like an input widget,
        and enable point selection in your ``spec`` by setting
        ``selectedMode`` on the series. Streamlit returns selected indices grouped
        by series and data type.

        .. code-block:: python
           :filename: streamlit_app.py

           import streamlit as st

           spec = {
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

           event = st.echarts_chart(spec, key="sales", on_select="rerun")

           rows = (
               event.selection.selected[0]["data_indices"]
               if event.selection.selected
               else []
           )
           st.write("You selected:", [spec["series"][0]["data"][i] for i in rows])

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

        on_select_callback = validate_on_change_mode(
            on_select,
            supported_modes=("rerun", "ignore"),
            none_supported=False,
            param_name="on_select",
        )

        key = to_key(key)
        is_selection_activated = on_select != "ignore"

        if is_selection_activated:
            # Run some checks that are only relevant when selections are activated
            is_callback = on_select_callback is not None
            check_widget_policies(
                self.dg,
                key,
                on_change=on_select_callback,
                default_value=None,
                writes_allowed=False,
                enable_check_callback_rules=is_callback,
            )

        normalized_option, arrow_datasets = _normalize_spec(spec)
        normalized_alt = normalize_alt(alt)

        # Only walk option variants when alt is present; the common path skips it.
        existing_description = (
            _author_aria_label_description(normalized_option)
            if normalized_alt is not None
            else None
        )
        # Authors can also set this on the option; log so they see that alt wins.
        if existing_description:
            _LOGGER.warning(
                "The ECharts option already sets aria.label.description=%r. "
                "The alt=%r parameter overrides it for the accessible name.",
                existing_description,
                normalized_alt,
                stack_info=True,
            )

        if is_selection_activated and not _enables_selection(normalized_option):
            # The chart still renders, but it can never return a selection, and
            # a chart that silently swallows clicks is hard to debug from the
            # app alone.
            _LOGGER.warning(
                "`st.echarts_chart` has selections activated through `on_select`, "
                "but the provided spec doesn't enable any: no series sets "
                "`selectedMode`, there is no `brush` component, and no "
                "`toolbox.feature.brush`. The chart will render, but it will never "
                "return a selection.",
                stack_info=True,
            )

        echarts_chart_proto = EChartsChartProto()
        echarts_chart_proto.spec = _serialize_option(normalized_option)
        echarts_chart_proto.theme = theme or ""
        echarts_chart_proto.renderer = (
            EChartsChartProto.Renderer.SVG
            if renderer == "svg"
            else EChartsChartProto.Renderer.CANVAS
        )
        if normalized_alt is not None:
            # Carry alt on its own proto field so it is not baked into the
            # wire spec JSON (applied on the frontend as aria.label.description).
            echarts_chart_proto.alt = normalized_alt

        # The spec references each dataset by name; the frontend swaps the
        # rows back in before rendering.
        for name, data_bytes in arrow_datasets.items():
            dataset_proto = echarts_chart_proto.datasets.add()
            dataset_proto.name = name
            dataset_proto.has_name = True
            dataset_proto.data.data = data_bytes

        # The backend only resolves the "content" default; the frontend handles
        # the actual layout.
        final_width = _resolve_content_width(width, spec)
        final_height = _resolve_content_height(height, spec)

        ctx = get_script_run_ctx()

        echarts_chart_proto.selection_activated = is_selection_activated
        if is_selection_activated:
            # Selections are activated, treat the ECharts chart as a widget.
            echarts_chart_proto.form_id = current_form_id(self.dg)

        # An element ID is computed for selection widgets and for any chart the
        # user gave a key. The key case is not only cosmetic: the frontend
        # derives the ``st-key-<key>`` CSS class from the ID and uses the ID as
        # a stable identity across reruns, which keeps ECharts from remounting
        # and replaying its entry animation. Unkeyed display-only charts skip
        # the ID entirely so they stay off the widget path.
        if is_selection_activated or key is not None:
            echarts_chart_proto.id = compute_and_register_element_id(
                "echarts_chart",
                user_key=key,
                # Identity rules:
                # - Keyed display-only: key only, so data/theme/renderer
                #   changes keep the instance.
                # - Keyed widget: key + is_selection_activated, so toggling
                #   on_select gets a fresh ID and drops stale frontend
                #   selection state.
                # - Unkeyed widget: all params, so any spec/theme/renderer/size
                #   change resets the selection. The spec carries each Arrow
                #   dataset's content hash, so a data change counts too.
                key_as_main_identity=(
                    {"is_selection_activated"} if is_selection_activated else True
                ),
                dg=self.dg if is_selection_activated else None,
                spec=echarts_chart_proto.spec,
                theme=theme,
                renderer=renderer,
                width=width,
                height=height,
                is_selection_activated=is_selection_activated,
                alt=normalized_alt,
            )

        layout_config = LayoutConfig(width=final_width, height=final_height)
        # A display-only chart has an element ID only when the author set a key.
        # An active selection is reported, not settable through this API.
        agent_props = agent_spec.element(
            "echarts_chart",
            key=echarts_chart_proto.id or None,
            support="action_unsupported" if is_selection_activated else None,
            # Reported only with selections on; the documented default,
            # "ignore", is left out. A callback reaches the server too, so
            # it is "rerun".
            on_select="rerun" if is_selection_activated else None,
            alt=echarts_chart_proto.alt or None,
            data_builder=lambda: _echarts_data(
                echarts_chart_proto, coordinates=self.dg._get_write_delta_path_str()
            ),
        )

        if not is_selection_activated:
            return self.dg._enqueue(
                "echarts_chart",
                echarts_chart_proto,
                layout_config=layout_config,
                agent_props=agent_props,
            )

        serde = EChartsChartSelectionSerde()
        widget_state = register_widget(
            echarts_chart_proto.id,
            on_change_handler=on_select_callback,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="string_value",
        )
        self.dg._enqueue(
            "echarts_chart",
            echarts_chart_proto,
            layout_config=layout_config,
            agent_props=agent_props,
        )
        return widget_state.value

    @property
    def dg(self) -> DeltaGenerator:
        """The associated DeltaGenerator."""
        return cast("DeltaGenerator", self)
