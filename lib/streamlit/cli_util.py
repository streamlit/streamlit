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
import shlex
import shutil
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
    except ImportError:  # pragma: no cover - optional dep
        print(message, flush=True)  # noqa: T201


def style_for_cli(message: str, **kwargs: Any) -> str:
    """Style a message using click if available, else return the message
    unchanged.

    You can provide any keyword arguments that click.style supports.
    """

    try:
        import click

        return click.style(message, **kwargs)
    except ImportError:  # pragma: no cover - optional dep
        return message


def _get_logger() -> Any:
    """Return this module's logger. Load it lazily to avoid a config import cycle."""
    from streamlit.logger import get_logger

    return get_logger(__name__)


def _open_browser_with_webbrowser(url: str) -> None:
    import webbrowser

    webbrowser.open(url)


def _open_browser_with_command(command: str, url: str) -> None:
    cmd_line = [command, url]
    with open(os.devnull, "w", encoding="utf-8") as devnull:
        import subprocess  # noqa: S404

        subprocess.Popen(cmd_line, stdout=devnull, stderr=subprocess.STDOUT)  # noqa: S603


def _nonblocking_webbrowser_command(browser_command: str) -> str:
    """If the command contains ``%s``, ensure it ends with a standalone ``&``.

    ``webbrowser.get()`` uses ``BackgroundBrowser`` only when the last shlex
    token is ``&``. ``GenericBrowser`` waits for the subprocess and would
    block the server event loop. A trailing ``&`` glued to ``%s`` (``%s&``)
    is split off so the URL placeholder stays intact.
    """
    if "%s" not in browser_command:
        return browser_command
    try:
        parts = shlex.split(browser_command)
    except ValueError:
        return browser_command
    if not parts or parts[-1] == "&":
        return browser_command
    stripped = browser_command.rstrip()
    if stripped.endswith("&"):
        return f"{stripped[:-1].rstrip()} &"
    return f"{stripped} &"


def _executable_from_browser_command(browser_command: str) -> str | None:
    """Return the program token from a webbrowser command, or None if unparsable."""
    try:
        parts = shlex.split(browser_command)
    except ValueError:
        return None
    if parts and parts[-1] == "&":
        parts = parts[:-1]
    if not parts:
        return None
    return parts[0]


def _browser_command_refers_to_existing_executable(browser_command: str) -> bool:
    """Return whether ``browser.command`` points at a program we can launch.

    Bare paths are checked as a whole so paths with spaces are not split.
    Command templates use the first shlex token (the program).
    """
    if os.path.isfile(browser_command) or shutil.which(browser_command) is not None:
        return True
    if "%s" not in browser_command:
        return False
    executable = _executable_from_browser_command(browser_command)
    if executable is None:
        return False
    return os.path.isfile(executable) or shutil.which(executable) is not None


def _open_browser_with_configured_command(browser_command: str, url: str) -> bool:
    """Try to open ``url`` with ``browser.command`` via ``webbrowser.get()``.

    Return True if a controller was constructed and ``open()`` was invoked
    without raising. Return False if the command cannot be resolved, the
    executable does not exist, the controller would block the server
    (``GenericBrowser``), or ``open()`` raises ``OSError``, so the caller
    can fall back.

    Do not treat ``open()``'s boolean as success. ``BackgroundBrowser``
    returns False when the helper exits immediately (for example ``open -a``
    or a browser that is already running), which is not a launch failure.
    """
    import webbrowser

    try:
        using = _nonblocking_webbrowser_command(browser_command)
        if "%s" in using and not _browser_command_refers_to_existing_executable(using):
            return False
        controller = webbrowser.get(using)
    except (webbrowser.Error, ValueError, IndexError):
        # webbrowser.get() only resolves a bare path when its basename matches a
        # registered browser, and it splits on whitespace, so quoted paths and
        # paths with spaces fail. Retry as an explicit "%s &" command template
        # only when that path exists.
        if (
            "%s" in browser_command
            or not _browser_command_refers_to_existing_executable(browser_command)
        ):
            return False
        try:
            controller = webbrowser.get(f"{shlex.quote(browser_command)} %s &")
        except (webbrowser.Error, ValueError, IndexError):
            return False

    # GenericBrowser.open() calls Popen.wait() and would block the server.
    if isinstance(controller, webbrowser.GenericBrowser) and not isinstance(
        controller, webbrowser.BackgroundBrowser
    ):
        return False

    try:
        controller.open(url)
    except OSError:
        return False
    return True


def _open_browser_with_os_default(url: str) -> None:
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

    # Unsupported platform - should never happen in standard environments
    import platform  # pragma: no cover - unsupported platform

    raise errors.Error(f'Cannot open browser in platform "{platform.system()}"')  # ty: ignore[unresolved-attribute]  # pragma: no cover - unsupported platform


def open_browser(url: str) -> None:
    """Open a web browser pointing to a given URL.

    If ``browser.command`` is set, try that browser via ``webbrowser.get()``.
    If it is unset or opening fails, use the operating system's default handler.

    url : str
        The URL. Must include the protocol.
    """
    from streamlit import config

    browser_command = str(config.get_option("browser.command") or "").strip()
    if browser_command and _open_browser_with_configured_command(browser_command, url):
        return
    if browser_command:
        _get_logger().warning(
            "Could not open the browser configured by browser.command=%r. "
            "Falling back to the system default.",
            browser_command,
        )
    _open_browser_with_os_default(url)
