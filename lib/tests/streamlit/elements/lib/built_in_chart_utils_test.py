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

"""Unit tests for streamlit.elements.lib.built_in_chart_utils internals."""

from __future__ import annotations

from datetime import date, time
from typing import Any

import altair as alt
import pandas as pd
import pytest

from streamlit.elements.lib import built_in_chart_utils as chart_utils
from streamlit.elements.lib.built_in_chart_utils import (
    StreamlitColorLengthError,
    StreamlitColumnNotFoundError,
    StreamlitInvalidColorError,
)
from streamlit.errors import StreamlitAPIException


@pytest.mark.parametrize(
    "stack",
    [None, True, False, "normalize", "center", "layered"],
)
def test_maybe_raise_stack_warning_accepts_valid(stack: Any) -> None:
    """Supported stack values do not raise."""
    chart_utils.maybe_raise_stack_warning(stack, "bar_chart", "https://docs")


@pytest.mark.parametrize("stack", ["invalid_value", 1.5])
def test_maybe_raise_stack_warning_rejects_invalid(stack: Any) -> None:
    """Unsupported stack values raise StreamlitAPIException."""
    with pytest.raises(StreamlitAPIException, match="Invalid value for stack"):
        chart_utils.maybe_raise_stack_warning(stack, "bar_chart", "https://docs")


@pytest.mark.parametrize(
    ("series", "expected"),
    [
        (pd.Series([1, 2, 3]), "quantitative"),
        (pd.Series([1.0, 2.0, 3.0]), "quantitative"),
        (pd.Series([1 + 2j, 3 + 4j]), "quantitative"),
        (pd.Series(["a", "b", "c"]), "nominal"),
        (pd.Series([True, False, True]), "nominal"),
        (
            pd.Series(pd.to_datetime(["2020-01-01", "2020-01-02"])),
            "temporal",
        ),
        (pd.Series([date(2020, 1, 1), date(2020, 1, 2)]), "temporal"),
        (pd.Series([time(12, 0), time(13, 0)]), "temporal"),
        (pd.Series(pd.to_timedelta(["1 day", "2 days"])), "temporal"),
        (
            pd.Series(
                pd.Categorical(
                    ["low", "high", "low"], ordered=True, categories=["low", "high"]
                )
            ),
            "ordinal",
        ),
        (
            pd.Series(pd.Categorical(["a", "b", "c"], ordered=False)),
            "nominal",
        ),
        # Empty object series falls through to the "nominal" default branch.
        (pd.Series([], dtype="object"), "nominal"),
    ],
)
def test_infer_vegalite_type(series: pd.Series, expected: str) -> None:
    """Verify Vega-Lite type inference for typical pandas dtypes."""
    assert chart_utils._infer_vegalite_type(series) == expected


@pytest.mark.parametrize(
    ("df", "column", "expected"),
    [
        (pd.DataFrame({"a": [date(2020, 1, 1)]}), None, False),
        (pd.DataFrame({"a": pd.Series([], dtype="object")}), "a", False),
        (pd.DataFrame({"a": [date(2020, 1, 1), date(2020, 1, 2)]}), "a", True),
        (pd.DataFrame({"a": [1, 2, 3]}), "a", False),
    ],
    ids=["none_column", "empty_column", "date_values", "non_date_values"],
)
def test_is_date_column(df: pd.DataFrame, column: str | None, expected: bool) -> None:
    """``_is_date_column`` only returns True when the first value is a ``date``."""
    assert chart_utils._is_date_column(df, column) is expected


def test_parse_x_column_with_none_returns_none() -> None:
    """``_parse_x_column`` returns None when input is None."""
    df = pd.DataFrame({"a": [1]})
    assert chart_utils._parse_x_column(df, None) is None


def test_parse_x_column_raises_for_unknown_column() -> None:
    """``_parse_x_column`` raises when the column is not in the DataFrame."""
    df = pd.DataFrame({"a": [1]})
    with pytest.raises(StreamlitColumnNotFoundError):
        chart_utils._parse_x_column(df, "missing")


def test_parse_x_column_raises_for_invalid_type() -> None:
    """``_parse_x_column`` raises StreamlitAPIException for non-str inputs."""
    df = pd.DataFrame({"a": [1]})
    with pytest.raises(StreamlitAPIException, match="x parameter"):
        chart_utils._parse_x_column(df, 123)  # type: ignore[arg-type]


@pytest.mark.parametrize("sort_from_user", [True, False])
def test_parse_sort_column_returns_none_for_bool(sort_from_user: bool) -> None:
    """A boolean ``sort_from_user`` should produce ``None``."""
    df = pd.DataFrame({"a": [1]})
    assert chart_utils._parse_sort_column(df, sort_from_user) is None


def test_parse_sort_column_strips_minus_prefix() -> None:
    """Leading '-' indicates descending and is stripped before lookup."""
    df = pd.DataFrame({"name": [1]})
    assert chart_utils._parse_sort_column(df, "-name") == "name"


def test_parse_sort_column_raises_when_missing() -> None:
    """A sort column not in the DataFrame raises."""
    df = pd.DataFrame({"name": [1]})
    with pytest.raises(StreamlitColumnNotFoundError):
        chart_utils._parse_sort_column(df, "missing")


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("a", ("a", None)),
        ("#ff0000", (None, "#ff0000")),
        (42, (None, 42)),
    ],
    ids=["column_name", "color_literal", "scalar_value"],
)
def test_parse_generic_column(value: Any, expected: tuple[Any, Any]) -> None:
    """Column names resolve to the column; other values fall through as a constant."""
    df = pd.DataFrame({"a": [1]})
    assert chart_utils._parse_generic_column(df, value) == expected


@pytest.mark.parametrize(
    ("columns", "y", "x_column", "expected"),
    [
        (["a", "b"], None, "a", ["b"]),
        (["a", "b"], "b", None, ["b"]),
        (["a", "b"], ["a", "b"], None, ["a", "b"]),
        (["x", "y"], ["x", "y"], "x", ["x", "y"]),
    ],
    ids=[
        "none_y_drops_x",
        "string_y_wrapped_in_list",
        "list_y_preserved",
        "explicit_y_keeps_x",
    ],
)
def test_parse_y_columns(
    columns: list[str], y: Any, x_column: str | None, expected: list[str]
) -> None:
    """``_parse_y_columns`` normalizes user input into a list of column names."""
    df = pd.DataFrame({col: [1] for col in columns})
    assert chart_utils._parse_y_columns(df, y, x_column) == expected


def test_parse_y_columns_raises_for_unknown() -> None:
    """An unknown y column raises ``StreamlitColumnNotFoundError``."""
    df = pd.DataFrame({"a": [1]})
    with pytest.raises(StreamlitColumnNotFoundError):
        chart_utils._parse_y_columns(df, "missing", None)


def test_drop_unused_columns_dedupes_and_filters_none() -> None:
    """``_drop_unused_columns`` keeps only the requested non-None columns once."""
    df = pd.DataFrame({"a": [1], "b": [2], "c": [3]})
    result = chart_utils._drop_unused_columns(df, "a", None, "b", "a")
    assert list(result.columns) == ["a", "b"]


@pytest.mark.parametrize(
    ("chart_type", "color_column", "expected_x_field", "expected_y_field"),
    [
        (chart_utils.ChartType.VERTICAL_BAR, "color_col", "color_col", None),
        (chart_utils.ChartType.HORIZONTAL_BAR, "color_col", None, "color_col"),
        (chart_utils.ChartType.VERTICAL_BAR, None, None, None),
        (chart_utils.ChartType.LINE, "color_col", None, None),
    ],
    ids=["vertical_bar", "horizontal_bar", "no_color_column", "non_bar_chart"],
)
def test_get_offset_encoding(
    chart_type: chart_utils.ChartType,
    color_column: str | None,
    expected_x_field: str | None,
    expected_y_field: str | None,
) -> None:
    """Offsets are only populated for bar charts in the matching orientation."""
    x_offset, y_offset = chart_utils._get_offset_encoding(chart_type, color_column)
    assert x_offset.to_dict() == (
        {"field": expected_x_field} if expected_x_field else {}
    )
    assert y_offset.to_dict() == (
        {"field": expected_y_field} if expected_y_field else {}
    )


@pytest.mark.parametrize(
    ("chart_type", "stack", "color_column", "is_opacity_value"),
    [
        (chart_utils.ChartType.AREA, None, "color_col", True),
        (chart_utils.ChartType.VERTICAL_BAR, "layered", "color_col", True),
        (chart_utils.ChartType.LINE, None, "color_col", False),
    ],
    ids=["area_with_color", "layered_bars", "line_default"],
)
def test_get_opacity_encoding(
    chart_type: chart_utils.ChartType,
    stack: Any,
    color_column: str | None,
    is_opacity_value: bool,
) -> None:
    """Opacity is only set for area-with-color and layered bar combinations."""
    encoding = chart_utils._get_opacity_encoding(chart_type, stack, color_column)
    if is_opacity_value:
        assert isinstance(encoding, alt.OpacityValue)
    else:
        assert encoding is None


@pytest.mark.parametrize(
    ("chart_type", "size_column", "size_value", "expected_cls"),
    [
        (chart_utils.ChartType.SCATTER, None, 200, alt.SizeValue),
        (chart_utils.ChartType.SCATTER, None, None, alt.SizeValue),
        (chart_utils.ChartType.SCATTER, "size_col", None, alt.Size),
    ],
    ids=["scatter_value", "scatter_default", "scatter_column"],
)
def test_get_size_encoding_scatter(
    chart_type: chart_utils.ChartType,
    size_column: str | None,
    size_value: Any,
    expected_cls: type,
) -> None:
    """Scatter plots produce Size/SizeValue encodings depending on input."""
    encoding = chart_utils._get_size_encoding(chart_type, size_column, size_value)
    assert isinstance(encoding, expected_cls)


def test_get_size_encoding_invalid_size_value_raises() -> None:
    """Non-numeric size_value should raise StreamlitAPIException."""
    with pytest.raises(StreamlitAPIException, match="valid size"):
        chart_utils._get_size_encoding(chart_utils.ChartType.SCATTER, None, "huge")


def test_get_size_encoding_returns_none_for_non_scatter() -> None:
    """Non-scatter chart types get no size encoding."""
    assert (
        chart_utils._get_size_encoding(chart_utils.ChartType.LINE, None, None) is None
    )


def test_maybe_melt_no_columns_returns_none_y() -> None:
    """When no y columns are provided, y_column should be None."""
    df = pd.DataFrame({"x": [1, 2, 3]})
    out_df, y_column, color_column = chart_utils._maybe_melt(
        df, "x", [], None, None, None
    )
    assert y_column is None
    assert color_column is None
    assert list(out_df.columns) == ["x"]


def test_maybe_melt_single_y_returns_y_column_unchanged() -> None:
    """When a single y column is provided, no melting occurs."""
    df = pd.DataFrame({"x": [1, 2], "y1": [3, 4]})
    out_df, y_column, color_column = chart_utils._maybe_melt(
        df, "x", ["y1"], None, None, None
    )
    assert y_column == "y1"
    assert color_column is None
    assert list(out_df.columns) == ["x", "y1"]


def test_maybe_melt_multiple_y_with_size_and_sort() -> None:
    """Multiple y columns are melted while preserving size and sort columns."""
    df = pd.DataFrame(
        {
            "x": [1, 2],
            "y1": [3, 4],
            "y2": [5, 6],
            "size_col": [10, 20],
            "sort_col": [0, 1],
        }
    )
    out_df, y_column, color_column = chart_utils._maybe_melt(
        df, "x", ["y1", "y2"], None, "size_col", "sort_col"
    )
    assert y_column == chart_utils._MELTED_Y_COLUMN_NAME
    assert color_column == chart_utils._MELTED_COLOR_COLUMN_NAME
    assert set(out_df.columns) >= {
        "size_col",
        "sort_col",
        chart_utils._MELTED_Y_COLUMN_NAME,
        chart_utils._MELTED_COLOR_COLUMN_NAME,
    }


def test_melt_data_raises_on_too_many_mixed_types() -> None:
    """Melting columns whose union has too many mixed values should raise."""
    # Use >100 unique values across int+str columns so the inferred dtype is mixed.
    rows = 110
    df = pd.DataFrame(
        {
            "x": list(range(rows)),
            "ints": list(range(rows)),
            "strs": [f"v{i}" for i in range(rows)],
        }
    )
    with pytest.raises(StreamlitAPIException, match="too many values"):
        chart_utils._melt_data(df, ["x"], ["ints", "strs"], "value", "color")


def test_convert_col_names_to_str_in_place_stringifies_columns() -> None:
    """Integer column names are converted to strings."""
    df = pd.DataFrame({0: [1], 1: [2]})
    x, y_list, color, size, sort = chart_utils._convert_col_names_to_str_in_place(
        df, 0, [1], None, None, None
    )
    assert list(df.columns) == ["0", "1"]
    assert (x, y_list, color, size, sort) == ("0", ["1"], None, None, None)


@pytest.mark.parametrize(
    "color_value",
    [["#ff0000"], ["primary"], "primary"],
    ids=["color_literal_list", "builtin_color_list", "builtin_color_string"],
)
def test_get_color_encoding_single_color_yields_color_value(color_value: Any) -> None:
    """Single-color inputs (literal or builtin name) produce an ``alt.ColorValue``."""
    df = pd.DataFrame({"y1": [1, 2, 3]})
    encoding = chart_utils._get_color_encoding(
        df=df,
        color_value=color_value,
        color_column=None,
        y_column_list=["y1"],
        color_from_user=color_value,
    )
    assert isinstance(encoding, alt.ColorValue)


def test_get_color_encoding_builtin_name_with_multiple_y_raises() -> None:
    """A single color string with multiple y columns raises a length error."""
    df = pd.DataFrame({"y1": [1], "y2": [2]})
    with pytest.raises(StreamlitColorLengthError):
        chart_utils._get_color_encoding(
            df=df,
            color_value="primary",
            color_column=None,
            y_column_list=["y1", "y2"],
            color_from_user="primary",
        )


def test_get_color_encoding_invalid_color_raises() -> None:
    """Non-color, non-iterable color values raise StreamlitInvalidColorError."""
    df = pd.DataFrame({"y1": [1]})
    with pytest.raises(StreamlitInvalidColorError):
        chart_utils._get_color_encoding(
            df=df,
            color_value=123,
            color_column=None,
            y_column_list=["y1"],
            color_from_user=123,
        )
