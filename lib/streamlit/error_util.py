# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from __future__ import annotations

from typing import Final

import streamlit
from streamlit import config
from streamlit.errors import UncaughtAppException
from streamlit.logger import get_logger

_LOGGER: Final = get_logger(__name__)


def _print_rich_exception(e: BaseException) -> None:
    from rich import box, panel

    # Monkey patch the panel to use our custom box style
    class ConfigurablePanel(panel.Panel):
        def __init__(
            self,
            renderable,
            box=box.Box("────\n    \n────\n    \n────\n────\n    \n────\n"),
            **kwargs,
        ):
            super().__init__(renderable, box, **kwargs)

    from rich import traceback as rich_traceback

    rich_traceback.Panel = ConfigurablePanel  # type: ignore

    # Configure console
    from rich.console import Console

    console = Console(
        color_system="256",
        force_terminal=True,
        width=88,
        no_color=False,
        tab_size=8,
    )

    # Print exception via rich
    console.print(
        rich_traceback.Traceback.from_exception(
            type(e),
            e,
            e.__traceback__,
            width=88,
            show_locals=False,
            max_frames=100,
            word_wrap=False,
            extra_lines=3,
            suppress=[streamlit],
        )
    )


def _show_exception(ex: BaseException) -> None:
    """Show the exception on the frontend."""
    streamlit.exception(ex)


def handle_uncaught_app_exception(ex: BaseException) -> None:
    """Handle an exception that originated from a user app.

    By default, we show exceptions directly in the browser. However,
    if the user has disabled client error details, we display a generic
    warning in the frontend instead.
    """

    error_logged = False

    if config.get_option("logger.enableRich"):
        try:
            # Print exception via rich
            # Rich is only a soft dependency
            # -> if not installed, we will use the default traceback formatting
            _print_rich_exception(ex)
            error_logged = True
        except Exception:
            # Rich is not installed or not compatible to our config
            # -> Use normal traceback formatting as fallback
            # Catching all exceptions because we don't want to leave any possibility of breaking here.
            error_logged = False

    if config.get_option("client.showErrorDetails"):
        if not error_logged:
            _LOGGER.warning("Uncaught app exception", exc_info=ex)
        _show_exception(ex)
    else:
        if not error_logged:
            # Use LOGGER.error, rather than LOGGER.debug, since we don't
            # show debug logs by default.
            _LOGGER.error("Uncaught app exception", exc_info=ex)
        _show_exception(UncaughtAppException(ex))
