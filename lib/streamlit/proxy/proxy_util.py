# -*- coding: future_fstrings -*-
# Copyright 2018 Streamlit Inc. All rights reserved.

"""A bunch of useful utilities for the Proxy.

These are functions that only make sense within the Proxy. In particular,
functions that use streamlit.config can go here to avoid a dependency cycle.
"""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import urllib

from streamlit import config
from streamlit import util


def url_is_from_allowed_origins(url):
    """Returns True if URL is from allowed origins (for CORS purpose).

    Allowed origins:
    1. localhost
    2. The internal and external IP addresses of the machine where this
    functions was called from.
    3. The cloud storage domain configured in `s3.bucket`.

    If `proxy.enableCORS` is False, this allows all origins.

    Parameters
    ----------
    url : str
        The URL to check

    Returns
    -------
    bool
        True if URL is accepted. False otherwise.

    """
    if not config.get_option('proxy.enableCORS'):
        # Allow everything when CORS is disabled.
        return True

    hostname = urllib.parse.urlparse(url).hostname

    # Allow connections from bucket.
    if hostname == config.get_option('s3.bucket'):
        return True

    # Allow connections from proxy's machine or localhost.
    allowed_domains = [
        'localhost',
        '127.0.0.1',
        util.get_internal_ip(),
        util.get_external_ip(),
    ]

    return any(hostname == d for d in allowed_domains)
