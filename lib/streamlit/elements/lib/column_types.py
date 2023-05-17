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
from typing import Iterable

from streamlit.elements.lib.column_config_utils import (
    ColumnConfig,
    ColumnType,
    ColumnWidth,
)


def NumberColumn(
    *,
    label: str | None = None,
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
        title=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        type="number",
        default=default,
        type_options={
            "min_value": min_value,
            "max_value": max_value,
            "format": format,
            "step": step,
        },
    )


def TextColumn(
    *,
    label: str | None = None,
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
        title=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        default=default,
        type="text",
        type_options={
            "max_chars": max_chars,
            "validate": validate,
        },
    )


def LinkColumn(
    *,
    label: str | None = None,
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
        title=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        default=default,
        type="link",
        type_options={
            "max_chars": max_chars,
            "validate": validate,
        },
    )


def CheckboxColumn(
    *,
    label: str | None = None,
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
        title=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        default=default,
        type="checkbox",
    )


def SelectboxColumn(
    *,
    label: str | None = None,
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
        title=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        default=default,
        type="selectbox",
        type_options={
            "options": list(options) if options is not None else None,
        },
    )


def BarChartColumn(
    *,
    label: str | None = None,
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
        title=label,
        width=width,
        help=help,
        type="bar_chart",
        type_options={
            "y_min": y_min,
            "y_max": y_max,
        },
    )


def LineChartColumn(
    *,
    label: str | None = None,
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
        title=label,
        width=width,
        help=help,
        type="line_chart",
        type_options={
            "y_min": y_min,
            "y_max": y_max,
        },
    )


def ImageColumn(
    *,
    label: str | None = None,
    width: ColumnWidth | None = None,
    help: str | None = None,
):
    """Configure an image column in ``st.dataframe`` or ``st.data_editor``.

    The cell values need to be one of:

    - A URL to fetch the image from. This can also be a relative URL of an image
      deployed via `static file serving <https://docs.streamlit.io/library/advanced-features/static-file-serving>`_.
      Note that you can NOT use an arbitrary local image if it is not available through
      a public URL.
    - An SVG XML data URL like ``data:image/svg+xml;utf8,<svg xmlns=...</svg>``.
    - A string containing a Base64 encoded image like ``data:image/png;base64,iVBO...``.

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
        title=label,
        width=width,
        help=help,
        type="image",
    )


def ListColumn(
    *,
    label: str | None = None,
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
        title=label,
        width=width,
        help=help,
        type="list",
    )


def DatetimeColumn(
    *,
    label: str | None = None,
    width: ColumnWidth | None = None,
    help: str | None = None,
    disabled: bool | None = None,
    required: bool | None = None,
    default: datetime.datetime | None = None,
    format: str | None = None,
    min_value: datetime.datetime | None = None,
    max_value: datetime.datetime | None = None,
    step: int | float | None = None,
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
        A date-fns format string controlling how datetimes are displayed. See
        `date-fns docs <hhttps://date-fns.org/docs/format>`_ for available formats.
        If None (default), uses ``yyyy-MM-dd HH:mm:ss``.

    min_value: datetime.datetime or None
        The minimum datetime that can be entered.
        If None (default), there will be no minimum.

    max_value: datetime.datetime or None
        The maximum datetime that can be entered.
        If None (default), there will be no minimum.

    step: int, float, or None
        The stepping interval in seconds. If None (default), the step will be 1 second.

    timezone: str or None
        The timezone of this column. If None (default),
        the timezone is inferred from the underlying data.
    """

    def _format_datetime(value: datetime.datetime | None) -> str | None:
        return None if value is None else value.isoformat()

    return ColumnConfig(
        title=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        default=_format_datetime(default),
        type="datetime",
        type_options={
            "format": format,
            "min_value": _format_datetime(min_value),
            "max_value": _format_datetime(max_value),
            "step": step,
            "timezone": timezone,
        },
    )


def TimeColumn(
    *,
    label: str | None = None,
    width: ColumnWidth | None = None,
    help: str | None = None,
    disabled: bool | None = None,
    required: bool | None = None,
    default: datetime.time | None = None,
    format: str | None = None,
    min_value: datetime.time | None = None,
    max_value: datetime.time | None = None,
    step: int | float | None = None,
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
        A date-fns format string controlling how times are displayed. See
        `date-fns docs <hhttps://date-fns.org/docs/format>`_ for available formats.
        If None (default), uses ``HH:mm:ss``.

    min_value: datetime.time or None
        The minimum time that can be entered.
        If None (default), there will be no minimum.

    max_value: datetime.time or None
        The maximum time that can be entered.
        If None (default), there will be no minimum.

    step: int, float or None
        The stepping interval in seconds. If None (default), the step will be 1 second.
    """

    # TODO: Check if this code is correct:
    def _format_time(value: datetime.time | None) -> str | None:
        return None if value is None else value.isoformat()

    return ColumnConfig(
        title=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        default=_format_time(default),
        type="time",
        type_options={
            "format": format,
            "min_value": _format_time(min_value),
            "max_value": _format_time(max_value),
            "step": step,
        },
    )


def DateColumn(
    *,
    label: str | None = None,
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
        A date-fns format string controlling how dates are displayed. See
        `date-fns docs <hhttps://date-fns.org/docs/format>`_ for available formats.
        If None (default), uses ``yyyy-MM-dd``.

    min_value: datetime.date or None
        The minimum date that can be entered.
        If None (default), there will be no minimum.

    max_value: datetime.date or None
        The maximum date that can be entered.
        If None (default), there will be no minimum.

    step: int or None
        The stepping interval in days. If None (default), the step will be 1 day.
    """

    # TODO: Check if this code is correct:
    def _format_date(value: datetime.date | None) -> str | None:
        return None if value is None else value.isoformat()

    return ColumnConfig(
        title=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        default=_format_date(default),
        type="date",
        type_options={
            "format": format,
            "min_value": _format_date(min_value),
            "max_value": _format_date(max_value),
            "step": step,
        },
    )


def ProgressColumn(
    *,
    label: str | None = None,
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
        title=label,
        width=width,
        help=help,
        type="progress",
        type_options={
            "min_value": min_value,
            "max_value": max_value,
            "format": format,
        },
    )


class ColumnConfigAPI:
    """Configure options for columns in ``st.dataframe`` and `st.data_editor`.

    This needs to be used as input to the column_config parameter of st.dataframe
    or st.data_editor. For more type-specific configuration options, use one of
    the column types available in ``st.column_config.`` namespace, e.g.
    ``st.column_config.NumberColumn``.

    Parameters
    ----------
    title: str
        The title of the column shown at the top in the column header.
        If None (default), the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. Can be either small, medium, or large.
        If None (default), the column will be sized to fit its contents.

    help: str or None
        An optional tooltip that gets displayed when hovering over the column header.

    required: bool or None
        If True, a cell can only be submitted by the user if it has a value.
        This will ensure that the data_editor never returns None as a value in this
        column. Defaults to False.

        This configuration option does not have any effect
        if used with a disabled column.

    type: "text", "number", "checkbox", "select", “list”,“datetime”, “date”, “time”, “url”, “image”, “line_chart”, “bar_chart”, “range” or None
        The type name for the column. If None, infers the type from the underlying
        data in the column. Defaults to None. To apply any type-specific configuration
        options, use one of the column types available in the ``st.column_config.``
        namespace - e.g. ``st.column_config.NumberColumn`` - as replacement for the
        ``st.column_config`` command.
    """

    def __call__(
        self,
        title: str | None = None,
        *,
        width: ColumnWidth | None = None,
        help: str | None = None,
        required: bool | None = None,
        type: ColumnType | None = None,
    ) -> ColumnConfig:
        """Configures a single table column.

        This needs to be used as input to the column_config parameter of st.dataframe
        or st.data_editor. For more type-specific configuration options, use one of
        the column types available in ``st.column_config.`` namespace, e.g.
        ``st.column_config.NumberColumn``.

        Parameters
        ----------
        title: str
            The title of the column shown at the top in the column header.
            If None (default), the column name is used.

        width: "small", "medium", "large", or None
            The display width of the column. Can be either small, medium, or large.
            If None (default), the column will be sized to fit its contents.

        help: str or None
            An optional tooltip that gets displayed when hovering over the column header.

        required: bool or None
            If True, a cell can only be submitted by the user if it has a value.
            This will ensure that the data_editor never returns None as a value in this
            column. Defaults to False.

            This configuration option does not have any effect
            if used with a disabled column.

        type: "text", "number", "checkbox", "select", “list”,“datetime”, “date”, “time”, “url”, “image”, “line_chart”, “bar_chart”, “range” or None
            The type name for the column. If None, infers the type from the underlying
            data in the column. Defaults to None. To apply any type-specific configuration
            options, use one of the column types available in the ``st.column_config.``
            namespace - e.g. ``st.column_config.NumberColumn`` - as replacement for the
            ``st.column_config`` command.
        """

        return ColumnConfig(
            type=type,
            title=title,
            width=width,
            help=help,
            required=required,
        )

    NumberColumn = NumberColumn
    TextColumn = TextColumn
    CheckboxColumn = CheckboxColumn
    SelectboxColumn = SelectboxColumn
    ListColumn = ListColumn
    DatetimeColumn = DatetimeColumn
    DateColumn = DateColumn
    TimeColumn = TimeColumn
    LinkColumn = LinkColumn
    ImageColumn = ImageColumn
    BarChartColumn = BarChartColumn
    LineChartColumn = LineChartColumn
    ProgressColumn = ProgressColumn


column_config = ColumnConfigAPI()
