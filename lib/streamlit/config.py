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

"""Loads the configuration data."""

from __future__ import annotations

import copy
import json
import logging
import os
import secrets
import threading
from collections import OrderedDict
from enum import Enum
from typing import Any, Callable, Final, Literal

from blinker import Signal

from streamlit import config_util, development, env_util, file_util, util
from streamlit.config_option import ConfigOption
from streamlit.errors import StreamlitAPIException

# Config System Global State #

# Descriptions of each of the possible config sections.
# (We use OrderedDict to make the order in which sections are declared in this
# file be the same order as the sections appear with `streamlit config show`)
_section_descriptions: OrderedDict[str, str] = OrderedDict(  # ty: ignore
    _test="Special test section just used for unit tests."  # ty: ignore
)

# Ensures that we don't try to get or set config options when config.toml files
# change so are re-parsed.
_config_lock = threading.RLock()

# Stores config options with their default values (or None if they don't have
# a default) before they are updated with values from config.toml files, flags
# to `streamlit run`, etc. Note that this and _config_options below are
# OrderedDicts to ensure stable ordering when printed using
# `streamlit config show`.
_config_options_template: dict[str, ConfigOption] = OrderedDict()

# Stores the current state of config options.
_config_options: dict[str, ConfigOption] | None = None

# Stores the path to the main script. This is used to
# resolve config and secret files relative to the main script:
_main_script_path: str | None = None

# Indicates that a config option was defined by the user.
_USER_DEFINED: Final = "<user defined>"

# Indicates that a config option was defined either in an environment variable
# or via command-line flag.
_DEFINED_BY_FLAG: Final = "command-line argument or environment variable"

# Indicates that a config option was defined in an environment variable
_DEFINED_BY_ENV_VAR: Final = "environment variable"

_LOGGER: Final = logging.getLogger(__name__)


class ShowErrorDetailsConfigOptions(str, Enum):
    """Valid options for the "client.showErrorDetails" config."""

    FULL = "full"
    STACKTRACE = "stacktrace"
    TYPE = "type"
    NONE = "none"

    @staticmethod
    def is_true_variation(val: str | bool) -> bool:
        return val in ["true", "True", True]

    @staticmethod
    def is_false_variation(val: str | bool) -> bool:
        return val in ["false", "False", False]

        # Config options can be set from several places including the command-line and
        # the user's script. Legacy config options (true/false) will have type string
        # when set via command-line and bool when set via user script
        # (e.g. st.set_option("client.showErrorDetails", False)).


class CustomThemeCategories(str, Enum):
    """Theme categories that can be set with custom theme config."""

    SIDEBAR = "sidebar"


def set_option(key: str, value: Any, where_defined: str = _USER_DEFINED) -> None:
    """Set config option.

    Run `streamlit config show` in the terminal to see all available options.

    This is an internal API. The public `st.set_option` API is implemented
    in `set_user_option`.

    Parameters
    ----------
    key : str
        The config option key of the form "section.optionName". To see all
        available options, run `streamlit config show` on a terminal.

    value
        The new value to assign to this config option.

    where_defined : str
        Tells the config system where this was set.
    """
    with _config_lock:
        # Ensure that our config files have been parsed.
        get_config_options()
        _set_option(key, value, where_defined)


def set_user_option(key: str, value: Any) -> None:
    """Set a configuration option.

    Currently, only ``client`` configuration options can be set within the
    script itself:

        - ``client.showErrorDetails``
        - ``client.showSidebarNavigation``
        - ``client.toolbarMode``

    Calling ``st.set_option`` with any other option will raise a
    ``StreamlitAPIException``. When changing a configuration option in a
    running app, you may need to trigger a rerun after changing the option to
    see the effects.

    Run ``streamlit config show`` in a terminal to see all available options.

    Parameters
    ----------
    key : str
        The config option key of the form "section.optionName". To see all
        available options, run ``streamlit config show`` in a terminal.

    value
        The new value to assign to this config option.

    Example
    -------

    >>> import streamlit as st
    >>>
    >>> st.set_option("client.showErrorDetails", True)

    """
    try:
        opt = _config_options_template[key]
    except KeyError as ke:
        raise StreamlitAPIException(f"Unrecognized config option: {key}") from ke
    # Allow e2e tests to set any option
    if opt.scriptable:
        set_option(key, value)
        return

    raise StreamlitAPIException(
        f"{key} cannot be set on the fly. Set as command line option, e.g. "
        f"streamlit run script.py --{key}, or in config.toml instead."
    )


def get_option(key: str) -> Any:
    """Return the current value of a given Streamlit configuration option.

    Run ``streamlit config show`` in a terminal to see all available options.

    Parameters
    ----------
    key : str
        The config option key of the form "section.optionName". To see all
        available options, run ``streamlit config show`` in a terminal.

    Example
    -------

    >>> import streamlit as st
    >>>
    >>> color = st.get_option("theme.primaryColor")

    """
    with _config_lock:
        config_options = get_config_options()

        if key not in config_options:
            raise RuntimeError(f'Config key "{key}" not defined.')
        return config_options[key].value


def get_options_for_section(section: str) -> dict[str, Any]:
    """Get all of the config options for the given section.

    Run `streamlit config show` in the terminal to see all available options.

    Parameters
    ----------
    section : str
        The name of the config section to fetch options for.

    Returns
    -------
    dict[str, Any]
        A dict mapping the names of the options in the given section (without
        the section name as a prefix) to their values.
    """
    with _config_lock:
        config_options = get_config_options()

        options_for_section = {}
        for option in config_options.values():
            if option.section == section:
                options_for_section[option.name] = option.value
        return options_for_section


def _create_section(section: str, description: str) -> None:
    """Create a config section and store it globally in this module."""
    if section in _section_descriptions:
        raise RuntimeError(f'Cannot define section "{section}" twice.')
    _section_descriptions[section] = description


def _create_option(
    key: str,
    description: str | None = None,
    default_val: Any | None = None,
    scriptable: bool = False,
    visibility: str = "visible",
    deprecated: bool = False,
    deprecation_text: str | None = None,
    expiration_date: str | None = None,
    replaced_by: str | None = None,
    type_: type = str,
    sensitive: bool = False,
    multiple: bool = False,
) -> ConfigOption:
    '''Create a ConfigOption and store it globally in this module.

    There are two ways to create a ConfigOption:

        (1) Simple, constant config options are created as follows:

            _create_option('section.optionName',
                description = 'Put the description here.',
                default_val = 12345)

        (2) More complex, programmable config options use decorator syntax to
        resolve their values at runtime:

            @_create_option('section.optionName')
            def _section_option_name():
                """Put the description here."""
                return 12345

    To achieve this sugar, _create_option() returns a *callable object* of type
    ConfigObject, which then decorates the function.

    NOTE: ConfigObjects call their evaluation functions *every time* the option
    is requested. To prevent this, use the `streamlit.util.memoize` decorator as
    follows:

            @_create_option('section.memoizedOptionName')
            @util.memoize
            def _section_memoized_option_name():
                """Put the description here."""

                (This function is only called once.)
                """
                return 12345

    '''
    option = ConfigOption(
        key,
        description=description,
        default_val=default_val,
        scriptable=scriptable,
        visibility=visibility,
        deprecated=deprecated,
        deprecation_text=deprecation_text,
        expiration_date=expiration_date,
        replaced_by=replaced_by,
        type_=type_,
        sensitive=sensitive,
        multiple=multiple,
    )
    if option.section not in _section_descriptions:
        raise RuntimeError(
            f'Section "{option.section}" must be one of {", ".join(_section_descriptions.keys())}.'
        )
    if key in _config_options_template:
        raise RuntimeError(f'Cannot define option "{key}" twice.')
    _config_options_template[key] = option
    return option


def _create_theme_options(
    name: str,
    categories: list[Literal["theme"] | CustomThemeCategories],
    description: str | None = None,
    default_val: Any | None = None,
    visibility: str = "visible",
    type_: type = str,
) -> None:
    """
    Create ConfigOption(s) for a theme-related config option and store it globally in
    this module.

    The same config option can be supported for multiple categories, e.g. "theme"
    and "theme.sidebar".
    """
    for cat in categories:
        section = cat if cat == "theme" else f"theme.{cat.value}"

        _create_option(
            f"{section}.{name}",
            description=description,
            default_val=default_val,
            visibility=visibility,
            type_=type_,
            scriptable=False,
            deprecated=False,
            deprecation_text=None,
            expiration_date=None,
            replaced_by=None,
            sensitive=False,
        )


def _delete_option(key: str) -> None:
    """Remove a ConfigOption by key from the global store.

    Only for use in testing.
    """
    if _config_options is None:
        raise RuntimeError(
            "_config_options should always be populated here. This should never happen."
        )

    try:
        del _config_options_template[key]
        del _config_options[key]
    except Exception:  # noqa: S110
        # We don't care if the option already doesn't exist.
        pass


# Config Section: Global #

_create_section("global", "Global options that apply across all of Streamlit.")


_create_option(
    "global.disableWidgetStateDuplicationWarning",
    description="""
        By default, Streamlit displays a warning when a user sets both a widget
        default value in the function defining the widget and a widget value via
        the widget's key in `st.session_state`.

        If you'd like to turn off this warning, set this to True.
    """,
    default_val=False,
    type_=bool,
)


_create_option(
    "global.showWarningOnDirectExecution",
    description="""
        If True, will show a warning when you run a Streamlit-enabled script
        via "python my_script.py".
    """,
    default_val=True,
    type_=bool,
)


@_create_option("global.developmentMode", visibility="hidden", type_=bool)
@util.memoize
def _global_development_mode() -> bool:
    """Are we in development mode.

    This option defaults to True if and only if Streamlit wasn't installed
    normally.
    """
    return (
        not env_util.is_pex()
        and "site-packages" not in __file__
        and "dist-packages" not in __file__
        and "__pypackages__" not in __file__
    )


_create_option(
    "global.e2eTest",
    description="Are we in an e2e (playwright) test? Set automatically when our e2e tests are running.",
    visibility="hidden",
    default_val=False,
    type_=bool,
)

_create_option(
    "global.unitTest",
    description="Are we in a unit test?",
    visibility="hidden",
    default_val=False,
    type_=bool,
)

_create_option(
    "global.appTest",
    description="Are we in an app test? Set automatically when the AppTest framework is running",
    visibility="hidden",
    default_val=False,
    type_=bool,
)

_create_option(
    "global.suppressDeprecationWarnings",
    description="Hide deprecation warnings in the streamlit app.",
    visibility="hidden",
    default_val=False,
    type_=bool,
)

_create_option(
    "global.minCachedMessageSize",
    description="""
        Only cache ForwardMsgs that are greater than or equal to this minimum.
    """,
    visibility="hidden",
    default_val=10 * 1e3,
    type_=float,
)  # 10k

_create_option(
    "global.maxCachedMessageAge",
    description="""
        Expire cached ForwardMsgs whose age is greater than this
        value. A message's age is defined by how many times its script has
        finished running since the message has been accessed.
    """,
    visibility="hidden",
    default_val=2,
    type_=int,
)


# Config Section: Logger #
_create_section("logger", "Settings to customize Streamlit log messages.")


@_create_option("logger.level", type_=str)
def _logger_log_level() -> str:
    """Level of logging for Streamlit's internal logger: "error", "warning",
    "info", or "debug".

    Default: "info"
    """
    if get_option("global.developmentMode"):
        return "debug"
    return "info"


@_create_option("logger.messageFormat", type_=str)
def _logger_message_format() -> str:
    """String format for logging messages. If logger.datetimeFormat is set,
    logger messages will default to `%(asctime)s.%(msecs)03d %(message)s`.

    See Python's documentation for available attributes:
    https://docs.python.org/3/library/logging.html#formatter-objects

    Default: "%(asctime)s %(message)s"
    """
    if get_option("global.developmentMode"):
        from streamlit.logger import DEFAULT_LOG_MESSAGE

        return DEFAULT_LOG_MESSAGE
    return "%(asctime)s %(message)s"


@_create_option(
    "logger.enableRich",
    visibility="hidden",
    type_=bool,
    scriptable=True,
)
@util.memoize
def _logger_enable_rich() -> bool:
    """
    Controls whether uncaught app exceptions are logged via the rich library.

    If True and if rich is installed, exception tracebacks will be logged with
    syntax highlighting and formatting. Rich tracebacks are easier to read and
    show more code than standard Python tracebacks.

    If set to False, the default Python traceback formatting will be used.

    Defaults to True if rich is installed, False otherwise.
    """
    try:
        import rich  # noqa: F401

        # Rich is importable, activate rich logging.
        return True
    except Exception:
        # We are extra broad in catching exceptions here because we don't want
        # that this causes Streamlit to crash if there is any unexpected
        # exception thrown by the import
        return False


# Config Section: Client #

_create_section("client", "Settings for scripts that use Streamlit.")


_create_option(
    "client.showErrorDetails",
    description="""
        Controls whether uncaught app exceptions and deprecation warnings
        are displayed in the browser. This can be one of the following:

        - "full"       : In the browser, Streamlit displays app deprecation
                         warnings and exceptions, including exception types,
                         exception messages, and associated tracebacks.
        - "stacktrace" : In the browser, Streamlit displays exceptions,
                         including exception types, generic exception messages,
                         and associated tracebacks. Deprecation warnings and
                         full exception messages will only print to the
                         console.
        - "type"       : In the browser, Streamlit displays exception types and
                         generic exception messages. Deprecation warnings, full
                         exception messages, and associated tracebacks only
                         print to the console.
        - "none"       : In the browser, Streamlit displays generic exception
                         messages. Deprecation warnings, full exception
                         messages, associated tracebacks, and exception types
                         will only print to the console.
        - True         : This is deprecated. Streamlit displays "full"
                         error details.
        - False        : This is deprecated. Streamlit displays "stacktrace"
                         error details.
    """,
    default_val=ShowErrorDetailsConfigOptions.FULL.value,
    type_=str,
    scriptable=True,
)

_create_option(
    "client.toolbarMode",
    description="""
        Change the visibility of items in the toolbar, options menu,
        and settings dialog (top right of the app).

        Allowed values:
        - "auto"      : Show the developer options if the app is accessed through
                        localhost or through Streamlit Community Cloud as a developer.
                        Hide them otherwise.
        - "developer" : Show the developer options.
        - "viewer"    : Hide the developer options.
        - "minimal"   : Show only options set externally (e.g. through
                        Streamlit Community Cloud) or through st.set_page_config.
                        If there are no options left, hide the menu.
    """,
    default_val="auto",
    type_=str,
    scriptable=True,
)

_create_option(
    "client.showSidebarNavigation",
    description="""
        Controls whether to display the default sidebar page navigation in a
        multi-page app. This only applies when app's pages are defined by the
        `pages/` directory.
    """,
    default_val=True,
    type_=bool,
    scriptable=True,
)

# Config Section: Runner #

_create_section("runner", "Settings for how Streamlit executes your script")

_create_option(
    "runner.magicEnabled",
    description="""
        Allows you to type a variable or string by itself in a single line of
        Python code to write it to the app.
    """,
    default_val=True,
    type_=bool,
)

_create_option(
    "runner.postScriptGC",
    description="""
        Run the Python Garbage Collector after each script execution.

        This can help avoid excess memory use in Streamlit apps, but could
        introduce delay in rerunning the app script for high-memory-use
        applications.
    """,
    default_val=True,
    type_=bool,
    visibility="hidden",
)

_create_option(
    "runner.fastReruns",
    description="""
        Handle script rerun requests immediately, rather than waiting for
        script execution to reach a yield point.

        This makes Streamlit much more responsive to user interaction, but it
        can lead to race conditions in apps that mutate session_state data
        outside of explicit session_state assignment statements.
    """,
    default_val=True,
    type_=bool,
)

_create_option(
    "runner.enforceSerializableSessionState",
    description="""
        Raise an exception after adding unserializable data to Session State.

        Some execution environments may require serializing all data in Session
        State, so it may be useful to detect incompatibility during development,
        or when the execution environment will stop supporting it in the future.
    """,
    default_val=False,
    type_=bool,
)

_create_option(
    "runner.enumCoercion",
    description="""
        Adjust how certain 'options' widgets like radio, selectbox, and
        multiselect coerce Enum members.

        This is useful when the Enum class gets re-defined during a script
        re-run. For more information, check out the docs:
        https://docs.streamlit.io/develop/concepts/design/custom-classes#enums

        Allowed values:
        - "off": Disables Enum coercion.
        - "nameOnly": Enum classes can be coerced if their member names match.
        - "nameAndValue": Enum classes can be coerced if their member names AND
          member values match.
    """,
    default_val="nameOnly",
    type_=str,
)

# Config Section: Server #

_create_section("server", "Settings for the Streamlit server")


_create_option(
    "server.folderWatchList",
    description="""
        List of directories to watch for changes.

        By default, Streamlit watches files in the current working directory
        and its subdirectories. Use this option to specify additional
        directories to watch. Paths must be absolute.
    """,
    default_val=[],
    multiple=True,
)

_create_option(
    "server.folderWatchBlacklist",
    description="""
        List of directories to ignore for changes.

        By default, Streamlit watches files in the current working directory
        and its subdirectories. Use this option to specify exceptions within
        watched directories. Paths can be absolute or relative to the current
        working directory.

        Example: ['/home/user1/env', 'relative/path/to/folder']
    """,
    default_val=[],
    multiple=True,
)

_create_option(
    "server.fileWatcherType",
    description="""
        Change the type of file watcher used by Streamlit, or turn it off
        completely.

        Allowed values:
        - "auto"     : Streamlit will attempt to use the watchdog module, and
                       falls back to polling if watchdog isn't available.
        - "watchdog" : Force Streamlit to use the watchdog module.
        - "poll"     : Force Streamlit to always use polling.
        - "none"     : Streamlit will not watch files.
    """,
    default_val="auto",
    type_=str,
)


@_create_option("server.cookieSecret", type_=str, sensitive=True)
@util.memoize
def _server_cookie_secret() -> str:
    """Symmetric key used to produce signed cookies. If deploying on multiple
    replicas, this should be set to the same value across all replicas to ensure
    they all share the same secret.

    Default: randomly generated secret key.
    """
    return secrets.token_hex()


@_create_option("server.headless", type_=bool)
def _server_headless() -> bool:
    """If false, will attempt to open a browser window on start.

    Default: false unless (1) we are on a Linux box where DISPLAY is unset, or
    (2) we are running in the Streamlit Atom plugin.
    """
    # Check if we are running in Linux and DISPLAY is unset
    return (
        env_util.IS_LINUX_OR_BSD
        and not os.getenv("DISPLAY")
        and not os.getenv("WAYLAND_DISPLAY")
    )


_create_option(
    "server.showEmailPrompt",
    description="""
        Whether to show a terminal prompt for the user's email address when
        they run Streamlit (locally) for the first time. If you set
        `server.headless=True`, Streamlit will not show this prompt.
    """,
    default_val=True,
    type_=bool,
)

_create_option(
    "server.runOnSave",
    description="""
        Automatically rerun script when the file is modified on disk.
    """,
    default_val=False,
    type_=bool,
)

_create_option(
    "server.allowRunOnSave",
    description="""
        Allows users to automatically rerun when app is updated.
    """,
    visibility="hidden",
    default_val=True,
    type_=bool,
)


@_create_option("server.address")
def _server_address() -> str | None:
    """The address where the server will listen for client and browser
    connections.

    Use this if you want to bind the server to a specific address.
    If set, the server will only be accessible from this address, and not from
    any aliases (like localhost).

    Default: (unset)
    """
    return None


_create_option(
    "server.port",
    description="""
        The port where the server will listen for browser connections.
    """,
    default_val=8501,
    type_=int,
)

_create_option(
    "server.scriptHealthCheckEnabled",
    visibility="hidden",
    description="""
        Flag for enabling the script health check endpoint. It's used for checking if
        a script loads successfully. On success, the endpoint will return a 200
        HTTP status code. On failure, the endpoint will return a 503 HTTP status code.

        Note: This is an experimental Streamlit internal API. The API is subject
        to change anytime so this should be used at your own risk
    """,
    default_val=False,
    type_=bool,
)

_create_option(
    "server.baseUrlPath",
    description="""
        The base path for the URL where Streamlit should be served from.
    """,
    default_val="",
    type_=str,
)

_create_option(
    "server.customComponentBaseUrlPath",
    description="""
        The base path for the URL where Streamlit should serve custom
        components. If this config var is set and a call to ``declare_component``
        does not specify a URL, the component's URL will be set to
        ``f"{server.customComponentBaseUrlPath}/{component_name}/"``.
    """,
    default_val="",
    type_=str,
    visibility="hidden",
)

# TODO: Rename to server.enableCorsProtection.
_create_option(
    "server.enableCORS",
    description="""
        Enables support for Cross-Origin Resource Sharing (CORS) protection,
        for added security.

        If XSRF protection is enabled and CORS protection is disabled at the
        same time, Streamlit will enable them both instead.
    """,
    default_val=True,
    type_=bool,
)

_create_option(
    "server.corsAllowedOrigins",
    description="""
        Allowed list of origins.

        If CORS protection is enabled (`server.enableCORS=True`), use this
        option to set a list of allowed origins that the Streamlit server will
        accept traffic from.

        This config option does nothing if CORS protection is disabled.

        Example: ['http://example.com', 'https://streamlit.io']
    """,
    default_val=[],
    multiple=True,
)

_create_option(
    "server.enableXsrfProtection",
    description="""
        Enables support for Cross-Site Request Forgery (XSRF) protection, for
        added security.

        If XSRF protection is enabled and CORS protection is disabled at the
        same time, Streamlit will enable them both instead.
    """,
    default_val=True,
    type_=bool,
)

_create_option(
    "server.maxUploadSize",
    description="""
        Max size, in megabytes, for files uploaded with the file_uploader.
    """,
    # If this default is changed, please also update the docstring
    # for `DeltaGenerator.file_uploader`.
    default_val=200,
    type_=int,
)

_create_option(
    "server.maxMessageSize",
    description="""
        Max size, in megabytes, of messages that can be sent via the WebSocket
        connection.
    """,
    default_val=200,
    type_=int,
)

_create_option(
    "server.enableArrowTruncation",
    description="""
        Enable automatically truncating all data structures that get serialized
        into Arrow (e.g. DataFrames) to ensure that the size is under
        `server.maxMessageSize`.
    """,
    visibility="hidden",
    default_val=False,
    scriptable=True,
    type_=bool,
)

_create_option(
    "server.enableWebsocketCompression",
    description="""
        Enables support for websocket compression.
    """,
    default_val=False,
    type_=bool,
)

_create_option(
    "server.websocketPingInterval",
    description="""
        The interval (in seconds) at which the server pings the client to keep
        the websocket connection alive.

        The default value should work for most deployments. However, if you're
        experiencing frequent disconnections in certain proxy setups (e.g.,
        "Connection error" messages), you may want to try adjusting this value.

        Note: When you set this option, Streamlit automatically sets the ping
        timeout to match this interval. For Tornado >=6.5, a value less than 30
        may cause connection issues.
    """,
    default_val=None,
    type_=int,
)

_create_option(
    "server.enableStaticServing",
    description="""
        Enable serving files from a `static` directory in the running app's
        directory.
    """,
    default_val=False,
    type_=bool,
)

_create_option(
    "server.disconnectedSessionTTL",
    description="""
        TTL in seconds for sessions whose websockets have been disconnected.

        The server may choose to clean up session state, uploaded files, etc
        for a given session with no active websocket connection at any point
        after this time has passed. If you are using load balancing or
        replication in your deployment, you must enable session stickiness
        in your proxy to guarantee reconnection to the existing session. For
        more information, see https://docs.streamlit.io/replication.
    """,
    default_val=120,
    type_=int,
)

_create_option(
    "server.trustedUserHeaders",
    description="""
        HTTP headers to embed in st.user.

        Configures HTTP headers whose values, on websocket connect, will be saved in
        st.user. Each key is the header name to map, and each value is the key in
        st.user to save the value under. If the configured header occurs multiple times
        in the request, the first value will be used. Multiple headers may not point to
        the same user key, and an error will be thrown on initialization if this is
        done.

        If configured using an environment variable or CLI option, it should be a
        single JSON-formatted dict of string-to-string.

        Note: This is an experimental API subject to change.
    """,
    default_val={},
    # This is used by click. We accept a JSON string, so this is a str.
    type_=str,
    # Hide until API is finalized.
    visibility="hidden",
)

# Config Section: Browser #

_create_section("browser", "Configuration of non-UI browser options.")


_create_option(
    "browser.serverAddress",
    description="""
        Internet address where users should point their browsers in order to
        connect to the app. Can be IP address or DNS name and path.

        This is used to:
        - Set the correct URL for CORS and XSRF protection purposes.
        - Show the URL on the terminal
        - Open the browser
    """,
    default_val="localhost",
    type_=str,
)


_create_option(
    "browser.gatherUsageStats",
    description="""
        Whether to send usage statistics to Streamlit.
    """,
    default_val=True,
    type_=bool,
)


@_create_option("browser.serverPort", type_=int)
def _browser_server_port() -> int:
    """Port where users should point their browsers in order to connect to the
    app.

    This is used to:
    - Set the correct URL for XSRF protection purposes.
    - Show the URL on the terminal (part of `streamlit run`).
    - Open the browser automatically (part of `streamlit run`).

    This option is for advanced use cases. To change the port of your app, use
    `server.Port` instead.

    Default: whatever value is set in server.port.
    """
    return int(get_option("server.port"))


_SSL_PRODUCTION_WARNING = [
    "DO NOT USE THIS OPTION IN A PRODUCTION ENVIRONMENT. It has not gone through "
    "security audits or performance tests. For the production environment, "
    "we recommend performing SSL termination by the load balancer or the reverse proxy."
]

_create_option(
    "server.sslCertFile",
    description=(
        f"""
        Server certificate file for connecting via HTTPS.
        Must be set at the same time as "server.sslKeyFile".

        {_SSL_PRODUCTION_WARNING}
        """
    ),
)

_create_option(
    "server.sslKeyFile",
    description=(
        f"""
        Cryptographic key file for connecting via HTTPS.
        Must be set at the same time as "server.sslCertFile".

        {_SSL_PRODUCTION_WARNING}
        """
    ),
)

# Config Section: UI #

_create_section("ui", "Configuration of UI elements displayed in the browser.")

_create_option(
    "ui.hideTopBar",
    description="""
        Flag to hide most of the UI elements found at the top of a Streamlit app.

        NOTE: This does *not* hide the main menu in the top-right of an app.
    """,
    default_val=False,
    type_=bool,
    visibility="hidden",
)


# Config Section: Mapbox #

_create_section("mapbox", "Mapbox configuration that is being used by DeckGL.")

_create_option(
    "mapbox.token",
    description="""
        If you'd like to show maps using Mapbox rather than Carto, use this
        to pass the Mapbox API token.
    """,
    default_val="",
    type_=str,
    sensitive=True,
    deprecated=True,
    deprecation_text="""
        Instead of this, you should use either the MAPBOX_API_KEY environment
        variable or PyDeck's `api_keys` argument.
    """,
    expiration_date="2026-05-01",
)


# Config Section: Magic #

_create_section("magic", "Settings for how Streamlit pre-processes your script")

_create_option(
    "magic.displayRootDocString",
    description="""
        Streamlit's "magic" parser typically skips strings that appear to be
        docstrings. When this flag is set to True, Streamlit will instead display
        the root-level docstring in the app, just like any other magic string.
        This is useful for things like notebooks.
    """,
    visibility="hidden",
    default_val=False,
    type_=bool,
)

_create_option(
    "magic.displayLastExprIfNoSemicolon",
    description="""
        Make Streamlit's "magic" parser always display the last expression in the
        root file if it has no semicolon at the end. This matches the behavior of
        Jupyter notebooks, for example.
    """,
    visibility="hidden",
    default_val=False,
    type_=bool,
)


# Config Section: Custom Theme #

_create_section("theme", "Settings to define a custom theme for your Streamlit app.")

# Create a section for each custom theme element
for cat in list(CustomThemeCategories):
    _create_section(
        f"theme.{cat.value}",
        f"Settings to define a custom {cat.value} theme in your Streamlit app.",
    )

_create_theme_options(
    "base",
    categories=["theme"],
    description="""
        The preset Streamlit theme that your custom theme inherits from.

        This can be one of the following: "light" or "dark".
    """,
)

_create_theme_options(
    "primaryColor",
    categories=["theme", CustomThemeCategories.SIDEBAR],
    description="""
        Primary accent color.
    """,
)

_create_theme_options(
    "backgroundColor",
    categories=["theme", CustomThemeCategories.SIDEBAR],
    description="""
        Background color of the app.
    """,
)

_create_theme_options(
    "secondaryBackgroundColor",
    categories=["theme", CustomThemeCategories.SIDEBAR],
    description="""
        Background color used for most interactive widgets.
    """,
)

_create_theme_options(
    "textColor",
    categories=["theme", CustomThemeCategories.SIDEBAR],
    description="""
        Color used for almost all text.
    """,
)

_create_theme_options(
    "linkColor",
    categories=["theme", CustomThemeCategories.SIDEBAR],
    description="""
        Color used for all links.
    """,
)

_create_theme_options(
    "linkUnderline",
    categories=["theme", CustomThemeCategories.SIDEBAR],
    description="""
        Whether or not links should be displayed with an underline.
    """,
    type_=bool,
)

_create_theme_options(
    "codeBackgroundColor",
    categories=["theme", CustomThemeCategories.SIDEBAR],
    description="""
        Background color used for code blocks.
    """,
)

_create_theme_options(
    "font",
    categories=["theme", CustomThemeCategories.SIDEBAR],
    description="""
        The font family for all text, except code blocks.

        This can be one of the following:
        - "sans-serif"
        - "serif"
        - "monospace"
        - The `family` value for a custom font table under [[theme.fontFaces]]
        - A comma-separated list of these (as a single string) to specify
          fallbacks

        For example, you can use the following:

            font = "cool-font, fallback-cool-font, sans-serif"
    """,
)

_create_theme_options(
    "fontFaces",
    categories=["theme"],
    description="""
        An array of fonts to use in your app.

        Each font in the array is a table (dictionary) that can have the
        following attributes, closely resembling CSS font-face definitions:
        - family
        - url
        - weight (optional)
        - style (optional)
        - unicodeRange (optional)

        To host a font with your app, enable static file serving with
        `server.enableStaticServing=true`.

        You can define multiple [[theme.fontFaces]] tables, including multiple
        tables with the same family if your font is defined by multiple files.

        For example, a font hosted with your app may have a [[theme.fontFaces]]
        table as follows:

            [[theme.fontFaces]]
            family = "font_name"
            url = "app/static/font_file.woff"
            weight = "400"
            style = "normal"
    """,
)

_create_theme_options(
    "baseFontSize",
    categories=["theme"],
    description="""
        The root font size (in pixels) for the app.

        This determines the overall scale of text and UI elements. This is a
        positive integer.

        If this isn't set, the font size will be 16px.
    """,
    type_=int,
)

_create_theme_options(
    "baseFontWeight",
    categories=["theme"],
    description="""
        The root font weight for the app.

        This determines the overall weight of text and UI elements. This is an
        integer multiple of 100. Values can be between 100 and 600, inclusive.

        If this isn't set, the font weight will be set to 400 (normal weight).
    """,
    type_=int,
)

_create_theme_options(
    "headingFont",
    categories=["theme", CustomThemeCategories.SIDEBAR],
    description="""
        The font family to use for headings.

        This can be one of the following:
        - "sans-serif"
        - "serif"
        - "monospace"
        - The `family` value for a custom font table under [[theme.fontFaces]]
        - A comma-separated list of these (as a single string) to specify
          fallbacks

        If this isn't set, Streamlit uses `theme.font` for headings.
    """,
)

_create_theme_options(
    "headingFontSizes",
    categories=["theme", CustomThemeCategories.SIDEBAR],
    description="""
        One or more font sizes for h1-h6 headings.

        If no sizes are set, Streamlit will use the default sizes for h1-h6
        headings. Heading font sizes set in [theme] are not inherited by
        [theme.sidebar]. The following sizes are used by default:
        [
            "2.75rem", # h1 (1.5rem for sidebar)
            "2.25rem", # h2 (1.25rem for sidebar)
            "1.75rem", # h3 (1.125rem for sidebar)
            "1.5rem",  # h4 (1rem for sidebar)
            "1.25rem", # h5 (0.875rem for sidebar)
            "1rem",    # h6 (0.75rem for sidebar)
        ]

        If you specify an array with fewer than six sizes, the unspecified
        heading sizes will be the default values. For example, you can use the
        following array to set the font sizes for h1-h3 headings while keeping
        h4-h6 headings at their default sizes:
            headingFontSizes = ["3rem", "2.875rem", "2.75rem"]

        Setting a single value (not in an array) will set the font size for all
        h1-h6 headings to that value:
            headingFontSizes = "2.75rem"

        Font sizes can be specified in pixels or rem, but rem is recommended.
    """,
)

_create_theme_options(
    "headingFontWeights",
    categories=["theme", CustomThemeCategories.SIDEBAR],
    description="""
        One or more font weights for h1-h6 headings.

        If no weights are set, Streamlit will use the default weights for h1-h6
        headings. Heading font weights set in [theme] are not inherited by
        [theme.sidebar]. The following weights are used by default:
        [
            700, # h1 (bold)
            600, # h2 (semi-bold)
            600, # h3 (semi-bold)
            600, # h4 (semi-bold)
            600, # h5 (semi-bold)
            600, # h6 (semi-bold)
        ]

        If you specify an array with fewer than six weights, the unspecified
        heading weights will be the default values. For example, you can use
        the following array to set the font weights for h1-h2 headings while
        keeping h3-h6 headings at their default weights:
            headingFontWeights = [800, 700]

        Setting a single value (not in an array) will set the font weight for
        all h1-h6 headings to that value:
            headingFontWeights = 500
    """,
)

_create_theme_options(
    "codeFont",
    categories=["theme", CustomThemeCategories.SIDEBAR],
    description="""
        The font family to use for code (monospace) in the sidebar.

        This can be one of the following:
        - "sans-serif"
        - "serif"
        - "monospace"
        - The `family` value for a custom font table under [[theme.fontFaces]]
        - A comma-separated list of these (as a single string) to specify
          fallbacks
    """,
)

_create_theme_options(
    "codeFontSize",
    categories=["theme", CustomThemeCategories.SIDEBAR],
    description="""
        The font size (in pixels or rem) for code blocks and code text.

        This applies to font in code blocks, `st.json`, and `st.help`. It
        doesn't apply to inline code, which is set by default to 0.75em.

        If this isn't set, the code font size will be 0.875rem.
    """,
)

_create_theme_options(
    "codeFontWeight",
    categories=["theme", CustomThemeCategories.SIDEBAR],
    description="""
        The font weight for code blocks and code text.

        This applies to font in inline code, code blocks, `st.json`, and
        `st.help`. This is an integer multiple of 100. Values can be between
        100 and 600, inclusive.

        If this isn't set, the code font weight will be 400 (normal weight).
    """,
    type_=int,
)

_create_theme_options(
    "baseRadius",
    categories=["theme", CustomThemeCategories.SIDEBAR],
    description="""
        The radius used as basis for the corners of most UI elements.

        This can be one of the following:
        - "none"
        - "small"
        - "medium"
        - "large"
        - "full"
        - The number in pixels or rem.

        For example, you can use "10px", "0.5rem", or "2rem". To follow best
        practices, use rem instead of pixels when specifying a numeric size.
    """,
)

_create_theme_options(
    "buttonRadius",
    categories=["theme", CustomThemeCategories.SIDEBAR],
    description="""
        The radius used as basis for the corners of buttons.

        This can be one of the following:
        - "none"
        - "small"
        - "medium"
        - "large"
        - "full"
        - The number in pixels or rem.

        For example, you can use "10px", "0.5rem", or "2rem". To follow best
        practices, use rem instead of pixels when specifying a numeric size.

        If this isn't set, Streamlit uses `theme.baseRadius` instead.
    """,
)

_create_theme_options(
    "borderColor",
    categories=["theme", CustomThemeCategories.SIDEBAR],
    description="""
        The color of the border around elements.
    """,
)

_create_theme_options(
    "dataframeBorderColor",
    categories=["theme", CustomThemeCategories.SIDEBAR],
    description="""
        The color of the border around dataframes and tables.

        If this isn't set, Streamlit uses `theme.borderColor` instead.
    """,
)

_create_theme_options(
    "dataframeHeaderBackgroundColor",
    categories=["theme", CustomThemeCategories.SIDEBAR],
    description="""
        The background color of the dataframe's header.

        This color applies to all non-interior cells of the dataframe. This
        includes the header row, the row-selection column (if present), and
        the bottom row of data editors with a dynamic number of rows. If this
        isn't set, Streamlit uses a mix of `theme.backgroundColor` and
        `theme.secondaryBackgroundColor`.
    """,
)

_create_theme_options(
    "showWidgetBorder",
    categories=["theme", CustomThemeCategories.SIDEBAR],
    description="""
        Whether to show a border around input widgets.
    """,
    type_=bool,
)

_create_theme_options(
    "showSidebarBorder",
    categories=["theme"],
    description="""
        Whether to show a vertical separator between the sidebar and the main
        content area.
    """,
    type_=bool,
)


_create_theme_options(
    "chartCategoricalColors",
    categories=["theme"],
    description="""
        An array of colors to use for categorical chart data.

        This is a list of one or more color strings which are applied in order
        to categorical data. These colors apply to Plotly, Altair, and
        Vega-Lite charts.

        Invalid colors are skipped, and colors repeat cyclically if there are
        more categories than colors. If no chart categorical colors are set,
        Streamlit uses a default set of colors.

        For light themes, the following colors are the default:
        [
            "#0068c9", # blue80
            "#83c9ff", # blue40
            "#ff2b2b", # red80
            "#ffabab", # red40
            "#29b09d", # blueGreen80
            "#7defa1", # green40
            "#ff8700", # orange80
            "#ffd16a", # orange50
            "#6d3fc0", # purple80
            "#d5dae5", # gray40
        ]
        For dark themes, the following colors are the default:
        [
            "#83c9ff", # blue40
            "#0068c9", # blue80
            "#ffabab", # red40
            "#ff2b2b", # red80
            "#7defa1", # green40
            "#29b09d", # blueGreen80
            "#ffd16a", # orange50
            "#ff8700", # orange80
            "#6d3fc0", # purple80
            "#d5dae5", # gray40
        ]
    """,
)

_create_theme_options(
    "chartSequentialColors",
    categories=["theme"],
    description="""
        An array of ten colors to use for sequential or continuous chart data.

        The ten colors create a gradient color scale. These colors apply to
        Plotly, Altair, and Vega-Lite charts.

        Invalid color strings are skipped. If there are not exactly ten
        valid colors specified, Streamlit uses a default set of colors.

         For light themes, the following colors are the default:
        [
            "#e4f5ff", #blue10
            "#c7ebff", #blue20
            "#a6dcff", #blue30
            "#83c9ff", #blue40
            "#60b4ff", #blue50
            "#3d9df3", #blue60
            "#1c83e1", #blue70
            "#0068c9", #blue80
            "#0054a3", #blue90
            "#004280", #blue100
        ]
        For dark themes, the following colors are the default:
        [
            "#004280", #blue100
            "#0054a3", #blue90
            "#0068c9", #blue80
            "#1c83e1", #blue70
            "#3d9df3", #blue60
            "#60b4ff", #blue50
            "#83c9ff", #blue40
            "#a6dcff", #blue30
            "#c7ebff", #blue20
            "#e4f5ff", #blue10
        ]
    """,
)

# Config Section: Secrets #

_create_section("secrets", "Secrets configuration.")


@_create_option("secrets.files", multiple=True)
def _secrets_files() -> list[str]:
    """List of locations where secrets are searched.

    An entry can be a path to a TOML file or directory path where
    Kubernetes style secrets are saved. Order is important, import is
    first to last, so secrets in later files will take precedence over
    earlier ones.
    """
    return get_config_files("secrets.toml")


def get_where_defined(key: str) -> str:
    """Indicate where (e.g. in which file) this option was defined.

    Parameters
    ----------
    key : str
        The config option key of the form "section.optionName"

    """
    with _config_lock:
        config_options = get_config_options()

        if key not in config_options:
            msg = f'Config key "{key}" not defined.'
            raise RuntimeError(msg)
        return config_options[key].where_defined


def _is_unset(option_name: str) -> bool:
    """Check if a given option has not been set by the user.

    Parameters
    ----------
    option_name : str
        The option to check


    Returns
    -------
    bool
        True if the option has not been set by the user.

    """
    return get_where_defined(option_name) == ConfigOption.DEFAULT_DEFINITION


def is_manually_set(option_name: str) -> bool:
    """Check if a given option was actually defined by the user.

    Parameters
    ----------
    option_name : str
        The option to check


    Returns
    -------
    bool
        True if the option has been set by the user.

    """
    return get_where_defined(option_name) not in (
        ConfigOption.DEFAULT_DEFINITION,
        ConfigOption.STREAMLIT_DEFINITION,
    )


def show_config() -> None:
    """Print all config options to the terminal."""
    with _config_lock:
        if _config_options is None:
            raise RuntimeError(
                "_config_options should always be populated here. This should never happen."
            )
        config_util.show_config(_section_descriptions, _config_options)


# Load Config Files #


def _set_option(key: str, value: Any, where_defined: str) -> None:
    """Set a config option by key / value pair.

    This function assumes that the _config_options dictionary has already been
    populated and thus should only be used within this file and by tests.

    Parameters
    ----------
    key : str
        The key of the option, like "logger.level".
    value
        The value of the option.
    where_defined : str
        Tells the config system where this was set.

    """
    if _config_options is None:
        raise RuntimeError("_config_options should always be populated here.")

    if key not in _config_options:
        # Import logger locally to prevent circular references
        from streamlit.logger import get_logger

        logger: Final = get_logger(__name__)

        logger.warning(
            '"%s" is not a valid config option. If you previously had this config '
            "option set, it may have been removed.",
            key,
        )

    else:
        _config_options[key].set_value(value, where_defined)


def _update_config_with_sensitive_env_var(
    config_options: dict[str, ConfigOption],
) -> None:
    """Update the config system by parsing the environment variable.

    This should only be called from get_config_options.
    """
    for opt_name, opt_val in config_options.items():
        if not opt_val.sensitive:
            continue
        env_var_value = os.environ.get(opt_val.env_var)
        if env_var_value is None:
            continue
        _set_option(opt_name, env_var_value, _DEFINED_BY_ENV_VAR)


def _update_config_with_toml(raw_toml: str, where_defined: str) -> None:
    """Update the config system by parsing this string.

    This should only be called from get_config_options.

    Parameters
    ----------
    raw_toml : str
        The TOML file to parse to update the config values.
    where_defined : str
        Tells the config system where this was set.

    """
    try:
        import toml

        parsed_config_file = toml.loads(raw_toml)
    except Exception:
        # Catching any parsing exception to prevent this from breaking our
        # config change watcher logic.
        _LOGGER.exception(
            "Error parsing config toml. This is most likely due to a syntax error "
            "in the config.toml file. Please fix it and try again.",
        )
        return

    def process_section(section_path: str, section_data: dict[str, Any]) -> None:
        """Recursively process nested sections of the config file.

        Parameters
        ----------
        section_path : str
            The dot-separated path to the current section (e.g., "server" or "theme")
        section_data : dict[str, Any]
            The dictionary containing configuration values for this section

        Notes
        -----
        TOML's hierarchical structure gets parsed into nested dictionaries.
        For example:
            [main]
            option = "value"

            [main.subsection]
            another = "value2"

        Will be loaded by the TOML parser as:
            {
                "main": {
                    "option": "value",
                    "subsection": {
                        "another": "value2"
                    }
                }
            }

        This function traverses these nested dictionaries and converts them
        to dot-notation config options.
        """

        for name, value in section_data.items():
            option_name = f"{section_path}.{name}"
            # Process it as a nested config section if it's a custom theme sub-category
            if name in [CustomThemeCategories.SIDEBAR.value]:
                process_section(option_name, value)
            else:
                # It's a regular config option, set it
                _set_option(option_name, _maybe_read_env_variable(value), where_defined)

    for section, options in parsed_config_file.items():
        process_section(section, options)


def _maybe_read_env_variable(value: Any) -> Any:
    """If value is "env:foo", return value of environment variable "foo".

    If value is not in the shape above, returns the value right back.

    Parameters
    ----------
    value : any
        The value to check

    Returns
    -------
    any
        Either returns value right back, or the value of the environment
        variable.

    """
    if isinstance(value, str) and value.startswith("env:"):
        var_name = value[len("env:") :]
        env_var = os.environ.get(var_name)

        if env_var is None:
            # Import logger locally to prevent circular references
            from streamlit.logger import get_logger

            logger: Final = get_logger(__name__)

            logger.error("No environment variable called %s", var_name)
        else:
            return _maybe_convert_to_number(env_var)

    return value


def _maybe_convert_to_number(v: Any) -> Any:
    """Convert v to int or float, or leave it as is."""
    try:
        return int(v)
    except Exception:  # noqa: S110
        pass

    try:
        return float(v)
    except Exception:  # noqa: S110
        pass

    return v


# Allow outside modules to wait for the config file to be parsed before doing
# something.
_on_config_parsed = Signal(doc="Emitted when the config file is parsed.")


def get_config_files(file_name: str) -> list[str]:
    """Return the list of config files (e.g. config.toml or secrets.toml) to be parsed.

    Order is important, import is first to last, so options in later files
    will take precedence over earlier ones.
    """
    # script-level config files overwrite project-level config
    # files, which in turn overwrite global config files.
    config_files = [
        file_util.get_streamlit_file_path(file_name),
        file_util.get_project_streamlit_file_path(file_name),
    ]

    if _main_script_path is not None:
        script_level_config = file_util.get_main_script_streamlit_file_path(
            _main_script_path, file_name
        )
        if script_level_config not in config_files:
            # We need to append the script-level config file to the list
            # so that it overwrites project & global level config files:
            config_files.append(script_level_config)

    return config_files


def get_config_options(
    force_reparse: bool = False, options_from_flags: dict[str, Any] | None = None
) -> dict[str, ConfigOption]:
    """Create and return a dict mapping config option names to their values,
    returning a cached dict if possible.

    Config option values are sourced from the following locations. Values
    set in locations further down the list overwrite those set earlier.
      1. default values defined in this file
      2. the global `~/.streamlit/config.toml` file
      3. per-project `$CWD/.streamlit/config.toml` files
      4. environment variables such as `STREAMLIT_SERVER_PORT`
      5. command line flags passed to `streamlit run`

    Parameters
    ----------
    force_reparse : bool
        Force config files to be parsed so that we pick up any changes to them.

    options_from_flags : dict[str, any] or None
        Config options that we received via CLI flag.

    Returns
    -------
    dict[str, ConfigOption]
        An ordered dict that maps config option names to their values.
    """
    global _config_options  # noqa: PLW0603

    if not options_from_flags:
        options_from_flags = {}

    # Avoid grabbing the lock in the case where there's nothing for us to do.
    config_options = _config_options
    if config_options and not force_reparse:
        return config_options

    with _config_lock:
        # Short-circuit if config files were parsed while we were waiting on
        # the lock.
        if _config_options and not force_reparse:
            return _config_options  # ty: ignore[invalid-return-type]

        old_options = _config_options
        _config_options = copy.deepcopy(_config_options_template)

        # Values set in files later in the CONFIG_FILENAMES list overwrite those
        # set earlier.
        for filename in get_config_files("config.toml"):
            if not os.path.exists(filename):
                continue

            with open(filename, encoding="utf-8") as file:
                file_contents = file.read()

            _update_config_with_toml(file_contents, filename)

        _update_config_with_sensitive_env_var(_config_options)

        for opt_name, opt_val in options_from_flags.items():
            _set_option(opt_name, opt_val, _DEFINED_BY_FLAG)

        if old_options and config_util.server_option_changed(
            old_options, _config_options
        ):
            # Import logger locally to prevent circular references.
            from streamlit.logger import get_logger

            logger: Final = get_logger(__name__)
            logger.warning(
                "An update to the [server] config option section was detected."
                " To have these changes be reflected, please restart streamlit."
            )

        _on_config_parsed.send()
        return _config_options


def _check_conflicts() -> None:
    # Node-related conflicts

    # When using the Node server, we must always connect to 8501 (this is
    # hard-coded in JS). Otherwise, the browser would decide what port to
    # connect to based on window.location.port, which in dev is going
    # to be 3000.

    # Import logger locally to prevent circular references
    from streamlit.logger import get_logger

    logger: Final = get_logger(__name__)

    if get_option("global.developmentMode"):
        if not _is_unset("server.port"):
            raise RuntimeError(
                "server.port does not work when global.developmentMode is true."
            )

        if not _is_unset("browser.serverPort"):
            raise RuntimeError(
                "browser.serverPort does not work when global.developmentMode is true."
            )

    # XSRF conflicts
    if get_option("server.enableXsrfProtection") and (
        not get_option("server.enableCORS") or get_option("global.developmentMode")
    ):
        logger.warning(
            """
Warning: the config option 'server.enableCORS=false' is not compatible with
'server.enableXsrfProtection=true'.
As a result, 'server.enableCORS' is being overridden to 'true'.

More information:
In order to protect against CSRF attacks, we send a cookie with each request.
To do so, we must specify allowable origins, which places a restriction on
cross-origin resource sharing.

If cross origin resource sharing is required, please disable server.enableXsrfProtection.
            """
        )


def _set_development_mode() -> None:
    development.is_development_mode = get_option("global.developmentMode")


def _parse_trusted_user_headers() -> None:
    """Convert string-valued server.trustedUserHeaders to a dict.

    If server.trustedUserHeaders is configured from an environment variable or from
    the CLI, it will be a JSON string. Parse this and set the value to the resulting
    dict, after validation.
    """
    options = get_config_options()
    trusted_user_headers = options["server.trustedUserHeaders"]
    if isinstance(trusted_user_headers.value, str):
        try:
            parsed_value = json.loads(trusted_user_headers.value)
            # Validate that this is an object with string values.
            if not isinstance(parsed_value, dict):
                # Config validation is using RuntimeError deliberately; ignore warning
                # about making this TypeError.
                # ruff: noqa: TRY004
                raise RuntimeError("server.trustedUserHeaders JSON must be an object")
            for json_key, json_value in parsed_value.items():
                if not isinstance(json_value, str):
                    raise RuntimeError(
                        "server.trustedUserHeaders JSON must only have string values. "
                        f'got bad value for key "{json_key}": {json_value}'
                    )
            set_option(
                "server.trustedUserHeaders",
                parsed_value,
                where_defined=trusted_user_headers.where_defined,
            )
        except json.JSONDecodeError as jde:
            raise RuntimeError(
                f"bad JSON value for server.trustedUserHeaders: {jde.msg}"
            )

    # Fetch the latest value, since we might've updated it from JSON.
    final_config_value = options["server.trustedUserHeaders"].value
    # Ensure no user keys are duplicated.
    values = set()
    bad_keys = []
    for user_key in final_config_value.values():
        if user_key in values:
            bad_keys.append(user_key)
        values.add(user_key)

    if bad_keys:
        raise RuntimeError(
            f"server.trustedUserHeaders had multiple mappings for user key(s) {bad_keys}"
        )


def on_config_parsed(
    func: Callable[[], None], force_connect: bool = False, lock: bool = False
) -> Callable[[], None]:
    """Wait for the config file to be parsed then call func.

    If the config file has already been parsed, just calls func immediately
    unless force_connect is set.

    Parameters
    ----------
    func : Callable[[], None]
        A function to run on config parse.

    force_connect : bool
        Wait until the next config file parse to run func, even if config files
        have already been parsed.

    lock : bool
        If set, grab _config_lock before running func.

    Returns
    -------
    Callable[[], None]
        A function that the caller can use to deregister func.
    """

    # We need to use the same receiver when we connect or disconnect on the
    # Signal. If we don't do this, then the registered receiver won't be released
    # leading to a memory leak because the Signal will keep a reference of the
    # callable argument. When the callable argument is an object method, then
    # the reference to that object won't be released.
    def receiver(_: Any) -> None:
        func_with_lock()

    def disconnect() -> None:
        _on_config_parsed.disconnect(receiver)

    def func_with_lock() -> None:
        if lock:
            with _config_lock:
                func()
        else:
            func()

    if force_connect or not _config_options:
        # weak=False so that we have control of when the on_config_parsed
        # callback is deregistered.
        _on_config_parsed.connect(receiver, weak=False)
    else:
        func_with_lock()

    return disconnect


# Run _check_conflicts only once the config file is parsed in order to avoid
# loops. We also need to grab the lock when running _check_conflicts since it
# may edit config options based on the values of other config options.
on_config_parsed(_check_conflicts, lock=True)
on_config_parsed(_set_development_mode)
# Update server.trustedUserHeaders from any JSON string that was set. Take out the
# lock, since this is mutating the config.
on_config_parsed(_parse_trusted_user_headers, lock=True)
