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

from __future__ import annotations

import datetime
from typing import Iterable, List, Union

from typing_extensions import Literal, NotRequired, TypeAlias, TypedDict

from streamlit.runtime.metrics_util import gather_metrics

ColumnWidth: TypeAlias = Literal["small", "medium", "large"]

# Type alias that represents all available column types
# which are configurable by the user.
ColumnType: TypeAlias = Literal[
    "object",
    "text",
    "number",
    "checkbox",
    "selectbox",
    "list",
    "datetime",
    "date",
    "time",
    "link",
    "line_chart",
    "bar_chart",
    "image",
    "progress",
]


class NumberColumnConfig(TypedDict):
    type: Literal["number"]
    format: NotRequired[str | None]
    min_value: NotRequired[int | float | None]
    max_value: NotRequired[int | float | None]
    step: NotRequired[int | float | None]


class TextColumnConfig(TypedDict):
    type: Literal["text"]
    max_chars: NotRequired[int | None]
    validate: NotRequired[str | None]


class CheckboxColumnConfig(TypedDict):
    type: Literal["checkbox"]


class SelectboxColumnConfig(TypedDict):
    type: Literal["selectbox"]
    options: NotRequired[List[str | int | float] | None]


class LinkColumnConfig(TypedDict):
    type: Literal["link"]
    max_chars: NotRequired[int | None]
    validate: NotRequired[str | None]


class BarChartColumnConfig(TypedDict):
    type: Literal["bar_chart"]
    y_min: NotRequired[int | float | None]
    y_max: NotRequired[int | float | None]


class LineChartColumnConfig(TypedDict):
    type: Literal["line_chart"]
    y_min: NotRequired[int | float | None]
    y_max: NotRequired[int | float | None]


class ImageColumnConfig(TypedDict):
    type: Literal["image"]


class ListColumnConfig(TypedDict):
    type: Literal["list"]


class DatetimeColumnConfig(TypedDict):
    type: Literal["datetime"]
    format: NotRequired[str | None]
    min_value: NotRequired[str | None]
    max_value: NotRequired[str | None]
    step: NotRequired[int | float | None]
    timezone: NotRequired[str | None]


class TimeColumnConfig(TypedDict):
    type: Literal["time"]
    format: NotRequired[str | None]
    min_value: NotRequired[str | None]
    max_value: NotRequired[str | None]
    step: NotRequired[int | float | None]


class DateColumnConfig(TypedDict):
    type: Literal["date"]
    format: NotRequired[str | None]
    min_value: NotRequired[str | None]
    max_value: NotRequired[str | None]
    step: NotRequired[int | None]


class ProgressColumnConfig(TypedDict):
    type: Literal["progress"]
    format: NotRequired[str | None]
    min_value: NotRequired[int | float | None]
    max_value: NotRequired[int | float | None]


class ColumnConfig(TypedDict, total=False):
    """Configuration options for columns in ``st.dataframe`` and ``st.data_editor``.

    Parameters
    ----------

    label: str or None
        The label shown at the top of the column. If None (default),
        the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. Can be one of “small”, “medium”, or “large”.
        If None (default), the column will be sized to fit the cell contents.

    help: str or None
        An optional tooltip that gets displayed when hovering over the column label.

    disabled: bool or None
        Whether editing should be disabled for this column. Defaults to False.

    required: bool or None
        Whether edited cells in the column need to have a value. If True, an edited cell
        can only be submitted if it has a value other than None. Defaults to False.

    default: str, bool, int, float, or None
        Specifies the default value in this column when a new row is added by the user.

    hidden: bool or None
        Whether to hide the column. Defaults to False.

    type_config: dict or str or None
        Configure a column type and type specific options.
    """

    label: str | None
    width: ColumnWidth | None
    help: str | None
    hidden: bool | None
    disabled: bool | None
    required: bool | None
    default: str | bool | int | float | None
    alignment: Literal["left", "center", "right"] | None
    type_config: Union[
        NumberColumnConfig,
        TextColumnConfig,
        CheckboxColumnConfig,
        SelectboxColumnConfig,
        LinkColumnConfig,
        ListColumnConfig,
        DatetimeColumnConfig,
        DateColumnConfig,
        TimeColumnConfig,
        ProgressColumnConfig,
        LineChartColumnConfig,
        BarChartColumnConfig,
        ImageColumnConfig,
        None,
    ]


@gather_metrics("column_config.Column")
def Column(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    disabled: bool | None = None,
    required: bool | None = None,
) -> ColumnConfig:
    """Configure a generic column in ```st.dataframe``` or ```st.data_editor```.

    The type of the column will be automatically inferred from the data type.
    This command needs to be used in the ``column_config`` parameter of ``st.dataframe``
    or ``st.data_editor``.

    To change the type of the column and enable type-specific configuration options,
    use one of the column types in the ``st.column_config`` namespace,
    e.g. ``st.column_config.NumberColumn``.

    Parameters
    ----------

    label: str or None
        The label shown at the top of the column. If None (default),
        the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. Can be one of “small”, “medium”, or “large”.
        If None (default), the column will be sized to fit the cell contents.

    help: str or None
        An optional tooltip that gets displayed when hovering over the column label.

    disabled: bool or None
        Whether editing should be disabled for this column. Defaults to False.

    required: bool or None
        Whether edited cells in the column need to have a value. If True, an edited cell
        can only be submitted if it has a value other than None. Defaults to False.
    """
    return ColumnConfig(
        label=label, width=width, help=help, disabled=disabled, required=required
    )


@gather_metrics("column_config.NumberColumn")
def NumberColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    disabled: bool | None = None,
    required: bool | None = None,
    default: int | float | None = None,
    format: str | None = None,
    min_value: int | float | None = None,
    max_value: int | float | None = None,
    step: int | float | None = None,
) -> ColumnConfig:
    """Configure a number column in ``st.dataframe`` or ``st.data_editor``.

    This is the default column type for integer and float values. This command needs to
    be used in the ``column_config`` parameter of ``st.dataframe`` or ``st.data_editor``.
    When used with ``st.data_editor``, editing will be enabled with a numeric input widget.

    Parameters
    ----------

    label: str or None
        The label shown at the top of the column. If None (default),
        the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. Can be one of “small”, “medium”, or “large”.
        If None (default), the column will be sized to fit the cell contents.

    help: str or None
        An optional tooltip that gets displayed when hovering over the column label.

    disabled: bool or None
        Whether editing should be disabled for this column. Defaults to False.

    required: bool or None
        Whether edited cells in the column need to have a value. If True, an edited cell
        can only be submitted if it has a value other than None. Defaults to False.

    default: int, float, or None
        Specifies the default value in this column when a new row is added by the user.

    format : str or None
        A printf-style format string controlling how numbers are displayed.
        This does not impact the return value. Valid formatters: %d %e %f %g %i %u.
        You can also add prefixes and suffixes.

    min_value : int, float, or None
        The minimum value that can be entered.
        If None (default), there will be no minimum.

    max_value : int, float, or None
        The maximum value that can be entered.
        If None (default), there will be no maximum.

    step: int, float, or None
        The stepping interval. Specifies the precision of numbers that can be entered.
        If None (default), uses 1 for integers and unrestricted precision for floats.
    """

    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        default=default,
        type_config=NumberColumnConfig(
            type="number",
            min_value=min_value,
            max_value=max_value,
            format=format,
            step=step,
        ),
    )


@gather_metrics("column_config.TextColumn")
def TextColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    disabled: bool | None = None,
    required: bool | None = None,
    default: str | None = None,
    max_chars: int | None = None,
    validate: str | None = None,
) -> ColumnConfig:
    """Configure a text column in ``st.dataframe`` or ``st.data_editor``.

    This is the default column type for string values. This command needs to be used in the
    ``column_config`` parameter of ``st.dataframe`` or ``st.data_editor``. When used with
    ``st.data_editor``, editing will be enabled with a text input widget.

    Parameters
    ----------

    label: str or None
        The label shown at the top of the column. If None (default),
        the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. Can be one of “small”, “medium”, or “large”.
        If None (default), the column will be sized to fit the cell contents.

    help: str or None
        An optional tooltip that gets displayed when hovering over the column label.

    disabled: bool or None
        Whether editing should be disabled for this column. Defaults to False.

    required: bool or None
        Whether edited cells in the column need to have a value. If True, an edited cell
        can only be submitted if it has a value other than None. Defaults to False.

    default: str or None
        Specifies the default value in this column when a new row is added by the user.

    max_chars: int or None
        The maximum number of characters that can be entered. If None (default),
        there will be no maximum.

    validate: str or None
        A regular expression (JS flavor) that edited values are validated against.
        If the input is invalid, it will not be submitted.
    """

    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        default=default,
        type_config=TextColumnConfig(
            type="text", max_chars=max_chars, validate=validate
        ),
    )


@gather_metrics("column_config.LinkColumn")
def LinkColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    disabled: bool | None = None,
    required: bool | None = None,
    default: str | None = None,
    max_chars: int | None = None,
    validate: str | None = None,
) -> ColumnConfig:
    """Configure a link column in ``st.dataframe`` or ``st.data_editor``.

    The cell values need to be string and will be shown as clickable links.
    This command needs to be used in the column_config parameter of ``st.dataframe``
    or ``st.data_editor``. When used with ``st.data_editor``, editing will be enabled
    with a text input widget.

    Parameters
    ----------

    label: str or None
        The label shown at the top of the column. If None (default),
        the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. Can be one of “small”, “medium”, or “large”.
        If None (default), the column will be sized to fit the cell contents.

    help: str or None
        An optional tooltip that gets displayed when hovering over the column label.

    disabled: bool or None
        Whether editing should be disabled for this column. Defaults to False.

    required: bool or None
        Whether edited cells in the column need to have a value. If True, an edited cell
        can only be submitted if it has a value other than None. Defaults to False.

    default: str or None
        Specifies the default value in this column when a new row is added by the user.

    max_chars: int or None
        The maximum number of characters that can be entered. If None (default),
        there will be no maximum.

    validate: str or None
        A regular expression (JS flavor) that edited values are validated against.
        If the input is invalid, it will not be submitted.
    """

    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        default=default,
        type_config=LinkColumnConfig(
            type="link", max_chars=max_chars, validate=validate
        ),
    )


@gather_metrics("column_config.CheckboxColumn")
def CheckboxColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    disabled: bool | None = None,
    required: bool | None = None,
    default: bool | None = None,
) -> ColumnConfig:
    """Configure a checkbox column in ``st.dataframe`` or ``st.data_editor``.

    This is the default column type for boolean values. This command needs to be used in
    the ``column_config`` parameter of ``st.dataframe`` or ``st.data_editor``.
    When used with ``st.data_editor``, editing will be enabled with a checkbox widget.

    Parameters
    ----------

    label: str or None
        The label shown at the top of the column. If None (default),
        the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. Can be one of “small”, “medium”, or “large”.
        If None (default), the column will be sized to fit the cell contents.

    help: str or None
        An optional tooltip that gets displayed when hovering over the column label.

    disabled: bool or None
        Whether editing should be disabled for this column. Defaults to False.

    required: bool or None
        Whether edited cells in the column need to have a value. If True, an edited cell
        can only be submitted if it has a value other than None. Defaults to False.

    default: bool or None
        Specifies the default value in this column when a new row is added by the user.
    """

    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        default=default,
        type_config=CheckboxColumnConfig(type="checkbox"),
    )


@gather_metrics("column_config.SelectboxColumn")
def SelectboxColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    disabled: bool | None = None,
    required: bool | None = None,
    default: str | int | float | None = None,
    options: Iterable[str | int | float] | None = None,
) -> ColumnConfig:
    """Configure a selectbox column in ``st.dataframe`` or ``st.data_editor``.

    This is the default column type for Pandas categorical values. This command needs to
    be used in the ``column_config`` parameter of ``st.dataframe`` or ``st.data_editor``.
    When used with ``st.data_editor``, editing will be enabled with a selectbox widget.

    Parameters
    ----------

    label: str or None
        The label shown at the top of the column. If None (default),
        the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. Can be one of “small”, “medium”, or “large”.
        If None (default), the column will be sized to fit the cell contents.

    help: str or None
        An optional tooltip that gets displayed when hovering over the column label.

    disabled: bool or None
        Whether editing should be disabled for this column. Defaults to False.

    required: bool or None
        Whether edited cells in the column need to have a value. If True, an edited cell
        can only be submitted if it has a value other than None. Defaults to False.

    default: str, int, float, bool, or None
        Specifies the default value in this column when a new row is added by the user.

    options: iterable of str or None
        The options that can be selected during editing. If None (default), this will be
        inferred from the underlying dataframe column if its dtype is “category”
        (`see Pandas docs on categorical data <https://pandas.pydata.org/docs/user_guide/categorical.html>`_).
    """

    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        default=default,
        type_config=SelectboxColumnConfig(
            type="selectbox", options=list(options) if options is not None else None
        ),
    )


@gather_metrics("column_config.BarChartColumn")
def BarChartColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    y_min: int | float | None = None,
    y_max: int | float | None = None,
) -> ColumnConfig:
    """Configure a bar chart column in ``st.dataframe`` or ``st.data_editor``.

    Cells need to contain a list of numbers. Chart columns are not editable
    at the moment. This command needs to be used in the ``column_config`` parameter
    of ``st.dataframe`` or ``st.data_editor``.

    Parameters
    ----------

    label: str or None
        The label shown at the top of the column. If None (default),
        the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. Can be one of “small”, “medium”, or “large”.
        If None (default), the column will be sized to fit the cell contents.

    help: str or None
        An optional tooltip that gets displayed when hovering over the column label.

    y_min: int, float, or None
        The minimum value on the y-axis for all cells in the column.
        If None (default), every cell will use the minimum of its data.

    y_max: int, float, or None
        The maximum value on the y-axis for all cells in the column. If None (default),
        every cell will use the maximum of its data.
    """

    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        type_config=BarChartColumnConfig(type="bar_chart", y_min=y_min, y_max=y_max),
    )


@gather_metrics("column_config.LineChartColumn")
def LineChartColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    y_min: int | float | None = None,
    y_max: int | float | None = None,
) -> ColumnConfig:
    """Configure a line chart column in ``st.dataframe`` or ``st.data_editor``.

    Cells need to contain a list of numbers. Chart columns are not editable
    at the moment. This command needs to be used in the ``column_config`` parameter
    of ``st.dataframe`` or ``st.data_editor``.

    Parameters
    ----------

    label: str or None
        The label shown at the top of the column. If None (default),
        the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. Can be one of “small”, “medium”, or “large”.
        If None (default), the column will be sized to fit the cell contents.

    help: str or None
        An optional tooltip that gets displayed when hovering over the column label.

    y_min: int, float, or None
        The minimum value on the y-axis for all cells in the column.
        If None (default), every cell will use the minimum of its data.

    y_max: int, float, or None
        The maximum value on the y-axis for all cells in the column. If None (default),
        every cell will use the maximum of its data.
    """

    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        type_config=LineChartColumnConfig(type="line_chart", y_min=y_min, y_max=y_max),
    )


@gather_metrics("column_config.ImageColumn")
def ImageColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
):
    """Configure an image column in ``st.dataframe`` or ``st.data_editor``.

    The cell values need to be one of:

    * A URL to fetch the image from. This can also be a relative URL of an image
      deployed via `static file serving <https://docs.streamlit.io/library/advanced-features/static-file-serving>`_.
      Note that you can NOT use an arbitrary local image if it is not available through
      a public URL.
    * An SVG XML data URL like ``data:image/svg+xml;utf8,<svg xmlns=...</svg>``.
    * A string containing a Base64 encoded image like ``data:image/png;base64,iVBO...``.

    Image columns are not editable at the moment. This command needs to be used in the
    ``column_config`` parameter of ``st.dataframe`` or ``st.data_editor``.

    Parameters
    ----------

    label: str or None
        The label shown at the top of the column. If None (default),
        the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. Can be one of “small”, “medium”, or “large”.
        If None (default), the column will be sized to fit the cell contents.

    help: str or None
        An optional tooltip that gets displayed when hovering over the column label.
    """
    return ColumnConfig(
        label=label, width=width, help=help, type_config=ImageColumnConfig(type="image")
    )


@gather_metrics("column_config.ListColumn")
def ListColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
):
    """Configure a list column in ``st.dataframe`` or ``st.data_editor``.

    This is the default column type for list-like values. List columns are not editable
    at the moment. This command needs to be used in the ``column_config`` parameter of
    ``st.dataframe`` or ``st.data_editor``.

    Parameters
    ----------

    label: str or None
        The label shown at the top of the column. If None (default),
        the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. Can be one of “small”, “medium”, or “large”.
        If None (default), the column will be sized to fit the cell contents.

    help: str or None
        An optional tooltip that gets displayed when hovering over the column label.
    """
    return ColumnConfig(
        label=label, width=width, help=help, type_config=ListColumnConfig(type="list")
    )


@gather_metrics("column_config.DatetimeColumn")
def DatetimeColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    disabled: bool | None = None,
    required: bool | None = None,
    default: datetime.datetime | None = None,
    format: str | None = None,
    min_value: datetime.datetime | None = None,
    max_value: datetime.datetime | None = None,
    step: int | float | datetime.timedelta | None = None,
    timezone: str | None = None,
) -> ColumnConfig:
    """Configure a datetime column in ``st.dataframe`` or ``st.data_editor``.

    This is the default column type for datetime values. This command needs to be
    used in the ``column_config`` parameter of ``st.dataframe`` or
    ``st.data_editor``. When used with ``st.data_editor``, editing will be enabled
    with a datetime picker widget.

    Parameters
    ----------

    label: str or None
        The label shown at the top of the column. If None (default),
        the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. Can be one of “small”, “medium”, or “large”.
        If None (default), the column will be sized to fit the cell contents.

    help: str or None
        An optional tooltip that gets displayed when hovering over the column label.

    disabled: bool or None
        Whether editing should be disabled for this column. Defaults to False.

    required: bool or None
        Whether edited cells in the column need to have a value. If True, an edited cell
        can only be submitted if it has a value other than None. Defaults to False.

    default: datetime.datetime or None
        Specifies the default value in this column when a new row is added by the user.

    format: str or None
        A momentJS format string controlling how datetimes are displayed. See
        `momentJS docs <https://momentjs.com/docs/#/displaying/format/>`_ for available
        formats. If None (default), uses ``YYYY-MM-DD HH:mm:ss``.

    min_value: datetime.datetime or None
        The minimum datetime that can be entered.
        If None (default), there will be no minimum.

    max_value: datetime.datetime or None
        The maximum datetime that can be entered.
        If None (default), there will be no minimum.

    step: int, float, datetime.timedelta, or None
        The stepping interval in seconds. If None (default), the step will be 1 second.

    timezone: str or None
        The timezone of this column. If None (default),
        the timezone is inferred from the underlying data.
    """

    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        default=None if default is None else default.isoformat(),
        type_config=DatetimeColumnConfig(
            type="datetime",
            format=format,
            min_value=None if min_value is None else min_value.isoformat(),
            max_value=None if max_value is None else max_value.isoformat(),
            step=step.total_seconds() if isinstance(step, datetime.timedelta) else step,
            timezone=timezone,
        ),
    )


@gather_metrics("column_config.TimeColumn")
def TimeColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    disabled: bool | None = None,
    required: bool | None = None,
    default: datetime.time | None = None,
    format: str | None = None,
    min_value: datetime.time | None = None,
    max_value: datetime.time | None = None,
    step: int | float | datetime.timedelta | None = None,
) -> ColumnConfig:
    """Configure a time column in ``st.dataframe`` or ``st.data_editor``.

    This is the default column type for time values. This command needs to be used in
    the ``column_config`` parameter of ``st.dataframe`` or ``st.data_editor``. When
    used with ``st.data_editor``, editing will be enabled with a time picker widget.

    Parameters
    ----------

    label: str or None
        The label shown at the top of the column. If None (default),
        the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. Can be one of “small”, “medium”, or “large”.
        If None (default), the column will be sized to fit the cell contents.

    help: str or None
        An optional tooltip that gets displayed when hovering over the column label.

    disabled: bool or None
        Whether editing should be disabled for this column. Defaults to False.

    required: bool or None
        Whether edited cells in the column need to have a value. If True, an edited cell
        can only be submitted if it has a value other than None. Defaults to False.

    default: datetime.time or None
        Specifies the default value in this column when a new row is added by the user.

    format: str or None
        A momentJS format string controlling how times are displayed. See
        `momentJS docs <https://momentjs.com/docs/#/displaying/format/>`_ for available
        formats. If None (default), uses ``HH:mm:ss``.

    min_value: datetime.time or None
        The minimum time that can be entered.
        If None (default), there will be no minimum.

    max_value: datetime.time or None
        The maximum time that can be entered.
        If None (default), there will be no minimum.

    step: int, float, datetime.timedelta, or None
        The stepping interval in seconds. If None (default), the step will be 1 second.
    """

    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        default=None if default is None else default.isoformat(),
        type_config=TimeColumnConfig(
            type="time",
            format=format,
            min_value=None if min_value is None else min_value.isoformat(),
            max_value=None if max_value is None else max_value.isoformat(),
            step=step.total_seconds() if isinstance(step, datetime.timedelta) else step,
        ),
    )


@gather_metrics("column_config.DateColumn")
def DateColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    disabled: bool | None = None,
    required: bool | None = None,
    default: datetime.date | None = None,
    format: str | None = None,
    min_value: datetime.date | None = None,
    max_value: datetime.date | None = None,
    step: int | None = None,
) -> ColumnConfig:
    """Configure a date column in ``st.dataframe`` or ``st.data_editor``.

    This is the default column type for date values. This command needs to be used in
    the ``column_config`` parameter of ``st.dataframe`` or ``st.data_editor``. When used
    with ``st.data_editor``, editing will be enabled with a date picker widget.

    Parameters
    ----------

    label: str or None
        The label shown at the top of the column. If None (default),
        the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. Can be one of “small”, “medium”, or “large”.
        If None (default), the column will be sized to fit the cell contents.

    help: str or None
        An optional tooltip that gets displayed when hovering over the column label.

    disabled: bool or None
        Whether editing should be disabled for this column. Defaults to False.

    required: bool or None
        Whether edited cells in the column need to have a value. If True, an edited cell
        can only be submitted if it has a value other than None. Defaults to False.

    default: datetime.date or None
        Specifies the default value in this column when a new row is added by the user.

    format: str or None
        A momentJS format string controlling how times are displayed. See
        `momentJS docs <https://momentjs.com/docs/#/displaying/format/>`_ for available
        formats. If None (default), uses ``YYYY-MM-DD``.

    min_value: datetime.date or None
        The minimum date that can be entered.
        If None (default), there will be no minimum.

    max_value: datetime.date or None
        The maximum date that can be entered.
        If None (default), there will be no minimum.

    step: int or None
        The stepping interval in days. If None (default), the step will be 1 day.
    """
    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        default=None if default is None else default.isoformat(),
        type_config=DateColumnConfig(
            type="date",
            format=format,
            min_value=None if min_value is None else min_value.isoformat(),
            max_value=None if max_value is None else max_value.isoformat(),
            step=step,
        ),
    )


@gather_metrics("column_config.ProgressColumn")
def ProgressColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    format: str | None = None,
    min_value: int | float | None = None,
    max_value: int | float | None = None,
) -> ColumnConfig:
    """Configure a progress column in ``st.dataframe`` or ``st.data_editor``.

    Cells need to contain a number. Progress columns are not editable at the moment.
    This command needs to be used in the ``column_config`` parameter of ``st.dataframe``
    or ``st.data_editor``.

    Parameters
    ----------

    label: str or None
        The label shown at the top of the column. If None (default),
        the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. Can be one of “small”, “medium”, or “large”.
        If None (default), the column will be sized to fit the cell contents.

    help: str or None
        An optional tooltip that gets displayed when hovering over the column label.

    format : str or None
        A printf-style format string controlling how numbers are displayed.
        Valid formatters: %d %e %f %g %i %u. You can also add prefixes and suffixes.

    min_value : int, float, or None
        The minimum value of the progress bar.
        If None (default), will be 0.

    max_value : int, float, or None
        The minimum value of the progress bar. If None (default), will be 100 for
        integer values and 1 for float values.
    """

    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        type_config=ProgressColumnConfig(
            type="progress",
            format=format,
            min_value=min_value,
            max_value=max_value,
        ),
    )
