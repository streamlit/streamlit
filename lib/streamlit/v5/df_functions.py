from __future__ import annotations

import datetime
from typing import List

from streamlit.elements.lib.column_config_utils import (
    ColumnConfig,
    ColumnType,
    ColumnWidth,
)


class ColumnConfigAPI:
    """Configure options for columns in `st.dataframe` and `st.data_editor`."""

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
        the column types available in `st.column_config.` namespace, e.g.
        `st.column_config.NumberColumn`.

        Parameters
        ----------
        title: str
            The title of the column shown at the top in the column header.
            If None, the column name is used.

        width: "small" or "medium" or "large" or None
            The display width of the column. Can be either small, medium, or large.
            If None, the column will be sized to fit its contents.

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
            options, use one of the column types available in the `st.column_config.`
            namespace - e.g. `st.column_config.NumberColumn` - as replacement for the
            `st.column_config` command.
        """

        return ColumnConfig(
            type=type,
            title=title,
            width=width,
            help=help,
            required=required,
        )

    def NumberColumn(
        self,
        *,
        title: str | None = None,
        width: ColumnWidth | None = None,
        help: str | None = None,
        required: bool | None = None,
        default: int | float | None = None,
        min_value: int | float | None = None,
        max_value: int | float | None = None,
        format: str | None = None,
        step: int | float | None = None,
    ) -> ColumnConfig:
        """Rendering and editing of numerical values.

        This needs to be used as input to the column_config parameter of st.dataframe
        or st.data_editor. When used with `st.data_editor`, editing will be enabled with
        a numeric input widget.

        Parameters
        ----------

        title: str
            The title of the column shown at the top in the column header.
            If None, the column name is used.

        width: "small" or "medium" or "large" or None
            The display width of the column. Can be either small, medium, or large.
            If None, the column will be sized to fit its contents.

        help: str or None
            An optional tooltip that gets displayed when hovering over the column header.

        required: bool or None
            If True, a cell can only be submitted by the user if it has a value.
            This will ensure that the data_editor never returns None as a value in this
            column. Defaults to False.

            This configuration option does not have any effect
            if used with a disabled column.

        default: int or float or None
            The default value for the cell in this column when the user adds a new row.
            Defaults to None.

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

        return ColumnConfig(
            title=title,
            width=width,
            help=help,
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
        self,
        *,
        title: str | None = None,
        width: ColumnWidth | None = None,
        help: str | None = None,
        required: bool | None = None,
        default: str | None = None,
        max_chars: int | None = None,
        validate: str | None = None,
    ) -> ColumnConfig:
        """Rendering and editing of text values.

        When used with `st.data_editor`, editing will be enabled with a text input widget.

        Parameters
        ----------

        title: str
            The title of the column shown at the top in the column header.
            If None, the column name is used.

        width: "small" or "medium" or "large" or None
            The display width of the column. Can be either small, medium, or large.
            If None, the column will be sized to fit its contents.

        help: str or None
            An optional tooltip that gets displayed when hovering over the column header.

        required: bool or None
            If True, a cell can only be submitted by the user if it has a value.
            This will ensure that the data_editor never returns None as a value in this
            column. Defaults to False.

            This configuration option does not have any effect
            if used with a disabled column.

        default: int or float or None
            The default value for the cell in this column when the user adds a new row.
            Defaults to None.

        max_chars: int or None
            The maximum number of characters that can be entered by the user.
            If None, there will be no maximum.

        validate: str or None
            A regular expression that edited values should be validated against.
            If the input is invalid, it will not be submitted by the user.
        """

        return ColumnConfig(
            title=title,
            width=width,
            help=help,
            required=required,
            default=default,
            type="text",
            type_options={
                "max_chars": max_chars,
                "validate": validate,
            },
        )

    def LinkColumn(
        self,
        *,
        title: str | None = None,
        width: ColumnWidth | None = None,
        help: str | None = None,
        required: bool | None = None,
        default: str | None = None,
        max_chars: int | None = None,
    ) -> ColumnConfig:
        """Rendering and editing of clickable URL values.

        When used with `st.data_editor`, editing will be enabled with a text input widget.

        Parameters
        ----------

        title: str
            The title of the column shown at the top in the column header.
            If None, the column name is used.

        width: "small" or "medium" or "large" or None
            The display width of the column. Can be either small, medium, or large.
            If None, the column will be sized to fit its contents.

        help: str or None
            An optional tooltip that gets displayed when hovering over the column header.

        required: bool or None
            If True, a cell can only be submitted by the user if it has a value.
            This will ensure that the data_editor never returns None as a value in this
            column. Defaults to False.

            This configuration option does not have any effect
            if used with a disabled column.

        default: str or None
            The default value for the cell in this column when the user adds a new row.
            Defaults to None.

        max_chars: int or None
            The maximum number of characters that can be entered by the user.
            If None, there will be no maximum.
        """

        return ColumnConfig(
            title=title,
            width=width,
            help=help,
            required=required,
            default=default,
            type="url",
            type_options={
                "max_chars": max_chars,
            },
        )

    def CheckboxColumn(
        self,
        *,
        title: str | None = None,
        width: ColumnWidth | None = None,
        help: str | None = None,
        required: bool | None = None,
        default: bool | None = None,
    ) -> ColumnConfig:
        """Rendering and editing of boolean values using checkboxes.

        When used with `st.data_editor`, editing will be enabled with a checkbox widget.

        Parameters
        ----------

        title: str
            The title of the column shown at the top in the column header.
            If None, the column name is used.

        width: "small" or "medium" or "large" or None
            The display width of the column. Can be either small, medium, or large.
            If None, the column will be sized to fit its contents.

        help: str or None
            An optional tooltip that gets displayed when hovering over the column header.

        required: bool or None
            If True, a cell can only be submitted by the user if it has a value.
            This will ensure that the data_editor never returns None as a value in this
            column. Defaults to False.

            This configuration option does not have any effect
            if used with a disabled column.

        default: bool or None
            The default value for the cell in this column when the user adds a new row.
            Defaults to None.
        """

        return ColumnConfig(
            title=title,
            width=width,
            help=help,
            required=required,
            default=default,
            type="checkbox",
        )

    def SelectboxColumn(
        self,
        *,
        title: str | None = None,
        width: ColumnWidth | None = None,
        help: str | None = None,
        required: bool | None = None,
        default: str | int | float | None = None,
        options: List[str | int | float] | None = None,
    ) -> ColumnConfig:
        """Rendering and editing of categorical values using selectboxes.

        When used with st.data_editor, editing will be enabled with a selectbox widget.

        Parameters
        ----------

        title: str
            The title of the column shown at the top in the column header.
            If None, the column name is used.

        width: "small" or "medium" or "large" or None
            The display width of the column. Can be either small, medium, or large.
            If None, the column will be sized to fit its contents.

        help: str or None
            An optional tooltip that gets displayed when hovering over the column header.

        required: bool or None
            If True, a cell can only be submitted by the user if it has a value.
            This will ensure that the data_editor never returns None as a value in this
            column. Defaults to False.

            This configuration option does not have any effect
            if used with a disabled column.

        default: str or None
            The default value in a cell when the user adds a new row.
            Defaults to None.

        options: list of str or None
            A list of options to choose from. If None, uses the categories from the
            underlying column in case it is configured as dtype "category".
        """

        return ColumnConfig(
            title=title,
            width=width,
            help=help,
            required=required,
            default=default,
            type="select",
            type_options={
                "options": options,
            },
        )

    def BarChartColumn(
        self,
        *,
        title: str | None = None,
        width: ColumnWidth | None = None,
        help: str | None = None,
        y_min: int | float | None = None,
        y_max: int | float | None = None,
    ) -> ColumnConfig:
        """Visualizes a list of numbers in a cell as a bar chart.

        This is a read-only type. It can be used with `st.data_editor`,
        but users will not be able to edit the cell values.

        Parameters
        ----------

        title: str
            The title of the column shown at the top in the column header.
            If None, the column name is used.

        width: "small" or "medium" or "large" or None
            The display width of the column. Can be either small, medium, or large.
            If None, the column will be sized to fit its contents.

        help: str or None
            An optional tooltip that gets displayed when hovering over the column header.

        y_min: int or float or None
            The minimum value of the y-axis of the chart.
            If None, the scales will be normalized individually for each column.

        y_max: int or float or None
            The maximum value of the y-axis of the chart.
            If None, the scales will be normalized individually for each column.
        """

        return ColumnConfig(
            title=title,
            width=width,
            help=help,
            type="bar_chart",
            type_options={
                "y_min": y_min,
                "y_max": y_max,
            },
        )

    def LineChartColumn(
        self,
        *,
        title: str | None = None,
        width: ColumnWidth | None = None,
        help: str | None = None,
        y_min: int | float | None = None,
        y_max: int | float | None = None,
    ) -> ColumnConfig:
        """Visualizes a list of numbers in a cell as a line chart.

        This is a read-only type. It can be used with `st.data_editor`,
        but users will not be able to edit the cell values.

        Parameters
        ----------

        title: str
            The title of the column shown at the top in the column header.
            If None, the column name is used.

        width: "small" or "medium" or "large" or None
            The display width of the column. Can be either small, medium, or large.
            If None, the column will be sized to fit its contents.

        help: str or None
            An optional tooltip that gets displayed when hovering over the column header.

        y_min: int or float or None
            The minimum value of the y-axis of the chart.
            If None, the scales will be normalized individually for each column.

        y_max: int or float or None
            The maximum value of the y-axis of the chart.
            If None, the scales will be normalized individually for each column.
        """

        return ColumnConfig(
            title=title,
            width=width,
            help=help,
            type="line_chart",
            type_options={
                "y_min": y_min,
                "y_max": y_max,
            },
        )

    def ImageColumn(
        self,
        *,
        title: str | None = None,
        width: ColumnWidth | None = None,
        help: str | None = None,
    ):
        """Rendering of cell values as images, given valid image URLs or binary data.

        This is a read-only type. It can be used with `st.data_editor`, but users will not
        be able to edit the cell values.

        Parameters
        ----------

        title: str
            The title of the column shown at the top in the column header.
            If None, the column name is used.

        width: "small" or "medium" or "large" or None
            The display width of the column. Can be either small, medium, or large.
            If None, the column will be sized to fit its contents.

        help: str or None
            An optional tooltip that gets displayed when hovering over the column header.
        """
        return ColumnConfig(
            title=title,
            width=width,
            help=help,
            type="image",
        )

    def ListColumn(
        self,
        *,
        title: str | None = None,
        width: ColumnWidth | None = None,
        help: str | None = None,
    ):
        """Rendering of list-values as a list of tags.

        This is a read-only type. It can be used with `st.data_editor`,
        but users will not be able to edit the cell values.

        Parameters
        ----------

        title: str
            The title of the column shown at the top in the column header.
            If None, the column name is used.

        width: "small" or "medium" or "large" or None
            The display width of the column. Can be either small, medium, or large.
            If None, the column will be sized to fit its contents.

        help: str or None
            An optional tooltip that gets displayed when hovering over the column header.
        """
        return ColumnConfig(
            title=title,
            width=width,
            help=help,
            type="list",
        )

    def DateTimeColumn(
        self,
        *,
        title: str | None = None,
        width: ColumnWidth | None = None,
        help: str | None = None,
        required: bool | None = None,
        default: datetime.datetime | None = None,
        format: str | None = None,
        min_value: datetime.datetime | None = None,
        max_value: datetime.datetime | None = None,
        step: int | float | None = None,
        timezone: str | None = None,
    ) -> ColumnConfig:
        """Rendering and editing of datetime values.

        When used with `st.data_editor`, editing will be enabled with a datetime picker widget.

        Parameters
        ----------

        title: str
            The title of the column shown at the top in the column header.
            If None, the column name is used.

        width: "small" or "medium" or "large" or None
            The display width of the column. Can be either small, medium, or large.
            If None, the column will be sized to fit its contents.

        help: str or None
            An optional tooltip that gets displayed when hovering over the column header.

        required: bool or None
            If True, a cell can only be submitted by the user if it has a value.
            This will ensure that the data_editor never returns None as a value in this
            column. Defaults to False.

            This configuration option does not have any effect
            if used with a disabled column.

        default: datetime.datetime or None
            The default value in a cell when the user adds a new row.
            Defaults to None.

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

        # TODO: Check if this code is correct:
        def _format_datetime(value: datetime.datetime | None) -> str | None:
            return None if value is None else value.isoformat()

        return ColumnConfig(
            title=title,
            width=width,
            help=help,
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
        self,
        *,
        title: str | None = None,
        width: ColumnWidth | None = None,
        help: str | None = None,
        required: bool | None = None,
        default: datetime.time | None = None,
        format: str | None = None,
        min_value: datetime.time | None = None,
        max_value: datetime.time | None = None,
        step: int | float | None = None,
    ) -> ColumnConfig:
        """Rendering and editing of time values.

        When used with `st.data_editor`, editing will be enabled with a time picker widget.

        Parameters
        ----------

        title: str
            The title of the column shown at the top in the column header.
            If None, the column name is used.

        width: "small" or "medium" or "large" or None
            The display width of the column. Can be either small, medium, or large.
            If None, the column will be sized to fit its contents.

        help: str or None
            An optional tooltip that gets displayed when hovering over the column header.

        required: bool or None
            If True, a cell can only be submitted by the user if it has a value.
            This will ensure that the data_editor never returns None as a value in this
            column. Defaults to False.

            This configuration option does not have any effect
            if used with a disabled column.

        default: datetime.time or None
            The default value in a cell when the user adds a new row.
            Defaults to None.

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

        # TODO: Check if this code is correct:
        def _format_datetime(value: datetime.time | None) -> str | None:
            return None if value is None else value.isoformat()

        return ColumnConfig(
            title=title,
            width=width,
            help=help,
            required=required,
            default=_format_datetime(default),
            type="time",
            type_options={
                "format": format,
                "min_value": _format_datetime(min_value),
                "max_value": _format_datetime(max_value),
                "step": step,
            },
        )

    def DateColumn(
        self,
        *,
        title: str | None = None,
        width: ColumnWidth | None = None,
        help: str | None = None,
        required: bool | None = None,
        default: datetime.date | None = None,
        format: str | None = None,
        min_value: datetime.date | None = None,
        max_value: datetime.date | None = None,
    ) -> ColumnConfig:
        """Rendering and editing of date values.

        When used with `st.data_editor`, editing will be enabled with a date picker widget.

        Parameters
        ----------
        title: str
            The title of the column shown at the top in the column header.
            If None, the column name is used.

        width: "small" or "medium" or "large" or None
            The display width of the column. Can be either small, medium, or large.
            If None, the column will be sized to fit its contents.

        help: str or None
            An optional tooltip that gets displayed when hovering over the column header.

        required: bool or None
            If True, a cell can only be submitted by the user if it has a value.
            This will ensure that the data_editor never returns None as a value in this
            column. Defaults to False.

            This configuration option does not have any effect
            if used with a disabled column.

        default: datetime.date or None
            The default value in a cell when the user adds a new row.
            Defaults to None.

        format: str or None
            A momentJS-style format string controlling how the cell value is displayed.

        min_value: datetime.date or None
            The minimum date that can be entered by the user.
            If None, there will be no minimum.

        max_value: datetime.date or None
            The maximum date that can be entered by the user.
            If None, there will be no maximum.
        """

        # TODO: Check if this code is correct:
        def _format_datetime(value: datetime.date | None) -> str | None:
            return None if value is None else value.isoformat()

        return ColumnConfig(
            title=title,
            width=width,
            help=help,
            required=required,
            default=_format_datetime(default),
            type="date",
            type_options={
                "format": format,
                "min_value": _format_datetime(min_value),
                "max_value": _format_datetime(max_value),
            },
        )

    def RangeColumn(
        self,
        *,
        title: str | None = None,
        width: ColumnWidth | None = None,
        help: str | None = None,
        required: bool | None = None,
        default: int | float | None = None,
        min_value: int | float | None = None,
        max_value: int | float | None = None,
        format: str | None = None,
    ) -> ColumnConfig:
        """Visualizes a numeric value using a progress bar-like element.

        This is a read-only type. It can be used with `st.data_editor`,
        but users will not be able to edit the cell values.

        Parameters
        ----------

        title: str
            The title of the column shown at the top in the column header.
            If None, the column name is used.

        width: "small" or "medium" or "large" or None
            The display width of the column. Can be either small, medium, or large.
            If None, the column will be sized to fit its contents.

        help: str or None
            An optional tooltip that gets displayed when hovering over the column header.

        required: bool or None
            If True, a cell can only be submitted by the user if it has a value.
            This will ensure that the data_editor never returns None as a value in this
            column. Defaults to False.

            This configuration option does not have any effect
            if used with a disabled column.

        default: int or float or None
            The default value in a cell when the user adds a new row.
            Defaults to None.

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

        return ColumnConfig(
            title=title,
            width=width,
            help=help,
            required=required,
            type="range",
            default=default,
            type_options={
                "min_value": min_value,
                "max_value": max_value,
                "format": format,
            },
        )


column_config = ColumnConfigAPI()
