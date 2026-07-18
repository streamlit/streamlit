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
from dataclasses import dataclass
from typing import (
    TYPE_CHECKING,
    Final,
    Literal,
    TypedDict,
    cast,
    overload,
)

from typing_extensions import Required

from streamlit import dataframe_util
from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.layout_utils import (
    HeightWithoutContent,
    LayoutConfig,
    WidthWithoutContent,
    validate_height,
    validate_width,
)
from streamlit.elements.lib.policies import check_widget_policies
from streamlit.elements.lib.utils import Key, compute_and_register_element_id, to_key
from streamlit.errors import StreamlitAPIException
from streamlit.proto.ScatterplotMatrixChart_pb2 import (
    ScatterplotMatrixChart as ScatterplotMatrixChartProto,
)
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.runtime.state import WidgetCallback, register_widget
from streamlit.util import AttributeDictionary

if TYPE_CHECKING:
    from collections.abc import Sequence

    import pandas as pd

    from streamlit.dataframe_util import Data
    from streamlit.delta_generator import DeltaGenerator

_MIN_DIMENSIONS: Final = 2
_MAX_DIMENSIONS: Final = 10
_MAX_QUERY_LAYERS: Final = 8
_DEFAULT_HEIGHT: Final = 520


class ScatterplotMatrixQueryLayerState(TypedDict, total=False):
    """
    The schema for a single query layer in the scatterplot matrix
    selection state.

    Attributes
    ----------
    label : str
        The label of the query layer (e.g. ``"Query 1"``).

    indices : list[int]
        The positional row indices of the data points captured by this
        query layer's lasso selection.
    """

    label: Required[str]
    indices: Required[list[int]]


class ScatterplotMatrixSelectionState(TypedDict, total=False):
    """
    The schema for the scatterplot matrix chart selection state.

    The selection state is stored in a dictionary-like object that supports
    both key and attribute notation. Selection states cannot be
    programmatically changed or set through Session State.

    Attributes
    ----------
    indices : list[int]
        The positional row indices of all data points that are part of at
        least one query layer selection.

    query_layers : list[dict[str, Any]]
        One entry per query layer, in layer order. Each entry contains the
        layer's ``label`` and the ``indices`` of the rows captured by the
        layer's lasso selection.

    Example
    -------
    >>> import numpy as np
    >>> import pandas as pd
    >>> import streamlit as st
    >>>
    >>> df = pd.DataFrame(
    ...     np.random.default_rng(0).standard_normal((60, 3)),
    ...     columns=["a", "b", "c"],
    ... )
    >>>
    >>> event = st.scatterplot_matrix_chart(df, key="splom", on_select="rerun")
    >>>
    >>> event.selection
    """

    indices: Required[list[int]]
    query_layers: Required[list[ScatterplotMatrixQueryLayerState]]


class ScatterplotMatrixState(TypedDict, total=False):
    """
    The schema for the scatterplot matrix chart event state.

    The event state is stored in a dictionary-like object that supports both
    key and attribute notation. Event states cannot be programmatically
    changed or set through Session State.

    Only selection events are supported at this time.

    Attributes
    ----------
    selection : dict
        The state of the ``on_select`` event. This attribute returns a
        dictionary-like object that supports both key and attribute notation.
        The attributes are described by the ``ScatterplotMatrixSelectionState``
        dictionary schema.
    """

    selection: Required[ScatterplotMatrixSelectionState]


@dataclass
class ScatterplotMatrixSelectionSerde:
    """Serialize and deserialize the scatterplot matrix chart selection state."""

    def deserialize(self, ui_value: str | None) -> ScatterplotMatrixState:
        empty_selection_state: ScatterplotMatrixState = {
            "selection": {
                "indices": [],
                "query_layers": [],
            },
        }

        selection_state = (
            empty_selection_state
            if ui_value is None
            else cast(
                "ScatterplotMatrixState", AttributeDictionary(json.loads(ui_value))
            )
        )

        if "selection" not in selection_state:  # pragma: no cover - defensive
            selection_state = empty_selection_state  # type: ignore[unreachable]

        return cast("ScatterplotMatrixState", AttributeDictionary(selection_state))

    def serialize(self, selection_state: ScatterplotMatrixState) -> str:
        return json.dumps(selection_state, default=str)


def _parse_dimension_columns(
    data_df: pd.DataFrame, columns: Sequence[str] | None
) -> list[str]:
    """Determine and validate the numeric dimension columns of the matrix."""
    from pandas.api.types import is_numeric_dtype

    if columns is None:
        parsed_columns = [
            str(column)
            for column in data_df.columns
            if is_numeric_dtype(data_df[column])
        ][:_MAX_DIMENSIONS]
    else:
        parsed_columns = [str(column) for column in columns]
        missing_columns = [
            column for column in parsed_columns if column not in data_df.columns
        ]
        if missing_columns:
            raise StreamlitAPIException(
                f"The following columns were not found in the data: "
                f"{missing_columns}. Available columns: "
                f"{[str(column) for column in data_df.columns]}."
            )
        non_numeric_columns = [
            column for column in parsed_columns if not is_numeric_dtype(data_df[column])
        ]
        if non_numeric_columns:
            raise StreamlitAPIException(
                f"The following columns are not numeric and cannot be used as "
                f"matrix dimensions: {non_numeric_columns}. All matrix "
                f"dimensions must be numeric columns."
            )

    if len(parsed_columns) < _MIN_DIMENSIONS:
        raise StreamlitAPIException(
            f"The scatterplot matrix chart requires at least {_MIN_DIMENSIONS} "
            f"numeric columns, but only got: {parsed_columns}."
        )
    if len(parsed_columns) > _MAX_DIMENSIONS:
        raise StreamlitAPIException(
            f"The scatterplot matrix chart supports at most {_MAX_DIMENSIONS} "
            f"dimensions, but got {len(parsed_columns)}. Please select a "
            f"subset via the `columns` parameter."
        )
    return parsed_columns


class ScatterplotMatrixChartMixin:
    @overload
    def scatterplot_matrix_chart(
        self,
        data: Data,
        *,
        columns: Sequence[str] | None = None,
        label: str | None = None,
        title: str | None = None,
        query_colors: Sequence[str] | None = None,
        roll_speed: float = 1.0,
        width: WidthWithoutContent = "stretch",
        height: HeightWithoutContent = _DEFAULT_HEIGHT,
        key: Key | None = None,
        on_select: Literal["ignore"],  # No default to make it work with mypy
    ) -> DeltaGenerator: ...

    @overload
    def scatterplot_matrix_chart(
        self,
        data: Data,
        *,
        columns: Sequence[str] | None = None,
        label: str | None = None,
        title: str | None = None,
        query_colors: Sequence[str] | None = None,
        roll_speed: float = 1.0,
        width: WidthWithoutContent = "stretch",
        height: HeightWithoutContent = _DEFAULT_HEIGHT,
        key: Key | None = None,
        on_select: Literal["rerun"] | WidgetCallback = "rerun",
    ) -> ScatterplotMatrixState: ...

    @gather_metrics("scatterplot_matrix_chart")
    def scatterplot_matrix_chart(
        self,
        data: Data,
        *,
        columns: Sequence[str] | None = None,
        label: str | None = None,
        title: str | None = None,
        query_colors: Sequence[str] | None = None,
        roll_speed: float = 1.0,
        width: WidthWithoutContent = "stretch",
        height: HeightWithoutContent = _DEFAULT_HEIGHT,
        key: Key | None = None,
        on_select: Literal["rerun", "ignore"] | WidgetCallback = "ignore",
    ) -> DeltaGenerator | ScatterplotMatrixState:
        """Display an interactive scatterplot matrix (SPLOM) with rolling navigation.

        The chart shows a small scatterplot for every pair of the selected
        numeric columns next to one large detail plot. Users can left-click a
        small plot to jump to it, right-click (or use the arrow keys) to
        "roll" to it through an animated sequence of neighboring plots, and
        inspect points through an excentric label lens. With a query layer
        selected, users can lasso points in the large plot to build up to
        several persistent selections that stay visible while navigating.

        The interaction design follows the classic scatterplot matrix
        navigation technique for exploring multidimensional datasets.

        Parameters
        ----------
        data : Anything supported by st.dataframe
            The dataset to explore. Non-numeric columns are ignored unless
            referenced via ``label``.

        columns : Sequence of str or None
            The numeric columns to use as matrix dimensions. If this is
            ``None`` (default), all numeric columns are used (up to 10).
            The matrix has one row and one column per dimension, so between
            2 and 10 dimensions are supported.

        label : str or None
            The column to use for point labels in the excentric label lens
            of the large plot. If this is ``None`` (default), the positional
            row number is used as the label.

        title : str or None
            An optional title to display above the matrix.

        query_colors : Sequence of str or None
            The CSS colors of the query layers. Each color adds one query
            layer that users can lasso points into. If this is ``None``
            (default), four default colors are used. A maximum of 8 query
            layers is supported.

        roll_speed : float
            A speed multiplier for the rolling animation between plots.
            This is ``1.0`` by default; larger values roll faster.

        width : "stretch" or int
            The width of the chart element. This can be one of the following:

            - ``"stretch"`` (default): The width of the element matches the
              width of the parent container.
            - An integer specifying the width in pixels: The element has a
              fixed width. If the specified width is greater than the width
              of the parent container, the width of the element matches the
              width of the parent container.

        height : int or "stretch"
            The height of the chart element. This can be one of the following:

            - An integer specifying the height in pixels: The chart has a
              fixed height. This is ``520`` by default.
            - ``"stretch"``: The height of the chart matches the height of
              the parent container.

        key : str, int, or None
            An optional string to use for giving this element a stable
            identity. If this is ``None`` (default), the element's identity
            will be determined based on the values of the other parameters.

        on_select : "ignore" or "rerun" or callable
            How the chart should respond to user selection events. This
            controls whether or not the chart behaves like an input widget.
            ``on_select`` can be one of the following:

            - ``"ignore"`` (default): Streamlit will not react to any
              selection events in the chart. The chart will not behave like
              an input widget.
            - ``"rerun"``: Streamlit will rerun the app when the user
              changes a lasso selection in the chart. In this case,
              ``st.scatterplot_matrix_chart`` will return the selection data
              as a dictionary.
            - A ``callable``: Streamlit will rerun the app and execute the
              ``callable`` as a callback function before the rest of the
              app. In this case, ``st.scatterplot_matrix_chart`` will return
              the selection data as a dictionary.

        Returns
        -------
        element or dict
            If ``on_select`` is ``"ignore"`` (default), this command returns
            an internal placeholder for the chart element. Otherwise, this
            command returns a dictionary-like object that supports both key
            and attribute notation. The attributes are described by the
            ``ScatterplotMatrixState`` dictionary schema.

        Examples
        --------
        **Example 1: Explore a dataset**

        >>> import numpy as np
        >>> import pandas as pd
        >>> import streamlit as st
        >>>
        >>> rng = np.random.default_rng(0)
        >>> df = pd.DataFrame(
        ...     {
        ...         "mpg": rng.normal(23, 8, 200),
        ...         "horsepower": rng.normal(105, 40, 200),
        ...         "weight": rng.normal(2970, 850, 200),
        ...         "acceleration": rng.normal(15.5, 2.8, 200),
        ...     }
        ... )
        >>>
        >>> st.scatterplot_matrix_chart(df, title="Cars")

        **Example 2: React to lasso selections**

        >>> import numpy as np
        >>> import pandas as pd
        >>> import streamlit as st
        >>>
        >>> rng = np.random.default_rng(0)
        >>> df = pd.DataFrame(rng.standard_normal((150, 3)), columns=["a", "b", "c"])
        >>>
        >>> event = st.scatterplot_matrix_chart(df, key="splom", on_select="rerun")
        >>> st.dataframe(df.iloc[event.selection.indices])
        """
        validate_width(width)
        validate_height(height)

        if on_select not in {"ignore", "rerun"} and not callable(on_select):
            raise StreamlitAPIException(
                f"You have passed {on_select} to `on_select`. But only 'ignore', "
                "'rerun', or a callable is supported."
            )

        if not isinstance(roll_speed, (int, float)) or roll_speed <= 0:
            raise StreamlitAPIException(
                f"Invalid roll_speed: {roll_speed}. The roll speed must be a "
                "positive number."
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

        data_df = dataframe_util.convert_anything_to_pandas_df(data, ensure_copy=False)
        # Stringify column names (e.g. a default RangeIndex produces integer
        # column names) so column lookups and the marshalled Arrow data are
        # consistent. rename returns a new frame, so user data is not mutated.
        data_df = data_df.rename(columns=str)

        parsed_columns = _parse_dimension_columns(data_df, columns)

        if label is not None and label not in data_df.columns:
            raise StreamlitAPIException(
                f'The label column "{label}" was not found in the data. '
                f"Available columns: {[str(column) for column in data_df.columns]}."
            )

        parsed_query_colors = (
            [str(color) for color in query_colors] if query_colors else []
        )
        if len(parsed_query_colors) > _MAX_QUERY_LAYERS:
            raise StreamlitAPIException(
                f"The scatterplot matrix chart supports at most "
                f"{_MAX_QUERY_LAYERS} query layers, but got "
                f"{len(parsed_query_colors)} colors."
            )

        # Only marshall the columns that are actually used by the chart:
        marshalled_columns = list(parsed_columns)
        if label is not None and label not in marshalled_columns:
            marshalled_columns.append(label)
        chart_df = data_df[marshalled_columns].reset_index(drop=True)

        proto = ScatterplotMatrixChartProto()
        proto.data.data = dataframe_util.convert_pandas_df_to_arrow_bytes(chart_df)
        proto.columns.extend(parsed_columns)
        proto.label = label or ""
        proto.title = title or ""
        proto.query_colors.extend(parsed_query_colors)
        proto.roll_speed = float(roll_speed)
        proto.selections_activated = is_selection_activated
        proto.form_id = current_form_id(self.dg)

        ctx = get_script_run_ctx()

        # We compute the element id for all uses (widget or not) so the
        # frontend component can keep its navigation state when it gets
        # unmounted and remounted.
        proto.id = compute_and_register_element_id(
            "scatterplot_matrix_chart",
            user_key=key,
            key_as_main_identity=False,
            dg=self.dg,
            data=proto.data.data,
            columns=parsed_columns,
            label=label,
            title=title,
            query_colors=parsed_query_colors,
            roll_speed=roll_speed,
            is_selection_activated=is_selection_activated,
            width=width,
            height=height,
        )

        layout_config = LayoutConfig(width=width, height=height)

        if is_selection_activated:
            # Selections are activated, treat the chart as a widget:
            serde = ScatterplotMatrixSelectionSerde()

            widget_state = register_widget(
                proto.id,
                on_change_handler=on_select if callable(on_select) else None,
                deserializer=serde.deserialize,
                serializer=serde.serialize,
                ctx=ctx,
                value_type="string_value",
            )

            self.dg._enqueue(
                "scatterplot_matrix_chart", proto, layout_config=layout_config
            )
            return widget_state.value

        return self.dg._enqueue(
            "scatterplot_matrix_chart", proto, layout_config=layout_config
        )

    @property
    def dg(self) -> DeltaGenerator:
        """The associated DeltaGenerator."""
        return cast("DeltaGenerator", self)
