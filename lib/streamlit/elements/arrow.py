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

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import (
    TYPE_CHECKING,
    Any,
    Final,
    Literal,
    TypeAlias,
    TypedDict,
    cast,
    overload,
)

from streamlit import dataframe_util
from streamlit.deprecation_util import (
    make_deprecated_name_warning,
    show_deprecation_warning,
)
from streamlit.elements.lib.column_config_utils import (
    INDEX_IDENTIFIER,
    ColumnConfigMappingInput,
    apply_data_specific_configs,
    marshall_column_config,
    process_config_mapping,
    update_column_config,
)
from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.layout_utils import (
    Height,
    LayoutConfig,
    Width,
    validate_height,
    validate_width,
)
from streamlit.elements.lib.pandas_styler_utils import marshall_styler
from streamlit.elements.lib.policies import check_widget_policies
from streamlit.elements.lib.utils import Key, compute_and_register_element_id, to_key
from streamlit.errors import StreamlitAPIException, StreamlitValueError
from streamlit.proto.Arrow_pb2 import Arrow as ArrowProto
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    enqueue_message,
    get_script_run_ctx,
)
from streamlit.runtime.state import WidgetCallback, register_widget
from streamlit.util import AttributeDictionary

if TYPE_CHECKING:
    from collections.abc import Hashable, Iterable

    from numpy import typing as npt
    from pandas import DataFrame

    from streamlit.dataframe_util import Data
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.built_in_chart_utils import AddRowsMetadata


SelectionMode: TypeAlias = Literal[
    "single-row",
    "multi-row",
    "single-column",
    "multi-column",
    "single-cell",
    "multi-cell",
]
_SELECTION_MODES: Final[set[SelectionMode]] = {
    "single-row",
    "multi-row",
    "single-column",
    "multi-column",
    "single-cell",
    "multi-cell",
}


class DataframeSelectionState(TypedDict, total=False):
    """
    The schema for the dataframe selection state.

    The selection state is stored in a dictionary-like object that supports both
    key and attribute notation. Selection states cannot be programmatically
    changed or set through Session State.

    .. warning::
        If a user sorts a dataframe, row selections will be reset. If your
        users need to sort and filter the dataframe to make selections, direct
        them to use the search function in the dataframe toolbar instead.

    Attributes
    ----------
    rows : list[int]
        The selected rows, identified by their integer position. The integer
        positions match the original dataframe, even if the user sorts the
        dataframe in their browser. For a ``pandas.DataFrame``, you can
        retrieve data from its integer position using methods like ``.iloc[]``
        or ``.iat[]``.
    columns : list[str]
        The selected columns, identified by their names.
    cells : list[tuple[int, str]]
        The selected cells, provided as a tuple of row integer position
        and column name. For example, the first cell in a column named "col 1"
        is represented as ``(0, "col 1")``. Cells within index columns are not
        returned.

    Example
    -------
    The following example has multi-row and multi-column selections enabled.
    Try selecting some rows. To select multiple columns, hold ``CMD`` (macOS)
    or ``Ctrl`` (Windows) while selecting columns. Hold ``Shift`` to select a
    range of columns.

    >>> import pandas as pd
    >>> import streamlit as st
    >>> from numpy.random import default_rng as rng
    >>>
    >>> df = pd.DataFrame(
    ...     rng(0).standard_normal((12, 5)), columns=["a", "b", "c", "d", "e"]
    ... )
    >>>
    >>> event = st.dataframe(
    ...     df,
    ...     key="data",
    ...     on_select="rerun",
    ...     selection_mode=["multi-row", "multi-column", "multi-cell"],
    ... )
    >>>
    >>> event.selection

    .. output::
        https://doc-dataframe-events-selection-state.streamlit.app
        height: 600px

    """

    rows: list[int]
    columns: list[str]
    cells: list[tuple[int, str]]


class DataframeState(TypedDict, total=False):
    """
    The schema for the dataframe event state.

    The event state is stored in a dictionary-like object that supports both
    key and attribute notation. Event states cannot be programmatically
    changed or set through Session State.

    Only selection events are supported at this time.

    Attributes
    ----------
    selection : dict
        The state of the ``on_select`` event. This attribute returns a
        dictionary-like object that supports both key and attribute notation.
        The attributes are described by the ``DataframeSelectionState``
        dictionary schema.


    """

    selection: DataframeSelectionState


@dataclass
class DataframeSelectionSerde:
    """DataframeSelectionSerde is used to serialize and deserialize the dataframe selection state."""

    def deserialize(self, ui_value: str | None) -> DataframeState:
        empty_selection_state: DataframeState = {
            "selection": {
                "rows": [],
                "columns": [],
                "cells": [],
            },
        }
        selection_state: DataframeState = (
            empty_selection_state if ui_value is None else json.loads(ui_value)
        )

        if "selection" not in selection_state:
            selection_state = empty_selection_state

        if "rows" not in selection_state["selection"]:
            selection_state["selection"]["rows"] = []

        if "columns" not in selection_state["selection"]:
            selection_state["selection"]["columns"] = []

        if "cells" not in selection_state["selection"]:
            selection_state["selection"]["cells"] = []
        else:
            # Explicitly convert all cells to a tuple (from list).
            # This is necessary since there isn't a concept of tuples in JSON
            # The format that the data is transferred to the backend.
            selection_state["selection"]["cells"] = [
                tuple(cell)  # type: ignore
                for cell in selection_state["selection"]["cells"]
            ]

        return cast("DataframeState", AttributeDictionary(selection_state))

    def serialize(self, state: DataframeState) -> str:
        return json.dumps(state)


def parse_selection_mode(
    selection_mode: SelectionMode | Iterable[SelectionMode],
) -> set[ArrowProto.SelectionMode.ValueType]:
    """Parse and check the user provided selection modes."""
    if isinstance(selection_mode, str):
        # Only a single selection mode was passed
        selection_mode_set = {selection_mode}
    else:
        # Multiple selection modes were passed
        selection_mode_set = set(selection_mode)

    if not selection_mode_set.issubset(_SELECTION_MODES):
        raise StreamlitAPIException(
            f"Invalid selection mode: {selection_mode}. "
            f"Valid options are: {_SELECTION_MODES}"
        )

    if selection_mode_set.issuperset({"single-row", "multi-row"}):
        raise StreamlitAPIException(
            "Only one of `single-row` or `multi-row` can be selected as selection mode."
        )

    if selection_mode_set.issuperset({"single-column", "multi-column"}):
        raise StreamlitAPIException(
            "Only one of `single-column` or `multi-column` can be selected as selection mode."
        )

    if selection_mode_set.issuperset({"single-cell", "multi-cell"}):
        raise StreamlitAPIException(
            "Only one of `single-cell` or `multi-cell` can be selected as selection mode."
        )

    parsed_selection_modes = []
    for mode in selection_mode_set:
        if mode == "single-row":
            parsed_selection_modes.append(ArrowProto.SelectionMode.SINGLE_ROW)
        elif mode == "multi-row":
            parsed_selection_modes.append(ArrowProto.SelectionMode.MULTI_ROW)
        elif mode == "single-column":
            parsed_selection_modes.append(ArrowProto.SelectionMode.SINGLE_COLUMN)
        elif mode == "multi-column":
            parsed_selection_modes.append(ArrowProto.SelectionMode.MULTI_COLUMN)
        elif mode == "single-cell":
            parsed_selection_modes.append(ArrowProto.SelectionMode.SINGLE_CELL)
        elif mode == "multi-cell":
            parsed_selection_modes.append(ArrowProto.SelectionMode.MULTI_CELL)
    return set(parsed_selection_modes)


def parse_border_mode(
    border: bool | Literal["horizontal"],
) -> ArrowProto.BorderMode.ValueType:
    """Parse and check the user provided border mode."""
    if isinstance(border, bool):
        return ArrowProto.BorderMode.ALL if border else ArrowProto.BorderMode.NONE
    if border == "horizontal":
        return ArrowProto.BorderMode.HORIZONTAL
    raise StreamlitValueError("border", ["True", "False", "'horizontal'"])


class ArrowMixin:
    @overload
    def dataframe(
        self,
        data: Data = None,
        width: Width = "stretch",
        height: Height | Literal["auto"] = "auto",
        *,
        use_container_width: bool | None = None,
        hide_index: bool | None = None,
        column_order: Iterable[str] | None = None,
        column_config: ColumnConfigMappingInput | None = None,
        key: Key | None = None,
        on_select: Literal["ignore"] = "ignore",
        selection_mode: SelectionMode | Iterable[SelectionMode] = "multi-row",
        row_height: int | None = None,
        placeholder: str | None = None,
    ) -> DeltaGenerator: ...

    @overload
    def dataframe(
        self,
        data: Data = None,
        width: Width = "stretch",
        height: Height | Literal["auto"] = "auto",
        *,
        use_container_width: bool | None = None,
        hide_index: bool | None = None,
        column_order: Iterable[str] | None = None,
        column_config: ColumnConfigMappingInput | None = None,
        key: Key | None = None,
        on_select: Literal["rerun"] | WidgetCallback,
        selection_mode: SelectionMode | Iterable[SelectionMode] = "multi-row",
        row_height: int | None = None,
        placeholder: str | None = None,
    ) -> DataframeState: ...

    @gather_metrics("dataframe")
    def dataframe(
        self,
        data: Data = None,
        width: Width = "stretch",
        height: Height | Literal["auto"] = "auto",
        *,
        use_container_width: bool | None = None,
        hide_index: bool | None = None,
        column_order: Iterable[str] | None = None,
        column_config: ColumnConfigMappingInput | None = None,
        key: Key | None = None,
        on_select: Literal["ignore", "rerun"] | WidgetCallback = "ignore",
        selection_mode: SelectionMode | Iterable[SelectionMode] = "multi-row",
        row_height: int | None = None,
        placeholder: str | None = None,
    ) -> DeltaGenerator | DataframeState:
        """Display a dataframe as an interactive table.

        This command works with a wide variety of collection-like and
        dataframe-like object types.

        Parameters
        ----------
        data : dataframe-like, collection-like, or None
            The data to display.

            Dataframe-like objects include dataframe and series objects from
            popular libraries like Dask, Modin, Numpy, pandas, Polars, PyArrow,
            Snowpark, Xarray, and more. You can use database cursors and
            clients that comply with the
            `Python Database API Specification v2.0 (PEP 249)
            <https://peps.python.org/pep-0249/>`_. Additionally, you can use
            anything that supports the `Python dataframe interchange protocol
            <https://data-apis.org/dataframe-protocol/latest/>`_.

            For example, you can use the following:

            - ``pandas.DataFrame``, ``pandas.Series``, ``pandas.Index``,
              ``pandas.Styler``, and ``pandas.Array``
            - ``polars.DataFrame``, ``polars.LazyFrame``, and ``polars.Series``
            - ``snowflake.snowpark.dataframe.DataFrame``,
              ``snowflake.snowpark.table.Table``

            If a data type is not recognized, Streamlit will convert the object
            to a ``pandas.DataFrame`` or ``pyarrow.Table`` using a
            ``.to_pandas()`` or ``.to_arrow()`` method, respectively, if
            available.

            If ``data`` is a ``pandas.Styler``, it will be used to style its
            underlying ``pandas.DataFrame``. Streamlit supports custom cell
            values, colors, and font weights. It does not support some of the
            more exotic styling options, like bar charts, hovering, and
            captions. For these styling options, use column configuration
            instead. Text and number formatting from ``column_config`` always
            takes precedence over text and number formatting from ``pandas.Styler``.

            Collection-like objects include all Python-native ``Collection``
            types, such as ``dict``, ``list``, and ``set``.

            If ``data`` is ``None``, Streamlit renders an empty table.

        width : "stretch", "content", or int
            The width of the dataframe element. This can be one of the following:

            - ``"stretch"`` (default): The width of the element matches the
              width of the parent container.
            - ``"content"``: The width of the element matches the width of its
              content, but doesn't exceed the width of the parent container.
            - An integer specifying the width in pixels: The element has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the element matches the width
              of the parent container.

        height : "auto", "content", "stretch", or int
            The height of the dataframe element. This can be one of the following:

            - ``"auto"`` (default): Streamlit sets the height to show at most
              ten rows.
            - ``"content"``: The height of the element matches the height of
              its content. The height is capped at 10,000 pixels to prevent
              performance issues with very large dataframes.
            - ``"stretch"``: The height of the element expands to fill the
              available vertical space in its parent container. When multiple
              elements with stretch height are in the same container, they
              share the available vertical space evenly. The dataframe will
              maintain a minimum height to display up to three rows, but
              otherwise won't exceed the available height in its parent
              container.
            - An integer specifying the height in pixels: The element has a
              fixed height.

            Vertical scrolling within the dataframe element is enabled when the
            height does not accommodate all rows.

        use_container_width : bool
            Whether to override ``width`` with the width of the parent
            container. If this is ``True`` (default), Streamlit sets the width
            of the dataframe to match the width of the parent container. If
            this is ``False``, Streamlit sets the dataframe's width according
            to ``width``.

            .. deprecated::
                ``use_container_width`` is deprecated and will be removed in a
                future release. For ``use_container_width=True``, use
                ``width="stretch"``.

        hide_index : bool or None
            Whether to hide the index column(s). If ``hide_index`` is ``None``
            (default), the visibility of index columns is automatically
            determined based on the data and other configurations.

        column_order : Iterable[str] or None
            The ordered list of columns to display. If this is ``None``
            (default), Streamlit displays all columns in the order inherited
            from the underlying data structure. If this is a list, the
            indicated columns will display in the order they appear within the
            list. Columns may be omitted or repeated within the list.

            For example, ``column_order=("col2", "col1")`` will display
            ``"col2"`` first, followed by ``"col1"``, and will hide all other
            non-index columns.

            ``column_order`` does not accept positional column indices and
            can't move the index column(s).

        column_config : dict or None
            Configuration to customize how columns are displayed. If this is
            ``None`` (default), columns are styled based on the underlying data
            type of each column.

            Column configuration can modify column names, visibility, type,
            width, format, and more. If this is a dictionary, the keys are
            column names (strings) and/or positional column indices (integers),
            and the values are one of the following:

            - ``None`` to hide the column.
            - A string to set the display label of the column.
            - One of the column types defined under ``st.column_config``. For
              example, to show a column as dollar amounts, use
              ``st.column_config.NumberColumn("Dollar values", format="$ %d")``.
              See more info on the available column types and config options
              `here <https://docs.streamlit.io/develop/api-reference/data/st.column_config>`_.

            To configure the index column(s), use ``"_index"`` as the column
            name, or use a positional column index where ``0`` refers to the
            first index column.

        key : str
            An optional string to use for giving this element a stable
            identity. If ``key`` is ``None`` (default), this element's identity
            will be determined based on the values of the other parameters.

            Additionally, if selections are activated and ``key`` is provided,
            Streamlit will register the key in Session State to store the
            selection state. The selection state is read-only.

        on_select : "ignore" or "rerun" or callable
            How the dataframe should respond to user selection events. This
            controls whether or not the dataframe behaves like an input widget.
            ``on_select`` can be one of the following:

            - ``"ignore"`` (default): Streamlit will not react to any selection
              events in the dataframe. The dataframe will not behave like an
              input widget.

            - ``"rerun"``: Streamlit will rerun the app when the user selects
              rows, columns, or cells in the dataframe. In this case,
              ``st.dataframe`` will return the selection data as a dictionary.

            - A ``callable``: Streamlit will rerun the app and execute the
              ``callable`` as a callback function before the rest of the app.
              In this case, ``st.dataframe`` will return the selection data
              as a dictionary.

        selection_mode : "single-row", "multi-row", "single-column", \
            "multi-column", "single-cell", "multi-cell", or Iterable of these
            The types of selections Streamlit should allow when selections are
            enabled with ``on_select``. This can be one of the following:

            - "multi-row" (default): Multiple rows can be selected at a time.
            - "single-row": Only one row can be selected at a time.
            - "multi-column": Multiple columns can be selected at a time.
            - "single-column": Only one column can be selected at a time.
            - "multi-cell": A rectangular range of cells can be selected.
            - "single-cell": Only one cell can be selected at a time.
            - An ``Iterable`` of the above options: The table will allow
              selection based on the modes specified. For example, to allow the
              user to select multiple rows and multiple cells, use
              ``["multi-row", "multi-cell"]``.

            When column selections are enabled, column sorting is disabled.

        row_height : int or None
            The height of each row in the dataframe in pixels. If ``row_height``
            is ``None`` (default), Streamlit will use a default row height,
            which fits one line of text.

        placeholder : str or None
            The text that should be shown for missing values. If this is
            ``None`` (default), missing values are displayed as "None". To
            leave a cell empty, use an empty string (``""``). Other common
            values are ``"null"``, ``"NaN"`` and ``"-"``.

        Returns
        -------
        element or dict
            If ``on_select`` is ``"ignore"`` (default), this command returns an
            internal placeholder for the dataframe element that can be used
            with the ``.add_rows()`` method. Otherwise, this command returns a
            dictionary-like object that supports both key and attribute
            notation. The attributes are described by the ``DataframeState``
            dictionary schema.

        Examples
        --------
        **Example 1: Display a dataframe**

        >>> import pandas as pd
        >>> import streamlit as st
        >>> from numpy.random import default_rng as rng
        >>>
        >>> df = pd.DataFrame(
        ...     rng(0).standard_normal((50, 20)), columns=("col %d" % i for i in range(20))
        ... )
        >>>
        >>> st.dataframe(df)

        .. output::
           https://doc-dataframe.streamlit.app/
           height: 500px

        **Example 2: Use Pandas Styler**

        You can also pass a Pandas Styler object to change the style of
        the rendered DataFrame:

        >>> import pandas as pd
        >>> import streamlit as st
        >>> from numpy.random import default_rng as rng
        >>>
        >>> df = pd.DataFrame(
        ...     rng(0).standard_normal((10, 20)), columns=("col %d" % i for i in range(20))
        ... )
        >>>
        >>> st.dataframe(df.style.highlight_max(axis=0))

        .. output::
           https://doc-dataframe1.streamlit.app/
           height: 500px

        **Example 3: Use column configuration**

        You can customize a dataframe via ``column_config``, ``hide_index``, or ``column_order``.

        >>> import pandas as pd
        >>> import streamlit as st
        >>> from numpy.random import default_rng as rng
        >>>
        >>> df = pd.DataFrame(
        ...     {
        ...         "name": ["Roadmap", "Extras", "Issues"],
        ...         "url": [
        ...             "https://roadmap.streamlit.app",
        ...             "https://extras.streamlit.app",
        ...             "https://issues.streamlit.app",
        ...         ],
        ...         "stars": rng(0).integers(0, 1000, size=3),
        ...         "views_history": rng(0).integers(0, 5000, size=(3, 30)).tolist(),
        ...     }
        ... )
        >>>
        >>> st.dataframe(
        ...     df,
        ...     column_config={
        ...         "name": "App name",
        ...         "stars": st.column_config.NumberColumn(
        ...             "Github Stars",
        ...             help="Number of stars on GitHub",
        ...             format="%d ⭐",
        ...         ),
        ...         "url": st.column_config.LinkColumn("App URL"),
        ...         "views_history": st.column_config.LineChartColumn(
        ...             "Views (past 30 days)", y_min=0, y_max=5000
        ...         ),
        ...     },
        ...     hide_index=True,
        ... )

        .. output::
           https://doc-dataframe-config.streamlit.app/
           height: 350px

        **Example 4: Customize your index**

        You can use column configuration to format your index.

        >>> from datetime import datetime, date
        >>> import numpy as np
        >>> import pandas as pd
        >>> import streamlit as st
        >>>
        >>> @st.cache_data
        >>> def load_data():
        >>>     year = datetime.now().year
        >>>     df = pd.DataFrame(
        ...         {
        ...             "Date": [date(year, month, 1) for month in range(1, 4)],
        ...             "Total": np.random.randint(1000, 5000, size=3),
        ...         }
        ...     )
        >>>     df.set_index("Date", inplace=True)
        >>>     return df
        >>>
        >>> df = load_data()
        >>> config = {
        ...     "_index": st.column_config.DateColumn("Month", format="MMM YYYY"),
        ...     "Total": st.column_config.NumberColumn("Total ($)"),
        ... }
        >>>
        >>> st.dataframe(df, column_config=config)

        .. output::
           https://doc-dataframe-config-index.streamlit.app/
           height: 225px

        """
        import pyarrow as pa

        if on_select not in ["ignore", "rerun"] and not callable(on_select):
            raise StreamlitAPIException(
                f"You have passed {on_select} to `on_select`. But only 'ignore', "
                "'rerun', or a callable is supported."
            )

        key = to_key(key)
        is_selection_activated = on_select != "ignore"

        if is_selection_activated:
            # Run some checks that are only relevant when selections are activated
            is_callback = callable(on_select)
            check_widget_policies(
                self.dg,
                key,
                on_change=cast("WidgetCallback", on_select) if is_callback else None,
                default_value=None,
                writes_allowed=False,
                enable_check_callback_rules=is_callback,
            )

        if use_container_width is not None:
            show_deprecation_warning(
                make_deprecated_name_warning(
                    "use_container_width",
                    "width",
                    "2025-12-31",
                    "For `use_container_width=True`, use `width='stretch'`. "
                    "For `use_container_width=False`, use `width='content'`.",
                    include_st_prefix=False,
                ),
                show_in_browser=False,
            )
            if use_container_width:
                width = "stretch"
            elif not isinstance(width, int):
                width = "content"

        validate_width(width, allow_content=True)
        validate_height(
            height,
            allow_content=True,
            additional_allowed=["auto"],
        )

        # Convert the user provided column config into the frontend compatible format:
        column_config_mapping = process_config_mapping(column_config)

        proto = ArrowProto()

        if row_height:
            proto.row_height = row_height

        if column_order:
            proto.column_order[:] = column_order

        if placeholder is not None:
            proto.placeholder = placeholder

        proto.editing_mode = ArrowProto.EditingMode.READ_ONLY

        has_range_index: bool = False
        if isinstance(data, pa.Table):
            # For pyarrow tables, we can just serialize the table directly
            proto.data = dataframe_util.convert_arrow_table_to_arrow_bytes(data)
        else:
            # For all other data formats, we need to convert them to a pandas.DataFrame
            # thereby, we also apply some data specific configs

            # Determine the input data format
            data_format = dataframe_util.determine_data_format(data)

            if dataframe_util.is_pandas_styler(data):
                # If pandas.Styler uuid is not provided, a hash of the position
                # of the element will be used. This will cause a rerender of the table
                # when the position of the element is changed.
                delta_path = self.dg._get_delta_path_str()
                default_uuid = str(hash(delta_path))
                marshall_styler(proto, data, default_uuid)

            # Convert the input data into a pandas.DataFrame
            data_df = dataframe_util.convert_anything_to_pandas_df(
                data, ensure_copy=False
            )
            has_range_index = dataframe_util.has_range_index(data_df)
            apply_data_specific_configs(column_config_mapping, data_format)
            # Serialize the data to bytes:
            proto.data = dataframe_util.convert_pandas_df_to_arrow_bytes(data_df)

        if hide_index is not None:
            update_column_config(
                column_config_mapping, INDEX_IDENTIFIER, {"hidden": hide_index}
            )

        elif (
            # Hide index column if row selections are activated and the dataframe has a range index.
            # The range index usually does not add a lot of value.
            is_selection_activated
            and selection_mode in ["multi-row", "single-row"]
            and has_range_index
        ):
            update_column_config(
                column_config_mapping, INDEX_IDENTIFIER, {"hidden": True}
            )

        marshall_column_config(proto, column_config_mapping)

        # Create layout configuration
        # For height, only include it in LayoutConfig if it's not "auto"
        # "auto" is the default behavior and doesn't need to be sent
        layout_config = LayoutConfig(
            width=width, height=height if height != "auto" else None
        )

        if is_selection_activated:
            # If selection events are activated, we need to register the dataframe
            # element as a widget.
            proto.selection_mode.extend(parse_selection_mode(selection_mode))
            proto.form_id = current_form_id(self.dg)

            ctx = get_script_run_ctx()
            proto.id = compute_and_register_element_id(
                "dataframe",
                user_key=key,
                key_as_main_identity=False,
                dg=self.dg,
                data=proto.data,
                width=width,
                height=height,
                use_container_width=use_container_width,
                column_order=proto.column_order,
                column_config=proto.columns,
                selection_mode=selection_mode,
                is_selection_activated=is_selection_activated,
                row_height=row_height,
                placeholder=placeholder,
            )

            serde = DataframeSelectionSerde()
            widget_state = register_widget(
                proto.id,
                on_change_handler=on_select if callable(on_select) else None,
                deserializer=serde.deserialize,
                serializer=serde.serialize,
                ctx=ctx,
                value_type="string_value",
            )
            self.dg._enqueue("arrow_data_frame", proto, layout_config=layout_config)
            return widget_state.value
        return self.dg._enqueue("arrow_data_frame", proto, layout_config=layout_config)

    @gather_metrics("table")
    def table(
        self, data: Data = None, *, border: bool | Literal["horizontal"] = True
    ) -> DeltaGenerator:
        """Display a static table.

        While ``st.dataframe`` is geared towards large datasets and interactive
        data exploration, ``st.table`` is useful for displaying small, styled
        tables without sorting or scrolling. For example, ``st.table`` may be
        the preferred way to display a confusion matrix or leaderboard.
        Additionally, ``st.table`` supports Markdown.

        Parameters
        ----------
        data : Anything supported by st.dataframe
            The table data.

            All cells including the index and column headers can optionally
            contain GitHub-flavored Markdown. Syntax information can be found
            at: https://github.github.com/gfm.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        border : bool or "horizontal"
            Whether to show borders around the table and between cells. This can be one
            of the following:

            - ``True`` (default): Show borders around the table and between cells.
            - ``False``: Don't show any borders.
            - ``"horizontal"``: Show only horizontal borders between rows.

        Examples
        --------
        **Example 1: Display a confusion matrix as a static table**

        >>> import pandas as pd
        >>> import streamlit as st
        >>>
        >>> confusion_matrix = pd.DataFrame(
        ...     {
        ...         "Predicted Cat": [85, 3, 2, 1],
        ...         "Predicted Dog": [2, 78, 4, 0],
        ...         "Predicted Bird": [1, 5, 72, 3],
        ...         "Predicted Fish": [0, 2, 1, 89],
        ...     },
        ...     index=["Actual Cat", "Actual Dog", "Actual Bird", "Actual Fish"],
        ... )
        >>> st.table(confusion_matrix)

        .. output::
           https://doc-table-confusion.streamlit.app/
           height: 250px

        **Example 2: Display a product leaderboard with Markdown and horizontal borders**

        >>> import streamlit as st
        >>>
        >>> product_data = {
        ...     "Product": [
        ...         ":material/devices: Widget Pro",
        ...         ":material/smart_toy: Smart Device",
        ...         ":material/inventory: Premium Kit",
        ...     ],
        ...     "Category": [":blue[Electronics]", ":green[IoT]", ":violet[Bundle]"],
        ...     "Stock": ["🟢 Full", "🟡 Low", "🔴 Empty"],
        ...     "Units sold": [1247, 892, 654],
        ...     "Revenue": [125000, 89000, 98000],
        ... }
        >>> st.table(product_data, border="horizontal")

        .. output::
           https://doc-table-horizontal-border.streamlit.app/
           height: 200px

        """
        # Parse border parameter to enum value
        border_mode = parse_border_mode(border)

        # Check if data is uncollected, and collect it but with 100 rows max, instead of
        # 10k rows, which is done in all other cases.
        # We use 100 rows in st.table, because large tables render slowly,
        # take too much screen space, and can crush the app.
        if dataframe_util.is_unevaluated_data_object(data):
            data = dataframe_util.convert_anything_to_pandas_df(
                data, max_unevaluated_rows=100
            )

        # If pandas.Styler uuid is not provided, a hash of the position
        # of the element will be used. This will cause a rerender of the table
        # when the position of the element is changed.
        delta_path = self.dg._get_delta_path_str()
        default_uuid = str(hash(delta_path))

        # Tables dimensions are not configurable, this ensures that
        # styles are applied correctly on the element container in the frontend.
        layout_config = LayoutConfig(
            width="stretch",
            height="content",
        )

        proto = ArrowProto()
        marshall(proto, data, default_uuid)
        proto.border_mode = border_mode
        return self.dg._enqueue("arrow_table", proto, layout_config=layout_config)

    @gather_metrics("add_rows")
    def add_rows(self, data: Data = None, **kwargs: Any) -> DeltaGenerator | None:
        """Concatenate a dataframe to the bottom of the current one.

        .. important::
            ``add_rows`` is deprecated and might be removed in a future version.
            If you have a specific use-case that requires the ``add_rows``
            functionality, please tell us via this
            [issue on Github](https://github.com/streamlit/streamlit/issues/13063).

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.dataframe.DataFrame, Iterable, dict, or None
            Table to concat. Optional.

        **kwargs : pandas.DataFrame, numpy.ndarray, Iterable, dict, or None
            The named dataset to concat. Optional. You can only pass in 1
            dataset (including the one in the data parameter).

        Example
        -------
        >>> import time
        >>> import pandas as pd
        >>> import streamlit as st
        >>> from numpy.random import default_rng as rng
        >>>
        >>> df1 = pd.DataFrame(
        >>>     rng(0).standard_normal(size=(50, 20)), columns=("col %d" % i for i in range(20))
        >>> )
        >>>
        >>> df2 = pd.DataFrame(
        >>>     rng(1).standard_normal(size=(50, 20)), columns=("col %d" % i for i in range(20))
        >>> )
        >>>
        >>> my_table = st.table(df1)
        >>> time.sleep(1)
        >>> my_table.add_rows(df2)

        You can do the same thing with plots. For example, if you want to add
        more data to a line chart:

        >>> # Assuming df1 and df2 from the example above still exist...
        >>> my_chart = st.line_chart(df1)
        >>> time.sleep(1)
        >>> my_chart.add_rows(df2)

        And for plots whose datasets are named, you can pass the data with a
        keyword argument where the key is the name:

        >>> my_chart = st.vega_lite_chart(
        ...     {
        ...         "mark": "line",
        ...         "encoding": {"x": "a", "y": "b"},
        ...         "datasets": {
        ...             "some_fancy_name": df1,  # <-- named dataset
        ...         },
        ...         "data": {"name": "some_fancy_name"},
        ...     }
        ... )
        >>> my_chart.add_rows(some_fancy_name=df2)  # <-- name used as keyword

        """  # noqa: E501
        show_deprecation_warning(
            "`add_rows` is deprecated and might be removed in a future version."
            " If you have a specific use-case that requires the `add_rows` "
            "functionality, please tell us via this "
            "[issue on Github](https://github.com/streamlit/streamlit/issues/13063).",
            show_in_browser=False,
        )

        return _arrow_add_rows(self.dg, data, **kwargs)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


def _prep_data_for_add_rows(
    data: Data,
    add_rows_metadata: AddRowsMetadata | None,
) -> tuple[Data, AddRowsMetadata | None]:
    if not add_rows_metadata:
        if dataframe_util.is_pandas_styler(data):
            # When calling add_rows on st.table or st.dataframe we want styles to
            # pass through.
            return data, None
        return dataframe_util.convert_anything_to_pandas_df(data), None

    # If add_rows_metadata is set, it indicates that the add_rows used called
    # on a chart based on our built-in chart commands.

    # For built-in chart commands we have to reshape the data structure
    # otherwise the input data and the actual data used
    # by vega_lite will be different, and it will throw an error.
    from streamlit.elements.lib.built_in_chart_utils import prep_chart_data_for_add_rows

    return prep_chart_data_for_add_rows(data, add_rows_metadata)


def _arrow_add_rows(
    dg: DeltaGenerator,
    data: Data = None,
    **kwargs: DataFrame | npt.NDArray[Any] | Iterable[Any] | dict[Hashable, Any] | None,
) -> DeltaGenerator | None:
    """Concatenate a dataframe to the bottom of the current one.

    Parameters
    ----------
    data : pandas.DataFrame, pandas.Styler, numpy.ndarray, Iterable, dict, or None
        Table to concat. Optional.

    **kwargs : pandas.DataFrame, numpy.ndarray, Iterable, dict, or None
        The named dataset to concat. Optional. You can only pass in 1
        dataset (including the one in the data parameter).

    Example
    -------
    >>> import time
    >>> import pandas as pd
    >>> import streamlit as st
    >>> from numpy.random import default_rng as rng
    >>>
    >>> df1 = pd.DataFrame(
    >>>     rng(0).standard_normal(size=(50, 20)), columns=("col %d" % i for i in range(20))
    >>> )
    >>>
    >>> df2 = pd.DataFrame(
    >>>     rng(1).standard_normal(size=(50, 20)), columns=("col %d" % i for i in range(20))
    >>> )
    >>>
    >>> my_table = st.table(df1)
    >>> time.sleep(1)
    >>> my_table.add_rows(df2)

    You can do the same thing with plots. For example, if you want to add
    more data to a line chart:

    >>> # Assuming df1 and df2 from the example above still exist...
    >>> my_chart = st.line_chart(df1)
    >>> time.sleep(1)
    >>> my_chart.add_rows(df2)

    And for plots whose datasets are named, you can pass the data with a
    keyword argument where the key is the name:

    >>> my_chart = st.vega_lite_chart(
    ...     {
    ...         "mark": "line",
    ...         "encoding": {"x": "a", "y": "b"},
    ...         "datasets": {
    ...             "some_fancy_name": df1,  # <-- named dataset
    ...         },
    ...         "data": {"name": "some_fancy_name"},
    ...     }
    ... )
    >>> my_chart.add_rows(some_fancy_name=df2)  # <-- name used as keyword

    """
    if dg._root_container is None or dg._cursor is None:
        return dg

    if not dg._cursor.is_locked:
        raise StreamlitAPIException("Only existing elements can `add_rows`.")

    # Accept syntax st._arrow_add_rows(df).
    if data is not None and len(kwargs) == 0:
        name = ""
    # Accept syntax st._arrow_add_rows(foo=df).
    elif len(kwargs) == 1:
        name, data = kwargs.popitem()
    # Raise error otherwise.
    else:
        raise StreamlitAPIException(
            "Wrong number of arguments to add_rows()."
            "Command requires exactly one dataset"
        )

    # When doing _arrow_add_rows on an element that does not already have data
    # (for example, st.line_chart() without any args), call the original
    # st.foo() element with new data instead of doing a _arrow_add_rows().
    if (
        "add_rows_metadata" in dg._cursor.props
        and dg._cursor.props["add_rows_metadata"]
        and dg._cursor.props["add_rows_metadata"].last_index is None
    ):
        st_method = getattr(dg, dg._cursor.props["add_rows_metadata"].chart_command)
        metadata = dg._cursor.props["add_rows_metadata"]

        # Pass the styling properties stored in add_rows_metadata
        # to the new element call.
        kwargs = {}
        if metadata.color is not None:
            kwargs["color"] = metadata.color
        if metadata.width is not None:
            kwargs["width"] = metadata.width
        if metadata.height is not None:
            kwargs["height"] = metadata.height
        if metadata.stack is not None:
            kwargs["stack"] = metadata.stack

        if metadata.chart_command == "bar_chart":
            kwargs["horizontal"] = metadata.horizontal
            kwargs["sort"] = metadata.sort

        if metadata.use_container_width is not None:
            kwargs["use_container_width"] = metadata.use_container_width

        st_method(data, **kwargs)
        return None

    new_data, dg._cursor.props["add_rows_metadata"] = _prep_data_for_add_rows(
        data,
        dg._cursor.props["add_rows_metadata"],
    )

    msg = ForwardMsg()
    msg.metadata.delta_path[:] = dg._cursor.delta_path

    default_uuid = str(hash(dg._get_delta_path_str()))
    marshall(msg.delta.arrow_add_rows.data, new_data, default_uuid)

    if name:
        msg.delta.arrow_add_rows.name = name
        msg.delta.arrow_add_rows.has_name = True

    enqueue_message(msg)

    return dg


def marshall(proto: ArrowProto, data: Data, default_uuid: str | None = None) -> None:
    """Marshall pandas.DataFrame into an Arrow proto.

    Parameters
    ----------
    proto : proto.Arrow
        Output. The protobuf for Streamlit Arrow proto.

    data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.DataFrame, Iterable, dict, or None
        Something that is or can be converted to a dataframe.

    default_uuid : str | None
        If pandas.Styler UUID is not provided, this value will be used.
        This attribute is optional and only used for pandas.Styler, other elements
        (e.g. charts) can ignore it.

    """  # noqa: E501

    if dataframe_util.is_pandas_styler(data):
        # default_uuid is a string only if the data is a `Styler`,
        # and `None` otherwise.
        if not isinstance(default_uuid, str):
            raise StreamlitAPIException(
                "Default UUID must be a string for Styler data."
            )
        marshall_styler(proto, data, default_uuid)

    proto.data = dataframe_util.convert_anything_to_arrow_bytes(data)
