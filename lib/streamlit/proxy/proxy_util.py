# -*- coding: future_fstrings -*-
# Copyright 2018 Streamlit Inc. All rights reserved.

"""A bunch of useful utilities for the Proxy."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

# flake8: noqa
import socket
import urllib

try:
    import urllib.request  # for Python3
except ImportError:
    pass

from streamlit import config
from streamlit import util


# URL for checking the current machine's external IP address.
_AWS_CHECK_IP = 'http://checkip.amazonaws.com'


_external_ip = None


def get_external_ip():
    """Get the *external* IP address of the current machine.

    Returns
    -------
    string
        The external IPv4 address of the current machine.

    """
    global _external_ip

    if _external_ip is not None:
        return _external_ip

    try:
        response = urllib.request.urlopen(_AWS_CHECK_IP, timeout=5).read()
        _external_ip = response.decode('utf-8').strip()
    except RuntimeError as e:
        LOGGER.error(f'Error connecting to {_AWS_CHECK_IP}: {e}')
        print('Did not auto detect external IP. Please go to '
              f'{util.HELP_DOC} for debugging hints.')

    return _external_ip


_internal_ip = None


def get_internal_ip():
    """Get the *local* IP address of the current machine.

    From: https://stackoverflow.com/a/28950776

    Returns
    -------
    string
        The local IPv4 address of the current machine.

    """
    global _internal_ip

    if _internal_ip is not None:
        return _internal_ip

    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Doesn't even have to be reachable
        s.connect(('8.8.8.8', 1))
        _internal_ip = s.getsockname()[0]
    except Exception:
        _internal_ip = '127.0.0.1'
    finally:
        s.close()

    return _internal_ip


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
    if hostname.endswith(config.get_option('s3.bucket')):
        return True

    # Allow connections from proxy's machine or localhost.
    allowed_domains = [
        'localhost',
        get_internal_ip(),
        get_external_ip(),
    ]

    return any(hostname == d for d in allowed_domains)
