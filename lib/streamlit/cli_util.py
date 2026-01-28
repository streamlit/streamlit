# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

"""Utilities related to the CLI."""

from __future__ import annotations

import os
from typing import Any

from streamlit import env_util, errors


def print_to_cli(message: str, **kwargs: Any) -> None:
    """Print a message to the terminal using click if available, else print
    using the built-in print function.

    You can provide any keyword arguments that click.secho supports.
    """
    try:
        import click

        click.secho(message, **kwargs)
    except ImportError:
        print(message, flush=True)  # noqa: T201


def style_for_cli(message: str, **kwargs: Any) -> str:
    """Style a message using click if available, else return the message
    unchanged.

    You can provide any keyword arguments that click.style supports.
    """

    try:
        import click

        return click.style(message, **kwargs)
    except ImportError:
        return message


def _open_browser_with_webbrowser(url: str) -> None:
    import webbrowser

    webbrowser.open(url)


def _open_browser_with_command(command: str, url: str) -> None:
    cmd_line = [command, url]
    with open(os.devnull, "w", encoding="utf-8") as devnull:
        import subprocess  # noqa: S404

        subprocess.Popen(cmd_line, stdout=devnull, stderr=subprocess.STDOUT)  # noqa: S603


def open_browser(url: str) -> None:
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

    raise errors.Error(f'Cannot open browser in platform "{platform.system()}"')  # ty: ignore[unresolved-attribute]
