# Copyright 2018-2022 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""A Python wrapper around Altair.
Altair is a Python visualization library based on Vega-Lite,
a nice JSON schema for expressing graphs and charts."""

from datetime import date
from enum import Enum
from typing import (
    cast,
    TYPE_CHECKING,
    Union,
    Dict,
    Any,
    Sequence,
    List,
    Tuple,
    Optional,
)

import altair as alt
import pandas as pd
from altair.vegalite.v4.api import Chart
from numpy.distutils.misc_util import is_sequence

from streamlit.errors import StreamlitAPIException
import streamlit.elements.arrow_vega_lite as arrow_vega_lite
from streamlit import type_util
from streamlit.proto.ArrowVegaLiteChart_pb2 import (
    ArrowVegaLiteChart as ArrowVegaLiteChartProto,
)

from .arrow import Data
from .utils import last_index_for_melted_dataframes

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator

# Create and enable streamlit theme
STREAMLIT_THEME = {"embedOptions": {"theme": "streamlit"}}

# This allows to use alt.themes.enable("streamlit") to activate Streamlit theme.
alt.themes.register("streamlit", lambda: {"usermeta": STREAMLIT_THEME})
# We don't want to activate the Streamlit theme for all Altair as default for now.
# However, the Streamlit theme will be activated as default for our built-in charts.
alt.themes.enable("none")


class ChartType(Enum):
    AREA = "area"
    BAR = "bar"
    LINE = "line"


class ArrowAltairMixin:
    def _arrow_line_chart(
        self,
        data: Data = None,
        *,
        x: Union[str, None] = None,
        y: Union[str, Sequence[str], None] = None,
        width: int = 0,
        height: int = 0,
        use_container_width: bool = True,
    ) -> "DeltaGenerator":
        """Display a line chart.

        This is syntax-sugar around st._arrow_altair_chart. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        If st._arrow_line_chart does not guess the data specification
        correctly, try specifying your desired chart using st._arrow_altair_chart.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, Iterable, dict or None
            Data to be plotted.

        x : str or None
            Column name to use for the x-axis. If None, uses the data index for the x-axis.
            This argument can only be supplied by keyword.

        y : str, sequence of str, or None
            Column name(s) to use for the y-axis. If a sequence of strings, draws several series
            on the same chart by melting your wide-format table into a long-format table behind
            the scenes. If None, draws the data of all columns as data series.
            This argument can only be supplied by keyword.

        width : int
            The chart width in pixels. If 0, selects the width automatically.
            This argument can only be supplied by keyword.

        height : int
            The chart height in pixels. If 0, selects the height automatically.
            This argument can only be supplied by keyword.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the width argument.
            This argument can only be supplied by keyword.

        Example
        -------
        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(20, 3),
        ...     columns=['a', 'b', 'c'])
        ...
        >>> st._arrow_line_chart(chart_data)

        .. output::
           https://static.streamlit.io/0.50.0-td2L/index.html?id=BdxXG3MmrVBfJyqS2R2ki8
           height: 220px

        """
        proto = ArrowVegaLiteChartProto()
        chart = _generate_chart(ChartType.LINE, data, x, y, width, height)
        marshall(proto, chart, use_container_width)
        last_index = last_index_for_melted_dataframes(data)

        return self.dg._enqueue("arrow_line_chart", proto, last_index=last_index)

    def _arrow_area_chart(
        self,
        data: Data = None,
        *,
        x: Union[str, None] = None,
        y: Union[str, Sequence[str], None] = None,
        width: int = 0,
        height: int = 0,
        use_container_width: bool = True,
    ) -> "DeltaGenerator":
        """Display an area chart.

        This is just syntax-sugar around st._arrow_altair_chart. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        If st._arrow_area_chart does not guess the data specification
        correctly, try specifying your desired chart using st._arrow_altair_chart.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, Iterable, or dict
            Data to be plotted.

        x : str or None
            Column name to use for the x-axis. If None, uses the data index for the x-axis.
            This argument can only be supplied by keyword.

        y : str, sequence of str, or None
            Column name(s) to use for the y-axis. If a sequence of strings, draws several series
            on the same chart by melting your wide-format table into a long-format table behind
            the scenes. If None, draws the data of all columns as data series.
            This argument can only be supplied by keyword.

        width : int
            The chart width in pixels. If 0, selects the width automatically.
            This argument can only be supplied by keyword.

        height : int
            The chart height in pixels. If 0, selects the height automatically.
            This argument can only be supplied by keyword.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the width argument.

        Example
        -------
        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(20, 3),
        ...     columns=['a', 'b', 'c'])
        ...
        >>> st._arrow_area_chart(chart_data)

        .. output::
           https://static.streamlit.io/0.50.0-td2L/index.html?id=Pp65STuFj65cJRDfhGh4Jt
           height: 220px

        """
        proto = ArrowVegaLiteChartProto()
        chart = _generate_chart(ChartType.AREA, data, x, y, width, height)
        marshall(proto, chart, use_container_width)
        last_index = last_index_for_melted_dataframes(data)

        return self.dg._enqueue("arrow_area_chart", proto, last_index=last_index)

    def _arrow_bar_chart(
        self,
        data: Data = None,
        *,
        x: Union[str, None] = None,
        y: Union[str, Sequence[str], None] = None,
        width: int = 0,
        height: int = 0,
        use_container_width: bool = True,
    ) -> "DeltaGenerator":
        """Display a bar chart.

        This is just syntax-sugar around st._arrow_altair_chart. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        If st._arrow_bar_chart does not guess the data specification
        correctly, try specifying your desired chart using st._arrow_altair_chart.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, Iterable, or dict
            Data to be plotted.

        x : str or None
            Column name to use for the x-axis. If None, uses the data index for the x-axis.
            This argument can only be supplied by keyword.

        y : str, sequence of str, or None
            Column name(s) to use for the y-axis. If a sequence of strings, draws several series
            on the same chart by melting your wide-format table into a long-format table behind
            the scenes. If None, draws the data of all columns as data series.
            This argument can only be supplied by keyword.

        width : int
            The chart width in pixels. If 0, selects the width automatically.
            This argument can only be supplied by keyword.

        height : int
            The chart height in pixels. If 0, selects the height automatically.
            This argument can only be supplied by keyword.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the width argument.
            This argument can only be supplied by keyword.

        Example
        -------
        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(50, 3),
        ...     columns=["a", "b", "c"])
        ...
        >>> st._arrow_bar_chart(chart_data)

        .. output::
           https://static.streamlit.io/0.66.0-2BLtg/index.html?id=GaYDn6vxskvBUkBwsGVEaL
           height: 220px

        """
        proto = ArrowVegaLiteChartProto()
        chart = _generate_chart(ChartType.BAR, data, x, y, width, height)
        marshall(proto, chart, use_container_width)
        last_index = last_index_for_melted_dataframes(data)

        return self.dg._enqueue("arrow_bar_chart", proto, last_index=last_index)

    def _arrow_altair_chart(
        self,
        altair_chart: Chart,
        use_container_width: bool = False,
    ) -> "DeltaGenerator":
        """Display a chart using the Altair library.

        Parameters
        ----------
        altair_chart : altair.vegalite.v2.api.Chart
            The Altair chart object to display.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over Altair's native `width` value.

        Example
        -------

        >>> import pandas as pd
        >>> import numpy as np
        >>> import altair as alt
        >>>
        >>> df = pd.DataFrame(
        ...     np.random.randn(200, 3),
        ...     columns=['a', 'b', 'c'])
        ...
        >>> c = alt.Chart(df).mark_circle().encode(
        ...     x='a', y='b', size='c', color='c', tooltip=['a', 'b', 'c'])
        >>>
        >>> st._arrow_altair_chart(c, use_container_width=True)

        .. output::
           https://static.streamlit.io/0.25.0-2JkNY/index.html?id=8jmmXR8iKoZGV4kXaKGYV5
           height: 200px

        Examples of Altair charts can be found at
        https://altair-viz.github.io/gallery/.

        """
        proto = ArrowVegaLiteChartProto()
        marshall(
            proto,
            altair_chart,
            use_container_width=use_container_width,
        )

        return self.dg._enqueue("arrow_vega_lite_chart", proto)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


def _is_date_column(df: pd.DataFrame, name: str) -> bool:
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
    column = df[name]
    if column.size == 0:
        return False
    return isinstance(column[0], date)


def _maybe_melt(
    data: pd.DataFrame,
    x: Union[str, None] = None,
    y: Union[str, Sequence[str], None] = None,
) -> Tuple[pd.DataFrame, str, str, str, str, Optional[str], Optional[str]]:
    color_name: Optional[str]
    color_title: Optional[str] = ""

    y_name = "value"
    # This has to contain an empty space, otherwise the
    # full y-axis disappears (maybe a bug in vega-lite)?
    y_title = " "

    if x and isinstance(x, str):
        # x is a single string -> use for x-axis
        x_name = x
        x_title = x
        if x_name not in data.columns:
            raise StreamlitAPIException(
                f"{x_name} (x parameter) was not found in the data columns."
            )
    else:
        # use index for x-axis
        x_name = data.index.name or "index"
        x_title = ""
        data = data.reset_index()

    if y and isinstance(y, str):
        # y is a single string -> use for y-axis
        y_name = y
        y_title = y
        if y_name not in data.columns:
            raise StreamlitAPIException(
                f"{y_name} (y parameter) was not found in the data columns."
            )

        # Set var name to None since it should not be used
        color_name = None
    elif y and is_sequence(y):
        color_name = "variable"
        # y is a list -> melt dataframe into value vars provided in y
        value_vars: List[str] = []
        for col in y:
            if str(col) not in data.columns:
                raise StreamlitAPIException(
                    f"{str(col)} in y parameter was not found in the data columns."
                )
            value_vars.append(str(col))

        if x_name in [y_name, color_name]:
            raise StreamlitAPIException(
                "Unable to melt the table. Please rename the columns used for x or y."
            )

        data = pd.melt(
            data,
            id_vars=[x_name],
            value_vars=value_vars,
            var_name=color_name,
            value_name=y_name,
        )

        # Arrow has problems with object types after melting two different dtypes
        # pyarrow.lib.ArrowTypeError: "Expected a <TYPE> object, got a object"
        data = type_util.convert_object_dtypes_to_string(
            data, selected_columns=[x_name, color_name, y_name]
        )
    else:
        color_name = "variable"
        # -> data will be melted into the value prop for y
        data = pd.melt(data, id_vars=[x_name], var_name=color_name, value_name=y_name)
        # Arrow has problems with object types after melting two different dtypes
        # pyarrow.lib.ArrowTypeError: "Expected a <TYPE> object, got a object"
        data = type_util.convert_object_dtypes_to_string(data)

    return data, x_name, x_title, y_name, y_title, color_name, color_title


def _generate_chart(
    chart_type: ChartType,
    data: Data,
    x: Union[str, None] = None,
    y: Union[str, Sequence[str], None] = None,
    width: int = 0,
    height: int = 0,
) -> Chart:
    """This function uses the chart's type, data columns and indices to figure out the chart's spec."""

    if data is None:
        # Use an empty-ish dict because if we use None the x axis labels rotate
        # 90 degrees. No idea why. Need to debug.
        data = {"": []}

    if not isinstance(data, pd.DataFrame):
        data = type_util.convert_anything_to_df(data)

    data, x_name, x_title, y_name, y_title, color_name, color_title = _maybe_melt(
        data, x, y
    )

    opacity = None
    if chart_type == ChartType.AREA and color_name:
        opacity = {y_name: 0.7}
    # Set the X and Y axes' scale to "utc" if they contain date values.
    # This causes time data to be displayed in UTC, rather the user's local
    # time zone. (By default, vega-lite displays time data in the browser's
    # local time zone, regardless of which time zone the data specifies:
    # https://vega.github.io/vega-lite/docs/timeunit.html#output).
    x_scale = alt.Scale(type="utc") if _is_date_column(data, x_name) else alt.Undefined
    y_scale = alt.Scale(type="utc") if _is_date_column(data, y_name) else alt.Undefined

    x_type = alt.Undefined
    # Bar charts should have a discrete (ordinal) x-axis, UNLESS type is date/time
    # https://github.com/streamlit/streamlit/pull/2097#issuecomment-714802475
    if chart_type == ChartType.BAR and not _is_date_column(data, x_name):
        x_type = "ordinal"

    tooltips = [alt.Tooltip(x_name, title=x_name), alt.Tooltip(y_name, title=y_name)]
    color = None

    if color_name:
        color = alt.Color(color_name, title=color_title, type="nominal")
        tooltips.append(alt.Tooltip(color_name, title="label"))

    chart = getattr(
        # Built-in charts use the streamlit theme as default. So, we set usermeta explicitly here.
        alt.Chart(data, width=width, height=height, usermeta=STREAMLIT_THEME),
        "mark_" + chart_type.value,
    )().encode(
        x=alt.X(x_name, title=x_title, scale=x_scale, type=x_type),
        y=alt.Y(y_name, title=y_title, scale=y_scale),
        tooltip=tooltips,
    )

    if color:
        chart = chart.encode(color=color)

    if opacity:
        chart = chart.encode(opacity=opacity)

    return chart.interactive()


def marshall(
    vega_lite_chart: ArrowVegaLiteChartProto,
    altair_chart: Chart,
    use_container_width: bool = False,
    **kwargs: Any,
) -> None:
    """Marshall chart's data into proto."""
    import altair as alt

    # Normally altair_chart.to_dict() would transform the dataframe used by the
    # chart into an array of dictionaries. To avoid that, we install a
    # transformer that replaces datasets with a reference by the object id of
    # the dataframe. We then fill in the dataset manually later on.

    datasets = {}

    def id_transform(data) -> Dict[str, str]:
        """Altair data transformer that returns a fake named dataset with the
        object id."""
        datasets[id(data)] = data
        return {"name": str(id(data))}

    alt.data_transformers.register("id", id_transform)

    with alt.data_transformers.enable("id"):
        chart_dict = altair_chart.to_dict()

        # Put datasets back into the chart dict but note how they weren't
        # transformed.
        chart_dict["datasets"] = datasets

        arrow_vega_lite.marshall(
            vega_lite_chart,
            chart_dict,
            use_container_width=use_container_width,
            **kwargs,
        )
