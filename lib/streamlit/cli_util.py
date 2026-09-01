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
    """Return this module's logger.

    Load it lazily: ``get_logger()`` calls ``setup_formatter()``, which imports
    ``streamlit.config``. This module is imported by ``config_util`` during
    config load (``config`` → ``config_util`` → ``cli_util``), so a module-level
    ``_LOGGER = get_logger(__name__)`` would cycle.
    """
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
    """Keep ``%s`` command templates from blocking the server.

    ``webbrowser.get()`` uses ``GenericBrowser``, which waits for the
    subprocess, unless the command ends with a standalone ``&``. A trailing
    ``&`` glued to ``%s`` (``%s&``) is split off so the URL placeholder stays
    intact.
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

    Uses ``shutil.which`` so a non-executable regular file is not treated as
    a valid browser. Bare paths are checked as a whole so paths with spaces
    are not split. Command templates use the first shlex token (the program).
    """
    if shutil.which(browser_command) is not None:
        return True
    if "%s" not in browser_command:
        return False
    executable = _executable_from_browser_command(browser_command)
    if executable is None:
        return False
    return shutil.which(executable) is not None


def _open_browser_with_configured_command(browser_command: str, url: str) -> bool:
    """Launch ``url`` with ``browser.command`` without blocking forever.

    Ignore a falsey ``open()`` only for ``BackgroundBrowser`` (the helper
    often exits after a successful launch). Other controllers treat False as
    a failed launch. Return False so the caller can fall back if the command
    cannot be resolved, the executable does not exist, the controller is a
    blocking ``GenericBrowser``, ``open()`` raises ``OSError``, or a
    non-background ``open()`` returns False.

    Named GUI controllers (``UnixBrowser``, ``MacOSXOSAScript``) may
    ``wait()`` for a few seconds. Callers on the asyncio loop must run this
    function off the loop.
    """
    import webbrowser

    try:
        webbrowser_spec = _nonblocking_webbrowser_command(browser_command)
        if (
            "%s" in webbrowser_spec
            and not _browser_command_refers_to_existing_executable(webbrowser_spec)
        ):
            return False
        controller = webbrowser.get(webbrowser_spec)
    except (webbrowser.Error, ValueError, IndexError):
        # webbrowser.get() does not take a raw path when:
        # - the basename is not a registered browser, or
        # - the path contains spaces (it splits on whitespace).
        # Retry as a quoted "%s &" template only when that path exists.
        if (
            "%s" in browser_command
            or not _browser_command_refers_to_existing_executable(browser_command)
        ):
            return False
        try:
            controller = webbrowser.get(f"{shlex.quote(browser_command)} %s &")
        except (webbrowser.Error, ValueError, IndexError):
            return False

    # GenericBrowser.open() calls Popen.wait() until the process exits
    # (console browsers such as lynx). Do not use those. UnixBrowser and
    # MacOSXOSAScript are not GenericBrowser subclasses; they may still
    # wait briefly and must be invoked off the asyncio loop.
    if isinstance(controller, webbrowser.GenericBrowser) and not isinstance(
        controller, webbrowser.BackgroundBrowser
    ):
        return False

    try:
        opened = controller.open(url)
    except OSError:
        return False
    return bool(opened) or isinstance(controller, webbrowser.BackgroundBrowser)


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

    browser_command = config.get_option("browser.command").strip()
    if browser_command and _open_browser_with_configured_command(browser_command, url):
        return
    if browser_command:
        _get_logger().warning(
            "Could not open the browser configured by browser.command=%r. "
            "Falling back to the system default.",
            browser_command,
        )
    _open_browser_with_os_default(url)
