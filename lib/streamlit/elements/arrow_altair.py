# Copyright 2018-2021 Streamlit Inc.
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
from typing import cast

import altair as alt
import pandas as pd
from altair.vegalite.v4.api import Chart

import streamlit
import streamlit.elements.arrow_vega_lite as arrow_vega_lite
from streamlit import type_util
from streamlit.proto.ArrowVegaLiteChart_pb2 import (
    ArrowVegaLiteChart as ArrowVegaLiteChartProto,
)

from .arrow import Data
from .utils import last_index_for_melted_dataframes


class ChartType(Enum):
    AREA = "area"
    BAR = "bar"
    LINE = "line"


class ArrowAltairMixin:
    def arrow_line_chart(
        self,
        data: Data = None,
        width: int = 0,
        height: int = 0,
        use_container_width: bool = True,
    ) -> "streamlit.delta_generator.DeltaGenerator":
        """Display a line chart.

        This is syntax-sugar around st._arrow_altair_chart. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        If st._arrow_line_chart does not guess the data specification
        correctly, try specifying your desired chart using st._arrow_altair_chart.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, numpy.ndarray, Iterable, dict or None
            Data to be plotted.

        width : int
            The chart width in pixels. If 0, selects the width automatically.

        height : int
            The chart height in pixels. If 0, selects the height automatically.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the width argument.

        Example
        -------
        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(20, 3),
        ...     columns=['a', 'b', 'c'])
        ...
        >>> st._arrow_line_chart(chart_data)

        """
        proto = ArrowVegaLiteChartProto()
        chart = _generate_chart(ChartType.LINE, data, width, height)
        marshall(proto, chart, use_container_width)
        last_index = last_index_for_melted_dataframes(data)

        return cast(
            "streamlit.delta_generator.DeltaGenerator",
            self.dg._enqueue("arrow_line_chart", proto, last_index=last_index),
        )

    def arrow_area_chart(
        self,
        data: Data = None,
        width: int = 0,
        height: int = 0,
        use_container_width: bool = True,
    ) -> "streamlit.delta_generator.DeltaGenerator":
        """Display an area chart.

        This is just syntax-sugar around st._arrow_altair_chart. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        If st._arrow_area_chart does not guess the data specification
        correctly, try specifying your desired chart using st._arrow_altair_chart.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, numpy.ndarray, Iterable, or dict
            Data to be plotted.

        width : int
            The chart width in pixels. If 0, selects the width automatically.

        height : int
            The chart height in pixels. If 0, selects the height automatically.

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

        """
        proto = ArrowVegaLiteChartProto()
        chart = _generate_chart(ChartType.AREA, data, width, height)
        marshall(proto, chart, use_container_width)
        last_index = last_index_for_melted_dataframes(data)

        return cast(
            "streamlit.delta_generator.DeltaGenerator",
            self.dg._enqueue("arrow_area_chart", proto, last_index=last_index),
        )

    def arrow_bar_chart(
        self,
        data: Data = None,
        width: int = 0,
        height: int = 0,
        use_container_width: bool = True,
    ) -> "streamlit.delta_generator.DeltaGenerator":
        """Display a bar chart.

        This is just syntax-sugar around st._arrow_altair_chart. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        If st._arrow_bar_chart does not guess the data specification
        correctly, try specifying your desired chart using st._arrow_altair_chart.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, numpy.ndarray, Iterable, or dict
            Data to be plotted.

        width : int
            The chart width in pixels. If 0, selects the width automatically.

        height : int
            The chart height in pixels. If 0, selects the height automatically.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the width argument.

        Example
        -------
        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(50, 3),
        ...     columns=["a", "b", "c"])
        ...
        >>> st._arrow_bar_chart(chart_data)

        """
        proto = ArrowVegaLiteChartProto()
        chart = _generate_chart(ChartType.BAR, data, width, height)
        marshall(proto, chart, use_container_width)
        last_index = last_index_for_melted_dataframes(data)

        return cast(
            "streamlit.delta_generator.DeltaGenerator",
            self.dg._enqueue("arrow_bar_chart", proto, last_index=last_index),
        )

    def arrow_altair_chart(
        self, altair_chart: Chart, use_container_width: bool = False
    ) -> "streamlit.delta_generator.DeltaGenerator":
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

        Examples of Altair charts can be found at
        https://altair-viz.github.io/gallery/.

        """
        proto = ArrowVegaLiteChartProto()
        marshall(
            proto,
            altair_chart,
            use_container_width=use_container_width,
        )

        return cast(
            "streamlit.delta_generator.DeltaGenerator",
            self.dg._enqueue("arrow_vega_lite_chart", proto),
        )

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)


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


def _generate_chart(
    chart_type: ChartType, data: Data, width: int = 0, height: int = 0
) -> Chart:
    """This function uses the chart's type, data columns and indices to figure out the chart's spec."""
    if data is None:
        # Use an empty-ish dict because if we use None the x axis labels rotate
        # 90 degrees. No idea why. Need to debug.
        data = {"": []}

    if not isinstance(data, pd.DataFrame):
        data = type_util.convert_anything_to_df(data)

    index_name = data.index.name
    if index_name is None:
        index_name = "index"

    data = pd.melt(data.reset_index(), id_vars=[index_name])

    if chart_type == ChartType.AREA:
        opacity = {"value": 0.7}
    else:
        opacity = {"value": 1.0}

    # Set the X and Y axes' scale to "utc" if they contain date values.
    # This causes time data to be displayed in UTC, rather the user's local
    # time zone. (By default, vega-lite displays time data in the browser's
    # local time zone, regardless of which time zone the data specifies:
    # https://vega.github.io/vega-lite/docs/timeunit.html#output).
    x_scale = (
        alt.Scale(type="utc") if _is_date_column(data, index_name) else alt.Undefined
    )
    y_scale = alt.Scale(type="utc") if _is_date_column(data, "value") else alt.Undefined

    x_type = alt.Undefined
    # Bar charts should have a discrete (ordinal) x-axis, UNLESS type is date/time
    # https://github.com/streamlit/streamlit/pull/2097#issuecomment-714802475
    if chart_type == ChartType.BAR and not _is_date_column(data, index_name):
        x_type = "ordinal"

    chart = (
        getattr(
            alt.Chart(data, width=width, height=height), "mark_" + chart_type.value
        )()
        .encode(
            alt.X(index_name, title="", scale=x_scale, type=x_type),
            alt.Y("value", title="", scale=y_scale),
            alt.Color("variable", title="", type="nominal"),
            alt.Tooltip([index_name, "value", "variable"]),
            opacity=opacity,
        )
        .interactive()
    )
    return chart


def marshall(
    vega_lite_chart: ArrowVegaLiteChartProto,
    altair_chart: Chart,
    use_container_width: bool = False,
    **kwargs,
):
    """Marshall chart's data into proto."""
    import altair as alt

    # Normally altair_chart.to_dict() would transform the dataframe used by the
    # chart into an array of dictionaries. To avoid that, we install a
    # transformer that replaces datasets with a reference by the object id of
    # the dataframe. We then fill in the dataset manually later on.

    datasets = {}

    def id_transform(data):
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
