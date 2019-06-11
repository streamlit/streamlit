# Copyright 2018 Streamlit Inc. All rights reserved.

"""Streamlit support for GraphViz charts."""

from six import string_types

from streamlit import util
from streamlit.logger import get_logger

LOGGER = get_logger(__name__)


def marshall(proto, figure_or_dot, width, height):
    """Construct a GraphViz chart object.

    See DeltaGenerator.graphviz_chart for docs.
    """

    if util.is_graphviz_chart(figure_or_dot):
        dot = figure_or_dot.source
    elif isinstance(figure_or_dot, string_types):
        dot = figure_or_dot
    else:
        raise Exception(
            'Unhandled type for graphviz chart: %s' % type(figure_or_dot))

    proto.spec = dot
    proto.width = width
    proto.height = height
