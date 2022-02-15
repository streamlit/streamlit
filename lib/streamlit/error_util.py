# Copyright 2018-2021 Streamlit Inc.
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

import os
import traceback

import streamlit as st
from streamlit import config
from streamlit.logger import get_logger
from streamlit.errors import UncaughtAppException

LOGGER = get_logger(__name__)


# Extract the streamlit package path
_streamlit_dir = os.path.dirname(st.__file__)

# Make it absolute, resolve aliases, and ensure there's a trailing path
# separator
_streamlit_dir = os.path.join(os.path.realpath(_streamlit_dir), "")

# When client.showErrorDetails is False, we show a generic warning in the
# frontend when we encounter an uncaught app exception.
_GENERIC_UNCAUGHT_EXCEPTION_TEXT = "This app has encountered an error. The original error message is redacted to prevent data leaks.  Full error details have been recorded in the logs (if you're on Streamlit Cloud, click on 'Manage app' in the lower right of your app)."


def _print_rich_exception(e: BaseException):
    from rich import panel, box  # type: ignore

    # Monkey patch the panel to use our custom box style
    class ConfigurablePanel(panel.Panel):
        def __init__(
            self,
            renderable,
            box=box.Box("────\n    \n────\n    \n────\n────\n    \n────\n"),
            **kwargs,
        ):
            super(ConfigurablePanel, self).__init__(renderable, box, **kwargs)

    from rich import traceback as rich_traceback  # type: ignore

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

    from streamlit import script_runner

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
            suppress=[script_runner],  # Ignore script runner
        )
    )


def handle_uncaught_app_exception(e: BaseException) -> None:
    """Handle an exception that originated from a user app.
    By default, we show exceptions directly in the browser. However,
    if the user has disabled client error details, we display a generic
    warning in the frontend instead.
    """

    errorLogged = False

    if config.get_option("logger.enableRich"):
        try:
            # Print exception via rich
            # Rich is only a soft dependency
            # -> if not installed, we will use the default traceback formatting
            _print_rich_exception(e)
            errorLogged = True
        except Exception:
            # Rich is not installed or not compatible to our config -> this is fine
            # Use normal traceback formatting as fallback
            errorLogged = False

    if config.get_option("client.showErrorDetails"):
        if not errorLogged:
            # TODO: Clean up the stack trace, so it doesn't include ScriptRunner.
            LOGGER.warning("Uncaught app exception", exc_info=e)
        st.exception(e)
    else:
        if not errorLogged:
            # Use LOGGER.error, rather than LOGGER.debug, since we don't
            # show debug logs by default.
            LOGGER.error("Uncaught app exception", exc_info=e)
        st.exception(UncaughtAppException(e))


def _is_in_streamlit_package(file):
    """True if the given file is part of the streamlit package."""
    try:
        common_prefix = os.path.commonprefix([os.path.realpath(file), _streamlit_dir])
    except ValueError:
        # Raised if paths are on different drives.
        return False

    return common_prefix == _streamlit_dir


def get_nonstreamlit_traceback(extracted_tb):
    return [
        entry for entry in extracted_tb if not _is_in_streamlit_package(entry.filename)
    ]
