# Copyright 2019 Streamlit Inc. All rights reserved.

"""Streamlit support for Plotly charts."""

import json
import urllib.parse

import plotly.plotly
import plotly.tools
import plotly.utils
from six import string_types

from streamlit import caching
from streamlit import util

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)

SHARING_MODES = set([
    # This means the plot will be sent to the Streamlit report rather than to
    # Plotly.
    'streamlit',
    # The three modes below are for plots that should be hosted in Plotly.
    # These are the names Plotly uses for them.
    'private',
    'public',
    'secret',
])


def marshall(
        proto, figure_or_data, width, height, sharing, **kwargs):
    """Marshall a proto with a Plotly spec.

    See DeltaGenerator.plotly_chart for docs.
    """
    # NOTE: "figure_or_data" is the name used in Plotly's .plot() method
    # for their main parameter. I don't like the name, but its best to keep
    # it in sync with what Plotly calls it.

    if util.is_type(figure_or_data, 'matplotlib.figure.Figure'):
        figure = plotly.tools.mpl_to_plotly(figure_or_data)

    else:
        figure = plotly.tools.return_figure_from_figure_or_data(
            figure_or_data, validate_figure=True)

    if (not isinstance(sharing, string_types) or
            sharing.lower() not in SHARING_MODES):
        raise ValueError(
            'Invalid sharing mode for Plotly chart: %s' % sharing)

    proto.width = width
    proto.height = height

    if sharing == 'streamlit':
        config = dict(kwargs.get('config', {}))
        # Copy over some kwargs to config dict. Plotly does the same in plot().
        config.setdefault('showLink', kwargs.get('show_link', False))
        config.setdefault('linkText', kwargs.get('link_text', False))

        proto.figure.spec = json.dumps(
            figure, cls=plotly.utils.PlotlyJSONEncoder)
        proto.figure.config = json.dumps(config)

    else:
        url = _plot_to_url_or_load_cached_url(
            figure,
            sharing=sharing,
            auto_open=False,
            **kwargs)
        proto.url = _get_embed_url(url)


@caching.cache
def _plot_to_url_or_load_cached_url(*args, **kwargs):
    """Call plotly.plot wrapped in st.cache.

    This is so we don't unecessarily upload data to Plotly's SASS if nothing
    changed since the previous upload.
    """
    return plotly.plotly.plot(*args, **kwargs)


def _get_embed_url(url):
    parsed_url = urllib.parse.urlparse(url)

    # Plotly's embed URL is the normal URL plus ".embed".
    # (Note that our use namedtuple._replace is fine because that's not a
    # private method! It just has an underscore to avoid clashing with the
    # tuple field names)
    parsed_embed_url = parsed_url._replace(path=parsed_url.path + '.embed')

    return urllib.parse.urlunparse(parsed_embed_url)
