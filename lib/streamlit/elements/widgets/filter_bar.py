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
from collections.abc import Callable, Mapping, Sequence
from typing import (
    TYPE_CHECKING,
    Any,
    Final,
    cast,
)

import pandas as pd

from streamlit import dataframe_util
from streamlit.elements.lib.column_config_utils import (
    ColumnDataKind,
    determine_dataframe_schema,
)
from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.layout_utils import validate_width
from streamlit.elements.lib.policies import (
    check_widget_policies,
    maybe_raise_label_warnings,
)
from streamlit.elements.lib.utils import (
    Key,
    LabelVisibility,
    compute_and_register_element_id,
    get_label_visibility_proto_value,
    to_key,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.FilterBar_pb2 import (
    FILTER_TYPE_DATE_RANGE,
    FILTER_TYPE_DATETIME_RANGE,
    FILTER_TYPE_MULTISELECT,
    FILTER_TYPE_RANGE,
    FILTER_TYPE_TEXT,
    FILTER_TYPE_TIME_RANGE,
    FILTER_TYPE_TOGGLE,
    FILTER_TYPE_UNSPECIFIED,
)
from streamlit.proto.FilterBar_pb2 import FilterBar as FilterBarProto
from streamlit.proto.FilterBar_pb2 import FilterColumnMeta as FilterColumnMetaProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.runtime.state import PersistStateOption, register_widget
from streamlit.util import ReadOnlyAttributeDictionary, calc_hash

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.layout_utils import Width
    from streamlit.runtime.state import (
        BindOption,
        WidgetArgs,
        WidgetCallback,
        WidgetKwargs,
    )

FILTER_TYPE_TEXT = FILTER_TYPE_TEXT  # noqa: PLW0127

_FILTER_TYPE_NAME_TO_PROTO: dict[str, int] = {
    "multiselect": FILTER_TYPE_MULTISELECT,
    "text": FILTER_TYPE_TEXT,
    "range": FILTER_TYPE_RANGE,
    "toggle": FILTER_TYPE_TOGGLE,
    "date_range": FILTER_TYPE_DATE_RANGE,
    "datetime_range": FILTER_TYPE_DATETIME_RANGE,
    "time_range": FILTER_TYPE_TIME_RANGE,
}

_PROTO_TO_FILTER_TYPE_NAME: dict[int, str] = {
    FILTER_TYPE_MULTISELECT: "multiselect",
    FILTER_TYPE_TEXT: "text",
    FILTER_TYPE_RANGE: "range",
    FILTER_TYPE_TOGGLE: "toggle",
    FILTER_TYPE_DATE_RANGE: "date_range",
    FILTER_TYPE_DATETIME_RANGE: "datetime_range",
    FILTER_TYPE_TIME_RANGE: "time_range",
}

_OPERATORS_BY_FILTER_TYPE: dict[str, list[str]] = {
    "multiselect": ["is", "is_not", "is_null", "is_not_null"],
    "text": [
        "contains",
        "not_contains",
        "equals",
        "not_equals",
        "starts_with",
        "ends_with",
        "is_null",
        "is_not_null",
    ],
    "toggle": ["is_true", "is_false", "is_null"],
    "range": [
        "between",
        "not_between",
        "equals",
        "not_equals",
        "greater_than",
        "less_than",
        "is_null",
        "is_not_null",
    ],
    "date_range": [
        "between",
        "not_between",
        "before",
        "after",
        "equals",
        "not_equals",
        "past_7_days",
        "past_30_days",
        "past_90_days",
        "this_week",
        "this_month",
        "this_year",
        "today",
        "is_null",
        "is_not_null",
    ],
    "datetime_range": [
        "between",
        "not_between",
        "before",
        "after",
        "equals",
        "not_equals",
        "past_7_days",
        "past_30_days",
        "past_90_days",
        "this_week",
        "this_month",
        "this_year",
        "today",
        "is_null",
        "is_not_null",
    ],
    "time_range": [
        "between",
        "not_between",
        "before",
        "after",
        "equals",
        "not_equals",
        "is_null",
        "is_not_null",
    ],
}

_TEXT_FILTER_CARDINALITY_THRESHOLD = 50


class FilterConfig:  # noqa: B903
    """Configuration for a single filter column.

    Parameters
    ----------
    type : str or None
        Override the auto-inferred filter type. One of ``"multiselect"``,
        ``"text"``, ``"range"``, ``"toggle"``, ``"date_range"``,
        ``"datetime_range"``, ``"time_range"``. If ``None``, the type is
        auto-inferred from the column dtype.
    label : str or None
        Custom display label for the filter chip. If ``None``, defaults to
        the column name.
    options : Sequence[Any] or None
        Explicit set of selectable values for multiselect filters. If
        ``None``, values are derived from the column data.
    min_value : int, float, or None
        Minimum bound for range filters. If ``None``, derived from data.
    max_value : int, float, or None
        Maximum bound for range filters. If ``None``, derived from data.
    operators : Sequence[str] or None
        Restrict the available operators to a subset of the defaults for
        the filter type. If ``None``, all operators for the type are
        available.
    format_func : Callable[[Any], str] or None
        A function that takes a raw filter value and returns its display
        string. For multiselect filters, applied to each option to produce
        human-readable labels. If ``None``, values display as-is.
    """

    def __init__(
        self,
        *,
        type: str | None = None,
        label: str | None = None,
        options: Sequence[Any] | None = None,
        min_value: int | float | None = None,
        max_value: int | float | None = None,
        operators: Sequence[str] | None = None,
        format_func: Callable[[Any], str] | None = None,
    ) -> None:
        self.type = type
        self.label = label
        self.options = options
        self.min_value = min_value
        self.max_value = max_value
        self.operators = operators
        self.format_func = format_func


_FILTER_TYPE_MAPPING: dict[ColumnDataKind, int] = {
    ColumnDataKind.STRING: FILTER_TYPE_MULTISELECT,
    ColumnDataKind.INTEGER: FILTER_TYPE_RANGE,
    ColumnDataKind.FLOAT: FILTER_TYPE_RANGE,
    ColumnDataKind.DECIMAL: FILTER_TYPE_RANGE,
    ColumnDataKind.BOOLEAN: FILTER_TYPE_TOGGLE,
    ColumnDataKind.DATE: FILTER_TYPE_DATE_RANGE,
    ColumnDataKind.DATETIME: FILTER_TYPE_DATETIME_RANGE,
    ColumnDataKind.TIME: FILTER_TYPE_TIME_RANGE,
}

_SERVER_SEARCH_THRESHOLD = 1000

_filter_columns_cache: dict[str, list[FilterColumnMetaProto]] = {}


FilterState = dict[str, Any]


class FilterBarState(ReadOnlyAttributeDictionary):
    """Typed state object returned by ``st.session_state[key]`` for filter bars.

    Supports both dict-style (``state["Industry"]``) and attribute-style
    (``state.Industry``) access. Nested filter configs are also wrapped,
    so ``state["Industry"]["values"]`` and ``state.Industry.values`` both work.

    Properties
    ----------
    active_filters : list[str]
        Column names that currently have active filter configurations.
    logic : str
        The current filter logic mode (``"and"`` or ``"or"``).
    """

    @property
    def active_filters(self) -> list[str]:
        """Column names with active filter configurations."""
        return [k for k in self if not k.startswith("_")]

    @property
    def logic(self) -> str:
        """Current filter logic mode: 'and' or 'or'."""
        groups = self.get("_groups")
        if isinstance(groups, list) and len(groups) > 0:
            return str(groups[0].get("logic", "and"))
        return str(self.get("_logic", "and"))


class FilterBarSerde:
    def __init__(self, default: FilterState | None = None) -> None:
        self._default = default or {}

    def deserialize(self, ui_value: str | None) -> FilterBarState:
        if ui_value is None or ui_value == "":
            return FilterBarState(self._default)
        try:
            return FilterBarState(json.loads(ui_value))
        except (json.JSONDecodeError, TypeError):
            return FilterBarState(self._default)

    def serialize(self, filter_state: FilterState) -> str:
        return json.dumps(filter_state, default=str)


def _compute_filter_bar_signature(
    schema: dict[str, ColumnDataKind],
) -> str:
    hasher_input = "|".join(
        f"{col}:{kind.value}" for col, kind in sorted(schema.items())
    )
    return calc_hash(hasher_input)


def _determine_filter_columns(
    data_df: pd.DataFrame,
    arrow_schema: Any,
    signature: str | None = None,
) -> list[FilterColumnMetaProto]:
    if signature is not None and signature in _filter_columns_cache:
        return _filter_columns_cache[signature]

    schema = determine_dataframe_schema(data_df, arrow_schema)
    columns: list[FilterColumnMetaProto] = []

    for col_name, data_kind in schema.items():
        if col_name == "_index":
            continue

        filter_type = _FILTER_TYPE_MAPPING.get(data_kind, FILTER_TYPE_UNSPECIFIED)
        if filter_type == FILTER_TYPE_UNSPECIFIED:
            filter_type = FILTER_TYPE_MULTISELECT

        col_meta = FilterColumnMetaProto()
        col_meta.name = col_name
        col_meta.filter_type = filter_type  # type: ignore[assignment] # ty: ignore[invalid-assignment]
        col_meta.column_data_kind = data_kind.value

        if filter_type == FILTER_TYPE_MULTISELECT:
            cardinality = data_df[col_name].nunique(dropna=True)
            if cardinality > _TEXT_FILTER_CARDINALITY_THRESHOLD:
                filter_type = FILTER_TYPE_TEXT
                col_meta.filter_type = filter_type  # ty: ignore[invalid-assignment]
            else:
                unique_vals = data_df[col_name].dropna().unique()
                options = sorted(str(v) for v in unique_vals)
                if len(options) > _SERVER_SEARCH_THRESHOLD:
                    col_meta.server_search = True
                    col_meta.options[:] = options[:_SERVER_SEARCH_THRESHOLD]
                else:
                    col_meta.options[:] = options
        elif filter_type in {
            FILTER_TYPE_RANGE,
            FILTER_TYPE_DATE_RANGE,
            FILTER_TYPE_DATETIME_RANGE,
            FILTER_TYPE_TIME_RANGE,
        }:
            series = data_df[col_name].dropna()
            if len(series) > 0 and filter_type == FILTER_TYPE_RANGE:
                col_meta.min_value = float(series.min())
                col_meta.max_value = float(series.max())

        type_name = _PROTO_TO_FILTER_TYPE_NAME.get(filter_type, "multiselect")
        col_meta.operators[:] = _OPERATORS_BY_FILTER_TYPE.get(type_name, [])

        columns.append(col_meta)

    if signature is not None:
        _filter_columns_cache[signature] = columns

    return columns


def _apply_filter_config(
    col_meta: FilterColumnMetaProto,
    config: FilterConfig,
    data_df: pd.DataFrame,
) -> FilterColumnMetaProto:
    """Apply FilterConfig overrides to a column's proto metadata."""
    if config.type is not None:
        proto_type = _FILTER_TYPE_NAME_TO_PROTO.get(config.type)
        if proto_type is not None:
            col_meta.filter_type = proto_type  # type: ignore[assignment] # ty: ignore[invalid-assignment]

    if config.label is not None:
        col_meta.custom_label = config.label

    if config.options is not None:
        col_meta.options[:] = [str(v) for v in config.options]
    elif (
        config.type == "multiselect"
        and col_meta.filter_type == FILTER_TYPE_MULTISELECT
        and len(col_meta.options) == 0
    ):
        unique_vals = data_df[col_meta.name].dropna().unique()
        col_meta.options[:] = sorted(str(v) for v in unique_vals)

    if config.min_value is not None:
        col_meta.min_value = float(config.min_value)
    if config.max_value is not None:
        col_meta.max_value = float(config.max_value)

    if config.operators is not None:
        type_name = _PROTO_TO_FILTER_TYPE_NAME.get(col_meta.filter_type, "multiselect")
        valid = set(_OPERATORS_BY_FILTER_TYPE.get(type_name, []))
        restricted = [op for op in config.operators if op in valid]
        if restricted:
            col_meta.operators[:] = restricted

    if config.format_func is not None and len(col_meta.options) > 0:
        col_meta.display_options[:] = [
            config.format_func(opt) for opt in col_meta.options
        ]

    return col_meta


def _resolve_columns_param(
    columns: Sequence[str] | Mapping[str, FilterConfig | None] | None,
    all_filter_columns: list[FilterColumnMetaProto],
    data_df: pd.DataFrame,
) -> list[FilterColumnMetaProto]:
    if columns is None:
        return all_filter_columns

    col_lookup = {col.name: col for col in all_filter_columns}

    if isinstance(columns, Mapping):
        requested_names = list(columns.keys())
    else:
        requested_names = list(columns)

    # Validate all requested column names exist in the DataFrame.
    missing = [name for name in requested_names if name not in data_df.columns]
    if missing:
        raise StreamlitAPIException(
            f"`columns` contains names not found in the DataFrame: {missing}"
        )

    result: list[FilterColumnMetaProto] = []
    for name in requested_names:
        # For Mapping form, None value means exclude this column.
        if isinstance(columns, Mapping) and columns[name] is None:
            continue
        if name in col_lookup:
            col_meta = col_lookup[name]
            # Apply FilterConfig overrides if provided.
            if isinstance(columns, Mapping):
                config = columns[name]
                if isinstance(config, FilterConfig):
                    col_meta = _apply_filter_config(col_meta, config, data_df)
            result.append(col_meta)

    return result


def _apply_multiselect_filter(
    data_df: pd.DataFrame, col_name: str, config: dict[str, Any], operator: str | None
) -> pd.Series[bool]:
    values = config.get("values", [])
    if not values:
        return pd.Series(True, index=data_df.index)
    col_str = data_df[col_name].astype(str)
    if operator == "is_not":
        return ~col_str.isin(values)
    return col_str.isin(values)


def _apply_text_filter(
    data_df: pd.DataFrame, col_name: str, config: dict[str, Any], operator: str | None
) -> pd.Series[bool]:
    query = config.get("query", "")
    if not query:
        return pd.Series(True, index=data_df.index)
    col_str = data_df[col_name].astype(str)
    if operator == "equals":
        return col_str == query  # type: ignore[no-any-return]
    if operator == "not_equals":
        return col_str != query  # type: ignore[no-any-return]
    if operator == "starts_with":
        return col_str.str.startswith(query, na=False)
    if operator == "ends_with":
        return col_str.str.endswith(query, na=False)
    if operator == "not_contains":
        return ~col_str.str.contains(query, case=False, na=False, regex=False)
    return col_str.str.contains(query, case=False, na=False, regex=False)


def _apply_range_filter(
    data_df: pd.DataFrame, col_name: str, config: dict[str, Any], operator: str | None
) -> pd.Series[bool]:
    all_true = pd.Series(True, index=data_df.index)
    if operator == "equals":
        val = config.get("min")
        if val is None:
            return all_true
        return data_df[col_name] == val  # type: ignore[no-any-return]
    if operator == "not_equals":
        val = config.get("min")
        if val is None:
            return all_true
        return data_df[col_name] != val  # type: ignore[no-any-return]
    if operator == "greater_than":
        val = config.get("min")
        if val is None:
            return all_true
        return data_df[col_name] > val  # type: ignore[no-any-return]
    if operator == "less_than":
        val = config.get("max")
        if val is None:
            return all_true
        return data_df[col_name] < val  # type: ignore[no-any-return]
    if operator == "not_between":
        min_val = config.get("min")
        max_val = config.get("max")
        if min_val is None and max_val is None:
            return all_true
        if min_val is not None and max_val is not None:
            return (data_df[col_name] < min_val) | (data_df[col_name] > max_val)  # type: ignore[no-any-return]
        if min_val is not None:
            return data_df[col_name] < min_val  # type: ignore[no-any-return]
        return data_df[col_name] > cast("Any", max_val)  # type: ignore[no-any-return]
    min_val = config.get("min")
    max_val = config.get("max")
    result = all_true
    if min_val is not None:
        result &= data_df[col_name] >= min_val
    if max_val is not None:
        result &= data_df[col_name] <= max_val
    return result


def _apply_toggle_filter(
    data_df: pd.DataFrame, col_name: str, config: dict[str, Any], operator: str | None
) -> pd.Series[bool]:
    val = config.get("value")
    if operator == "is_true" or val is True:
        return data_df[col_name] == True  # noqa: E712
    if operator == "is_false" or val is False:
        return data_df[col_name] == False  # noqa: E712
    return pd.Series(True, index=data_df.index)


_RELATIVE_DATE_OPERATORS: Final[set[str]] = {
    "past_7_days",
    "past_30_days",
    "past_90_days",
    "this_week",
    "this_month",
    "this_year",
    "today",
}


def _resolve_relative_date_range(
    operator: str | None,
) -> tuple[pd.Timestamp, pd.Timestamp] | tuple[pd.Timestamp, None] | None:
    """Return (start, end) for relative date operators, or None if not relative."""
    if operator not in _RELATIVE_DATE_OPERATORS:
        return None
    now = pd.Timestamp.now()
    today_start = now.normalize()
    today_end = today_start + pd.Timedelta(days=1) - pd.Timedelta(microseconds=1)

    if operator == "today":
        return (today_start, today_end)
    if operator == "past_7_days":
        return (today_start - pd.Timedelta(days=7), now)
    if operator == "past_30_days":
        return (today_start - pd.Timedelta(days=30), now)
    if operator == "past_90_days":
        return (today_start - pd.Timedelta(days=90), now)
    if operator == "this_week":
        week_start = today_start - pd.Timedelta(days=now.dayofweek)
        return (week_start, now)
    if operator == "this_month":
        month_start = today_start.replace(day=1)
        return (month_start, now)
    if operator == "this_year":
        year_start = today_start.replace(month=1, day=1)
        return (year_start, now)
    return None


def _apply_date_range_filter(
    data_df: pd.DataFrame, col_name: str, config: dict[str, Any], operator: str | None
) -> pd.Series[bool]:
    all_true = pd.Series(True, index=data_df.index)
    col_dt = pd.to_datetime(data_df[col_name], errors="coerce")

    relative_range = _resolve_relative_date_range(operator)
    if relative_range is not None:
        start, end = relative_range
        result = all_true
        if start is not None:
            result &= col_dt >= start
        if end is not None:
            result &= col_dt <= end
        return result

    if operator == "equals":
        val = config.get("start")
        if val is None:
            return all_true
        return col_dt == pd.Timestamp(val)
    if operator == "not_equals":
        val = config.get("start")
        if val is None:
            return all_true
        return col_dt != pd.Timestamp(val)
    if operator == "before":
        val = config.get("end") or config.get("start")
        if val is None:
            return all_true
        return col_dt < pd.Timestamp(val)
    if operator == "after":
        val = config.get("start")
        if val is None:
            return all_true
        return col_dt > pd.Timestamp(val)
    if operator == "not_between":
        nb_start = config.get("start")
        nb_end = config.get("end")
        if nb_start is None and nb_end is None:
            return all_true
        if nb_start is not None and nb_end is not None:
            return (col_dt < pd.Timestamp(nb_start)) | (col_dt > pd.Timestamp(nb_end))
        if nb_start is not None:
            return col_dt < pd.Timestamp(nb_start)
        return col_dt > pd.Timestamp(cast("str", nb_end))
    between_start = config.get("start")
    between_end = config.get("end")
    result = all_true
    if between_start is not None:
        result &= col_dt >= pd.Timestamp(between_start)
    if between_end is not None:
        result &= col_dt <= pd.Timestamp(between_end)
    return result


def _reconcile_state(
    filter_state: FilterState,
    valid_columns: set[str],
) -> FilterState:
    """Remove filter entries for columns no longer in the DataFrame.

    Also prunes stale column references from _groups[].columns.
    """
    reconciled = {
        k: v for k, v in filter_state.items() if k.startswith("_") or k in valid_columns
    }

    # Prune _groups columns entries to only valid columns.
    if "_groups" in reconciled:
        groups = reconciled["_groups"]
        if isinstance(groups, list):
            reconciled["_groups"] = [
                {
                    **g,
                    "columns": [c for c in g.get("columns", []) if c in valid_columns],
                }
                for g in groups
            ]

    return reconciled


def _get_filter_logic(filter_state: FilterState) -> str:
    """Extract the filter logic mode from the groups-ready state model.

    Supports both the new _groups format and the legacy _logic key for
    backward compatibility.
    """
    groups = filter_state.get("_groups")
    if isinstance(groups, list) and len(groups) > 0:
        return str(groups[0].get("logic", "and"))
    # Backward compat: flat _logic key from older state.
    return str(filter_state.get("_logic", "and"))


def _apply_filters(data_df: pd.DataFrame, filter_state: FilterState) -> pd.DataFrame:
    if not filter_state:
        return data_df

    logic = _get_filter_logic(filter_state)
    use_or = logic == "or"

    if use_or:
        combined_mask = pd.Series(False, index=data_df.index)
    else:
        combined_mask = pd.Series(True, index=data_df.index)

    for col_name, filter_config in filter_state.items():
        if col_name.startswith("_"):
            continue
        if col_name not in data_df.columns:
            continue

        filter_type = filter_config.get("type")
        operator = filter_config.get("operator")

        if operator == "is_null":
            col_mask = data_df[col_name].isna()
        elif operator == "is_not_null":
            col_mask = data_df[col_name].notna()
        elif filter_type == "multiselect":
            col_mask = _apply_multiselect_filter(
                data_df, col_name, filter_config, operator
            )
        elif filter_type == "text":
            col_mask = _apply_text_filter(data_df, col_name, filter_config, operator)
        elif filter_type == "range":
            col_mask = _apply_range_filter(data_df, col_name, filter_config, operator)
        elif filter_type == "toggle":
            col_mask = _apply_toggle_filter(data_df, col_name, filter_config, operator)
        elif filter_type in {"date_range", "datetime_range"}:
            col_mask = _apply_date_range_filter(
                data_df, col_name, filter_config, operator
            )
        else:
            continue

        if use_or:
            combined_mask |= col_mask
        else:
            combined_mask &= col_mask

    return data_df[combined_mask]


class FilterBarMixin:
    @gather_metrics("filter_bar")
    def filter_bar(
        self,
        data: Any,
        *,
        columns: Sequence[str] | Mapping[str, FilterConfig | None] | None = None,
        default: FilterState | None = None,
        label: str | None = None,
        help: str | None = None,
        placeholder: str | None = None,
        expanded: bool = True,
        disabled: bool | Sequence[str] = False,
        key: Key | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        label_visibility: LabelVisibility = "visible",
        width: Width = "stretch",
        bind: BindOption = None,
        persist_state: PersistStateOption = None,
    ) -> pd.DataFrame:
        r"""Display an interactive filter bar for a DataFrame.

        Parameters
        ----------
        data : DataFrame-like
            The data to filter. Accepts pandas DataFrames, polars DataFrames,
            and other DataFrame-like objects.
        columns : Sequence[str], Mapping[str, FilterConfig | None], or None
            Controls which columns are filterable.

            - ``None`` (default): auto-include all eligible columns.
            - ``Sequence[str]``: include only the named columns (filter type
              auto-inferred from dtype).
            - ``Mapping[str, FilterConfig | None]``: keys are column names,
              values are ``FilterConfig`` instances for explicit control,
              empty ``FilterConfig()`` for auto-inference, or ``None`` to
              exclude the column from filtering.

            Column names not present in the input DataFrame raise a
            ``StreamlitAPIException``.
        default : dict or None
            Initial filter state applied on first render. Keys are column
            names, values are filter configuration dicts (e.g.,
            ``{"Industry": {"type": "multiselect", "values": ["Tech"],
            "operator": "is"}}``). If ``None`` (default), the filter bar
            starts with no active filters. The default is ignored once
            the user has interacted with the widget.
        label : str or None
            A short label displayed above the filter bar.
        help : str or None
            Tooltip text shown on hover.
        placeholder : str or None
            Custom text for the "Add filter" button.
        expanded : bool
            Whether the filter bar starts expanded. Default is ``True``.
        disabled : bool or Sequence[str]
            If ``True``, disables the entire filter bar. If a sequence of
            column names, only those columns' filters are locked (cannot be
            added, modified, or removed). Default is ``False``.
        key : str or int or None
            An optional key that uniquely identifies this widget.
        on_change : callable or None
            Callback invoked when the filter state changes.
        args : tuple or None
            Positional arguments passed to ``on_change``.
        kwargs : dict or None
            Keyword arguments passed to ``on_change``.
        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. ``"visible"`` (default): label is
            shown. ``"hidden"``: label is not displayed but space is reserved.
            ``"collapsed"``: no label or spacer is displayed.
        width : "stretch", "content", or int
            Width of the filter bar. ``"stretch"`` (default) fills the
            container. ``"content"`` sizes to the filter bar's content.
            An ``int`` value sets a fixed pixel width.
        bind : "query-params" or None
            Bind the filter state to URL query parameters. When set to
            ``"query-params"``, filter selections are synced to the URL,
            enabling shareable filtered views. Requires a user-provided
            ``key``. The filter state is serialized as JSON in a single
            query parameter named after the ``key``.
        persist_state : "page", "session", or None
            How long to preserve the widget's value when it isn't rendered.
            If this is ``None`` (default), the value is lost when the widget
            is no longer on screen. ``"page"`` persists across reruns on the
            same page. ``"session"`` persists for the entire browser session,
            including across page switches in multi-page apps.

        Returns
        -------
        pd.DataFrame
            The filtered DataFrame.

        Examples
        --------
        .. code-block:: python
           :filename: streamlit_app.py

           import streamlit as st
           import pandas as pd

           df = pd.DataFrame(
               {
                   "status": ["active", "inactive", "active", "pending"],
                   "price": [10.0, 20.0, 30.0, 40.0],
               }
           )

           filtered = st.filter_bar(df)
           st.dataframe(filtered)

        .. output::
           https://doc-filter-bar.streamlit.app
           height: 400px

        """
        ctx = get_script_run_ctx()
        key = to_key(key)
        check_widget_policies(self.dg, key)
        maybe_raise_label_warnings(label, label_visibility)
        validate_width(width, allow_content=True)

        data_df = dataframe_util.convert_anything_to_pandas_df(data)
        data_format = dataframe_util.determine_data_format(data)

        import pyarrow as pa

        arrow_schema = pa.Schema.from_pandas(data_df)

        schema = determine_dataframe_schema(data_df, arrow_schema)
        schema_no_index = {k: v for k, v in schema.items() if k != "_index"}
        signature = _compute_filter_bar_signature(schema_no_index)

        all_filter_columns = _determine_filter_columns(
            data_df, arrow_schema, signature=signature
        )
        filter_columns = _resolve_columns_param(columns, all_filter_columns, data_df)

        # Process disabled as Sequence[str] — mark per-column disabled.
        if isinstance(disabled, bool):
            globally_disabled = disabled
        else:
            globally_disabled = False
            disabled_set = set(disabled)
            invalid = [n for n in disabled_set if n not in data_df.columns]
            if invalid:
                raise StreamlitAPIException(
                    f"`disabled` contains column names not found in the "
                    f"DataFrame: {sorted(invalid)}"
                )
            for col_meta in filter_columns:
                if col_meta.name in disabled_set:
                    col_meta.disabled = True

        element_id = compute_and_register_element_id(
            "filter_bar",
            user_key=key,
            key_as_main_identity=False,
            dg=self.dg,
            schema_signature=signature,
        )

        proto = FilterBarProto()
        proto.id = element_id
        proto.form_id = current_form_id(self.dg)

        if label is not None:
            proto.label = label
        if help is not None:
            proto.help = help
        if placeholder is not None:
            proto.placeholder = placeholder

        proto.expanded = expanded
        proto.disabled = globally_disabled
        proto.columns.extend(filter_columns)
        proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )
        if isinstance(width, int):
            proto.width = width

        valid_column_names = {col.name for col in filter_columns}

        # Validate and reconcile default state.
        validated_default: FilterState = {}
        if default is not None:
            if not isinstance(default, dict):
                raise StreamlitAPIException(
                    "`default` must be a dict mapping column names to filter "
                    "configurations."
                )
            validated_default = _reconcile_state(default, valid_column_names)

        serde = FilterBarSerde(default=validated_default)
        proto.default = serde.serialize(validated_default)

        widget_state = register_widget(
            proto.id,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="string_value",
            bind=bind,
            clearable=True,
            persist_state=persist_state,
        )

        # Reconcile stale filter entries for columns no longer in the schema.
        current_state: FilterState = widget_state.value
        reconciled = _reconcile_state(current_state, valid_column_names)
        if len(reconciled) != len(current_state):
            current_state = reconciled

        if widget_state.value_changed:
            proto.value = serde.serialize(current_state)
            proto.set_value = True

        self.dg._enqueue("filter_bar", proto)

        filtered_df = _apply_filters(data_df, current_state)
        return cast(
            "pd.DataFrame",
            dataframe_util.convert_pandas_df_to_data_format(filtered_df, data_format),
        )

    @property
    def dg(self) -> DeltaGenerator:
        return cast("DeltaGenerator", self)
