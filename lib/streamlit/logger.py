# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

"""Logging module.

This module provides logging utilities for Streamlit. It follows Python's
logging best practices by configuring handlers only on the root "streamlit"
logger, allowing child loggers to propagate messages up to the root.

This design enables users to configure Streamlit's logging using standard
Python logging methods:

    import logging
    logging.getLogger("streamlit").setLevel(logging.DEBUG)
    logging.getLogger("streamlit").addHandler(my_custom_handler)

For more information, see: https://github.com/streamlit/streamlit/issues/4742
"""

from __future__ import annotations

import logging
import sys
from typing import Final, cast

DEFAULT_LOG_MESSAGE: Final = "%(asctime)s %(levelname) -7s %(name)s: %(message)s"

# Loggers registered through get_logger() are tracked here.
# This is used by set_log_level() and update_formatter() to update all loggers.
_loggers: dict[str, logging.Logger] = {}

# The global log level is set here across all names.
_global_log_level = logging.INFO


def _get_root_logger() -> logging.Logger:
    """Return the Streamlit root logger."""
    return logging.getLogger("streamlit")


def _setup_root_handler(root_logger: logging.Logger) -> None:
    """Set up the console handler for the root streamlit logger.

    This configures the handler and formatter on the root logger. Child loggers
    under the "streamlit.*" namespace will propagate their messages to this
    handler.
    """
    # Deregister any previous console handler.
    if hasattr(root_logger, "streamlit_console_handler"):
        root_logger.removeHandler(
            cast("logging.Handler", root_logger.streamlit_console_handler)
        )

    root_logger.streamlit_console_handler = logging.StreamHandler()  # type: ignore[attr-defined]

    # Import here to avoid circular imports
    from streamlit import config

    if config._config_options:
        # logger is required in ConfigOption.set_value
        # Getting the config option before the config file has been parsed
        # can create an infinite loop
        message_format = config.get_option("logger.messageFormat")
    else:
        message_format = DEFAULT_LOG_MESSAGE
    formatter = logging.Formatter(fmt=message_format)
    formatter.default_msec_format = "%s.%03d"
    root_logger.streamlit_console_handler.setFormatter(formatter)  # type: ignore[attr-defined]

    # Register the new console handler.
    root_logger.addHandler(root_logger.streamlit_console_handler)  # type: ignore[attr-defined]


def _ensure_root_logger_configured() -> None:
    """Ensure the streamlit root logger is configured with a handler.

    This is called automatically when any streamlit.* logger is requested
    to ensure log messages are properly handled even before config is parsed.
    """
    root_logger = _get_root_logger()
    if not hasattr(root_logger, "streamlit_console_handler"):
        root_logger.setLevel(_global_log_level)
        # Don't propagate to the global root logger to avoid duplicate messages
        root_logger.propagate = False
        _setup_root_handler(root_logger)
        _loggers["streamlit"] = root_logger


def setup_formatter(logger: logging.Logger) -> None:
    """Set up the console formatter for a given logger.

    This is primarily used for external loggers (like tornado.*) that need
    their own handlers. For streamlit.* loggers, use _setup_root_handler()
    on the root logger instead.
    """
    # Deregister any previous console loggers.
    if hasattr(logger, "streamlit_console_handler"):
        logger.removeHandler(cast("logging.Handler", logger.streamlit_console_handler))

    logger.streamlit_console_handler = logging.StreamHandler()  # type: ignore[attr-defined]

    # Import here to avoid circular imports
    from streamlit import config

    if config._config_options:
        # logger is required in ConfigOption.set_value
        # Getting the config option before the config file has been parsed
        # can create an infinite loop
        message_format = config.get_option("logger.messageFormat")
    else:
        message_format = DEFAULT_LOG_MESSAGE
    formatter = logging.Formatter(fmt=message_format)
    formatter.default_msec_format = "%s.%03d"
    logger.streamlit_console_handler.setFormatter(formatter)  # type: ignore[attr-defined]

    # Register the new console logger.
    logger.addHandler(logger.streamlit_console_handler)  # type: ignore[attr-defined]


def set_log_level(level: str | int) -> None:
    """Set log level for all Streamlit loggers.

    Parameters
    ----------
    level : str | int
        The log level to set. Can be a string ("DEBUG", "INFO", "WARNING",
        "ERROR", "CRITICAL") or a logging constant (logging.DEBUG, etc.).
    """
    if isinstance(level, str):
        level = level.upper()
    if level in {"CRITICAL", logging.CRITICAL}:
        log_level = logging.CRITICAL
    elif level in {"ERROR", logging.ERROR}:
        log_level = logging.ERROR
    elif level in {"WARNING", logging.WARNING}:
        log_level = logging.WARNING
    elif level in {"INFO", logging.INFO}:
        log_level = logging.INFO
    elif level in {"DEBUG", logging.DEBUG}:
        log_level = logging.DEBUG
    else:
        # Use root logger for error message to ensure it's displayed
        root = _get_root_logger()
        msg = f'undefined log level "{level}"'
        root.critical(msg)
        sys.exit(1)

    # Update level on all registered loggers
    for log in _loggers.values():
        log.setLevel(log_level)

    # Also ensure root logger level is updated
    _get_root_logger().setLevel(log_level)

    global _global_log_level  # noqa: PLW0603
    _global_log_level = log_level


def update_formatter() -> None:
    """Update the formatter on all registered loggers.

    This is called when the logger.messageFormat config option changes.
    """
    # Update the root streamlit logger's handler
    root_logger = _get_root_logger()
    if hasattr(root_logger, "streamlit_console_handler"):
        _setup_root_handler(root_logger)

    # Update external loggers (like tornado.*) that have their own handlers
    for name, log in _loggers.items():
        # Skip streamlit.* loggers - they use root's handler via propagation
        if name == "streamlit" or name.startswith("streamlit."):
            continue
        # External loggers have their own handlers
        if hasattr(log, "streamlit_console_handler"):
            setup_formatter(log)


def init_tornado_logs() -> None:
    """Set Tornado log levels.

    This function does not import any Tornado code, so it's safe to call even
    when Server is not running.
    """
    # http://www.tornadoweb.org/en/stable/log.html
    for log in ("access", "application", "general"):
        # get_logger will set the log level for the logger with the given name.
        get_logger(f"tornado.{log}")


def get_logger(name: str) -> logging.Logger:
    """Return a logger.

    For streamlit.* loggers, this returns a logger that propagates messages
    to the root "streamlit" logger, which has the actual handler configured.
    This follows Python's logging best practices and allows users to configure
    Streamlit's logging using standard methods.

    For external loggers (like tornado.*), a handler is configured directly
    on the logger for backward compatibility.

    Parameters
    ----------
    name : str
        The name of the logger to use. You should just pass in __name__.

    Returns
    -------
    Logger

    """
    if name in _loggers:
        return _loggers[name]

    # Handle special "root" name that maps to "streamlit"
    if name == "root":
        name = "streamlit"

    logger = logging.getLogger(name)

    # Check if this is a streamlit logger (root or child)
    is_streamlit_logger = name == "streamlit" or name.startswith("streamlit.")

    if is_streamlit_logger:
        # Ensure the root logger is configured with a handler first.
        # Child loggers will propagate messages to this handler.
        _ensure_root_logger_configured()

        if name == "streamlit":
            # Root logger is already configured by _ensure_root_logger_configured()
            pass
        else:
            # Child streamlit.* loggers: set level, use default propagate=True
            # Messages will bubble up to the root logger's handler
            logger.setLevel(_global_log_level)
    else:
        # External loggers (like tornado.*): keep old behavior for compatibility.
        # These loggers need their own handlers since they're not under
        # the streamlit.* namespace and won't propagate to streamlit root.
        logger.setLevel(_global_log_level)
        logger.propagate = False
        setup_formatter(logger)

    _loggers[name] = logger
    return logger
