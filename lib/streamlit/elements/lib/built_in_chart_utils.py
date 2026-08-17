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

"""Utilities for our built-in charts commands."""

from __future__ import annotations

from datetime import date
from enum import Enum
from typing import TYPE_CHECKING, Any, Final, Literal, TypeAlias, cast

from streamlit import dataframe_util, type_util
from streamlit.elements.lib.color_util import (
    Color,
    is_builtin_color_name,
    is_color_like,
    is_color_tuple_like,
    is_hex_color_like,
    to_css_color,
)
from streamlit.errors import Error, StreamlitAPIException, StreamlitValueError

if TYPE_CHECKING:
    from collections.abc import Collection, Sequence

    import altair as alt
    import pandas as pd

    from streamlit.dataframe_util import Data
    from streamlit.elements.lib.layout_utils import (
        Height,
        Width,
    )

VegaLiteType: TypeAlias = Literal["quantitative", "ordinal", "temporal", "nominal"]
ChartStackType: TypeAlias = Literal["normalize", "center", "layered"]

# Threshold for applying hover event throttling on large datasets.
# For datasets with more points than this threshold, hover events are throttled
# to 16ms (~60fps) to improve performance.
_LARGE_DATASET_POINT_THRESHOLD: Final = 1000


class ChartType(Enum):
    AREA: Final = {"mark_type": "area", "command": "area_chart"}
    VERTICAL_BAR: Final = {
        "mark_type": "bar",
        "command": "bar_chart",
        "horizontal": False,
    }
    HORIZONTAL_BAR: Final = {
        "mark_type": "bar",
        "command": "bar_chart",
        "horizontal": True,
    }
    LINE: Final = {"mark_type": "line", "command": "line_chart"}
    SCATTER: Final = {"mark_type": "circle", "command": "scatter_chart"}


# Color and size legends need different title paddings in order for them
# to be vertically aligned.
#
# NOTE: I don't think it's possible to *perfectly* align the size and
# color legends in all instances, since the "size" circles vary in size based
# on the data, and their container is top-aligned with the color container. But
# through trial-and-error I found this value to be a good enough middle ground.
#
# NOTE #2: In theory, we could move COLOR_LEGEND_SETTINGS into
# ArrowVegaLiteChart/CustomTheme.tsx, but this would impact existing behavior.
# (See https://github.com/streamlit/streamlit/pull/7164#discussion_r1307707345)
_COLOR_LEGEND_SETTINGS: Final = {"titlePadding": 5, "offset": 5, "orient": "bottom"}
_SIZE_LEGEND_SETTINGS: Final = {"titlePadding": 0.5, "offset": 5, "orient": "bottom"}

# User-readable names to give the index and melted columns.
_SEPARATED_INDEX_COLUMN_TITLE: Final = "index"
_MELTED_Y_COLUMN_TITLE: Final = "value"
_MELTED_COLOR_COLUMN_TITLE: Final = "color"

# Crazy internal (non-user-visible) names for the index and melted columns, in order to
# avoid collision with existing column names.
_PROTECTION_SUFFIX: Final = " -- streamlit-generated"
_SEPARATED_INDEX_COLUMN_NAME: Final = _SEPARATED_INDEX_COLUMN_TITLE + _PROTECTION_SUFFIX
_MELTED_Y_COLUMN_NAME: Final = _MELTED_Y_COLUMN_TITLE + _PROTECTION_SUFFIX
_MELTED_COLOR_COLUMN_NAME: Final = _MELTED_COLOR_COLUMN_TITLE + _PROTECTION_SUFFIX

# Name we use for a column we know doesn't exist in the data, to address a Vega-Lite
# rendering bug
# where empty charts need x, y encodings set in order to take up space.
_NON_EXISTENT_COLUMN_NAME: Final = "DOES_NOT_EXIST" + _PROTECTION_SUFFIX

# Prefix for internal aliases used when a user column name contains characters that
# Vega-Lite treats as special in field strings (e.g. `.` for nested access, `[`/`]`
# for property access, and `\` used as an escape). See GitHub issue #7714.
_COLUMN_ALIAS_PREFIX: Final = "col" + _PROTECTION_SUFFIX + "-"

# Characters that Vega-Lite treats as special in a field string. When any of these
# appear in a user column name we rename the column to a safe alias to avoid Vega-Lite
# interpreting the name as nested-object or property access.
_VEGA_LITE_FIELD_SPECIAL_CHARS: Final = (".", "[", "]", "\\")


def _needs_field_alias(name: str) -> bool:
    """Return True if ``name`` contains characters that Vega-Lite treats as special
    inside a field string.
    """
    return any(ch in name for ch in _VEGA_LITE_FIELD_SPECIAL_CHARS)


def maybe_raise_stack_warning(stack: bool | ChartStackType | None) -> None:
    # Reject values outside the supported stack options.
    if stack not in {None, True, False, "normalize", "center", "layered"}:
        raise StreamlitValueError(
            "stack",
            ["True", "False", "'normalize'", "'center'", "'layered'", "None"],
        )


def generate_chart(
    chart_type: ChartType,
    data: Data | None,
    x_from_user: str | None = None,
    y_from_user: str | Sequence[str] | None = None,
    x_axis_label: str | None = None,
    y_axis_label: str | None = None,
    color_from_user: str | Color | list[Color] | None = None,
    size_from_user: str | float | None = None,
    width: Width | None = None,
    height: Height | None = None,
    # Bar & Area charts only:
    stack: bool | ChartStackType | None = None,
    # Bar charts only:
    sort_from_user: bool | str = False,
) -> alt.Chart | alt.LayerChart:
    """Function to use the chart's type, data columns and indices to figure out the
    chart's spec.
    """
    import altair as alt

    df = dataframe_util.convert_anything_to_pandas_df(data, ensure_copy=True)

    # From now on, use "df" instead of "data". Deleting "data" to guarantee we follow
    #  this.
    del data

    # Convert arguments received from the user to things Vega-Lite understands.
    # Get name of column to use for x.
    x_column = _parse_x_column(df, x_from_user)
    # Get name of columns to use for y.
    y_column_list = _parse_y_columns(df, y_from_user, x_column)
    # Get name of column to use for color, or constant value to use. Any/both could
    # be None.
    color_column, color_value = _parse_generic_column(df, color_from_user)
    # Get name of column to use for size, or constant value to use. Any/both could
    #  be None.
    size_column, size_value = _parse_generic_column(df, size_from_user)
    # Get name of column to use for sort.
    sort_column = _parse_sort_column(df, sort_from_user)

    # At this point, all foo_column variables are either None/empty or contain actual
    # columns that are guaranteed to exist.
    (
        df,
        x_column,
        y_column,
        y_column_list,
        color_column,
        size_column,
        sort_column,
        alias_to_original,
    ) = _prep_data(df, x_column, y_column_list, color_column, size_column, sort_column)

    # At this point, x_column is only None if user did not provide one AND df is empty.

    # Get x and y encodings
    x_encoding, y_encoding = _get_axis_encodings(
        df,
        chart_type,
        x_column,
        y_column,
        x_from_user,
        y_from_user,
        x_axis_label,
        y_axis_label,
        stack,
        sort_from_user,
        alias_to_original,
    )

    chart_width = width if isinstance(width, int) else None
    chart_height = height if isinstance(height, int) else None

    # Create a Chart with x and y encodings.
    chart = alt.Chart(
        data=df,
        mark=chart_type.value["mark_type"],  # ty: ignore[invalid-argument-type]
        width=chart_width or 0,
        height=chart_height or 0,
    ).encode(
        x=x_encoding,
        y=y_encoding,
    )

    # Offset encoding only works for Altair >= 5.0.0
    is_altair_version_5_or_greater = not type_util.is_altair_version_less_than("5.0.0")
    # Set up offset encoding (creates grouped/non-stacked bar charts, so only applicable
    # when stack=False).
    if is_altair_version_5_or_greater and stack is False and color_column is not None:
        x_offset, y_offset = _get_offset_encoding(chart_type, color_column)
        chart = chart.encode(xOffset=x_offset, yOffset=y_offset)

    # Set up opacity encoding.
    opacity_enc = _get_opacity_encoding(chart_type, stack, color_column)
    if opacity_enc is not None:
        chart = chart.encode(opacity=opacity_enc)

    # Set up color encoding.
    color_enc = _get_color_encoding(
        df,
        color_value,
        color_column,
        y_column_list,
        color_from_user,
        alias_to_original,
    )
    if color_enc is not None:
        chart = chart.encode(color=color_enc)

    # Set up size encoding.
    size_enc = _get_size_encoding(
        chart_type, size_column, size_value, alias_to_original
    )
    if size_enc is not None:
        chart = chart.encode(size=size_enc)

    # Set up tooltip encoding.
    if x_column is not None and y_column is not None:
        chart = chart.encode(
            tooltip=_get_tooltip_encoding(
                x_column,
                y_column,
                size_column,
                color_column,
                color_enc,
                alias_to_original,
            )
        )

    if (
        chart_type is ChartType.LINE
        and x_column is not None
        # This is using the new selection API that was added in Altair 5.0.0
        and is_altair_version_5_or_greater
    ):
        return _add_improved_hover_tooltips(
            chart, x_column, chart_width, chart_height, len(df)
        ).interactive()

    return chart.interactive()


def _add_improved_hover_tooltips(
    chart: alt.Chart,
    x_column: str,
    width: int | None,
    height: int | None,
    data_point_count: int,
) -> alt.LayerChart:
    """Adds improved hover tooltips to an existing line chart.

    This implementation uses a three-layer approach for better performance:
    1. Base chart layer: The original line chart
    2. Detection layer: Invisible points for detecting the nearest point on hover
    3. Highlight layer: Only renders the selected point(s) using transform_filter

    The filter-based approach is more efficient than using conditional opacity
    because it only renders the selected point(s) rather than evaluating opacity
    for every single data point on each hover event.
    """

    import altair as alt

    # Throttle hover events for large datasets to 16ms (~60fps) to improve performance.
    # For smaller datasets, use standard mousemove without throttling.
    hover_event = (
        "mousemove{16}"
        if data_point_count > _LARGE_DATASET_POINT_THRESHOLD
        else "mousemove"
    )

    # Create a selection that chooses the nearest point & selects based on x-value.
    # Uses mouseleave instead of mouseout/pointerout for more reliable hover clearing
    # (mouseout fires when moving over child elements like tooltips).
    nearest = alt.selection_point(
        nearest=True,
        on=hover_event,
        fields=[x_column],
        empty=False,
        clear="mouseleave",
    )

    # Detection layer: Invisible points for detecting the nearest point.
    # This layer is needed because selections must be attached to a mark.
    detection_points = chart.mark_point(opacity=0).add_params(nearest)

    # Highlight layer: Only renders the selected point(s) using transform_filter.
    # This is more efficient than conditional opacity because it only renders
    # the filtered data (typically 1-2 points) rather than all points.
    highlighted_points = chart.mark_point(filled=True, size=65).transform_filter(
        nearest
    )

    layer_chart = (
        alt.layer(chart, detection_points, highlighted_points)
        .configure_legend(symbolType="stroke")
        .properties(
            width=width or 0,
            height=height or 0,
        )
    )

    return cast("alt.LayerChart", layer_chart)  # ty: ignore[redundant-cast]


def _infer_vegalite_type(
    data: pd.Series[Any],
) -> VegaLiteType:
    """
    From an array-like input, infer the correct vega typecode
    ('ordinal', 'nominal', 'quantitative', or 'temporal').

    Parameters
    ----------
    data: Numpy array or Pandas Series
    """
    # The code below is copied from Altair, and slightly modified.
    # We copy this code here so we don't depend on private Altair functions.
    # Source: https://github.com/altair-viz/altair/blob/62ca5e37776f5cecb27e83c1fbd5d685a173095d/altair/utils/core.py#L193

    from pandas.api.types import infer_dtype

    # STREAMLIT MOD: I'm using infer_dtype directly here, rather than using Altair's
    # wrapper. Their wrapper is only there to support Pandas < 0.20, but Streamlit
    # requires Pandas 1.3.
    typ = infer_dtype(data)

    if typ in {
        "floating",
        "mixed-integer-float",
        "integer",
        "mixed-integer",
        "complex",
    }:
        return "quantitative"

    if typ == "categorical" and data.cat.ordered:
        # The original code returns a tuple here:
        # return ("ordinal", data.cat.categories.tolist())  # noqa: ERA001
        # But returning the tuple here isn't compatible with our
        # built-in chart implementation. And it also doesn't seem to be necessary.
        # Altair already extracts the correct sort order somewhere else.
        # More info about the issue here: https://github.com/streamlit/streamlit/issues/7776
        return "ordinal"
    if typ in {"string", "bytes", "categorical", "boolean", "mixed", "unicode"}:
        return "nominal"
    if typ in {
        "datetime",
        "datetime64",
        "timedelta",
        "timedelta64",
        "date",
        "time",
        "period",
    }:
        return "temporal"
    # STREAMLIT MOD: I commented this out since Streamlit doesn't use warnings.warn.
    # > warnings.warn(
    # >     "I don't know how to infer vegalite type from '{}'.  "
    # >     "Defaulting to nominal.".format(typ),
    # >     stacklevel=1,
    # > )
    return "nominal"


def _prep_data(
    df: pd.DataFrame,
    x_column: str | None,
    y_column_list: list[str],
    color_column: str | None,
    size_column: str | None,
    sort_column: str | None = None,
) -> tuple[
    pd.DataFrame,
    str | None,
    str | None,
    list[str],
    str | None,
    str | None,
    str | None,
    dict[str, str],
]:
    """Prepares the data for charting.

    Returns the prepared dataframe and the new names of the x column (taking the index
    reset into consideration), the y, color, and size columns, the aliased y column
    list, and a mapping from any internal column aliases back to the original
    user-facing column names.
    """

    # If y is provided, but x is not, we'll use the index as x.
    # So we need to pull the index into its own column.
    x_column = _maybe_reset_index_in_place(df, x_column, y_column_list)

    # Drop columns we're not using.
    selected_data = _drop_unused_columns(
        df, x_column, color_column, size_column, sort_column, *y_column_list
    )

    # Maybe convert color to Vega colors.
    _maybe_convert_color_column_in_place(selected_data, color_column)

    # Make sure all columns have string names, and rename any that contain
    # Vega-Lite-special characters (see #7714).
    (
        x_column,
        y_column_list,
        color_column,
        size_column,
        sort_column,
        alias_to_original,
    ) = _convert_col_names_to_str_in_place(
        selected_data, x_column, y_column_list, color_column, size_column, sort_column
    )

    # Maybe melt data from wide format into long format.
    melted_data, y_column, color_column = _maybe_melt(
        selected_data, x_column, y_column_list, color_column, size_column, sort_column
    )

    # If the melt produced a melted-color column and any y columns were aliased,
    # rewrite the melted-color values back to the original user-facing names.
    # This makes the color legend and tooltip display the original column names
    # without needing a Vega-Lite ``labelExpr`` remap. The y encoding still
    # references the alias columns via ``y_column`` for the actual value lookup.
    if (
        color_column == _MELTED_COLOR_COLUMN_NAME
        and alias_to_original
        and color_column in melted_data.columns
    ):
        melted_data[color_column] = melted_data[color_column].map(
            lambda v: alias_to_original.get(v, v)
        )
        # Also swap ``y_column_list`` entries back to originals so any downstream
        # scale domain lines up with the values now stored in the data.
        y_column_list = [alias_to_original.get(c, c) for c in y_column_list]

    # Return the data, the new names to use for x, y, and color, the (possibly
    # user-facing) y column list, and the alias-to-original title map.
    return (
        melted_data,
        x_column,
        y_column,
        y_column_list,
        color_column,
        size_column,
        sort_column,
        alias_to_original,
    )


def _is_date_column(df: pd.DataFrame, name: str | None) -> bool:
    """True if the column with the given name stores datetime.date values.

    This function just checks the first value in the given column, so
    it's meaningful only for columns whose values all share the same type.

    Parameters
    ----------
    df : pd.DataFrame
    name : str
        The column name

    Returns
    -------
    bool

    """
    if name is None:
        return False

    column = df[name]
    if column.size == 0:
        return False

    return isinstance(column.iat[0], date)


def _melt_data(
    df: pd.DataFrame,
    columns_to_leave_alone: list[str],
    columns_to_melt: list[str] | None,
    new_y_column_name: str,
    new_color_column_name: str,
) -> pd.DataFrame:
    """Converts a wide-format dataframe to a long-format dataframe.

    You can find more info about melting on the Pandas documentation:
    https://pandas.pydata.org/docs/reference/api/pandas.melt.html

    Parameters
    ----------
    df : pd.DataFrame
        The dataframe to melt.
    columns_to_leave_alone : list[str]
        The columns to leave as they are.
    columns_to_melt : list[str]
        The columns to melt.
    new_y_column_name : str
        The name of the new column that will store the values of the melted columns.
    new_color_column_name : str
        The name of column that will store the original column names.

    Returns
    -------
    pd.DataFrame
        The melted dataframe.


    Examples
    --------
    >>> import pandas as pd
    >>> df = pd.DataFrame(
    ...     {
    ...         "a": [1, 2, 3],
    ...         "b": [4, 5, 6],
    ...         "c": [7, 8, 9],
    ...     }
    ... )
    >>> _melt_data(df, ["a"], ["b", "c"], "value", "color")
    >>>    a color  value
    >>> 0  1        b      4
    >>> 1  2        b      5
    >>> 2  3        b      6
    >>> ...

    """
    import pandas as pd
    from pandas.api.types import infer_dtype

    melted_df = pd.melt(
        df,
        id_vars=columns_to_leave_alone,
        value_vars=columns_to_melt,
        var_name=new_color_column_name,
        value_name=new_y_column_name,
    )

    y_series = melted_df[new_y_column_name]
    if (
        # After melting columns of different dtypes, the result has object dtype.
        # In pandas 3.0+, melting columns with the same StringDtype keeps StringDtype,
        # so this check correctly identifies only truly mixed-type scenarios.
        y_series.dtype == "object"
        and "mixed" in infer_dtype(y_series)
        and len(y_series.unique()) > 100
    ):
        raise StreamlitAPIException(
            "The columns used for rendering the chart contain too many values with "
            "mixed types. Please select the columns manually via the y parameter."
        )

    # Arrow has problems with object types after melting two different dtypes
    # > pyarrow.lib.ArrowTypeError: "Expected a <TYPE> object, got a object"
    return dataframe_util.fix_arrow_incompatible_column_types(
        melted_df,
        selected_columns=[
            *columns_to_leave_alone,
            new_color_column_name,
            new_y_column_name,
        ],
    )


def _maybe_reset_index_in_place(
    df: pd.DataFrame, x_column: str | None, y_column_list: list[str]
) -> str | None:
    if x_column is None and len(y_column_list) > 0:
        if df.index.name is None:
            # Pick column name that is unlikely to collide with user-given names.
            x_column = _SEPARATED_INDEX_COLUMN_NAME
        else:
            # Reuse index's name for the new column.
            x_column = str(df.index.name)

        df.index.name = x_column
        df.reset_index(inplace=True)  # noqa: PD002

    return x_column


def _drop_unused_columns(df: pd.DataFrame, *column_names: str | None) -> pd.DataFrame:
    """Returns a subset of df, selecting only column_names that aren't None."""

    # We can't just call set(col_names) because sets don't have stable ordering,
    # which means tests that depend on ordering will fail.
    # Performance-wise, it's not a problem, though, since this function is only ever
    # used on very small lists.
    seen = set()
    keep = []

    for x in column_names:
        if x is None:
            continue
        if x in seen:
            continue
        seen.add(x)
        keep.append(x)

    return df[keep]  # type: ignore[no-any-return, unused-ignore]


def _maybe_convert_color_column_in_place(
    df: pd.DataFrame, color_column: str | None
) -> None:
    """If needed, convert color column to a format Vega understands."""
    if color_column is None or len(df[color_column]) == 0:
        return

    first_color_datum = df[color_column].iat[0]

    if is_hex_color_like(first_color_datum):
        # Hex is already CSS-valid.
        pass
    elif is_color_tuple_like(first_color_datum):
        # Tuples need to be converted to CSS-valid.
        df.loc[:, color_column] = df[color_column].apply(to_css_color)
    else:
        # Other kinds of colors columns (i.e. pure numbers or nominal strings) shouldn't
        # be converted since they are treated by Vega-Lite as sequential or categorical
        # colors.
        pass


def _convert_col_names_to_str_in_place(
    df: pd.DataFrame,
    x_column: str | None,
    y_column_list: list[str],
    color_column: str | None,
    size_column: str | None,
    sort_column: str | None,
) -> tuple[str | None, list[str], str | None, str | None, str | None, dict[str, str]]:
    r"""Converts column names to strings, since Vega-Lite does not accept ints, etc.

    Additionally, if any column name contains characters that Vega-Lite treats as
    special in a field string (``.``, ``[``, ``]``, ``\``), the column is renamed
    to an internal alias so the chart still renders correctly. The mapping from
    alias to the original (user-facing) name is returned so encodings can surface
    the original name as the title, tooltip, and legend label.
    """
    import pandas as pd

    column_names = list(df.columns)  # list() converts RangeIndex, etc, to regular list.
    str_column_names = [str(c) for c in column_names]

    # Set of stringified names that must not collide with generated aliases. This
    # covers plain user columns (which we never rename) so an alias like
    # ``col -- streamlit-generated-0`` cannot silently shadow a user column that
    # happens to already be named that.
    reserved_names: set[str] = {
        name for name in str_column_names if not _needs_field_alias(name)
    }
    # Map from original stringified name to the *first* safe alias assigned to
    # that name. Used to remap single-column user arguments (x, color, size,
    # sort) that reference columns by name — for those, first-occurrence-wins
    # matches pandas' behavior when selecting by a duplicated column label.
    original_to_alias: dict[str, str] = {}
    # Map from alias back to the original name, for user-facing titles.
    alias_to_original: dict[str, str] = {}
    # FIFO queue of aliases per original column name. When ``y_column_list`` has
    # duplicate labels (e.g. two columns both named ``"a.b"``), each entry
    # consumes a distinct alias in column order (see #7714 follow-up).
    per_name_aliases: dict[str, list[str]] = {}
    final_column_names: list[str] = []
    for idx, name in enumerate(str_column_names):
        if _needs_field_alias(name):
            # Every column that needs aliasing gets its own alias keyed on the
            # column index, so two columns whose stringified names collide (e.g.
            # tuple columns ``('a.b', 0)`` and ``('a.b', 1)`` both -> ``"a.b"``)
            # still map to distinct DataFrame columns. The trailing counter is
            # only needed on the extremely rare occasion that a user column
            # literally matches the default form.
            alias = f"{_COLUMN_ALIAS_PREFIX}{idx}"
            counter = 0
            while alias in reserved_names or alias in alias_to_original:
                counter += 1
                alias = f"{_COLUMN_ALIAS_PREFIX}{idx}-{counter}"
            alias_to_original[alias] = name
            original_to_alias.setdefault(name, alias)
            per_name_aliases.setdefault(name, []).append(alias)
            final_column_names.append(alias)
        else:
            final_column_names.append(name)

    df.columns = pd.Index(final_column_names)

    def _remap(name: str | None) -> str | None:
        if name is None:
            return None
        name = str(name)
        return original_to_alias.get(name, name)

    def _remap_y(name: str) -> str:
        # Position-aware: consume aliases in df-column order so duplicate y
        # entries (e.g. ``list(df.columns)`` on a df with duplicate labels) each
        # address a distinct DataFrame column instead of collapsing to the first
        # alias. If a caller passes more duplicates than the DataFrame actually
        # has, fall back to the first alias for that name so the reference still
        # points at an aliased column (never the pre-rename original).
        name = str(name)
        aliases = per_name_aliases.get(name)
        if aliases:
            # Intentionally destructive: each queue entry is consumed once,
            # matching one DataFrame column occurrence.
            return aliases.pop(0)
        return original_to_alias.get(name, name)

    remapped_y = [_remap_y(c) for c in y_column_list]

    return (
        _remap(x_column),
        remapped_y,
        _remap(color_column),
        _remap(size_column),
        _remap(sort_column),
        alias_to_original,
    )


def _parse_generic_column(
    df: pd.DataFrame, column_or_value: Any
) -> tuple[str | None, Any]:
    if isinstance(column_or_value, str) and column_or_value in df.columns:
        column_name = column_or_value
        value = None
    else:
        column_name = None
        value = column_or_value

    return column_name, value


def _parse_x_column(df: pd.DataFrame, x_from_user: str | None) -> str | None:
    if x_from_user is None:
        return None

    if isinstance(x_from_user, str):
        if x_from_user not in df.columns:
            raise StreamlitColumnNotFoundError(df, x_from_user)

        return x_from_user

    raise StreamlitAPIException(
        "x parameter should be a column name (str) or None to use the "
        f" dataframe's index. Value given: {x_from_user} "
        f"(type {type(x_from_user)})"
    )


def _parse_sort_column(df: pd.DataFrame, sort_from_user: bool | str) -> str | None:
    if sort_from_user is False or sort_from_user is True:
        return None

    sort_column = sort_from_user.removeprefix("-")
    if sort_column not in df.columns:
        raise StreamlitColumnNotFoundError(df, sort_column)

    return sort_column


def _parse_y_columns(
    df: pd.DataFrame,
    y_from_user: str | Sequence[str] | None,
    x_column: str | None,
) -> list[str]:
    y_column_list: list[str] = []

    if y_from_user is None:
        y_column_list = list(df.columns)

    elif isinstance(y_from_user, str):
        y_column_list = [y_from_user]

    else:
        y_column_list = [
            str(col) for col in dataframe_util.convert_anything_to_list(y_from_user)
        ]

    for col in y_column_list:
        if col not in df.columns:
            raise StreamlitColumnNotFoundError(df, col)

    # y_column_list should only include x_column when user explicitly asked for it.
    if x_column in y_column_list and (not y_from_user or x_column not in y_from_user):
        y_column_list.remove(x_column)

    return y_column_list


def _get_offset_encoding(
    chart_type: ChartType,
    color_column: str | None,
) -> tuple[alt.XOffset, alt.YOffset]:
    # Vega's Offset encoding channel is used to create grouped/non-stacked bar charts
    import altair as alt

    x_offset = alt.XOffset()
    y_offset = alt.YOffset()

    _color_column: str | alt.typing.Optional[Any] = (
        color_column if color_column is not None else alt.Undefined
    )

    if chart_type is ChartType.VERTICAL_BAR:
        x_offset = alt.XOffset(field=_color_column)
    elif chart_type is ChartType.HORIZONTAL_BAR:
        y_offset = alt.YOffset(field=_color_column)

    return x_offset, y_offset


def _get_opacity_encoding(
    chart_type: ChartType,
    stack: bool | ChartStackType | None,
    color_column: str | None,
) -> alt.OpacityValue | None:
    import altair as alt

    # Opacity set to 0.7 for all area charts
    if color_column and chart_type == ChartType.AREA:
        return alt.OpacityValue(0.7)

    # Layered bar chart
    if color_column and stack == "layered":
        return alt.OpacityValue(0.7)

    return None


def _get_axis_config(df: pd.DataFrame, column_name: str | None, grid: bool) -> alt.Axis:
    import altair as alt
    from pandas.api.types import is_integer_dtype

    if column_name is not None and is_integer_dtype(df[column_name]):
        # Use a max tick size of 1 for integer columns (prevents zoom into
        # float numbers) and deactivate grid lines for x-axis
        return alt.Axis(tickMinStep=1, grid=grid)

    return alt.Axis(grid=grid)


def _maybe_melt(
    df: pd.DataFrame,
    x_column: str | None,
    y_column_list: list[str],
    color_column: str | None,
    size_column: str | None,
    sort_column: str | None,
) -> tuple[pd.DataFrame, str | None, str | None]:
    """If multiple columns are set for y, melt the dataframe into long format."""
    y_column: str | None = None

    if len(y_column_list) == 0:
        y_column = None
    elif len(y_column_list) == 1:
        y_column = y_column_list[0]
    elif x_column is not None:
        # Pick column names that are unlikely to collide with user-given names.
        y_column = _MELTED_Y_COLUMN_NAME
        color_column = _MELTED_COLOR_COLUMN_NAME

        columns_to_leave_alone = [x_column]
        if size_column and size_column not in columns_to_leave_alone:
            columns_to_leave_alone.append(size_column)
        if sort_column and sort_column not in columns_to_leave_alone:
            columns_to_leave_alone.append(sort_column)

        df = _melt_data(
            df=df,
            columns_to_leave_alone=columns_to_leave_alone,
            columns_to_melt=y_column_list,
            new_y_column_name=y_column,
            new_color_column_name=color_column,
        )

    return df, y_column, color_column


def _get_axis_encodings(
    df: pd.DataFrame,
    chart_type: ChartType,
    x_column: str | None,
    y_column: str | None,
    x_from_user: str | None,
    y_from_user: str | Sequence[str] | None,
    x_axis_label: str | None,
    y_axis_label: str | None,
    stack: bool | ChartStackType | None,
    sort_from_user: bool | str,
    alias_to_original: dict[str, str],
) -> tuple[alt.X, alt.Y]:
    stack_encoding: alt.X | alt.Y
    sort_encoding: alt.X | alt.Y
    if chart_type == ChartType.HORIZONTAL_BAR:
        # Handle horizontal bar chart - switches x and y data and labels:
        x_encoding = _get_x_encoding(
            df, y_column, y_from_user, y_axis_label, chart_type, alias_to_original
        )
        y_encoding = _get_y_encoding(
            df, x_column, x_from_user, x_axis_label, chart_type, alias_to_original
        )
        stack_encoding = x_encoding
        sort_encoding = y_encoding
    else:
        x_encoding = _get_x_encoding(
            df, x_column, x_from_user, x_axis_label, chart_type, alias_to_original
        )
        y_encoding = _get_y_encoding(
            df, y_column, y_from_user, y_axis_label, chart_type, alias_to_original
        )
        stack_encoding = y_encoding
        sort_encoding = x_encoding

    # Handle stacking - only relevant for bar & area charts
    _update_encoding_with_stack(stack, stack_encoding)

    # Handle sorting - only relevant for bar charts
    if chart_type in {ChartType.VERTICAL_BAR, ChartType.HORIZONTAL_BAR}:
        _update_encoding_with_sort(sort_from_user, sort_encoding, alias_to_original)

    return x_encoding, y_encoding


def _get_x_encoding(
    df: pd.DataFrame,
    x_column: str | None,
    x_from_user: str | Sequence[str] | None,
    x_axis_label: str | None,
    chart_type: ChartType,
    alias_to_original: dict[str, str],
) -> alt.X:
    import altair as alt

    if x_column is None:
        # If no field is specified, the full axis disappears when no data is present.
        # Maybe a bug in vega-lite? So we pass a field that doesn't exist.
        x_field = _NON_EXISTENT_COLUMN_NAME
        x_title = ""
    elif x_column == _SEPARATED_INDEX_COLUMN_NAME:
        # If the x column name is the crazy anti-collision name we gave it, then need to
        # set up a title so we never show the crazy name to the user.
        x_field = x_column
        # Don't show a label in the x axis (not even a nice label like
        # SEPARATED_INDEX_COLUMN_TITLE) when we pull the x axis from the index.
        x_title = ""
    else:
        x_field = x_column

        # Only show a label in the x axis if the user passed a column explicitly. We
        # could go either way here, but I'm keeping this to avoid breaking the existing
        # behavior. Show the original (user-facing) name if we renamed the column.
        x_title = (
            "" if x_from_user is None else alias_to_original.get(x_column, x_column)
        )

    # User specified x-axis label takes precedence
    if x_axis_label is not None:
        x_title = x_axis_label

    # grid lines on x axis for horizontal bar charts only
    grid = chart_type == ChartType.HORIZONTAL_BAR

    return alt.X(
        x_field,
        title=x_title,
        type=_get_x_encoding_type(df, chart_type, x_column),
        scale=alt.Scale(),
        axis=_get_axis_config(df, x_column, grid=grid),
    )


def _get_y_encoding(
    df: pd.DataFrame,
    y_column: str | None,
    y_from_user: str | Sequence[str] | None,
    y_axis_label: str | None,
    chart_type: ChartType,
    alias_to_original: dict[str, str],
) -> alt.Y:
    import altair as alt

    if y_column is None:
        # If no field is specified, the full axis disappears when no data is present.
        # Maybe a bug in vega-lite? So we pass a field that doesn't exist.
        y_field = _NON_EXISTENT_COLUMN_NAME
        y_title = ""
    elif y_column == _MELTED_Y_COLUMN_NAME:
        # If the y column name is the crazy anti-collision name we gave it, then need to
        # set up a title so we never show the crazy name to the user.
        y_field = y_column
        # Don't show a label in the y axis (not even a nice label like
        # MELTED_Y_COLUMN_TITLE) when we pull the x axis from the index.
        y_title = ""
    else:
        y_field = y_column

        # Only show a label in the y axis if the user passed a column explicitly. We
        # could go either way here, but I'm keeping this to avoid breaking the existing
        # behavior. Show the original (user-facing) name if we renamed the column.
        y_title = (
            "" if y_from_user is None else alias_to_original.get(y_column, y_column)
        )

    # User specified y-axis label takes precedence
    if y_axis_label is not None:
        y_title = y_axis_label

    # grid lines on y axis for all charts except horizontal bar charts
    grid = chart_type != ChartType.HORIZONTAL_BAR

    return alt.Y(
        field=y_field,
        title=y_title,
        type=_get_y_encoding_type(df, chart_type, y_column),
        scale=alt.Scale(),
        axis=_get_axis_config(df, y_column, grid=grid),
    )


def _update_encoding_with_stack(
    stack: bool | ChartStackType | None,
    encoding: alt.X | alt.Y,
) -> None:
    if stack is None:
        return
    # Our layered option maps to vega's stack=False option
    if stack == "layered":
        stack = False

    encoding["stack"] = stack


def _update_encoding_with_sort(
    sort_from_user: bool | str,
    encoding: alt.X | alt.Y,
    alias_to_original: dict[str, str],
) -> None:
    """Apply sort to the given encoding in-place.

    - If sort is False: disable Altair's default sorting on the bar's categorical axis
        (i.e., set to None).
    - If sort is True: use Altair's default sorting.
    - If sort is a column name (optionally starting with '-') set a SortField with the correct order.

    Note: Column validation should be done before calling this function.
    """
    import altair as alt

    if sort_from_user is False:
        # Disable Altair's default sorting
        encoding["sort"] = None
    elif sort_from_user is True:
        # Use Altair's default sorting
        pass
    else:
        # String: sort by column name (optional '-' prefix for descending)
        sort_order: Literal["ascending", "descending"]
        if sort_from_user.startswith("-"):
            sort_order = "descending"
        else:
            sort_order = "ascending"
        sort_field = sort_from_user.removeprefix("-")
        # If the sort column was renamed to a safe alias (e.g. because its name
        # contained ".", "[", "]", or "\"), use the alias here so Vega-Lite finds
        # the actual field. See #7714. When multiple df columns share the same
        # original name, use the first alias assigned to that name so this stays
        # consistent with ``_remap`` (which also picks the first alias).
        sort_field = next(
            (alias for alias, orig in alias_to_original.items() if orig == sort_field),
            sort_field,
        )
        encoding["sort"] = alt.SortField(field=sort_field, order=sort_order)


def _get_color_encoding(
    df: pd.DataFrame,
    color_value: Color | None,
    color_column: str | None,
    y_column_list: list[str],
    color_from_user: str | Color | list[Color] | None,
    alias_to_original: dict[str, str],
) -> alt.Color | alt.ColorValue | None:
    import altair as alt

    has_color_value = color_value not in [None, [], ()]  # type: ignore[comparison-overlap]

    # If user passed a color value, that should win over colors coming from the
    # color column (be they manual or auto-assigned due to melting)
    if has_color_value:
        # If the color value is color-like, return that.
        if is_color_like(cast("Any", color_value)):
            if len(y_column_list) != 1:
                raise StreamlitColorLengthError(
                    [color_value] if color_value else [], y_column_list
                )

            return alt.ColorValue(to_css_color(cast("Any", color_value)))

        # Check for built-in color names (resolved on frontend, not converted here)
        if isinstance(color_value, str) and is_builtin_color_name(color_value):
            if len(y_column_list) != 1:
                raise StreamlitColorLengthError(
                    [color_value] if color_value else [], y_column_list
                )
            return alt.ColorValue(color_value)

        # If the color value is a list of colors of appropriate length, return that.
        if isinstance(color_value, (list, tuple)):
            color_values = cast("Collection[Color]", color_value)

            if len(color_values) != len(y_column_list):
                raise StreamlitColorLengthError(color_values, y_column_list)

            if len(color_values) == 1:
                first_color = cast("Any", color_value[0])
                # Pass through built-in color names as-is (resolved on frontend)
                if isinstance(first_color, str) and is_builtin_color_name(first_color):
                    return alt.ColorValue(first_color)
                return alt.ColorValue(to_css_color(first_color))

            # Convert colors, but pass through built-in color names as-is
            resolved_colors: list[Color] = []
            for c in color_values:
                if isinstance(c, str) and is_builtin_color_name(c):
                    resolved_colors.append(c)
                else:
                    resolved_colors.append(to_css_color(c))

            # After ``_prep_data`` the melted `color` column contains the
            # original user-facing y column names (aliases are only used as the
            # underlying data-column identifiers). ``y_column_list`` is likewise
            # in user-facing form here, so the scale domain lines up naturally
            # and no ``labelExpr`` remap is needed for the legend.
            return alt.Color(
                field=color_column if color_column is not None else alt.Undefined,
                scale=alt.Scale(domain=y_column_list, range=resolved_colors),
                legend=_COLOR_LEGEND_SETTINGS,
                type="nominal",
                title=" ",
            )

        raise StreamlitInvalidColorError(color_from_user)

    if color_column is not None:
        column_type: VegaLiteType

        column_type = (
            "nominal"
            if color_column == _MELTED_COLOR_COLUMN_NAME
            else _infer_vegalite_type(df[color_column])
        )

        # When the melted `color` column is in play its values are the original
        # (user-facing) y column names — ``_prep_data`` rewrites them from
        # aliases before we get here — so the legend labels come out correct
        # without any extra remapping. See #7714.
        color_enc = alt.Color(
            field=color_column, legend=_COLOR_LEGEND_SETTINGS, type=column_type
        )

        # Fix title if DF was melted
        if color_column == _MELTED_COLOR_COLUMN_NAME:
            # This has to contain an empty space, otherwise the
            # full y-axis disappears (maybe a bug in vega-lite)?
            color_enc["title"] = " "

        else:
            # If the color column was renamed to a safe alias, show the original
            # name as the legend title so the user sees their column name.
            if color_column in alias_to_original:
                color_enc["title"] = alias_to_original[color_column]

            # If the 0th element in the color column looks like a color, we'll use
            # the color column's values as the colors in our chart.
            if len(df[color_column]) and is_color_like(df[color_column].iat[0]):
                color_range = [to_css_color(c) for c in df[color_column].unique()]
                color_enc["scale"] = alt.Scale(range=color_range)
                # Don't show the color legend, because it will just show text with
                # the color values, like #f00, #00f, etc, which are not
                # user-readable.
                color_enc["legend"] = None

            # Otherwise, let Vega-Lite auto-assign colors.
            # This codepath is typically reached when the color column contains
            # numbers (in which case Vega-Lite uses a color gradient to represent
            # them) or strings (in which case Vega-Lite assigns one color for each
            # unique value).

        return color_enc

    return None


def _get_size_encoding(
    chart_type: ChartType,
    size_column: str | None,
    size_value: str | float | None,
    alias_to_original: dict[str, str],
) -> alt.Size | alt.SizeValue | None:
    import altair as alt

    if chart_type == ChartType.SCATTER:
        if size_column is not None:
            # Show the original (user-facing) name in the legend if the size column
            # was renamed to a safe alias.
            size_title = alias_to_original.get(size_column, size_column)
            return alt.Size(
                size_column,
                title=size_title,
                legend=_SIZE_LEGEND_SETTINGS,
            )

        if isinstance(size_value, (float, int)):
            return alt.SizeValue(size_value)
        if size_value is None:
            return alt.SizeValue(100)
        raise StreamlitAPIException(
            f"This does not look like a valid size: {size_value!r}"
        )

    if (
        size_column is not None or size_value is not None
    ):  # pragma: no cover - defensive
        raise Error(
            f"Chart type {chart_type.name} does not support size argument. "
            "This should never happen!"
        )

    return None


def _get_tooltip_encoding(
    x_column: str,
    y_column: str,
    size_column: str | None,
    color_column: str | None,
    color_enc: alt.Color | alt.ColorValue | None,
    alias_to_original: dict[str, str],
) -> list[alt.Tooltip]:
    import altair as alt

    tooltip = []

    # If the x column name is the crazy anti-collision name we gave it, then need to set
    # up a tooltip title so we never show the crazy name to the user.
    if x_column == _SEPARATED_INDEX_COLUMN_NAME:
        tooltip.append(alt.Tooltip(x_column, title=_SEPARATED_INDEX_COLUMN_TITLE))
    elif x_column in alias_to_original:
        tooltip.append(alt.Tooltip(x_column, title=alias_to_original[x_column]))
    else:
        tooltip.append(alt.Tooltip(x_column))

    # If the y column name is the crazy anti-collision name we gave it, then need to set
    # up a tooltip title so we never show the crazy name to the user.
    if y_column == _MELTED_Y_COLUMN_NAME:
        tooltip.append(
            alt.Tooltip(
                y_column,
                title=_MELTED_Y_COLUMN_TITLE,
                # Just picked something random. Doesn't really matter:
                type="quantitative",
            )
        )
    elif y_column in alias_to_original:
        tooltip.append(alt.Tooltip(y_column, title=alias_to_original[y_column]))
    else:
        tooltip.append(alt.Tooltip(y_column))

    # If we earlier decided that there should be no color legend, that's because the
    # user passed a color column with actual color values (like "#ff0"), so we should
    # not show the color values in the tooltip.
    if color_column and getattr(color_enc, "legend", True) is not None:
        # Use a human-readable title for the color.
        if color_column == _MELTED_COLOR_COLUMN_NAME:
            tooltip.append(
                alt.Tooltip(
                    color_column,
                    title=_MELTED_COLOR_COLUMN_TITLE,
                    type="nominal",
                )
            )
        elif color_column in alias_to_original:
            tooltip.append(
                alt.Tooltip(color_column, title=alias_to_original[color_column])
            )
        else:
            tooltip.append(alt.Tooltip(color_column))

    if size_column:
        if size_column in alias_to_original:
            tooltip.append(
                alt.Tooltip(size_column, title=alias_to_original[size_column])
            )
        else:
            tooltip.append(alt.Tooltip(size_column))

    return tooltip


def _get_x_encoding_type(
    df: pd.DataFrame, chart_type: ChartType, x_column: str | None
) -> VegaLiteType:
    if x_column is None:
        return "quantitative"  # Anything. If None, Vega-Lite may hide the axis.

    # Vertical bar charts should have a discrete (ordinal) x-axis,
    # UNLESS type is date/time
    # https://github.com/streamlit/streamlit/pull/2097#issuecomment-714802475
    if chart_type == ChartType.VERTICAL_BAR and not _is_date_column(df, x_column):
        return "ordinal"

    return _infer_vegalite_type(df[x_column])


def _get_y_encoding_type(
    df: pd.DataFrame, chart_type: ChartType, y_column: str | None
) -> VegaLiteType:
    # Horizontal bar charts should have a discrete (ordinal) y-axis,
    # UNLESS type is date/time
    if chart_type == ChartType.HORIZONTAL_BAR and not _is_date_column(df, y_column):
        return "ordinal"

    if y_column:
        return _infer_vegalite_type(df[y_column])

    return "quantitative"  # Pick anything. If undefined, Vega-Lite may hide the axis.


class StreamlitColumnNotFoundError(StreamlitAPIException):
    def __init__(self, df: pd.DataFrame, col_name: str, *args: Any) -> None:
        available_columns = ", ".join(str(c) for c in list(df.columns))
        message = (
            f'Data does not have a column named `"{col_name}"`. '
            f"Available columns are `{available_columns}`"
        )
        super().__init__(message, *args)


class StreamlitInvalidColorError(StreamlitAPIException):
    def __init__(self, color_from_user: str | Color | list[Color] | None) -> None:
        message = f"""
This does not look like a valid color argument: `{color_from_user}`.

The color argument can be:

* A hex string like "#ffaa00" or "#ffaa0088".
* An RGB or RGBA tuple with the red, green, blue, and alpha
  components specified as ints from 0 to 255 or floats from 0.0 to
  1.0.
* The name of a column.
* Or a list of colors, matching the number of y columns to draw.
        """
        super().__init__(message)


class StreamlitColorLengthError(StreamlitAPIException):
    def __init__(
        self,
        color_values: str | Color | Collection[Color] | None,
        y_column_list: list[str],
    ) -> None:
        message = (
            f"The list of colors `{color_values}` must have the same "
            "length as the list of columns to be colored "
            f"`{y_column_list}`."
        )
        super().__init__(message)
