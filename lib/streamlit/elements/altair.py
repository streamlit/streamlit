# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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

# Python 2/3 compatibility
from __future__ import absolute_import


from streamlit.elements.data_frame_proto import convert_anything_to_df
import streamlit.elements.vega_lite as vega_lite
import altair as alt
import pandas as pd


def generate_chart(chart_type, data):
    if data is None:
        # Use an empty-ish dict because if we use None the x axis labels rotate
        # 90 degrees. No idea why. Need to debug.
        data = {"": []}

    if not isinstance(data, pd.DataFrame):
        data = convert_anything_to_df(data)

    n_cols = len(data.columns)
    
    index_name = data.index.name
    if index_name is None:
       index_name = "index" 
        
    data = pd.melt(data.reset_index(), id_vars=[index_name])

    if chart_type == "area":
        opacity = {"value": 0.7}
    else:
        opacity = {"value": 1.0}

    chart = (
        getattr(alt.Chart(data), "mark_" + chart_type)()
        .encode(
            alt.X(index_name, title=""),
            alt.Y("value", title=""),
            alt.Color("variable", title="", type="nominal"),
            alt.Tooltip([index_name, "value", "variable"]),
            opacity=opacity,
        )
        .interactive()
    )
    return chart


def marshall(vega_lite_chart, altair_chart, width=0, **kwargs):
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

        vega_lite.marshall(vega_lite_chart, chart_dict, width=width, **kwargs)
