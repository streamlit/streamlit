# Copyright 2018-2022 Streamlit Inc.
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

import socket
from typing import Optional

import requests

from streamlit import util

from streamlit.logger import get_logger

LOGGER = get_logger(__name__)

# URL for checking the current machine's external IP address.
_AWS_CHECK_IP = "http://checkip.amazonaws.com"

_external_ip = None  # type: Optional[str]


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

    response = _make_blocking_http_get(_AWS_CHECK_IP, timeout=5)

    if _looks_like_an_ip_adress(response):
        _external_ip = response
    else:
        LOGGER.warning(
            # fmt: off
            "Did not auto detect external IP.\n"
            "Please go to %s for debugging hints.",
            # fmt: on
            util.HELP_DOC
        )
        _external_ip = None

    return _external_ip


_internal_ip = None  # type: Optional[str]


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
        s.connect(("8.8.8.8", 1))
        _internal_ip = s.getsockname()[0]
    except Exception:
        _internal_ip = "127.0.0.1"
    finally:
        s.close()

    return _internal_ip


def _make_blocking_http_get(url, timeout=5):
    try:
        text = requests.get(url, timeout=timeout).text
        if isinstance(text, str):
            text = text.strip()
        return text
    except Exception as e:
        return None


def _looks_like_an_ip_adress(address):
    if address is None:
        return False

    try:
        socket.inet_pton(socket.AF_INET, address)
        return True  # Yup, this is an IPv4 address!
    except (AttributeError, OSError):
        pass

    try:
        socket.inet_pton(socket.AF_INET6, address)
        return True  # Yup, this is an IPv6 address!
    except (AttributeError, OSError):
        pass

    # Nope, this is not an IP address.
    return False
