# Copyright 2018 Streamlit Inc. All rights reserved.

"""A Python wrapper around Bokeh."""

from bokeh.embed import json_item
import json


def marshall(proto, figure):
    """Construct a Bokeh chart object.

    See DeltaGenerator.bokeh_chart for docs.
    """
    data = json_item(figure)
    proto.figure = json.dumps(data)
