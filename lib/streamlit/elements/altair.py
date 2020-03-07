# Copyright 2018-2020 Streamlit Inc.
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

"""A Python wrapper around Altair."""

from datetime import date

from streamlit import type_util
import streamlit.elements.vega_lite as vega_lite
import altair as alt
import pandas as pd


def _is_date_column(df, name):
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


def generate_chart(chart_type, data, width=0, height=0):
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

    if chart_type == "area":
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

    chart = (
        getattr(alt.Chart(data, width=width, height=height), "mark_" + chart_type)()
        .encode(
            alt.X(index_name, title="", scale=x_scale),
            alt.Y("value", title="", scale=y_scale),
            alt.Color("variable", title="", type="nominal"),
            alt.Tooltip([index_name, "value", "variable"]),
            opacity=opacity,
        )
        .interactive()
    )
    return chart


def marshall(vega_lite_chart, altair_chart, use_container_width=False, **kwargs):
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

        vega_lite.marshall(
            vega_lite_chart,
            chart_dict,
            use_container_width=use_container_width,
            **kwargs,
        )
