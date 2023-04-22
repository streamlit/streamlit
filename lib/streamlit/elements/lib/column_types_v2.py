from __future__ import annotations

import datetime
from abc import ABC, abstractmethod
from typing import Any, Dict, Iterable, List

import pandas as pd
from typing_extensions import Literal

from streamlit.elements.lib.column_config_utils import (
    ColumnConfigMapping,
    ColumnType,
    ColumnWidth,
)


class BaseColumn(ABC):
    """Base class for all column types."""

    def __init__(self, options: Dict[str, Any] | None) -> None:
        self._options = options or {}

    @staticmethod
    @abstractmethod
    def name() -> ColumnType:
        pass

    def options(self) -> Dict[str, Any]:
        return self._options


class NumberColumn(BaseColumn):
    """Rendering and editing of numerical values.

    When used with `st.data_editor`, editing will be enabled with a numeric input widget.

    Parameters
    ----------

    min_value : int or float or None
        The minimum value that can be entered by the user.
        If None, there will be no minimum.
    max_value : int or float or None
        The maximum value that can be entered by the user.
        If None, there will be no maximum.
    format : str or None
        A printf-style format string controlling how the cell value is displayed.
    step: int or float or None
        Specifies the value granularity and precision that can be entered by the user.
        If None, defaults to 1 for integers. Float numbers will be unrestricted by default.
    """

    def __init__(
        self,
        *,
        min_value: int | float | None = None,
        max_value: int | float | None = None,
        format: str | None = None,
        step: int | float | None = None,
    ) -> None:
        super(NumberColumn, self).__init__(
            {
                "min_value": min_value,
                "max_value": max_value,
                "step": step,
                "format": format,
            }
        )

    @staticmethod
    def name() -> ColumnType:
        return "number"


class TextColumn(BaseColumn):
    """Rendering and editing of text values.

    When used with `st.data_editor`, editing will be enabled with a text input widget.

    Parameters
    ----------

    max_chars: int or None
        The maximum number of characters that can be entered by the user.
        If None, there will be no maximum.
    validate: str or None
        A regular expression that edited values should be validated against.
        If the input is invalid, it will not be submitted by the user.
    """

    def __init__(
        self,
        *,
        max_chars: int | None = None,
        validate: str | None = None,
    ) -> None:
        super(TextColumn, self).__init__(
            {
                "max_chars": max_chars,
                "validate": validate,
            }
        )

    @staticmethod
    def name() -> ColumnType:
        return "text"


class LinkColumn(BaseColumn):
    """Rendering and editing of clickable URL values.

    When used with `st.data_editor`, editing will be enabled with a text input widget.

    Parameters
    ----------

    max_chars: int or None
        The maximum number of characters that can be entered by the user.
        If None, there will be no maximum.
    """

    def __init__(
        self,
        *,
        max_chars: int | None = None,
    ) -> None:
        super(LinkColumn, self).__init__(
            {
                "max_chars": max_chars,
            }
        )

    @staticmethod
    def name() -> ColumnType:
        return "url"


class CheckboxColumn(BaseColumn):
    """Rendering and editing of boolean values using checkboxes.

    When used with `st.data_editor`, editing will be enabled with a checkbox widget.
    """

    def __init__(
        self,
    ) -> None:
        super(CheckboxColumn, self).__init__(None)

    @staticmethod
    def name() -> ColumnType:
        return "checkbox"


class SelectColumn(BaseColumn):
    """Rendering and editing of categorical values using selectboxs.

    When used with st.data_editor, editing will be enabled with a selectbox widget.

    Parameters
    ----------

    options: list of str or None
        A list of options to choose from. If None, uses the categories from the
        underlying column in case it is configured as dtype "category".
    """

    def __init__(
        self,
        *,
        options: List[str | int | float] | None = None,
    ) -> None:
        super(SelectColumn, self).__init__(
            {
                "options": options,
            }
        )

    @staticmethod
    def name() -> ColumnType:
        return "select"


class BarChartColumn(BaseColumn):
    """Visualizes a list of numbers in a cell as a bar chart.

    This is a read-only type. It can be used with `st.data_editor`,
    but users will not be able to edit the cell values.

    Parameters
    ----------

    y_min: int or float or None
        The minimum value of the y-axis of the chart.
        If None, the scales will be normalized individually for each column.
    y_max: int or float or None
        The maximum value of the y-axis of the chart.
        If None, the scales will be normalized individually for each column.
    """

    def __init__(
        self,
        *,
        y_min: int | float | None = None,
        y_max: int | float | None = None,
    ) -> None:
        super(BarChartColumn, self).__init__(
            {
                "y_min": y_min,
                "y_max": y_max,
            }
        )

    @staticmethod
    def name() -> ColumnType:
        return "bar_chart"


class LineChartColumn(BaseColumn):
    """Visualizes a list of numbers in a cell as a line chart.

    This is a read-only type. It can be used with `st.data_editor`,
    but users will not be able to edit the cell values.

    Parameters
    ----------

    y_min: int or float or None
        The minimum value of the y-axis of the chart.
        If None, the scales will be normalized individually for each column.
    y_max: int or float or None
        The maximum value of the y-axis of the chart.
        If None, the scales will be normalized individually for each column.
    """

    def __init__(
        self,
        *,
        y_min: int | float | None = None,
        y_max: int | float | None = None,
    ) -> None:
        super(LineChartColumn, self).__init__(
            {
                "y_min": y_min,
                "y_max": y_max,
            }
        )

    @staticmethod
    def name() -> ColumnType:
        return "line_chart"


class ImageColumn(BaseColumn):
    """Rendering of cell values as images, given valid image URLs or binary data.

    This is a read-only type. It can be used with `st.data_editor`, but users will not
    be able to edit the cell values.
    """

    def __init__(
        self,
    ) -> None:
        super(ImageColumn, self).__init__(None)

    @staticmethod
    def name() -> ColumnType:
        return "image"


class ListColumn(BaseColumn):
    """Rendering of list-values as a list of tags.

    This is a read-only type. It can be used with `st.data_editor`,
    but users will not be able to edit the cell values.
    """

    def __init__(
        self,
    ) -> None:
        super(ListColumn, self).__init__(None)

    @staticmethod
    def name() -> ColumnType:
        return "list"


class DateTimeColumn(BaseColumn):
    """Rendering and editing of datetime values.

    When used with `st.data_editor`, editing will be enabled with a datetime picker widget.

    Parameters
    ----------

    format: str or None
        A momentJS-style format string controlling how the cell value is displayed.
    min_value: datetime.datetime or None
        The minimum datetime that can be entered by the user.
        If None, there will be no minimum.
    max_value: datetime.datetime or None
        The maximum datetime that can be entered by the user.
        If None, there will be no maximum.
    timezone: str or None
        The timezone of this column.
    step: int or float or None
        Specifies the value granularity in seconds that can be entered by the user.
        If None, the step will be 1 second.
    """

    def __init__(
        self,
        *,
        format: str | None = None,
        min_value: datetime.datetime | None = None,
        max_value: datetime.datetime | None = None,
        step: int | float | None = None,
        timezone: str | None = None,
    ) -> None:
        def _format_datetime(value: datetime.datetime | None) -> str | None:
            return None if value is None else value.isoformat()

        super(DateTimeColumn, self).__init__(
            {
                "format": format,
                "min_value": _format_datetime(min_value),
                "max_value": _format_datetime(max_value),
                "step": step,
                "timezone": timezone,
            }
        )

    @staticmethod
    def name() -> ColumnType:
        return "datetime"


class DateColumn(BaseColumn):
    """Rendering and editing of date values.

    When used with `st.data_editor`, editing will be enabled with a date picker widget.

    Parameters
    ----------

    format: str or None
        A momentJS-style format string controlling how the cell value is displayed.
    min_value: datetime.date or None
        The minimum date that can be entered by the user.
        If None, there will be no minimum.
    max_value: datetime.date or None
        The maximum date that can be entered by the user.
        If None, there will be no maximum.
    """

    def __init__(
        self,
        *,
        format: str | None = None,
        min_value: datetime.date | None = None,
        max_value: datetime.date | None = None,
    ) -> None:
        def _format_date(value: datetime.date | None) -> str | None:
            return None if value is None else value.isoformat()

        super(DateColumn, self).__init__(
            {
                "format": format,
                "min_value": _format_date(min_value),
                "max_value": _format_date(max_value),
            }
        )

    @staticmethod
    def name() -> ColumnType:
        return "date"


class TimeColumn(BaseColumn):
    """Rendering and editing of time values.

    When used with `st.data_editor`, editing will be enabled with a time picker widget.

    Parameters
    ----------

    format: str or None
        A momentJS-style format string controlling how the cell value is displayed.
    min_value: datetime.time or None
        The minimum time that can be entered by the user.
        If None, there will be no minimum.
    max_value: datetime.time or None
        The maximum time that can be entered by the user.
        If None, there will be no maximum.
    step: int or float or None
        Specifies the value granularity in seconds that can be entered by the user.
        If None, the step will be 0.1 second.
    """

    def __init__(
        self,
        *,
        format: str | None = None,
        min_value: datetime.time | None = None,
        max_value: datetime.time | None = None,
        step: int | float | None = None,
    ) -> None:
        def _format_time(value: datetime.time | None) -> str | None:
            return None if value is None else value.isoformat()

        super(TimeColumn, self).__init__(
            {
                "format": format,
                "min_value": _format_time(min_value),
                "max_value": _format_time(max_value),
                "step": step,
            }
        )

    @staticmethod
    def name() -> ColumnType:
        return "time"


class RangeColumn(BaseColumn):
    """Visualizes a numeric value using a progress bar-like element.

    This is a read-only type. It can be used with `st.data_editor`,
    but users will not be able to edit the cell values.

    Parameters
    ----------

    min_value : int or float or None
        The minimum value of the range bar.
        Defaults to 0.
    max_value : int or float or None
        The maximum value of the range bar.
        Defaults to 1.
    format : str or None
        A printf-style format string controlling how the number next to
        the range bar should be formatted.
    """

    def __init__(
        self,
        *,
        min_value: int | float | None = None,
        max_value: int | float | None = None,
        format: str | None = None,
    ) -> None:
        super(RangeColumn, self).__init__(
            {
                "min_value": min_value,
                "max_value": max_value,
                "format": format,
            }
        )

    @staticmethod
    def name() -> ColumnType:
        return "range"


def _process_boolean_config(
    column_config_mapping: ColumnConfigMapping,
    config_name: str,
    config_value: Literal["index"] | str | Iterable[str] | None,
) -> None:
    if config_value is None:
        return
    if isinstance(config_value, str):
        config_value = [config_value]
    if isinstance(config_value, Iterable):
        for col in config_value:
            if col not in column_config_mapping:
                column_config_mapping[col] = {}
            column_config_mapping[col][config_name] = True  # type: ignore


def _process_value_config(
    column_config_mapping: ColumnConfigMapping,
    columns: List[str],
    config_name: str,
    config_value: Iterable[Any] | Dict[str, Any] | None,
) -> None:
    if config_value is None:
        return
    if isinstance(config_value, dict):
        for col, col_value in config_value.items():
            if col not in column_config_mapping:
                column_config_mapping[col] = {}
            if isinstance(col_value, BaseColumn):
                column_config_mapping[col]["type_options"] = col_value.options()  # type: ignore
                column_config_mapping[col]["type"] = col_value.name()  # type: ignore
            else:
                column_config_mapping[col][config_name] = col_value  # type: ignore
    elif isinstance(config_value, Iterable):
        for i, col_value in enumerate(config_value):
            if i < len(columns):
                col = columns[i]
                if col:
                    if col not in column_config_mapping:
                        column_config_mapping[col] = {}
                    column_config_mapping[col][config_name] = col_value  # type: ignore


def process_config_options(
    column_config_mapping: ColumnConfigMapping,
    columns: pd.Index,
    titles: List[str | None] | Dict[str, str] | None = None,
    types: List[ColumnType | BaseColumn | None]
    | Dict[str, ColumnType | BaseColumn]
    | None = None,
    hidden: Literal["index"] | str | Iterable[str] | None = None,
    widths: List[ColumnWidth | None] | Dict[str, ColumnWidth] | None = None,
    help: List[str | None] | Dict[str, str] | None = None,
    required: Literal["index"] | str | Iterable[str] | None = None,
    locked: Literal["index"] | str | Iterable[str] | None = None,
    default: List[str | int | float | bool | None]
    | Dict[str, str | int | float | bool | None]
    | None = None,
):
    _process_boolean_config(column_config_mapping, "hidden", hidden)
    visible_columns = []
    if (
        "index" not in column_config_mapping
        or column_config_mapping["index"].get("hidden") is not True
    ):
        visible_columns.append("index")
    for column in columns:
        if (
            column not in column_config_mapping
            or column_config_mapping[column].get("hidden") is not True
        ):
            visible_columns.append(column)
    _process_boolean_config(column_config_mapping, "required", required)
    _process_boolean_config(column_config_mapping, "disabled", locked)
    _process_value_config(column_config_mapping, visible_columns, "title", titles)
    _process_value_config(column_config_mapping, visible_columns, "help", help)
    _process_value_config(column_config_mapping, visible_columns, "default", default)
    _process_value_config(column_config_mapping, visible_columns, "width", widths)
    _process_value_config(column_config_mapping, visible_columns, "type", types)
