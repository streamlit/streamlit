# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""A bunch of useful utilities."""

import functools
import hashlib
import os
import subprocess
from typing import Any, Dict, Iterable, Mapping, TypeVar

from typing_extensions import Final

from streamlit import env_util

# URL of Streamlit's help page.
HELP_DOC: Final = "https://docs.streamlit.io/"
FLOAT_EQUALITY_EPSILON: Final[float] = 0.000000000005


def memoize(func):
    """Decorator to memoize the result of a no-args func."""
    result: List[Any] = []

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

    # Treat Windows separately because:
    # 1. /dev/null doesn't exist.
    # 2. subprocess.Popen(['start', url]) doesn't actually pop up the
    #    browser even though 'start url' works from the command prompt.
    # Fun!
    # Also, use webbrowser if we are on Linux and xdg-open is not installed.
    #
    # We don't use the webbrowser module on Linux and Mac because some browsers
    # (ahem... Chrome) always print "Opening in existing browser session" to
    # the terminal, which is spammy and annoying. So instead we start the
    # browser ourselves and send all its output to /dev/null.

    if env_util.IS_WINDOWS:
        _open_browser_with_webbrowser(url)
        return
    if env_util.IS_LINUX_OR_BSD:
        if env_util.is_executable_in_path("xdg-open"):
            _open_browser_with_command("xdg-open", url)
            return
        _open_browser_with_webbrowser(url)
        return
    if env_util.IS_DARWIN:
        _open_browser_with_command("open", url)
        return

    import platform

    raise Error('Cannot open browser in platform "%s"' % platform.system())


def _open_browser_with_webbrowser(url):
    import webbrowser

    webbrowser.open(url)


def _open_browser_with_command(command, url):
    cmd_line = [command, url]
    with open(os.devnull, "w") as devnull:
        subprocess.Popen(cmd_line, stdout=devnull, stderr=subprocess.STDOUT)


def _maybe_tuple_to_list(item: Any) -> Any:
    """Convert a tuple to a list. Leave as is if it's not a tuple."""
    if isinstance(item, tuple):
        return list(item)
    return item


def repr_(cls) -> str:
    classname = cls.__class__.__name__
    args = ", ".join([f"{k}={repr(v)}" for (k, v) in cls.__dict__.items()])
    return f"{classname}({args})"


_Value = TypeVar("_Value")


def index_(iterable: Iterable[_Value], x: _Value) -> int:
    """Return zero-based index of the first item whose value is equal to x.
    Raises a ValueError if there is no such item.

    We need a custom implementation instead of the built-in list .index() to
    be compatible with NumPy array and Pandas Series.

    Parameters
    ----------
    iterable : list, tuple, numpy.ndarray, pandas.Series
    x : Any

    Returns
    -------
    int
    """

    for i, value in enumerate(iterable):
        if x == value:
            return i
        elif isinstance(value, float) and isinstance(x, float):
            if abs(x - value) < FLOAT_EQUALITY_EPSILON:
                return i
    raise ValueError("{} is not in iterable".format(str(x)))


_Key = TypeVar("_Key", bound=str)


def lower_clean_dict_keys(dict: Mapping[_Key, _Value]) -> Dict[str, _Value]:
    return {k.lower().strip(): v for k, v in dict.items()}


# TODO: Move this into errors.py? Replace with StreamlitAPIException?
class Error(Exception):
    pass


def calc_md5(s: str) -> str:
    """Return the md5 hash of the given string."""
    h = hashlib.new("md5")
    h.update(s.encode("utf-8"))
    return h.hexdigest()
