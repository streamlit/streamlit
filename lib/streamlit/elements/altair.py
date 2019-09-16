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


import streamlit.elements.vega_lite as vega_lite


def marshall(vega_lite_chart, altair_chart, width=0):
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

        vega_lite.marshall(vega_lite_chart, chart_dict, width=width)
