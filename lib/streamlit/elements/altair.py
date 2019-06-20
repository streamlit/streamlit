# Copyright 2019 Streamlit Inc. All rights reserved.

"""A Python wrapper around Altair."""

# Python 2/3 compatibility
from __future__ import absolute_import


import streamlit.elements.vega_lite as vega_lite


def marshall(vega_lite_chart, altair_chart):
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
        return {
            'name': str(id(data))
        }

    alt.data_transformers.register('id', id_transform)

    with alt.data_transformers.enable('id'):
        chart_dict = altair_chart.to_dict()

        # Put datasets back into the chart dict but note how they weren't
        # transformed.
        chart_dict['datasets'] = datasets

        vega_lite.marshall(vega_lite_chart, chart_dict)
