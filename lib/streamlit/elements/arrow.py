# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
    Dict,
    Final,
    Iterable,
    List,
    Literal,
    Set,
    TypedDict,
    Union,
    cast,
    overload,
)

from typing_extensions import TypeAlias

from streamlit import type_util
from streamlit.elements.lib.column_config_utils import (
    INDEX_IDENTIFIER,
    ColumnConfigMappingInput,
    apply_data_specific_configs,
    marshall_column_config,
    process_config_mapping,
    update_column_config,
)
from streamlit.elements.lib.event_utils import AttributeDictionary
from streamlit.elements.lib.pandas_styler_utils import marshall_styler
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Arrow_pb2 import Arrow as ArrowProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.state import WidgetCallback, register_widget
from streamlit.runtime.state.common import compute_widget_id
from streamlit.type_util import Key, to_key

if TYPE_CHECKING:
    import pyarrow as pa
    from numpy import ndarray
    from pandas import DataFrame, Index, Series
    from pandas.io.formats.style import Styler

    from streamlit.delta_generator import DeltaGenerator

Data: TypeAlias = Union[
    "DataFrame",
    "Series",
    "Styler",
    "Index",
    "pa.Table",
    "ndarray",
    Iterable,
    Dict[str, List[Any]],
    None,
]

SelectionMode: TypeAlias = Literal[
    "single-row", "multi-row", "single-column", "multi-column"
]
_SELECTION_MODES: Final[set[SelectionMode]] = {
    "single-row",
    "multi-row",
    "single-column",
    "multi-column",
}


class DataframeSelectionState(TypedDict, total=False):
    """
    The schema for the dataframe selection state.

    The selection state is stored in a dictionary-like object that suports both
    key and attribute notation. Selection states cannot be programmatically
    changed or set through Session State.

    Attributes
    ----------
    rows : list[int]
        The selected rows, identified by their positional index. The positional
        indices match the original dataframe, even if the user sorts the
        dataframe in their browser.
    columns : list[str]
        The selected columns, identified by their names.

    Example
    -------
    The following example has multi-row and multi-column selections enabled.
    Try selecting some rows. To select multiple columns, hold ``Ctrl`` while
    selecting columns. Hold ``Shift`` to select a range of columns.

    >>> import streamlit as st
    >>> import pandas as pd
    >>> import numpy as np
    >>>
    >>> if "df" not in st.session_state:
    >>>     st.session_state.df = pd.DataFrame(
    ...         np.random.randn(12, 5), columns=["a", "b", "c", "d", "e"]
    ...     )
    >>>
    >>> event = st.dataframe(
    ...     st.session_state.df,
    ...     key="data",
    ...     on_select="rerun",
    ...     selection_mode=["multi-row", "multi-column"],
    ... )
    >>>
    >>> event.selection

    .. output::
        https://doc-dataframe-events-selection-state.streamlit.app
        height: 600px

    """

    rows: list[int]
    columns: list[str]


class DataframeState(TypedDict, total=False):
    """
    The schema for the dataframe event state.

    The event state is stored in a dictionary-like object that suports both
    key and attribute notation. Event states cannot be programmatically
    changed or set through Session State.

    Only selection events are supported at this time.

    Attributes
    ----------
    selection : DataframeSelectionState
        The state of the ``on_select`` event.

    """

    selection: DataframeSelectionState


@dataclass
class DataframeSelectionSerde:
    """DataframeSelectionSerde is used to serialize and deserialize the dataframe selection state."""

    def deserialize(self, ui_value: str | None, widget_id: str = "") -> DataframeState:
        empty_selection_state: DataframeState = {
            "selection": {
                "rows": [],
                "columns": [],
            },
        }
        selection_state: DataframeState = (
            empty_selection_state if ui_value is None else json.loads(ui_value)
        )

        if "selection" not in selection_state:
            selection_state = empty_selection_state

        return cast(DataframeState, AttributeDictionary(selection_state))

    def serialize(self, editing_state: DataframeState) -> str:
        return json.dumps(editing_state, default=str)


def parse_selection_mode(
    selection_mode: SelectionMode | Iterable[SelectionMode],
) -> Set[ArrowProto.SelectionMode.ValueType]:
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

    parsed_selection_modes = []
    for selection_mode in selection_mode_set:
        if selection_mode == "single-row":
            parsed_selection_modes.append(ArrowProto.SelectionMode.SINGLE_ROW)
        elif selection_mode == "multi-row":
            parsed_selection_modes.append(ArrowProto.SelectionMode.MULTI_ROW)
        elif selection_mode == "single-column":
            parsed_selection_modes.append(ArrowProto.SelectionMode.SINGLE_COLUMN)
        elif selection_mode == "multi-column":
            parsed_selection_modes.append(ArrowProto.SelectionMode.MULTI_COLUMN)
    return set(parsed_selection_modes)


class ArrowMixin:
    @overload
    def dataframe(
        self,
        data: Data = None,
        width: int | None = None,
        height: int | None = None,
        *,
        use_container_width: bool = False,
        hide_index: bool | None = None,
        column_order: Iterable[str] | None = None,
        column_config: ColumnConfigMappingInput | None = None,
        key: Key | None = None,
        on_select: Literal["ignore"],  # No default value here to make it work with mypy
        selection_mode: SelectionMode | Iterable[SelectionMode] = "multi-row",
    ) -> DeltaGenerator:
        ...

    @overload
    def dataframe(
        self,
        data: Data = None,
        width: int | None = None,
        height: int | None = None,
        *,
        use_container_width: bool = False,
        hide_index: bool | None = None,
        column_order: Iterable[str] | None = None,
        column_config: ColumnConfigMappingInput | None = None,
        key: Key | None = None,
        on_select: Literal["rerun"] | WidgetCallback = "rerun",
        selection_mode: SelectionMode | Iterable[SelectionMode] = "multi-row",
    ) -> DataframeState:
        ...

    @gather_metrics("dataframe")
    def dataframe(
        self,
        data: Data = None,
        width: int | None = None,
        height: int | None = None,
        *,
        use_container_width: bool = False,
        hide_index: bool | None = None,
        column_order: Iterable[str] | None = None,
        column_config: ColumnConfigMappingInput | None = None,
        key: Key | None = None,
        on_select: Literal["ignore", "rerun"] | WidgetCallback = "ignore",
        selection_mode: SelectionMode | Iterable[SelectionMode] = "multi-row",
    ) -> DeltaGenerator | DataframeState:
        """Display a dataframe as an interactive table.

        This command works with dataframes from Pandas, PyArrow, Snowpark, and PySpark.
        It can also display several other types that can be converted to dataframes,
        e.g. numpy arrays, lists, sets and dictionaries.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Series, pandas.Styler, pandas.Index, \
            pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.dataframe.DataFrame, \
            snowflake.snowpark.table.Table, Iterable, dict, or None
            The data to display.

            If ``data`` is a ``pandas.Styler``, it will be used to style its
            underlying ``pandas.DataFrame``. Streamlit supports custom cell
            values and colors. It does not support some of the more exotic
            pandas styling features, like bar charts, hovering, and captions.

        width : int or None
            Desired width of the dataframe expressed in pixels. If ``width`` is
            ``None`` (default), Streamlit sets the dataframe width to fit its
            contents up to the width of the parent container. If ``width`` is
            greater than the width of the parent container, Streamlit sets the
            dataframe width to match the width of the parent container.

        height : int or None
            Desired height of the dataframe expressed in pixels. If ``height``
            is ``None`` (default), Streamlit sets the height to show at most
            ten rows. Vertical scrolling within the dataframe element is
            enabled when the height does not accomodate all rows.

        use_container_width : bool
            Whether to override ``width`` with the width of the parent
            container. If ``use_container_width`` is ``False`` (default),
            Streamlit sets the dataframe's width according to ``width``. If
            ``use_container_width`` is ``True``, Streamlit sets the width of
            the dataframe to match the width of the parent container.

        hide_index : bool or None
            Whether to hide the index column(s). If ``hide_index`` is ``None``
            (default), the visibility of index columns is automatically
            determined based on the data.

        column_order : Iterable of str or None
            The ordered list of columns to display. If ``column_order`` is
            ``None`` (default), Streamlit displays all columns in the order
            inherited from the underlying data structure. If ``column_order``
            is a list, the indicated columns will display in the order they
            appear within the list. Columns may be omitted or repeated within
            the list.

            For example, ``column_order=("col2", "col1")`` will display
            ``"col2"`` first, followed by ``"col1"``, and will hide all other
            non-index columns.

        column_config : dict or None
            Configuration to customize how columns display. If ``column_config``
            is ``None`` (default), columns are styled based on the underlying
            data type of each column.

            Column configuration can modify column names, visibility, type,
            width, or format, among other things. ``column_config`` must be a
            dictionary where each key is a column name and the associated value
            is one of the following:

            * ``None``: Streamlit hides the column.

            * A string: Streamlit changes the display label of the column to
              the given string.

            * A column type within ``st.column_config``: Streamlit applies the
              defined configuration to the column. For example, use
              ``st.column_config.NumberColumn("Dollar values”, format=”$ %d")``
              to change the displayed name of the column to "Dollar values"
              and add a "$" prefix in each cell. For more info on the
              available column types and config options, see
              `Column configuration <https://docs.streamlit.io/library/api-reference/data/st.column_config>`_.

            To configure the index column(s), use ``_index`` as the column name.

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
              rows or columns in the dataframe. In this case, ``st.dataframe``
              will return the selection data as a dictionary.

            - A ``callable``: Streamlit will rerun the app and execute the
              ``callable`` as a callback function before the rest of the app.
              In this case, ``st.dataframe`` will return the selection data
              as a dictionary.

        selection_mode : "single-row", "multi-row", single-column", \
            "multi-column", or Iterable of these
            The types of selections Streamlit should allow. This can be one of
            the following:

            - "multi-row" (default): Multiple rows can be selected at a time.
            - "single-row": Only one row can be selected at a time.
            - "multi-column": Multiple columns can be selected at a time.
            - "single-column": Only one column can be selected at a time.
            - An ``Iterable`` of the above options: The table will allow
              selection based on the modes specified.

            When column selections are enabled, column sorting is disabled.

        Returns
        -------
        element or dict
            If ``on_select`` is ``"ignore"`` (default), this method returns an
            internal placeholder for the dataframe element that can be used
            with the ``.add_rows()`` method. Otherwise, this method returns a
            dictionary-like object that supports both key and attribute
            notation. The attributes are described by the ``DataframeState``
            dictionary schema.

        Examples
        --------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> df = pd.DataFrame(np.random.randn(50, 20), columns=("col %d" % i for i in range(20)))
        >>>
        >>> st.dataframe(df)  # Same as st.write(df)

        .. output::
           https://doc-dataframe.streamlit.app/
           height: 500px

        You can also pass a Pandas Styler object to change the style of
        the rendered DataFrame:

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> df = pd.DataFrame(np.random.randn(10, 20), columns=("col %d" % i for i in range(20)))
        >>>
        >>> st.dataframe(df.style.highlight_max(axis=0))

        .. output::
           https://doc-dataframe1.streamlit.app/
           height: 500px

        Or you can customize the dataframe via ``column_config``, ``hide_index``, or ``column_order``:

        >>> import random
        >>> import pandas as pd
        >>> import streamlit as st
        >>>
        >>> df = pd.DataFrame(
        >>>     {
        >>>         "name": ["Roadmap", "Extras", "Issues"],
        >>>         "url": ["https://roadmap.streamlit.app", "https://extras.streamlit.app", "https://issues.streamlit.app"],
        >>>         "stars": [random.randint(0, 1000) for _ in range(3)],
        >>>         "views_history": [[random.randint(0, 5000) for _ in range(30)] for _ in range(3)],
        >>>     }
        >>> )
        >>> st.dataframe(
        >>>     df,
        >>>     column_config={
        >>>         "name": "App name",
        >>>         "stars": st.column_config.NumberColumn(
        >>>             "Github Stars",
        >>>             help="Number of stars on GitHub",
        >>>             format="%d ⭐",
        >>>         ),
        >>>         "url": st.column_config.LinkColumn("App URL"),
        >>>         "views_history": st.column_config.LineChartColumn(
        >>>             "Views (past 30 days)", y_min=0, y_max=5000
        >>>         ),
        >>>     },
        >>>     hide_index=True,
        >>> )

        .. output::
           https://doc-dataframe-config.streamlit.app/
           height: 350px

        """
        import pyarrow as pa

        if on_select not in ["ignore", "rerun"] and not callable(on_select):
            raise StreamlitAPIException(
                f"You have passed {on_select} to `on_select`. But only 'ignore', 'rerun', or a callable is supported."
            )

        key = to_key(key)
        is_selection_activated = on_select != "ignore"

        if is_selection_activated:
            # Run some checks that are only relevant when selections are activated

            # Import here to avoid circular imports
            from streamlit.elements.utils import (
                check_cache_replay_rules,
                check_callback_rules,
                check_session_state_rules,
            )

            check_cache_replay_rules()
            if callable(on_select):
                check_callback_rules(self.dg, on_select)
            check_session_state_rules(default_value=None, key=key, writes_allowed=False)

        # Convert the user provided column config into the frontend compatible format:
        column_config_mapping = process_config_mapping(column_config)

        proto = ArrowProto()
        proto.use_container_width = use_container_width
        if width:
            proto.width = width
        if height:
            proto.height = height

        if column_order:
            proto.column_order[:] = column_order

        proto.editing_mode = ArrowProto.EditingMode.READ_ONLY

        if isinstance(data, pa.Table):
            # For pyarrow tables, we can just serialize the table directly
            proto.data = type_util.pyarrow_table_to_bytes(data)
        else:
            # For all other data formats, we need to convert them to a pandas.DataFrame
            # thereby, we also apply some data specific configs

            # Determine the input data format
            data_format = type_util.determine_data_format(data)

            if type_util.is_pandas_styler(data):
                # If pandas.Styler uuid is not provided, a hash of the position
                # of the element will be used. This will cause a rerender of the table
                # when the position of the element is changed.
                delta_path = self.dg._get_delta_path_str()
                default_uuid = str(hash(delta_path))
                marshall_styler(proto, data, default_uuid)

            # Convert the input data into a pandas.DataFrame
            data_df = type_util.convert_anything_to_df(data, ensure_copy=False)
            apply_data_specific_configs(
                column_config_mapping,
                data_df,
                data_format,
                check_arrow_compatibility=False,
            )
            # Serialize the data to bytes:
            proto.data = type_util.data_frame_to_bytes(data_df)

        if hide_index is not None:
            update_column_config(
                column_config_mapping, INDEX_IDENTIFIER, {"hidden": hide_index}
            )
        marshall_column_config(proto, column_config_mapping)

        if is_selection_activated:
            # Import here to avoid circular imports
            from streamlit.elements.form import current_form_id

            # If selection events are activated, we need to register the dataframe
            # element as a widget.
            proto.selection_mode.extend(parse_selection_mode(selection_mode))
            proto.form_id = current_form_id(self.dg)

            ctx = get_script_run_ctx()
            proto.id = compute_widget_id(
                "dataframe",
                user_key=key,
                data=proto.data,
                width=width,
                height=height,
                use_container_width=use_container_width,
                column_order=proto.column_order,
                column_config=proto.columns,
                key=key,
                selection_mode=selection_mode,
                is_selection_activated=is_selection_activated,
                form_id=proto.form_id,
                page=ctx.page_script_hash if ctx else None,
            )

            serde = DataframeSelectionSerde()
            widget_state = register_widget(
                "dataframe",
                proto,
                user_key=key,
                on_change_handler=on_select if callable(on_select) else None,
                deserializer=serde.deserialize,
                serializer=serde.serialize,
                ctx=ctx,
            )
            self.dg._enqueue("arrow_data_frame", proto)
            return cast(DataframeState, widget_state.value)
        else:
            return self.dg._enqueue("arrow_data_frame", proto)

    @gather_metrics("table")
    def table(self, data: Data = None) -> DeltaGenerator:
        """Display a static table.

        This differs from ``st.dataframe`` in that the table in this case is
        static: its entire contents are laid out directly on the page.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.dataframe.DataFrame, snowflake.snowpark.table.Table, Iterable, dict, or None
            The table data.

        Example
        -------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> df = pd.DataFrame(np.random.randn(10, 5), columns=("col %d" % i for i in range(5)))
        >>>
        >>> st.table(df)

        .. output::
           https://doc-table.streamlit.app/
           height: 480px

        """

        # Check if data is uncollected, and collect it but with 100 rows max, instead of 10k rows, which is done in all other cases.
        # Avoid this and use 100 rows in st.table, because large tables render slowly, take too much screen space, and can crush the app.
        if type_util.is_unevaluated_data_object(data):
            data = type_util.convert_anything_to_df(data, max_unevaluated_rows=100)

        # If pandas.Styler uuid is not provided, a hash of the position
        # of the element will be used. This will cause a rerender of the table
        # when the position of the element is changed.
        delta_path = self.dg._get_delta_path_str()
        default_uuid = str(hash(delta_path))

        proto = ArrowProto()
        marshall(proto, data, default_uuid)
        return self.dg._enqueue("arrow_table", proto)

    @gather_metrics("add_rows")
    def add_rows(self, data: Data = None, **kwargs) -> DeltaGenerator | None:
        """Concatenate a dataframe to the bottom of the current one.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.dataframe.DataFrame, Iterable, dict, or None
            Table to concat. Optional.

        **kwargs : pandas.DataFrame, numpy.ndarray, Iterable, dict, or None
            The named dataset to concat. Optional. You can only pass in 1
            dataset (including the one in the data parameter).

        Example
        -------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> df1 = pd.DataFrame(np.random.randn(50, 20), columns=("col %d" % i for i in range(20)))
        >>>
        >>> my_table = st.table(df1)
        >>>
        >>> df2 = pd.DataFrame(np.random.randn(50, 20), columns=("col %d" % i for i in range(20)))
        >>>
        >>> my_table.add_rows(df2)
        >>> # Now the table shown in the Streamlit app contains the data for
        >>> # df1 followed by the data for df2.

        You can do the same thing with plots. For example, if you want to add
        more data to a line chart:

        >>> # Assuming df1 and df2 from the example above still exist...
        >>> my_chart = st.line_chart(df1)
        >>> my_chart.add_rows(df2)
        >>> # Now the chart shown in the Streamlit app contains the data for
        >>> # df1 followed by the data for df2.

        And for plots whose datasets are named, you can pass the data with a
        keyword argument where the key is the name:

        >>> my_chart = st.vega_lite_chart({
        ...     'mark': 'line',
        ...     'encoding': {'x': 'a', 'y': 'b'},
        ...     'datasets': {
        ...       'some_fancy_name': df1,  # <-- named dataset
        ...      },
        ...     'data': {'name': 'some_fancy_name'},
        ... }),
        >>> my_chart.add_rows(some_fancy_name=df2)  # <-- name used as keyword

        """
        return self.dg._arrow_add_rows(data, **kwargs)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


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

    """
    import pyarrow as pa

    if type_util.is_pandas_styler(data):
        # default_uuid is a string only if the data is a `Styler`,
        # and `None` otherwise.
        assert isinstance(
            default_uuid, str
        ), "Default UUID must be a string for Styler data."
        marshall_styler(proto, data, default_uuid)

    if isinstance(data, pa.Table):
        proto.data = type_util.pyarrow_table_to_bytes(data)
    else:
        df = type_util.convert_anything_to_df(data)
        proto.data = type_util.data_frame_to_bytes(df)
