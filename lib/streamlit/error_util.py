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

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Final

import streamlit
from streamlit import config
from streamlit.delta_generator_singletons import get_dg_singleton_instance
from streamlit.elements import exception
from streamlit.logger import get_logger

if TYPE_CHECKING:
    from collections.abc import Callable

_LOGGER: Final = get_logger(__name__)


def _print_rich_exception(e: BaseException) -> None:
    from rich.box import Box
    from rich.panel import Panel

    # Monkey patch the panel to use our custom box style
    class ConfigurablePanel(Panel):
        def __init__(
            self,
            renderable: Any,
            box: Box | None = None,
            **kwargs: Any,
        ) -> None:
            super().__init__(
                renderable,
                box
                if box is not None
                else Box("────\n    \n────\n    \n────\n────\n    \n────\n"),
                **kwargs,
            )

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


def show_uncaught_app_exception(ex: BaseException) -> None:
    """Show the exception on the frontend."""
    main_delta_generator = get_dg_singleton_instance().main_dg
    exception._exception(main_delta_generator, ex, is_uncaught_app_exception=True)


def _log_uncaught_app_exception(ex: BaseException) -> None:
    """Log an uncaught app exception to the console.

    Uses rich traceback formatting if available and enabled, otherwise falls
    back to standard Python logging.
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
            # Catching all exceptions because we don't want to leave any possibility
            # of breaking here.
            error_logged = False

    if not error_logged:
        # Only log error to console if not already logged by rich
        _LOGGER.error("Uncaught app execution", exc_info=ex)


def handle_uncaught_app_exception(ex: BaseException) -> None:
    """Handle an exception that originated from a user app.

    By default, we show exceptions directly in the browser. However,
    if the user has disabled client error details, we display a generic
    warning in the frontend instead.

    Note: This function is kept for backward compatibility with third-party code
    that patches its __code__ attribute (e.g. streamlit-extras). Internal code
    should use handle_user_script_exception() instead.
    """
    _log_uncaught_app_exception(ex)
    show_uncaught_app_exception(ex)


def invoke_script_error_handler(
    ex: Exception,
    on_script_error: Callable[[Exception], bool | None] | None,
) -> bool:
    """Invoke the on_script_error handler if set.

    This function centralizes the logic for invoking the custom error handler,
    handling any exceptions raised by the handler itself, and determining whether
    to suppress the default UI display.

    Parameters
    ----------
    ex : Exception
        The original exception that occurred.
    on_script_error : Callable[[Exception], bool | None] | None
        The custom error handler callback, if any.

    Returns
    -------
    bool
        True if the handler suppressed the UI display, False otherwise.
    """
    # Import here to avoid circular dependency
    from streamlit.runtime.scriptrunner_utils.exceptions import (
        RerunException,
        StopException,
    )

    suppress_ui_display = False
    if on_script_error is not None:
        try:
            handler_result = on_script_error(ex)
            if handler_result is True:
                suppress_ui_display = True
        except (StopException, RerunException):
            # StopException/RerunException raised inside the handler should not
            # crash the script runner thread. These are internal control-flow signals,
            # so use warning-level logging without full traceback.
            _LOGGER.warning(
                "on_script_error handler raised a control-flow exception "
                "(st.stop/st.rerun); falling back to default error UI",
                exc_info=True,
            )
        except Exception:
            # Log any handler errors and fall back to showing the original
            # exception. We catch Exception (not BaseException) so that
            # KeyboardInterrupt/SystemExit propagate unchanged. StopException and
            # RerunException (BaseException subclasses) are caught explicitly above.
            _LOGGER.exception("on_script_error handler raised an exception")
    return suppress_ui_display


def handle_user_script_exception(
    ex: Exception,
    on_script_error: Callable[[Exception], bool | None] | None,
) -> None:
    """Handle an uncaught exception from user script code.

    This performs the standard error handling flow for exceptions that occur
    during script execution:

    1. Log the exception to the console
    2. Invoke the custom on_script_error handler if set
    3. Show the exception in the UI (unless suppressed by the handler)

    Parameters
    ----------
    ex : Exception
        The exception that occurred.
    on_script_error : Callable[[Exception], bool | None] | None
        The custom error handler callback, if any.
    """
    _log_uncaught_app_exception(ex)
    suppress_ui_display = invoke_script_error_handler(ex, on_script_error)
    if not suppress_ui_display:
        show_uncaught_app_exception(ex)
