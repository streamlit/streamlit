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

import hashlib
import time
import urllib

from streamlit import config
from streamlit import util


def url_is_from_allowed_origins(url):
    """Return True if URL is from allowed origins (for CORS purpose).

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

    s3_url = config.get_option('s3.url')

    if s3_url is not None:
        parsed = urllib.parse.urlparse(s3_url)
        allowed_domains.append(parsed.hostname)

    if config.is_manually_set('browser.proxyAddress'):
        allowed_domains.append(config.get_option('browser.proxyAddress'))

    return any(hostname == d for d in allowed_domains)


# How many times to try to grab the MD5 hash.
_MAX_RETRIES = 5

# How long to wait between retries.
_RETRY_WAIT_SECS = 0.1


def calc_md5_with_blocking_retries(file_path):
    """Calculate the MD5 checksum of the given file.

    IMPORTANT: This method calls time.sleep(), which blocks execution. So you
    should only use this outside the main thread.

    Parameters
    ----------
    file_path : str
        The path of the file to check.

    Returns
    -------
    str
        The MD5 checksum.

    """
    file_bytes = None

    # There's a race condition where sometimes file_path no longer exists when
    # we try to read it (since the file is in the process of being written).
    # So here we retry a few times using this loop. See issue #186.
    for i in range(_MAX_RETRIES):
        try:
            with open(file_path, 'rb') as f:
                file_bytes = f.read()
                break
        except FileNotFoundError as e:
            if i >= _MAX_RETRIES - 1:
                raise e
            time.sleep(_RETRY_WAIT_SECS)

    md5 = hashlib.md5()
    md5.update(file_bytes)

    # Use hexdigest() instead of digest(), so it's easier to debug.
    return md5.hexdigest()
