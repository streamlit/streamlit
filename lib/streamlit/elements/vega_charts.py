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

"""Collection of chart commands that are rendered via our vega-lite chart component."""

from __future__ import annotations

import json
from contextlib import nullcontext
from typing import TYPE_CHECKING, Any, Final, Literal, Sequence, cast

import streamlit.elements.lib.dicttools as dicttools
from streamlit import type_util
from streamlit.elements.lib.built_in_chart_utils import (
    AddRowsMetadata,
    ChartType,
    generate_chart,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.ArrowVegaLiteChart_pb2 import (
    ArrowVegaLiteChart as ArrowVegaLiteChartProto,
)
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    import altair as alt

    from streamlit.color_util import Color
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.arrow import Data

# See https://vega.github.io/vega-lite/docs/encoding.html
_CHANNELS: Final = {
    "x",
    "y",
    "x2",
    "y2",
    "xError",
    "xError2",
    "yError",
    "yError2",
    "longitude",
    "latitude",
    "color",
    "opacity",
    "fillOpacity",
    "strokeOpacity",
    "strokeWidth",
    "size",
    "shape",
    "text",
    "tooltip",
    "href",
    "key",
    "order",
    "detail",
    "facet",
    "row",
    "column",
}


def _prepare_vega_lite_spec(
    spec: dict[str, Any] | None = None,
    use_container_width: bool = False,
    **kwargs,
) -> dict[str, Any]:
    # Support passing no spec arg, but filling it with kwargs.
    # Example:
    #   marshall(proto, baz='boz')
    if spec is None:
        spec = dict()

    if len(kwargs):
        # Support passing in kwargs. Example:
        #   marshall(proto, {foo: 'bar'}, baz='boz')
        # Merge spec with unflattened kwargs, where kwargs take precedence.
        # This only works for string keys, but kwarg keys are strings anyways.
        spec = dict(spec, **dicttools.unflatten(kwargs, _CHANNELS))
    else:
        # Clone the spec dict, since we may be mutating it.
        spec = dict(spec)

    if len(spec) == 0:
        raise StreamlitAPIException("Vega-Lite charts require a non-empty spec dict.")

    if "autosize" not in spec:
        # type fit does not work for many chart types. This change focuses
        # on vconcat with use_container_width=True as there are unintended
        # consequences of changing the default autosize for all charts.
        # fit-x fits the width and height can be adjusted.
        if "vconcat" in spec and use_container_width:
            spec["autosize"] = {"type": "fit-x", "contains": "padding"}
        else:
            spec["autosize"] = {"type": "fit", "contains": "padding"}

    return spec


def _serialize_data(data: Any) -> bytes:
    """Serialize the any type of data structure to Arrow IPC format (bytes)."""
    import pyarrow as pa

    if isinstance(data, pa.Table):
        return type_util.pyarrow_table_to_bytes(data)

    df = type_util.convert_anything_to_df(data)
    return type_util.data_frame_to_bytes(df)


def _marshall_chart_data(
    proto: ArrowVegaLiteChartProto,
    spec: dict[str, Any],
    data: Data = None,
) -> None:
    """Adds the data to the proto and removes it from the spec dict.
    These operations will happen in-place."""

    # Pull data out of spec dict when it's in a 'datasets' key:
    #   datasets: {foo: df1, bar: df2}, ...}
    if "datasets" in spec:
        for dataset_name, dataset_data in spec["datasets"].items():
            dataset = proto.datasets.add()
            dataset.name = str(dataset_name)
            dataset.has_name = True
            dataset.data.data = _serialize_data(dataset_data)
        del spec["datasets"]

    # Pull data out of spec dict when it's in a top-level 'data' key:
    #   {data: df}
    #   {data: {values: df, ...}}
    #   {data: {url: 'url'}}
    #   {data: {name: 'foo'}}
    if "data" in spec:
        data_spec = spec["data"]

        if isinstance(data_spec, dict):
            if "values" in data_spec:
                data = data_spec["values"]
                del spec["data"]
        else:
            data = data_spec
            del spec["data"]

    if data is not None:
        proto.data.data = _serialize_data(data)


def _convert_altair_to_vega_lite_spec(altair_chart: alt.Chart) -> dict[str, Any]:
    """Convert an Altair chart object to a Vega-Lite chart spec."""
    import altair as alt

    # Normally altair_chart.to_dict() would transform the dataframe used by the
    # chart into an array of dictionaries. To avoid that, we install a
    # transformer that replaces datasets with a reference by the object id of
    # the dataframe. We then fill in the dataset manually later on.

    datasets = {}

    def id_transform(data) -> dict[str, str]:
        """Altair data transformer that returns a fake named dataset with the
        object id.
        """
        name = str(id(data))
        datasets[name] = data
        return {"name": name}

    alt.data_transformers.register("id", id_transform)  # type: ignore[attr-defined,unused-ignore]

    # The default altair theme has some width/height defaults defined
    # which are not useful for Streamlit. Therefore, we change the theme to
    # "none" to avoid those defaults.
    with alt.themes.enable("none") if alt.themes.active == "default" else nullcontext():  # type: ignore[attr-defined,unused-ignore]
        with alt.data_transformers.enable("id"):  # type: ignore[attr-defined,unused-ignore]
            chart_dict = altair_chart.to_dict()

    # Put datasets back into the chart dict but note how they weren't
    # transformed.
    chart_dict["datasets"] = datasets
    return chart_dict


class VegaChartsMixin:
    """Mix-in class for all vega-related chart commands.

    Altair is a python wrapper on top of the vega-lite spec. And our
    built-in chart commands are just another layer on-top of Altair.
    All of these chart commands will be eventually converted to a vega-lite
    spec and rendered using the same vega-lite chart component.
    """

    @gather_metrics("line_chart")
    def line_chart(
        self,
        data: Data = None,
        *,
        x: str | None = None,
        y: str | Sequence[str] | None = None,
        color: str | Color | list[Color] | None = None,
        width: int = 0,
        height: int = 0,
        use_container_width: bool = True,
    ) -> DeltaGenerator:
        """Display a line chart.

        This is syntax-sugar around ``st.altair_chart``. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        If ``st.line_chart`` does not guess the data specification
        correctly, try specifying your desired chart using ``st.altair_chart``.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.dataframe.DataFrame, snowflake.snowpark.table.Table, Iterable, dict or None
            Data to be plotted.

        x : str or None
            Column name to use for the x-axis. If None, uses the data index for the x-axis.

        y : str, Sequence of str, or None
            Column name(s) to use for the y-axis. If a Sequence of strings,
            draws several series on the same chart by melting your wide-format
            table into a long-format table behind the scenes. If None, draws
            the data of all remaining columns as data series.

        color : str, tuple, Sequence of str, Sequence of tuple, or None
            The color to use for different lines in this chart.

            For a line chart with just one line, this can be:

            * None, to use the default color.
            * A hex string like "#ffaa00" or "#ffaa0088".
            * An RGB or RGBA tuple with the red, green, blue, and alpha
              components specified as ints from 0 to 255 or floats from 0.0 to
              1.0.

            For a line chart with multiple lines, where the dataframe is in
            long format (that is, y is None or just one column), this can be:

            * None, to use the default colors.
            * The name of a column in the dataset. Data points will be grouped
              into lines of the same color based on the value of this column.
              In addition, if the values in this column match one of the color
              formats above (hex string or color tuple), then that color will
              be used.

              For example: if the dataset has 1000 rows, but this column only
              contains the values "adult", "child", and "baby", then those 1000
              datapoints will be grouped into three lines whose colors will be
              automatically selected from the default palette.

              But, if for the same 1000-row dataset, this column contained
              the values "#ffaa00", "#f0f", "#0000ff", then then those 1000
              datapoints would still be grouped into three lines, but their
              colors would be "#ffaa00", "#f0f", "#0000ff" this time around.

            For a line chart with multiple lines, where the dataframe is in
            wide format (that is, y is a Sequence of columns), this can be:

            * None, to use the default colors.
            * A list of string colors or color tuples to be used for each of
              the lines in the chart. This list should have the same length
              as the number of y values (e.g. ``color=["#fd0", "#f0f", "#04f"]``
              for three lines).

        width : int
            The chart width in pixels. If 0, selects the width automatically.

        height : int
            The chart height in pixels. If 0, selects the height automatically.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the width argument.

        Examples
        --------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(np.random.randn(20, 3), columns=["a", "b", "c"])
        >>>
        >>> st.line_chart(chart_data)

        .. output::
           https://doc-line-chart.streamlit.app/
           height: 440px

        You can also choose different columns to use for x and y, as well as set
        the color dynamically based on a 3rd column (assuming your dataframe is in
        long format):

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(
        ...    {
        ...        "col1": np.random.randn(20),
        ...        "col2": np.random.randn(20),
        ...        "col3": np.random.choice(["A", "B", "C"], 20),
        ...    }
        ... )
        >>>
        >>> st.line_chart(chart_data, x="col1", y="col2", color="col3")

        .. output::
           https://doc-line-chart1.streamlit.app/
           height: 440px

        Finally, if your dataframe is in wide format, you can group multiple
        columns under the y argument to show multiple lines with different
        colors:

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(np.random.randn(20, 3), columns=["col1", "col2", "col3"])
        >>>
        >>> st.line_chart(
        ...    chart_data, x="col1", y=["col2", "col3"], color=["#FF0000", "#0000FF"]  # Optional
        ... )

        .. output::
           https://doc-line-chart2.streamlit.app/
           height: 440px

        """

        chart, add_rows_metadata = generate_chart(
            chart_type=ChartType.LINE,
            data=data,
            x_from_user=x,
            y_from_user=y,
            color_from_user=color,
            size_from_user=None,
            width=width,
            height=height,
        )
        return self._altair_chart(
            chart,
            use_container_width=use_container_width,
            theme="streamlit",
            add_rows_metadata=add_rows_metadata,
        )

    @gather_metrics("area_chart")
    def area_chart(
        self,
        data: Data = None,
        *,
        x: str | None = None,
        y: str | Sequence[str] | None = None,
        color: str | Color | list[Color] | None = None,
        width: int = 0,
        height: int = 0,
        use_container_width: bool = True,
    ) -> DeltaGenerator:
        """Display an area chart.

        This is syntax-sugar around ``st.altair_chart``. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        If ``st.area_chart`` does not guess the data specification
        correctly, try specifying your desired chart using ``st.altair_chart``.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.dataframe.DataFrame, snowflake.snowpark.table.Table, Iterable, or dict
            Data to be plotted.

        x : str or None
            Column name to use for the x-axis. If None, uses the data index for the x-axis.

        y : str, Sequence of str, or None
            Column name(s) to use for the y-axis. If a Sequence of strings,
            draws several series on the same chart by melting your wide-format
            table into a long-format table behind the scenes. If None, draws
            the data of all remaining columns as data series.

        color : str, tuple, Sequence of str, Sequence of tuple, or None
            The color to use for different series in this chart.

            For an area chart with just 1 series, this can be:

            * None, to use the default color.
            * A hex string like "#ffaa00" or "#ffaa0088".
            * An RGB or RGBA tuple with the red, green, blue, and alpha
              components specified as ints from 0 to 255 or floats from 0.0 to
              1.0.

            For an area chart with multiple series, where the dataframe is in
            long format (that is, y is None or just one column), this can be:

            * None, to use the default colors.
            * The name of a column in the dataset. Data points will be grouped
              into series of the same color based on the value of this column.
              In addition, if the values in this column match one of the color
              formats above (hex string or color tuple), then that color will
              be used.

              For example: if the dataset has 1000 rows, but this column only
              contains the values "adult", "child", and "baby", then those 1000
              datapoints will be grouped into three series whose colors will be
              automatically selected from the default palette.

              But, if for the same 1000-row dataset, this column contained
              the values "#ffaa00", "#f0f", "#0000ff", then then those 1000
              datapoints would still be grouped into 3 series, but their
              colors would be "#ffaa00", "#f0f", "#0000ff" this time around.

            For an area chart with multiple series, where the dataframe is in
            wide format (that is, y is a Sequence of columns), this can be:

            * None, to use the default colors.
            * A list of string colors or color tuples to be used for each of
              the series in the chart. This list should have the same length
              as the number of y values (e.g. ``color=["#fd0", "#f0f", "#04f"]``
              for three lines).

        width : int
            The chart width in pixels. If 0, selects the width automatically.

        height : int
            The chart height in pixels. If 0, selects the height automatically.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the width argument.

        Examples
        --------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(np.random.randn(20, 3), columns=["a", "b", "c"])
        >>>
        >>> st.area_chart(chart_data)

        .. output::
           https://doc-area-chart.streamlit.app/
           height: 440px

        You can also choose different columns to use for x and y, as well as set
        the color dynamically based on a 3rd column (assuming your dataframe is in
        long format):

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(
        ...    {
        ...        "col1": np.random.randn(20),
        ...        "col2": np.random.randn(20),
        ...        "col3": np.random.choice(["A", "B", "C"], 20),
        ...    }
        ... )
        >>>
        >>> st.area_chart(chart_data, x="col1", y="col2", color="col3")

        .. output::
           https://doc-area-chart1.streamlit.app/
           height: 440px

        Finally, if your dataframe is in wide format, you can group multiple
        columns under the y argument to show multiple series with different
        colors:

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(np.random.randn(20, 3), columns=["col1", "col2", "col3"])
        >>>
        >>> st.area_chart(
        ...    chart_data, x="col1", y=["col2", "col3"], color=["#FF0000", "#0000FF"]  # Optional
        ... )

        .. output::
           https://doc-area-chart2.streamlit.app/
           height: 440px

        """

        chart, add_rows_metadata = generate_chart(
            chart_type=ChartType.AREA,
            data=data,
            x_from_user=x,
            y_from_user=y,
            color_from_user=color,
            size_from_user=None,
            width=width,
            height=height,
        )
        return self._altair_chart(
            chart,
            use_container_width=use_container_width,
            theme="streamlit",
            add_rows_metadata=add_rows_metadata,
        )

    @gather_metrics("bar_chart")
    def bar_chart(
        self,
        data: Data = None,
        *,
        x: str | None = None,
        y: str | Sequence[str] | None = None,
        color: str | Color | list[Color] | None = None,
        width: int = 0,
        height: int = 0,
        use_container_width: bool = True,
    ) -> DeltaGenerator:
        """Display a bar chart.

        This is syntax-sugar around ``st.altair_chart``. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        If ``st.bar_chart`` does not guess the data specification
        correctly, try specifying your desired chart using ``st.altair_chart``.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.dataframe.DataFrame, snowflake.snowpark.table.Table, Iterable, or dict
            Data to be plotted.

        x : str or None
            Column name to use for the x-axis. If None, uses the data index for the x-axis.

        y : str, Sequence of str, or None
            Column name(s) to use for the y-axis. If a Sequence of strings,
            draws several series on the same chart by melting your wide-format
            table into a long-format table behind the scenes. If None, draws
            the data of all remaining columns as data series.

        color : str, tuple, Sequence of str, Sequence of tuple, or None
            The color to use for different series in this chart.

            For a bar chart with just one series, this can be:

            * None, to use the default color.
            * A hex string like "#ffaa00" or "#ffaa0088".
            * An RGB or RGBA tuple with the red, green, blue, and alpha
              components specified as ints from 0 to 255 or floats from 0.0 to
              1.0.

            For a bar chart with multiple series, where the dataframe is in
            long format (that is, y is None or just one column), this can be:

            * None, to use the default colors.
            * The name of a column in the dataset. Data points will be grouped
              into series of the same color based on the value of this column.
              In addition, if the values in this column match one of the color
              formats above (hex string or color tuple), then that color will
              be used.

              For example: if the dataset has 1000 rows, but this column only
              contains the values "adult", "child", and "baby", then those 1000
              datapoints will be grouped into three series whose colors will be
              automatically selected from the default palette.

              But, if for the same 1000-row dataset, this column contained
              the values "#ffaa00", "#f0f", "#0000ff", then then those 1000
              datapoints would still be grouped into 3 series, but their
              colors would be "#ffaa00", "#f0f", "#0000ff" this time around.

            For a bar chart with multiple series, where the dataframe is in
            wide format (that is, y is a Sequence of columns), this can be:

            * None, to use the default colors.
            * A list of string colors or color tuples to be used for each of
              the series in the chart. This list should have the same length
              as the number of y values (e.g. ``color=["#fd0", "#f0f", "#04f"]``
              for three lines).

        width : int
            The chart width in pixels. If 0, selects the width automatically.

        height : int
            The chart height in pixels. If 0, selects the height automatically.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the width argument.

        Examples
        --------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(np.random.randn(20, 3), columns=["a", "b", "c"])
        >>>
        >>> st.bar_chart(chart_data)

        .. output::
           https://doc-bar-chart.streamlit.app/
           height: 440px

        You can also choose different columns to use for x and y, as well as set
        the color dynamically based on a 3rd column (assuming your dataframe is in
        long format):

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(
        ...    {
        ...        "col1": list(range(20)) * 3,
        ...        "col2": np.random.randn(60),
        ...        "col3": ["A"] * 20 + ["B"] * 20 + ["C"] * 20,
        ...    }
        ... )
        >>>
        >>> st.bar_chart(chart_data, x="col1", y="col2", color="col3")

        .. output::
           https://doc-bar-chart1.streamlit.app/
           height: 440px

        Finally, if your dataframe is in wide format, you can group multiple
        columns under the y argument to show multiple series with different
        colors:

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(
        ...    {"col1": list(range(20)), "col2": np.random.randn(20), "col3": np.random.randn(20)}
        ... )
        >>>
        >>> st.bar_chart(
        ...    chart_data, x="col1", y=["col2", "col3"], color=["#FF0000", "#0000FF"]  # Optional
        ... )

        .. output::
           https://doc-bar-chart2.streamlit.app/
           height: 440px

        """

        chart, add_rows_metadata = generate_chart(
            chart_type=ChartType.BAR,
            data=data,
            x_from_user=x,
            y_from_user=y,
            color_from_user=color,
            size_from_user=None,
            width=width,
            height=height,
        )
        return self._altair_chart(
            chart,
            use_container_width=use_container_width,
            theme="streamlit",
            add_rows_metadata=add_rows_metadata,
        )

    @gather_metrics("scatter_chart")
    def scatter_chart(
        self,
        data: Data = None,
        *,
        x: str | None = None,
        y: str | Sequence[str] | None = None,
        color: str | Color | list[Color] | None = None,
        size: str | float | int | None = None,
        width: int = 0,
        height: int = 0,
        use_container_width: bool = True,
    ) -> DeltaGenerator:
        """Display a scatterplot chart.

        This is syntax-sugar around ``st.altair_chart``. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        If ``st.scatter_chart`` does not guess the data specification correctly,
        try specifying your desired chart using ``st.altair_chart``.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, pyspark.sql.DataFrame, snowflake.snowpark.dataframe.DataFrame, snowflake.snowpark.table.Table, Iterable, dict or None
            Data to be plotted.

        x : str or None
            Column name to use for the x-axis. If None, uses the data index for the x-axis.

        y : str, Sequence of str, or None
            Column name(s) to use for the y-axis. If a Sequence of strings,
            draws several series on the same chart by melting your wide-format
            table into a long-format table behind the scenes. If None, draws
            the data of all remaining columns as data series.

        color : str, tuple, Sequence of str, Sequence of tuple, or None
            The color of the circles representing each datapoint.

            This can be:

            * None, to use the default color.
            * A hex string like "#ffaa00" or "#ffaa0088".
            * An RGB or RGBA tuple with the red, green, blue, and alpha
              components specified as ints from 0 to 255 or floats from 0.0 to
              1.0.
            * The name of a column in the dataset where the color of that
              datapoint will come from.

              If the values in this column are in one of the color formats
              above (hex string or color tuple), then that color will be used.

              Otherwise, the color will be automatically picked from the
              default palette.

              For example: if the dataset has 1000 rows, but this column only
              contains the values "adult", "child", and "baby", then those 1000
              datapoints be shown using three colors from the default palette.

              But if this column only contains floats or ints, then those
              1000 datapoints will be shown using a colors from a continuous
              color gradient.

              Finally, if this column only contains the values "#ffaa00",
              "#f0f", "#0000ff", then then each of those 1000 datapoints will
              be assigned "#ffaa00", "#f0f", or "#0000ff" as appropriate.

            If the dataframe is in wide format (that is, y is a Sequence of
            columns), this can also be:

            * A list of string colors or color tuples to be used for each of
              the series in the chart. This list should have the same length
              as the number of y values (e.g. ``color=["#fd0", "#f0f", "#04f"]``
              for three series).

        size : str, float, int, or None
            The size of the circles representing each point.

            This can be:

            * A number like 100, to specify a single size to use for all
              datapoints.
            * The name of the column to use for the size. This allows each
              datapoint to be represented by a circle of a different size.

        width : int
            The chart width in pixels. If 0, selects the width automatically.

        height : int
            The chart height in pixels. If 0, selects the height automatically.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the width argument.

        Examples
        --------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(np.random.randn(20, 3), columns=["a", "b", "c"])
        >>>
        >>> st.scatter_chart(chart_data)

        .. output::
           https://doc-scatter-chart.streamlit.app/
           height: 440px

        You can also choose different columns to use for x and y, as well as set
        the color dynamically based on a 3rd column (assuming your dataframe is in
        long format):

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(np.random.randn(20, 3), columns=["col1", "col2", "col3"])
        >>> chart_data['col4'] = np.random.choice(['A','B','C'], 20)
        >>>
        >>> st.scatter_chart(
        ...     chart_data,
        ...     x='col1',
        ...     y='col2',
        ...     color='col4',
        ...     size='col3',
        ... )

        .. output::
           https://doc-scatter-chart1.streamlit.app/
           height: 440px

        Finally, if your dataframe is in wide format, you can group multiple
        columns under the y argument to show multiple series with different
        colors:

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(np.random.randn(20, 4), columns=["col1", "col2", "col3", "col4"])
        >>>
        >>> st.scatter_chart(
        ...     chart_data,
        ...     x='col1',
        ...     y=['col2', 'col3'],
        ...     size='col4',
        ...     color=['#FF0000', '#0000FF'],  # Optional
        ... )

        .. output::
           https://doc-scatter-chart2.streamlit.app/
           height: 440px

        """

        chart, add_rows_metadata = generate_chart(
            chart_type=ChartType.SCATTER,
            data=data,
            x_from_user=x,
            y_from_user=y,
            color_from_user=color,
            size_from_user=size,
            width=width,
            height=height,
        )
        return self._altair_chart(
            chart,
            use_container_width=use_container_width,
            theme="streamlit",
            add_rows_metadata=add_rows_metadata,
        )

    @gather_metrics("altair_chart")
    def altair_chart(
        self,
        altair_chart: alt.Chart,
        use_container_width: bool = False,
        theme: Literal["streamlit"] | None = "streamlit",
    ) -> DeltaGenerator:
        """Display a chart using the Altair library.

        Parameters
        ----------
        altair_chart : altair.Chart
            The Altair chart object to display.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over Altair's native ``width`` value.

        theme : "streamlit" or None
            The theme of the chart. Currently, we only support "streamlit" for the Streamlit
            defined design or None to fallback to the default behavior of the library.

        Example
        -------

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>> import altair as alt
        >>>
        >>> chart_data = pd.DataFrame(np.random.randn(20, 3), columns=["a", "b", "c"])
        >>>
        >>> c = (
        ...    alt.Chart(chart_data)
        ...    .mark_circle()
        ...    .encode(x="a", y="b", size="c", color="c", tooltip=["a", "b", "c"])
        ... )
        >>>
        >>> st.altair_chart(c, use_container_width=True)

        .. output::
           https://doc-vega-lite-chart.streamlit.app/
           height: 300px

        Examples of Altair charts can be found at
        https://altair-viz.github.io/gallery/.

        """
        return self._altair_chart(
            altair_chart, use_container_width=use_container_width, theme=theme
        )

    @gather_metrics("vega_lite_chart")
    def vega_lite_chart(
        self,
        data: Data = None,
        spec: dict[str, Any] | None = None,
        use_container_width: bool = False,
        theme: Literal["streamlit"] | None = "streamlit",
        **kwargs: Any,
    ) -> DeltaGenerator:
        """Display a chart using the Vega-Lite library.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, Iterable, dict, or None
            Either the data to be plotted or a Vega-Lite spec containing the
            data (which more closely follows the Vega-Lite API).

        spec : dict or None
            The Vega-Lite spec for the chart. If the spec was already passed in
            the previous argument, this must be set to None. See
            https://vega.github.io/vega-lite/docs/ for more info.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over Vega-Lite's native `width` value.

        theme : "streamlit" or None
            The theme of the chart. Currently, we only support "streamlit" for the Streamlit
            defined design or None to fallback to the default behavior of the library.

        **kwargs : any
            Same as spec, but as keywords.

        Example
        -------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> chart_data = pd.DataFrame(np.random.randn(200, 3), columns=["a", "b", "c"])
        >>>
        >>> st.vega_lite_chart(
        ...    chart_data,
        ...    {
        ...        "mark": {"type": "circle", "tooltip": True},
        ...        "encoding": {
        ...            "x": {"field": "a", "type": "quantitative"},
        ...            "y": {"field": "b", "type": "quantitative"},
        ...            "size": {"field": "c", "type": "quantitative"},
        ...            "color": {"field": "c", "type": "quantitative"},
        ...        },
        ...    },
        ... )

        .. output::
           https://doc-vega-lite-chart.streamlit.app/
           height: 300px

        Examples of Vega-Lite usage without Streamlit can be found at
        https://vega.github.io/vega-lite/examples/. Most of those can be easily
        translated to the syntax shown above.

        """
        return self._vega_lite_chart(
            data=data,
            spec=spec,
            use_container_width=use_container_width,
            theme=theme,
            **kwargs,
        )

    def _altair_chart(
        self,
        altair_chart: alt.Chart,
        use_container_width: bool = False,
        theme: Literal["streamlit"] | None = "streamlit",
        add_rows_metadata: AddRowsMetadata | None = None,
    ) -> DeltaGenerator:
        """Internal method to enqueue a vega-lite chart element based on an Altair chart."""
        vega_lite_spec = _convert_altair_to_vega_lite_spec(altair_chart)
        return self._vega_lite_chart(
            data=None,  # The data is already part of the spec
            spec=vega_lite_spec,
            use_container_width=use_container_width,
            theme=theme,
            add_rows_metadata=add_rows_metadata,
        )

    def _vega_lite_chart(
        self,
        data: Data = None,
        spec: dict[str, Any] | None = None,
        use_container_width: bool = False,
        theme: Literal["streamlit"] | None = "streamlit",
        add_rows_metadata: AddRowsMetadata | None = None,
        **kwargs: Any,
    ) -> DeltaGenerator:
        """Internal method to enqueue a vega-lite chart element based on a vega-lite spec."""

        if theme not in ["streamlit", None]:
            raise StreamlitAPIException(
                f'You set theme="{theme}" while Streamlit charts only support theme=”streamlit” or theme=None to fallback to the default library theme.'
            )

        # Support passing data inside spec['datasets'] and spec['data'].
        # (The data gets pulled out of the spec dict later on.)
        if isinstance(data, dict) and spec is None:
            spec = data
            data = None

        proto = ArrowVegaLiteChartProto()

        spec = _prepare_vega_lite_spec(spec, use_container_width, **kwargs)
        _marshall_chart_data(proto, spec, data)

        proto.spec = json.dumps(spec)
        proto.use_container_width = use_container_width
        proto.theme = theme or ""

        return self.dg._enqueue(
            "arrow_vega_lite_chart", proto, add_rows_metadata=add_rows_metadata
        )

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
