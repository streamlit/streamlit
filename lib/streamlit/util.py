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

"""A bunch of useful utilities."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims

setup_2_3_shims(globals())

import functools
import os
import subprocess

from streamlit import env_util

# URL of Streamlit's help page.
HELP_DOC = "https://streamlit.io/docs/"


def memoize(func):
    """Decorator to memoize the result of a no-args func."""
    result = []

    @functools.wraps(func)
    def wrapped_func():
        if not result:
            result.append(func())
        return result[0]

    return wrapped_func


def open_browser(url):
    """Open a web browser pointing to a given URL.

    We use this function instead of Python's `webbrowser` module because this
    way we can capture stdout/stderr to avoid polluting the terminal with the
    browser's messages. For example, Chrome always prints things like "Created
    new window in existing browser session", and those get on the user's way.

    url : str
        The URL. Must include the protocol.

    """

    if env_util.IS_WINDOWS:
        # Treat Windows separately because:
        # 1. /dev/null doesn't exist.
        # 2. subprocess.Popen(['start', url]) doesn't actually pop up the
        #    browser even though 'start url' works from the command prompt.
        # Fun!
        import webbrowser

        webbrowser.open(url)
        return

    # We don't use the webbrowser module on Linux and Mac because some browsers
    # (ahem... Chrome) always print "Opening in existing browser session" to
    # the terminal, which is spammy and annoying. So instead we start the
    # browser ourselves and send all its output to /dev/null.

    if env_util.IS_LINUX_OR_BSD:
        cmd = ["xdg-open", url]
    elif env_util.IS_DARWIN:
        cmd = ["open", url]
    else:
        raise Error('Cannot open browser in platform "%s"' % system)

    with open(os.devnull, "w") as devnull:
        subprocess.Popen(cmd, stdout=devnull, stderr=subprocess.STDOUT)


class Error(Exception):
    pass
