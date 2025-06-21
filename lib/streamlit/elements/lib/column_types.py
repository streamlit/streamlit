# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

# Allow function names with uppercase letters:
# ruff: noqa: N802

from __future__ import annotations

import datetime
from typing import TYPE_CHECKING, Literal, TypedDict

from typing_extensions import NotRequired, TypeAlias

from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from collections.abc import Iterable

NumberFormat: TypeAlias = Literal[
    "plain",
    "localized",
    "dollar",
    "euro",
    "yen",
    "percent",
    "compact",
    "scientific",
    "engineering",
    "accounting",
]

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
    "area_chart",
    "image",
    "progress",
    "json",
]


class NumberColumnConfig(TypedDict):
    type: Literal["number"]
    format: NotRequired[str | NumberFormat | None]
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
    options: NotRequired[list[str | int | float] | None]


class LinkColumnConfig(TypedDict):
    type: Literal["link"]
    max_chars: NotRequired[int | None]
    validate: NotRequired[str | None]
    display_text: NotRequired[str | None]


class BarChartColumnConfig(TypedDict):
    type: Literal["bar_chart"]
    y_min: NotRequired[int | float | None]
    y_max: NotRequired[int | float | None]


class LineChartColumnConfig(TypedDict):
    type: Literal["line_chart"]
    y_min: NotRequired[int | float | None]
    y_max: NotRequired[int | float | None]


class AreaChartColumnConfig(TypedDict):
    type: Literal["area_chart"]
    y_min: NotRequired[int | float | None]
    y_max: NotRequired[int | float | None]


class ImageColumnConfig(TypedDict):
    type: Literal["image"]


class ListColumnConfig(TypedDict):
    type: Literal["list"]


class DatetimeColumnConfig(TypedDict):
    type: Literal["datetime"]
    format: NotRequired[
        str | Literal["localized", "distance", "calendar", "iso8601"] | None
    ]
    min_value: NotRequired[str | None]
    max_value: NotRequired[str | None]
    step: NotRequired[int | float | None]
    timezone: NotRequired[str | None]


class TimeColumnConfig(TypedDict):
    type: Literal["time"]
    format: NotRequired[str | Literal["localized", "iso8601"] | None]
    min_value: NotRequired[str | None]
    max_value: NotRequired[str | None]
    step: NotRequired[int | float | None]


class DateColumnConfig(TypedDict):
    type: Literal["date"]
    format: NotRequired[str | Literal["localized", "distance", "iso8601"] | None]
    min_value: NotRequired[str | None]
    max_value: NotRequired[str | None]
    step: NotRequired[int | None]


class ProgressColumnConfig(TypedDict):
    type: Literal["progress"]
    format: NotRequired[str | NumberFormat | None]
    min_value: NotRequired[int | float | None]
    max_value: NotRequired[int | float | None]


class JsonColumnConfig(TypedDict):
    type: Literal["json"]


class ColumnConfig(TypedDict, total=False):
    """Configuration options for columns in ``st.dataframe`` and ``st.data_editor``.

    Parameters
    ----------
    label: str or None
        The label shown at the top of the column. If this is ``None``
        (default), the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. If this is ``None`` (default), the
        column will be sized to fit the cell contents. Otherwise, this can be
        one of the following:

        - ``"small"``: 75px wide
        - ``"medium"``: 200px wide
        - ``"large"``: 400px wide

    help: str or None
        A tooltip that gets displayed when hovering over the column label. If
        this is ``None`` (default), no tooltip is displayed.

        The tooltip can optionally contain GitHub-flavored Markdown, including
        the Markdown directives described in the ``body`` parameter of
        ``st.markdown``.

    disabled: bool or None
        Whether editing should be disabled for this column. If this is ``None``
        (default), Streamlit will decide: indices are disabled and data columns
        are not.

        If a column has mixed types, it may become uneditable regardless of
        ``disabled``.

    required: bool or None
        Whether edited cells in the column need to have a value. If this is
        ``False`` (default), the user can submit empty values for this column.
        If this is ``True``, an edited cell in this column can only be
        submitted if its value is not ``None``, and a new row will only be
        submitted after the user fills in this column.

    pinned: bool or None
        Whether the column is pinned. A pinned column will stay visible on the
        left side no matter where the user scrolls. If this is ``None``
        (default), Streamlit will decide: index columns are pinned, and data
        columns are not pinned.

    default: str, bool, int, float, or None
        Specifies the default value in this column when a new row is added by
        the user. This defaults to ``None``.

    hidden: bool or None
        Whether to hide the column. This defaults to ``False``.

    type_config: dict or str or None
        Configure a column type and type specific options.
    """

    label: str | None
    width: ColumnWidth | None
    help: str | None
    hidden: bool | None
    disabled: bool | None
    required: bool | None
    pinned: bool | None
    default: str | bool | int | float | None
    alignment: Literal["left", "center", "right"] | None
    type_config: (
        NumberColumnConfig
        | TextColumnConfig
        | CheckboxColumnConfig
        | SelectboxColumnConfig
        | LinkColumnConfig
        | ListColumnConfig
        | DatetimeColumnConfig
        | DateColumnConfig
        | TimeColumnConfig
        | ProgressColumnConfig
        | LineChartColumnConfig
        | BarChartColumnConfig
        | AreaChartColumnConfig
        | ImageColumnConfig
        | JsonColumnConfig
        | None
    )


@gather_metrics("column_config.Column")
def Column(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    disabled: bool | None = None,
    required: bool | None = None,
    pinned: bool | None = None,
) -> ColumnConfig:
    """Configure a generic column in ``st.dataframe`` or ``st.data_editor``.

    The type of the column will be automatically inferred from the data type.
    This command needs to be used in the ``column_config`` parameter of ``st.dataframe``
    or ``st.data_editor``.

    To change the type of the column and enable type-specific configuration options,
    use one of the column types in the ``st.column_config`` namespace,
    e.g. ``st.column_config.NumberColumn``.

    Parameters
    ----------
    label: str or None
        The label shown at the top of the column. If this is ``None``
        (default), the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. If this is ``None`` (default), the
        column will be sized to fit the cell contents. Otherwise, this can be
        one of the following:

        - ``"small"``: 75px wide
        - ``"medium"``: 200px wide
        - ``"large"``: 400px wide

    help: str or None
        A tooltip that gets displayed when hovering over the column label. If
        this is ``None`` (default), no tooltip is displayed.

        The tooltip can optionally contain GitHub-flavored Markdown, including
        the Markdown directives described in the ``body`` parameter of
        ``st.markdown``.

    disabled: bool or None
        Whether editing should be disabled for this column. If this is ``None``
        (default), Streamlit will decide: indices are disabled and data columns
        are not.

        If a column has mixed types, it may become uneditable regardless of
        ``disabled``.

    required: bool or None
        Whether edited cells in the column need to have a value. If this is
        ``False`` (default), the user can submit empty values for this column.
        If this is ``True``, an edited cell in this column can only be
        submitted if its value is not ``None``, and a new row will only be
        submitted after the user fills in this column.

    pinned: bool or None
        Whether the column is pinned. A pinned column will stay visible on the
        left side no matter where the user scrolls. If this is ``None``
        (default), Streamlit will decide: index columns are pinned, and data
        columns are not pinned.

    Examples
    --------
    >>> import pandas as pd
    >>> import streamlit as st
    >>>
    >>> data_df = pd.DataFrame(
    >>>     {
    >>>         "widgets": ["st.selectbox", "st.number_input", "st.text_area", "st.button"],
    >>>     }
    >>> )
    >>>
    >>> st.data_editor(
    >>>     data_df,
    >>>     column_config={
    >>>         "widgets": st.column_config.Column(
    >>>             "Streamlit Widgets",
    >>>             help="Streamlit **widget** commands 🎈",
    >>>             width="medium",
    >>>             required=True,
    >>>         )
    >>>     },
    >>>     hide_index=True,
    >>>     num_rows="dynamic",
    >>> )

    .. output::
        https://doc-column.streamlit.app/
        height: 300px
    """
    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        pinned=pinned,
    )


@gather_metrics("column_config.NumberColumn")
def NumberColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    disabled: bool | None = None,
    required: bool | None = None,
    pinned: bool | None = None,
    default: int | float | None = None,
    format: str | NumberFormat | None = None,
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
        The label shown at the top of the column. If this is ``None``
        (default), the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. If this is ``None`` (default), the
        column will be sized to fit the cell contents. Otherwise, this can be
        one of the following:

        - ``"small"``: 75px wide
        - ``"medium"``: 200px wide
        - ``"large"``: 400px wide

    help: str or None
        A tooltip that gets displayed when hovering over the column label. If
        this is ``None`` (default), no tooltip is displayed.

        The tooltip can optionally contain GitHub-flavored Markdown, including
        the Markdown directives described in the ``body`` parameter of
        ``st.markdown``.

    disabled: bool or None
        Whether editing should be disabled for this column. If this is ``None``
        (default), Streamlit will decide: indices are disabled and data columns
        are not.

        If a column has mixed types, it may become uneditable regardless of
        ``disabled``.

    required: bool or None
        Whether edited cells in the column need to have a value. If this is
        ``False`` (default), the user can submit empty values for this column.
        If this is ``True``, an edited cell in this column can only be
        submitted if its value is not ``None``, and a new row will only be
        submitted after the user fills in this column.

    pinned: bool or None
        Whether the column is pinned. A pinned column will stay visible on the
        left side no matter where the user scrolls. If this is ``None``
        (default), Streamlit will decide: index columns are pinned, and data
        columns are not pinned.

    default: int, float, or None
        Specifies the default value in this column when a new row is added by
        the user. This defaults to ``None``.

    format:  str, "plain", "localized", "percent", "dollar", "euro", "yen", "accounting", "compact", "scientific", "engineering", or None
        A format string controlling how numbers are displayed.
        This can be one of the following values:

        - ``None`` (default): Streamlit infers the formatting from the data.
        - ``"plain"``: Show the full number without any formatting (e.g. "1234.567").
        - ``"localized"``: Show the number in the default locale format (e.g. "1,234.567").
        - ``"percent"``: Show the number as a percentage (e.g. "123456.70%").
        - ``"dollar"``: Show the number as a dollar amount (e.g. "$1,234.57").
        - ``"euro"``: Show the number as a euro amount (e.g. "€1,234.57").
        - ``"yen"``: Show the number as a yen amount (e.g. "¥1,235").
        - ``"accounting"``: Show the number in an accounting format (e.g. "1,234.00").
        - ``"compact"``: Show the number in a compact format (e.g. "1.2K").
        - ``"scientific"``: Show the number in scientific notation (e.g. "1.235E3").
        - ``"engineering"``: Show the number in engineering notation (e.g. "1.235E3").
        - printf-style format string: Format the number with a printf
          specifier, like ``"%d"`` to show a signed integer (e.g. "1234") or
          ``"%X"`` to show an unsigned hexadecimal integer (e.g. "4D2"). You
          can also add prefixes and suffixes. To show British pounds, use
          ``"£ %.2f"`` (e.g. "£ 1234.57"). For more information, see `sprint-js
          <https://github.com/alexei/sprintf.js?tab=readme-ov-file#format-specification>`_.

        Formatting from ``column_config`` always takes precedence over
        formatting from ``pandas.Styler``. The formatting does not impact the
        return value when used in ``st.data_editor``.

    min_value: int, float, or None
        The minimum value that can be entered. If this is ``None`` (default),
        there will be no minimum.

    max_value: int, float, or None
        The maximum value that can be entered. If this is ``None`` (default),
        there will be no maximum.

    step: int, float, or None
        The precision of numbers that can be entered. If this ``None``
        (default), integer columns will have a step of 1 and float columns will
        have unrestricted precision. In this case, some floats may display like
        integers. Setting ``step`` for float columns will ensure a consistent
        number of digits after the decimal even without setting ``format``.

    Examples
    --------
    >>> import pandas as pd
    >>> import streamlit as st
    >>>
    >>> data_df = pd.DataFrame(
    >>>     {
    >>>         "price": [20, 950, 250, 500],
    >>>     }
    >>> )
    >>>
    >>> st.data_editor(
    >>>     data_df,
    >>>     column_config={
    >>>         "price": st.column_config.NumberColumn(
    >>>             "Price (in USD)",
    >>>             help="The price of the product in USD",
    >>>             min_value=0,
    >>>             max_value=1000,
    >>>             step=1,
    >>>             format="$%d",
    >>>         )
    >>>     },
    >>>     hide_index=True,
    >>> )

    .. output::
        https://doc-number-column.streamlit.app/
        height: 300px
    """  # noqa: E501

    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        pinned=pinned,
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
    pinned: bool | None = None,
    default: str | None = None,
    max_chars: int | None = None,
    validate: str | None = None,
) -> ColumnConfig:
    r"""Configure a text column in ``st.dataframe`` or ``st.data_editor``.

    This is the default column type for string values. This command needs to be used in the
    ``column_config`` parameter of ``st.dataframe`` or ``st.data_editor``. When used with
    ``st.data_editor``, editing will be enabled with a text input widget.

    Parameters
    ----------
    label: str or None
        The label shown at the top of the column. If this is ``None``
        (default), the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. If this is ``None`` (default), the
        column will be sized to fit the cell contents. Otherwise, this can be
        one of the following:

        - ``"small"``: 75px wide
        - ``"medium"``: 200px wide
        - ``"large"``: 400px wide

    help: str or None
        A tooltip that gets displayed when hovering over the column label. If
        this is ``None`` (default), no tooltip is displayed.

        The tooltip can optionally contain GitHub-flavored Markdown, including
        the Markdown directives described in the ``body`` parameter of
        ``st.markdown``.

    disabled: bool or None
        Whether editing should be disabled for this column. If this is ``None``
        (default), Streamlit will decide: indices are disabled and data columns
        are not.

        If a column has mixed types, it may become uneditable regardless of
        ``disabled``.

    required: bool or None
        Whether edited cells in the column need to have a value. If this is
        ``False`` (default), the user can submit empty values for this column.
        If this is ``True``, an edited cell in this column can only be
        submitted if its value is not ``None``, and a new row will only be
        submitted after the user fills in this column.

    pinned: bool or None
        Whether the column is pinned. A pinned column will stay visible on the
        left side no matter where the user scrolls. If this is ``None``
        (default), Streamlit will decide: index columns are pinned, and data
        columns are not pinned.

    default: str or None
        Specifies the default value in this column when a new row is added by
        the user. This defaults to ``None``.

    max_chars: int or None
        The maximum number of characters that can be entered. If this is
        ``None`` (default), there will be no maximum.

    validate: str or None
        A JS-flavored regular expression (e.g. ``"^[a-z]+$"``) that edited
        values are validated against. If the user input is invalid, it will not
        be submitted.

    Examples
    --------
    >>> import pandas as pd
    >>> import streamlit as st
    >>>
    >>> data_df = pd.DataFrame(
    >>>     {
    >>>         "widgets": ["st.selectbox", "st.number_input", "st.text_area", "st.button"],
    >>>     }
    >>> )
    >>>
    >>> st.data_editor(
    >>>     data_df,
    >>>     column_config={
    >>>         "widgets": st.column_config.TextColumn(
    >>>             "Widgets",
    >>>             help="Streamlit **widget** commands 🎈",
    >>>             default="st.",
    >>>             max_chars=50,
    >>>             validate=r"^st\.[a-z_]+$",
    >>>         )
    >>>     },
    >>>     hide_index=True,
    >>> )

    .. output::
        https://doc-text-column.streamlit.app/
        height: 300px
    """

    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        pinned=pinned,
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
    pinned: bool | None = None,
    default: str | None = None,
    max_chars: int | None = None,
    validate: str | None = None,
    display_text: str | None = None,
) -> ColumnConfig:
    r"""Configure a link column in ``st.dataframe`` or ``st.data_editor``.

    The cell values need to be string and will be shown as clickable links.
    This command needs to be used in the column_config parameter of ``st.dataframe``
    or ``st.data_editor``. When used with ``st.data_editor``, editing will be enabled
    with a text input widget.

    Parameters
    ----------
    label: str or None
        The label shown at the top of the column. If this is ``None``
        (default), the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. If this is ``None`` (default), the
        column will be sized to fit the cell contents. Otherwise, this can be
        one of the following:

        - ``"small"``: 75px wide
        - ``"medium"``: 200px wide
        - ``"large"``: 400px wide

    help: str or None
        A tooltip that gets displayed when hovering over the column label. If
        this is ``None`` (default), no tooltip is displayed.

        The tooltip can optionally contain GitHub-flavored Markdown, including
        the Markdown directives described in the ``body`` parameter of
        ``st.markdown``.

    disabled: bool or None
        Whether editing should be disabled for this column. If this is ``None``
        (default), Streamlit will decide: indices are disabled and data columns
        are not.

        If a column has mixed types, it may become uneditable regardless of
        ``disabled``.

    required: bool or None
        Whether edited cells in the column need to have a value. If this is
        ``False`` (default), the user can submit empty values for this column.
        If this is ``True``, an edited cell in this column can only be
        submitted if its value is not ``None``, and a new row will only be
        submitted after the user fills in this column.

    pinned: bool or None
        Whether the column is pinned. A pinned column will stay visible on the
        left side no matter where the user scrolls. If this is ``None``
        (default), Streamlit will decide: index columns are pinned, and data
        columns are not pinned.

    default: str or None
        Specifies the default value in this column when a new row is added by
        the user. This defaults to ``None``.

    max_chars: int or None
        The maximum number of characters that can be entered. If this is
        ``None`` (default), there will be no maximum.

    validate: str or None
        A JS-flavored regular expression (e.g. ``"^https://.+$"``) that edited
        values are validated against. If the user input is invalid, it will not
        be submitted.

    display_text: str or None
        The text that is displayed in the cell. This can be one of the
        following:

        - ``None`` (default) to display the URL itself.
        - A string that is displayed in every cell, e.g. ``"Open link"``.
        - A JS-flavored regular expression (detected by usage of parentheses)
          to extract a part of the URL via a capture group. For example, use
          ``"https://(.*?)\.example\.com"`` to extract the display text
          "foo" from the URL "\https://foo.example.com".

        .. Comment: The backslash in front of foo.example.com prevents a hyperlink in docs.

        For more complex cases, you may use `Pandas Styler's format
        <https://pandas.pydata.org/docs/reference/api/pandas.io.formats.style.Styler.format.html>`_
        function on the underlying dataframe. Note that this makes the app slow,
        doesn't work with editable columns, and might be removed in the future.
        Text formatting from ``column_config`` always takes precedence over
        text formatting from ``pandas.Styler``.

    Examples
    --------
    >>> import pandas as pd
    >>> import streamlit as st
    >>>
    >>> data_df = pd.DataFrame(
    >>>     {
    >>>         "apps": [
    >>>             "https://roadmap.streamlit.app",
    >>>             "https://extras.streamlit.app",
    >>>             "https://issues.streamlit.app",
    >>>             "https://30days.streamlit.app",
    >>>         ],
    >>>         "creator": [
    >>>             "https://github.com/streamlit",
    >>>             "https://github.com/arnaudmiribel",
    >>>             "https://github.com/streamlit",
    >>>             "https://github.com/streamlit",
    >>>         ],
    >>>     }
    >>> )
    >>>
    >>> st.data_editor(
    >>>     data_df,
    >>>     column_config={
    >>>         "apps": st.column_config.LinkColumn(
    >>>             "Trending apps",
    >>>             help="The top trending Streamlit apps",
    >>>             validate=r"^https://[a-z]+\.streamlit\.app$",
    >>>             max_chars=100,
    >>>             display_text=r"https://(.*?)\.streamlit\.app"
    >>>         ),
    >>>         "creator": st.column_config.LinkColumn(
    >>>             "App Creator", display_text="Open profile"
    >>>         ),
    >>>     },
    >>>     hide_index=True,
    >>> )

    .. output::
        https://doc-link-column.streamlit.app/
        height: 300px
    """

    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        pinned=pinned,
        default=default,
        type_config=LinkColumnConfig(
            type="link",
            max_chars=max_chars,
            validate=validate,
            display_text=display_text,
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
    pinned: bool | None = None,
    default: bool | None = None,
) -> ColumnConfig:
    """Configure a checkbox column in ``st.dataframe`` or ``st.data_editor``.

    This is the default column type for boolean values. This command needs to be used in
    the ``column_config`` parameter of ``st.dataframe`` or ``st.data_editor``.
    When used with ``st.data_editor``, editing will be enabled with a checkbox widget.

    Parameters
    ----------
    label: str or None
        The label shown at the top of the column. If this is ``None``
        (default), the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. If this is ``None`` (default), the
        column will be sized to fit the cell contents. Otherwise, this can be
        one of the following:

        - ``"small"``: 75px wide
        - ``"medium"``: 200px wide
        - ``"large"``: 400px wide

    help: str or None
        A tooltip that gets displayed when hovering over the column label. If
        this is ``None`` (default), no tooltip is displayed.

        The tooltip can optionally contain GitHub-flavored Markdown, including
        the Markdown directives described in the ``body`` parameter of
        ``st.markdown``.

    disabled: bool or None
        Whether editing should be disabled for this column. If this is ``None``
        (default), Streamlit will decide: indices are disabled and data columns
        are not.

        If a column has mixed types, it may become uneditable regardless of
        ``disabled``.

    required: bool or None
        Whether edited cells in the column need to have a value. If this is
        ``False`` (default), the user can submit empty values for this column.
        If this is ``True``, an edited cell in this column can only be
        submitted if its value is not ``None``, and a new row will only be
        submitted after the user fills in this column.

    pinned: bool or None
        Whether the column is pinned. A pinned column will stay visible on the
        left side no matter where the user scrolls. If this is ``None``
        (default), Streamlit will decide: index columns are pinned, and data
        columns are not pinned.

    default: bool or None
        Specifies the default value in this column when a new row is added by
        the user. This defaults to ``None``.

    Examples
    --------
    >>> import pandas as pd
    >>> import streamlit as st
    >>>
    >>> data_df = pd.DataFrame(
    >>>     {
    >>>         "widgets": ["st.selectbox", "st.number_input", "st.text_area", "st.button"],
    >>>         "favorite": [True, False, False, True],
    >>>     }
    >>> )
    >>>
    >>> st.data_editor(
    >>>     data_df,
    >>>     column_config={
    >>>         "favorite": st.column_config.CheckboxColumn(
    >>>             "Your favorite?",
    >>>             help="Select your **favorite** widgets",
    >>>             default=False,
    >>>         )
    >>>     },
    >>>     disabled=["widgets"],
    >>>     hide_index=True,
    >>> )

    .. output::
        https://doc-checkbox-column.streamlit.app/
        height: 300px
    """

    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        pinned=pinned,
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
    pinned: bool | None = None,
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
        The label shown at the top of the column. If this is ``None``
        (default), the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. If this is ``None`` (default), the
        column will be sized to fit the cell contents. Otherwise, this can be
        one of the following:

        - ``"small"``: 75px wide
        - ``"medium"``: 200px wide
        - ``"large"``: 400px wide

    help: str or None
        A tooltip that gets displayed when hovering over the column label. If
        this is ``None`` (default), no tooltip is displayed.

        The tooltip can optionally contain GitHub-flavored Markdown, including
        the Markdown directives described in the ``body`` parameter of
        ``st.markdown``.

    disabled: bool or None
        Whether editing should be disabled for this column. If this is ``None``
        (default), Streamlit will decide: indices are disabled and data columns
        are not.

        If a column has mixed types, it may become uneditable regardless of
        ``disabled``.

    required: bool or None
        Whether edited cells in the column need to have a value. If this is
        ``False`` (default), the user can submit empty values for this column.
        If this is ``True``, an edited cell in this column can only be
        submitted if its value is not ``None``, and a new row will only be
        submitted after the user fills in this column.

    pinned: bool or None
        Whether the column is pinned. A pinned column will stay visible on the
        left side no matter where the user scrolls. If this is ``None``
        (default), Streamlit will decide: index columns are pinned, and data
        columns are not pinned.

    default: str, int, float, bool, or None
        Specifies the default value in this column when a new row is added by
        the user. This defaults to ``None``.

    options: Iterable of str or None
        The options that can be selected during editing. If this is ``None``
        (default), the options will be inferred from the underlying dataframe
        column if its dtype is "category". For more information, see `Pandas docs
        <https://pandas.pydata.org/docs/user_guide/categorical.html>`_).

    Examples
    --------
    >>> import pandas as pd
    >>> import streamlit as st
    >>>
    >>> data_df = pd.DataFrame(
    >>>     {
    >>>         "category": [
    >>>             "📊 Data Exploration",
    >>>             "📈 Data Visualization",
    >>>             "🤖 LLM",
    >>>             "📊 Data Exploration",
    >>>         ],
    >>>     }
    >>> )
    >>>
    >>> st.data_editor(
    >>>     data_df,
    >>>     column_config={
    >>>         "category": st.column_config.SelectboxColumn(
    >>>             "App Category",
    >>>             help="The category of the app",
    >>>             width="medium",
    >>>             options=[
    >>>                 "📊 Data Exploration",
    >>>                 "📈 Data Visualization",
    >>>                 "🤖 LLM",
    >>>             ],
    >>>             required=True,
    >>>         )
    >>>     },
    >>>     hide_index=True,
    >>> )

    .. output::
        https://doc-selectbox-column.streamlit.app/
        height: 300px
    """

    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        pinned=pinned,
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
    pinned: bool | None = None,
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
        The label shown at the top of the column. If this is ``None``
        (default), the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. If this is ``None`` (default), the
        column will be sized to fit the cell contents. Otherwise, this can be
        one of the following:

        - ``"small"``: 75px wide
        - ``"medium"``: 200px wide
        - ``"large"``: 400px wide

    help: str or None
        A tooltip that gets displayed when hovering over the column label. If
        this is ``None`` (default), no tooltip is displayed.

        The tooltip can optionally contain GitHub-flavored Markdown, including
        the Markdown directives described in the ``body`` parameter of
        ``st.markdown``.

    pinned: bool or None
        Whether the column is pinned. A pinned column will stay visible on the
        left side no matter where the user scrolls. If this is ``None``
        (default), Streamlit will decide: index columns are pinned, and data
        columns are not pinned.

    y_min: int, float, or None
        The minimum value on the y-axis for all cells in the column. If this is
        ``None`` (default), every cell will use the minimum of its data.

    y_max: int, float, or None
        The maximum value on the y-axis for all cells in the column. If this is
        ``None`` (default), every cell will use the maximum of its data.

    Examples
    --------
    >>> import pandas as pd
    >>> import streamlit as st
    >>>
    >>> data_df = pd.DataFrame(
    >>>     {
    >>>         "sales": [
    >>>             [0, 4, 26, 80, 100, 40],
    >>>             [80, 20, 80, 35, 40, 100],
    >>>             [10, 20, 80, 80, 70, 0],
    >>>             [10, 100, 20, 100, 30, 100],
    >>>         ],
    >>>     }
    >>> )
    >>>
    >>> st.data_editor(
    >>>     data_df,
    >>>     column_config={
    >>>         "sales": st.column_config.BarChartColumn(
    >>>             "Sales (last 6 months)",
    >>>             help="The sales volume in the last 6 months",
    >>>             y_min=0,
    >>>             y_max=100,
    >>>         ),
    >>>     },
    >>>     hide_index=True,
    >>> )

    .. output::
        https://doc-barchart-column.streamlit.app/
        height: 300px
    """

    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        pinned=pinned,
        type_config=BarChartColumnConfig(type="bar_chart", y_min=y_min, y_max=y_max),
    )


@gather_metrics("column_config.LineChartColumn")
def LineChartColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    pinned: bool | None = None,
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
        The label shown at the top of the column. If this is ``None``
        (default), the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. If this is ``None`` (default), the
        column will be sized to fit the cell contents. Otherwise, this can be
        one of the following:

        - ``"small"``: 75px wide
        - ``"medium"``: 200px wide
        - ``"large"``: 400px wide

    help: str or None
        A tooltip that gets displayed when hovering over the column label. If
        this is ``None`` (default), no tooltip is displayed.

        The tooltip can optionally contain GitHub-flavored Markdown, including
        the Markdown directives described in the ``body`` parameter of
        ``st.markdown``.

    pinned: bool or None
        Whether the column is pinned. A pinned column will stay visible on the
        left side no matter where the user scrolls. If this is ``None``
        (default), Streamlit will decide: index columns are pinned, and data
        columns are not pinned.

    y_min: int, float, or None
        The minimum value on the y-axis for all cells in the column. If this is
        ``None`` (default), every cell will use the minimum of its data.

    y_max: int, float, or None
        The maximum value on the y-axis for all cells in the column. If this is
        ``None`` (default), every cell will use the maximum of its data.

    Examples
    --------
    >>> import pandas as pd
    >>> import streamlit as st
    >>>
    >>> data_df = pd.DataFrame(
    >>>     {
    >>>         "sales": [
    >>>             [0, 4, 26, 80, 100, 40],
    >>>             [80, 20, 80, 35, 40, 100],
    >>>             [10, 20, 80, 80, 70, 0],
    >>>             [10, 100, 20, 100, 30, 100],
    >>>         ],
    >>>     }
    >>> )
    >>>
    >>> st.data_editor(
    >>>     data_df,
    >>>     column_config={
    >>>         "sales": st.column_config.LineChartColumn(
    >>>             "Sales (last 6 months)",
    >>>             width="medium",
    >>>             help="The sales volume in the last 6 months",
    >>>             y_min=0,
    >>>             y_max=100,
    >>>          ),
    >>>     },
    >>>     hide_index=True,
    >>> )

    .. output::
        https://doc-linechart-column.streamlit.app/
        height: 300px
    """

    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        pinned=pinned,
        type_config=LineChartColumnConfig(type="line_chart", y_min=y_min, y_max=y_max),
    )


@gather_metrics("column_config.AreaChartColumn")
def AreaChartColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    pinned: bool | None = None,
    y_min: int | float | None = None,
    y_max: int | float | None = None,
) -> ColumnConfig:
    """Configure an area chart column in ``st.dataframe`` or ``st.data_editor``.

    Cells need to contain a list of numbers. Chart columns are not editable
    at the moment. This command needs to be used in the ``column_config`` parameter
    of ``st.dataframe`` or ``st.data_editor``.

    Parameters
    ----------
    label: str or None
        The label shown at the top of the column. If this is ``None``
        (default), the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. If this is ``None`` (default), the
        column will be sized to fit the cell contents. Otherwise, this can be
        one of the following:

        - ``"small"``: 75px wide
        - ``"medium"``: 200px wide
        - ``"large"``: 400px wide

    help: str or None
        A tooltip that gets displayed when hovering over the column label. If
        this is ``None`` (default), no tooltip is displayed.

        The tooltip can optionally contain GitHub-flavored Markdown, including
        the Markdown directives described in the ``body`` parameter of
        ``st.markdown``.

    pinned: bool or None
        Whether the column is pinned. A pinned column will stay visible on the
        left side no matter where the user scrolls. If this is ``None``
        (default), Streamlit will decide: index columns are pinned, and data
        columns are not pinned.

    y_min: int, float, or None
        The minimum value on the y-axis for all cells in the column. If this is
        ``None`` (default), every cell will use the minimum of its data.

    y_max: int, float, or None
        The maximum value on the y-axis for all cells in the column. If this is
        ``None`` (default), every cell will use the maximum of its data.

    Examples
    --------
    >>> import pandas as pd
    >>> import streamlit as st
    >>>
    >>> data_df = pd.DataFrame(
    >>>     {
    >>>         "sales": [
    >>>             [0, 4, 26, 80, 100, 40],
    >>>             [80, 20, 80, 35, 40, 100],
    >>>             [10, 20, 80, 80, 70, 0],
    >>>             [10, 100, 20, 100, 30, 100],
    >>>         ],
    >>>     }
    >>> )
    >>>
    >>> st.data_editor(
    >>>     data_df,
    >>>     column_config={
    >>>         "sales": st.column_config.AreaChartColumn(
    >>>             "Sales (last 6 months)",
    >>>             width="medium",
    >>>             help="The sales volume in the last 6 months",
    >>>             y_min=0,
    >>>             y_max=100,
    >>>          ),
    >>>     },
    >>>     hide_index=True,
    >>> )

    .. output::
        https://doc-areachart-column.streamlit.app/
        height: 300px
    """

    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        pinned=pinned,
        type_config=AreaChartColumnConfig(type="area_chart", y_min=y_min, y_max=y_max),
    )


@gather_metrics("column_config.ImageColumn")
def ImageColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    pinned: bool | None = None,
) -> ColumnConfig:
    """Configure an image column in ``st.dataframe`` or ``st.data_editor``.

    The cell values need to be one of:

    * A URL to fetch the image from. This can also be a relative URL of an image
      deployed via `static file serving <https://docs.streamlit.io/develop/concepts/configuration/serving-static-files>`_.
      Note that you can NOT use an arbitrary local image if it is not available through
      a public URL.
    * A data URL containing an SVG XML like ``data:image/svg+xml;utf8,<svg xmlns=...</svg>``.
    * A data URL containing a Base64 encoded image like ``data:image/png;base64,iVBO...``.

    Image columns are not editable at the moment. This command needs to be used in the
    ``column_config`` parameter of ``st.dataframe`` or ``st.data_editor``.

    Parameters
    ----------
    label: str or None
        The label shown at the top of the column. If this is ``None``
        (default), the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. If this is ``None`` (default), the
        column will be sized to fit the cell contents. Otherwise, this can be
        one of the following:

        - ``"small"``: 75px wide
        - ``"medium"``: 200px wide
        - ``"large"``: 400px wide

    help: str or None
        A tooltip that gets displayed when hovering over the column label. If
        this is ``None`` (default), no tooltip is displayed.

        The tooltip can optionally contain GitHub-flavored Markdown, including
        the Markdown directives described in the ``body`` parameter of
        ``st.markdown``.

    pinned: bool or None
        Whether the column is pinned. A pinned column will stay visible on the
        left side no matter where the user scrolls. If this is ``None``
        (default), Streamlit will decide: index columns are pinned, and data
        columns are not pinned.

    Examples
    --------
    >>> import pandas as pd
    >>> import streamlit as st
    >>>
    >>> data_df = pd.DataFrame(
    >>>     {
    >>>         "apps": [
    >>>             "https://storage.googleapis.com/s4a-prod-share-preview/default/st_app_screenshot_image/5435b8cb-6c6c-490b-9608-799b543655d3/Home_Page.png",
    >>>             "https://storage.googleapis.com/s4a-prod-share-preview/default/st_app_screenshot_image/ef9a7627-13f2-47e5-8f65-3f69bb38a5c2/Home_Page.png",
    >>>             "https://storage.googleapis.com/s4a-prod-share-preview/default/st_app_screenshot_image/31b99099-8eae-4ff8-aa89-042895ed3843/Home_Page.png",
    >>>             "https://storage.googleapis.com/s4a-prod-share-preview/default/st_app_screenshot_image/6a399b09-241e-4ae7-a31f-7640dc1d181e/Home_Page.png",
    >>>         ],
    >>>     }
    >>> )
    >>>
    >>> st.data_editor(
    >>>     data_df,
    >>>     column_config={
    >>>         "apps": st.column_config.ImageColumn(
    >>>             "Preview Image", help="Streamlit app preview screenshots"
    >>>         )
    >>>     },
    >>>     hide_index=True,
    >>> )

    .. output::
        https://doc-image-column.streamlit.app/
        height: 300px
    """
    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        pinned=pinned,
        type_config=ImageColumnConfig(type="image"),
    )


@gather_metrics("column_config.ListColumn")
def ListColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    pinned: bool | None = None,
) -> ColumnConfig:
    """Configure a list column in ``st.dataframe`` or ``st.data_editor``.

    This is the default column type for list-like values. List columns are not editable
    at the moment. This command needs to be used in the ``column_config`` parameter of
    ``st.dataframe`` or ``st.data_editor``.

    Parameters
    ----------
    label: str or None
        The label shown at the top of the column. If this is ``None``
        (default), the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. If this is ``None`` (default), the
        column will be sized to fit the cell contents. Otherwise, this can be
        one of the following:

        - ``"small"``: 75px wide
        - ``"medium"``: 200px wide
        - ``"large"``: 400px wide

    help: str or None
        A tooltip that gets displayed when hovering over the column label. If
        this is ``None`` (default), no tooltip is displayed.

        The tooltip can optionally contain GitHub-flavored Markdown, including
        the Markdown directives described in the ``body`` parameter of
        ``st.markdown``.

    pinned: bool or None
        Whether the column is pinned. A pinned column will stay visible on the
        left side no matter where the user scrolls. If this is ``None``
        (default), Streamlit will decide: index columns are pinned, and data
        columns are not pinned.

    Examples
    --------
    >>> import pandas as pd
    >>> import streamlit as st
    >>>
    >>> data_df = pd.DataFrame(
    >>>     {
    >>>         "sales": [
    >>>             [0, 4, 26, 80, 100, 40],
    >>>             [80, 20, 80, 35, 40, 100],
    >>>             [10, 20, 80, 80, 70, 0],
    >>>             [10, 100, 20, 100, 30, 100],
    >>>         ],
    >>>     }
    >>> )
    >>>
    >>> st.data_editor(
    >>>     data_df,
    >>>     column_config={
    >>>         "sales": st.column_config.ListColumn(
    >>>             "Sales (last 6 months)",
    >>>             help="The sales volume in the last 6 months",
    >>>             width="medium",
    >>>         ),
    >>>     },
    >>>     hide_index=True,
    >>> )

    .. output::
        https://doc-list-column.streamlit.app/
        height: 300px
    """
    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        pinned=pinned,
        type_config=ListColumnConfig(type="list"),
    )


@gather_metrics("column_config.DatetimeColumn")
def DatetimeColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    disabled: bool | None = None,
    required: bool | None = None,
    pinned: bool | None = None,
    default: datetime.datetime | None = None,
    format: str | Literal["localized", "distance", "calendar", "iso8601"] | None = None,
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
        The label shown at the top of the column. If this is ``None``
        (default), the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. If this is ``None`` (default), the
        column will be sized to fit the cell contents. Otherwise, this can be
        one of the following:

        - ``"small"``: 75px wide
        - ``"medium"``: 200px wide
        - ``"large"``: 400px wide

    help: str or None
        A tooltip that gets displayed when hovering over the column label. If
        this is ``None`` (default), no tooltip is displayed.

        The tooltip can optionally contain GitHub-flavored Markdown, including
        the Markdown directives described in the ``body`` parameter of
        ``st.markdown``.

    disabled: bool or None
        Whether editing should be disabled for this column. If this is ``None``
        (default), Streamlit will decide: indices are disabled and data columns
        are not.

        If a column has mixed types, it may become uneditable regardless of
        ``disabled``.

    required: bool or None
        Whether edited cells in the column need to have a value. If this is
        ``False`` (default), the user can submit empty values for this column.
        If this is ``True``, an edited cell in this column can only be
        submitted if its value is not ``None``, and a new row will only be
        submitted after the user fills in this column.

    pinned: bool or None
        Whether the column is pinned. A pinned column will stay visible on the
        left side no matter where the user scrolls. If this is ``None``
        (default), Streamlit will decide: index columns are pinned, and data
        columns are not pinned.

    default: datetime.datetime or None
        Specifies the default value in this column when a new row is added by
        the user. This defaults to ``None``.

    format: str, "localized", "distance", "calendar", "iso8601", or None
        A format string controlling how datetimes are displayed.
        This can be one of the following values:

        - ``None`` (default): Show the datetime in ``"YYYY-MM-DD HH:mm:ss"``
          format (e.g. "2025-03-04 20:00:00").
        - ``"localized"``: Show the datetime in the default locale format (e.g.
          "Mar 4, 2025, 12:00:00 PM" in the America/Los_Angeles timezone).
        - ``"distance"``: Show the datetime in a relative format (e.g.
          "a few seconds ago").
        - ``"calendar"``: Show the datetime in a calendar format (e.g.
          "Today at 8:00 PM").
        - ``"iso8601"``: Show the datetime in ISO 8601 format (e.g.
          "2025-03-04T20:00:00.000Z").
        - A momentJS format string: Format the datetime with a string, like
          ``"ddd ha"`` to show "Tue 8pm". For available formats, see
          `momentJS <https://momentjs.com/docs/#/displaying/format/>`_.

        Formatting from ``column_config`` always takes precedence over
        formatting from ``pandas.Styler``. The formatting does not impact the
        return value when used in ``st.data_editor``.

    min_value: datetime.datetime or None
        The minimum datetime that can be entered. If this is ``None``
        (default), there will be no minimum.

    max_value: datetime.datetime or None
        The maximum datetime that can be entered. If this is ``None``
        (default), there will be no maximum.

    step: int, float, datetime.timedelta, or None
        The stepping interval in seconds. If this is ``None`` (default), the
        step will be 1 second.

    timezone: str or None
        The timezone of this column. If this is ``None`` (default), the
        timezone is inferred from the underlying data.

    Examples
    --------
    >>> from datetime import datetime
    >>> import pandas as pd
    >>> import streamlit as st
    >>>
    >>> data_df = pd.DataFrame(
    >>>     {
    >>>         "appointment": [
    >>>             datetime(2024, 2, 5, 12, 30),
    >>>             datetime(2023, 11, 10, 18, 0),
    >>>             datetime(2024, 3, 11, 20, 10),
    >>>             datetime(2023, 9, 12, 3, 0),
    >>>         ]
    >>>     }
    >>> )
    >>>
    >>> st.data_editor(
    >>>     data_df,
    >>>     column_config={
    >>>         "appointment": st.column_config.DatetimeColumn(
    >>>             "Appointment",
    >>>             min_value=datetime(2023, 6, 1),
    >>>             max_value=datetime(2025, 1, 1),
    >>>             format="D MMM YYYY, h:mm a",
    >>>             step=60,
    >>>         ),
    >>>     },
    >>>     hide_index=True,
    >>> )

    .. output::
        https://doc-datetime-column.streamlit.app/
        height: 300px
    """

    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        pinned=pinned,
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
    pinned: bool | None = None,
    default: datetime.time | None = None,
    format: str | Literal["localized", "iso8601"] | None = None,
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
        The label shown at the top of the column. If this is ``None``
        (default), the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. If this is ``None`` (default), the
        column will be sized to fit the cell contents. Otherwise, this can be
        one of the following:

        - ``"small"``: 75px wide
        - ``"medium"``: 200px wide
        - ``"large"``: 400px wide

    help: str or None
        A tooltip that gets displayed when hovering over the column label. If
        this is ``None`` (default), no tooltip is displayed.

        The tooltip can optionally contain GitHub-flavored Markdown, including
        the Markdown directives described in the ``body`` parameter of
        ``st.markdown``.

    disabled: bool or None
        Whether editing should be disabled for this column. If this is ``None``
        (default), Streamlit will decide: indices are disabled and data columns
        are not.

        If a column has mixed types, it may become uneditable regardless of
        ``disabled``.

    required: bool or None
        Whether edited cells in the column need to have a value. If this is
        ``False`` (default), the user can submit empty values for this column.
        If this is ``True``, an edited cell in this column can only be
        submitted if its value is not ``None``, and a new row will only be
        submitted after the user fills in this column.

    pinned: bool or None
        Whether the column is pinned. A pinned column will stay visible on the
        left side no matter where the user scrolls. If this is ``None``
        (default), Streamlit will decide: index columns are pinned, and data
        columns are not pinned.

    default: datetime.time or None
        Specifies the default value in this column when a new row is added by
        the user. This defaults to ``None``.

    format: str, "localized", "iso8601", or None
        A format string controlling how times are displayed.
        This can be one of the following values:

        - ``None`` (default): Show the time in ``"HH:mm:ss"`` format (e.g.
          "20:00:00").
        - ``"localized"``: Show the time in the default locale format (e.g.
          "12:00:00 PM" in the America/Los_Angeles timezone).
        - ``"iso8601"``: Show the time in ISO 8601 format (e.g.
          "20:00:00.000Z").
        - A momentJS format string: Format the time with a string, like
          ``"ha"`` to show "8pm". For available formats, see
          `momentJS <https://momentjs.com/docs/#/displaying/format/>`_.

        Formatting from ``column_config`` always takes precedence over
        formatting from ``pandas.Styler``. The formatting does not impact the
        return value when used in ``st.data_editor``.

    min_value: datetime.time or None
        The minimum time that can be entered. If this is ``None`` (default),
        there will be no minimum.

    max_value: datetime.time or None
        The maximum time that can be entered. If this is ``None`` (default),
        there will be no maximum.

    step: int, float, datetime.timedelta, or None
        The stepping interval in seconds. If this is ``None`` (default), the
        step will be 1 second.

    Examples
    --------
    >>> from datetime import time
    >>> import pandas as pd
    >>> import streamlit as st
    >>>
    >>> data_df = pd.DataFrame(
    >>>     {
    >>>         "appointment": [
    >>>             time(12, 30),
    >>>             time(18, 0),
    >>>             time(9, 10),
    >>>             time(16, 25),
    >>>         ]
    >>>     }
    >>> )
    >>>
    >>> st.data_editor(
    >>>     data_df,
    >>>     column_config={
    >>>         "appointment": st.column_config.TimeColumn(
    >>>             "Appointment",
    >>>             min_value=time(8, 0, 0),
    >>>             max_value=time(19, 0, 0),
    >>>             format="hh:mm a",
    >>>             step=60,
    >>>         ),
    >>>     },
    >>>     hide_index=True,
    >>> )

    .. output::
        https://doc-time-column.streamlit.app/
        height: 300px
    """

    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        pinned=pinned,
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
    pinned: bool | None = None,
    default: datetime.date | None = None,
    format: str | Literal["localized", "distance", "iso8601"] | None = None,
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
        The label shown at the top of the column. If this is ``None``
        (default), the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. If this is ``None`` (default), the
        column will be sized to fit the cell contents. Otherwise, this can be
        one of the following:

        - ``"small"``: 75px wide
        - ``"medium"``: 200px wide
        - ``"large"``: 400px wide

    help: str or None
        A tooltip that gets displayed when hovering over the column label. If
        this is ``None`` (default), no tooltip is displayed.

        The tooltip can optionally contain GitHub-flavored Markdown, including
        the Markdown directives described in the ``body`` parameter of
        ``st.markdown``.

    disabled: bool or None
        Whether editing should be disabled for this column. If this is ``None``
        (default), Streamlit will decide: indices are disabled and data columns
        are not.

        If a column has mixed types, it may become uneditable regardless of
        ``disabled``.

    required: bool or None
        Whether edited cells in the column need to have a value. If this is
        ``False`` (default), the user can submit empty values for this column.
        If this is ``True``, an edited cell in this column can only be
        submitted if its value is not ``None``, and a new row will only be
        submitted after the user fills in this column.

    pinned: bool or None
        Whether the column is pinned. A pinned column will stay visible on the
        left side no matter where the user scrolls. If this is ``None``
        (default), Streamlit will decide: index columns are pinned, and data
        columns are not pinned.

    default: datetime.date or None
        Specifies the default value in this column when a new row is added by
        the user. This defaults to ``None``.

    format: str, "localized", "distance", "iso8601", or None
        A format string controlling how dates are displayed.
        This can be one of the following values:

        - ``None`` (default): Show the date in ``"YYYY-MM-DD"`` format (e.g.
          "2025-03-04").
        - ``"localized"``: Show the date in the default locale format (e.g.
          "Mar 4, 2025" in the America/Los_Angeles timezone).
        - ``"distance"``: Show the date in a relative format (e.g.
          "a few seconds ago").
        - ``"iso8601"``: Show the date in ISO 8601 format (e.g.
          "2025-03-04").
        - A momentJS format string: Format the date with a string, like
          ``"ddd, MMM Do"`` to show "Tue, Mar 4th". For available formats, see
          `momentJS <https://momentjs.com/docs/#/displaying/format/>`_.

        Formatting from ``column_config`` always takes precedence over
        formatting from ``pandas.Styler``. The formatting does not impact the
        return value when used in ``st.data_editor``.

    min_value: datetime.date or None
        The minimum date that can be entered. If this is ``None`` (default),
        there will be no minimum.

    max_value: datetime.date or None
        The maximum date that can be entered. If this is ``None`` (default),
        there will be no maximum.

    step: int or None
        The stepping interval in days. If this is ``None`` (default), the step
        will be 1 day.

    Examples
    --------
    >>> from datetime import date
    >>> import pandas as pd
    >>> import streamlit as st
    >>>
    >>> data_df = pd.DataFrame(
    >>>     {
    >>>         "birthday": [
    >>>             date(1980, 1, 1),
    >>>             date(1990, 5, 3),
    >>>             date(1974, 5, 19),
    >>>             date(2001, 8, 17),
    >>>         ]
    >>>     }
    >>> )
    >>>
    >>> st.data_editor(
    >>>     data_df,
    >>>     column_config={
    >>>         "birthday": st.column_config.DateColumn(
    >>>             "Birthday",
    >>>             min_value=date(1900, 1, 1),
    >>>             max_value=date(2005, 1, 1),
    >>>             format="DD.MM.YYYY",
    >>>             step=1,
    >>>         ),
    >>>     },
    >>>     hide_index=True,
    >>> )

    .. output::
        https://doc-date-column.streamlit.app/
        height: 300px
    """
    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        disabled=disabled,
        required=required,
        pinned=pinned,
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
    pinned: bool | None = None,
    format: str | NumberFormat | None = None,
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
        The label shown at the top of the column. If this is ``None``
        (default), the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. If this is ``None`` (default), the
        column will be sized to fit the cell contents. Otherwise, this can be
        one of the following:

        - ``"small"``: 75px wide
        - ``"medium"``: 200px wide
        - ``"large"``: 400px wide

    help: str or None
        A tooltip that gets displayed when hovering over the column label. If
        this is ``None`` (default), no tooltip is displayed.

        The tooltip can optionally contain GitHub-flavored Markdown, including
        the Markdown directives described in the ``body`` parameter of
        ``st.markdown``.

    format: str, "plain", "localized", "percent", "dollar", "euro", "yen", "accounting", "compact", "scientific", "engineering", or None
        A format string controlling how the numbers are displayed.
        This can be one of the following values:

        - ``None`` (default): Streamlit infers the formatting from the data.
        - ``"plain"``: Show the full number without any formatting (e.g. "1234.567").
        - ``"localized"``: Show the number in the default locale format (e.g. "1,234.567").
        - ``"percent"``: Show the number as a percentage (e.g. "123456.70%").
        - ``"dollar"``: Show the number as a dollar amount (e.g. "$1,234.57").
        - ``"euro"``: Show the number as a euro amount (e.g. "€1,234.57").
        - ``"yen"``: Show the number as a yen amount (e.g. "¥1,235").
        - ``"accounting"``: Show the number in an accounting format (e.g. "1,234.00").
        - ``"compact"``: Show the number in a compact format (e.g. "1.2K").
        - ``"scientific"``: Show the number in scientific notation (e.g. "1.235E3").
        - ``"engineering"``: Show the number in engineering notation (e.g. "1.235E3").
        - printf-style format string: Format the number with a printf
          specifier, like ``"%d"`` to show a signed integer (e.g. "1234") or
          ``"%X"`` to show an unsigned hexadecimal integer (e.g. "4D2"). You
          can also add prefixes and suffixes. To show British pounds, use
          ``"£ %.2f"`` (e.g. "£ 1234.57"). For more information, see `sprint-js
          <https://github.com/alexei/sprintf.js?tab=readme-ov-file#format-specification>`_.

        Number formatting from ``column_config`` always takes precedence over
        number formatting from ``pandas.Styler``. The number formatting does
        not impact the return value when used in ``st.data_editor``.

    pinned: bool or None
        Whether the column is pinned. A pinned column will stay visible on the
        left side no matter where the user scrolls. If this is ``None``
        (default), Streamlit will decide: index columns are pinned, and data
        columns are not pinned.

    min_value: int, float, or None
        The minimum value of the progress bar. If this is ``None`` (default),
        the minimum will be 0.

    max_value: int, float, or None
        The maximum value of the progress bar. If this is ``None`` (default),
        the maximum will be 100 for integer values and 1.0 for float values.

    Examples
    --------
    >>> import pandas as pd
    >>> import streamlit as st
    >>>
    >>> data_df = pd.DataFrame(
    >>>     {
    >>>         "sales": [200, 550, 1000, 80],
    >>>     }
    >>> )
    >>>
    >>> st.data_editor(
    >>>     data_df,
    >>>     column_config={
    >>>         "sales": st.column_config.ProgressColumn(
    >>>             "Sales volume",
    >>>             help="The sales volume in USD",
    >>>             format="$%f",
    >>>             min_value=0,
    >>>             max_value=1000,
    >>>         ),
    >>>     },
    >>>     hide_index=True,
    >>> )

    .. output::
        https://doc-progress-column.streamlit.app/
        height: 300px
    """  # noqa: E501

    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        pinned=pinned,
        type_config=ProgressColumnConfig(
            type="progress",
            format=format,
            min_value=min_value,
            max_value=max_value,
        ),
    )


@gather_metrics("column_config.JsonColumn")
def JsonColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    pinned: bool | None = None,
) -> ColumnConfig:
    """Configure a JSON column in ``st.dataframe`` or ``st.data_editor``.

    Cells need to contain JSON strings or JSON-compatible objects. JSON columns
    are not editable at the moment. This command needs to be used in the
    ``column_config`` parameter of ``st.dataframe`` or ``st.data_editor``.

    Parameters
    ----------
    label: str or None
        The label shown at the top of the column. If this is ``None``
        (default), the column name is used.

    width: "small", "medium", "large", or None
        The display width of the column. If this is ``None`` (default), the
        column will be sized to fit the cell contents. Otherwise, this can be
        one of the following:

        - ``"small"``: 75px wide
        - ``"medium"``: 200px wide
        - ``"large"``: 400px wide

    help: str or None
        A tooltip that gets displayed when hovering over the column label. If
        this is ``None`` (default), no tooltip is displayed.

        The tooltip can optionally contain GitHub-flavored Markdown, including
        the Markdown directives described in the ``body`` parameter of
        ``st.markdown``.

    pinned: bool or None
        Whether the column is pinned. A pinned column will stay visible on the
        left side no matter where the user scrolls. If this is ``None``
        (default), Streamlit will decide: index columns are pinned, and data
        columns are not pinned.

    Examples
    --------
    >>> import pandas as pd
    >>> import streamlit as st
    >>>
    >>> data_df = pd.DataFrame(
    >>>     {
    >>>         "json": [
    >>>             {"foo": "bar", "bar": "baz"},
    >>>             {"foo": "baz", "bar": "qux"},
    >>>             {"foo": "qux", "bar": "foo"},
    >>>             None,
    >>>         ],
    >>>     }
    >>> )
    >>>
    >>> st.dataframe(
    >>>     data_df,
    >>>     column_config={
    >>>         "json": st.column_config.JsonColumn(
    >>>             "JSON Data",
    >>>             help="JSON strings or objects",
    >>>             width="large",
    >>>         ),
    >>>     },
    >>>     hide_index=True,
    >>> )

    .. output::
        https://doc-json-column.streamlit.app/
        height: 300px
    """
    return ColumnConfig(
        label=label,
        width=width,
        help=help,
        pinned=pinned,
        type_config=JsonColumnConfig(type="json"),
    )
