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

"""Loads the configuration data."""

from __future__ import annotations

import copy
import os
import secrets
import threading
from collections import OrderedDict
from typing import Any, Callable

from blinker import Signal

from streamlit import config_util, development, env_util, file_util, util
from streamlit.config_option import ConfigOption
from streamlit.errors import StreamlitAPIException

# Config System Global State #

# Descriptions of each of the possible config sections.
# (We use OrderedDict to make the order in which sections are declared in this
# file be the same order as the sections appear with `streamlit config show`)
_section_descriptions: dict[str, str] = OrderedDict(
    _test="Special test section just used for unit tests."
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


# Indicates that a config option was defined by the user.
_USER_DEFINED = "<user defined>"

# Indicates that a config option was defined either in an environment variable
# or via command-line flag.
_DEFINED_BY_FLAG = "command-line argument or environment variable"

# Indicates that a config option was defined in an environment variable
_DEFINED_BY_ENV_VAR = "environment variable"


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
        f"{key} cannot be set on the fly. Set as command line option, e.g. streamlit run script.py --{key}, or in config.toml instead."
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
    assert (
        section not in _section_descriptions
    ), f'Cannot define section "{section}" twice.'
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
    )
    assert (
        option.section in _section_descriptions
    ), 'Section "{}" must be one of {}.'.format(
        option.section,
        ", ".join(_section_descriptions.keys()),
    )
    assert key not in _config_options_template, f'Cannot define option "{key}" twice.'
    _config_options_template[key] = option
    return option


def _delete_option(key: str) -> None:
    """Remove a ConfigOption by key from the global store.

    Only for use in testing.
    """
    try:
        del _config_options_template[key]
        assert (
            _config_options is not None
        ), "_config_options should always be populated here."
        del _config_options[key]
    except Exception:
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

_create_option(
    "global.storeCachedForwardMessagesInMemory",
    description="""
        If True, store cached ForwardMsgs in backend memory. This is an
        internal flag to validate a potential removal of the in-memory
        forward message cache.
    """,
    visibility="hidden",
    default_val=True,
    type_=bool,
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
    else:
        return "info"


@_create_option("logger.messageFormat", type_=str)
def _logger_message_format() -> str:
    """String format for logging messages. If logger.datetimeFormat is set,
    logger messages will default to `%(asctime)s.%(msecs)03d %(message)s`. See
    Python's documentation for available attributes:
    https://docs.python.org/3/library/logging.html#formatter-objects

    Default: "%(asctime)s %(message)s"
    """
    if get_option("global.developmentMode"):
        from streamlit.logger import DEFAULT_LOG_MESSAGE

        return DEFAULT_LOG_MESSAGE
    else:
        return "%(asctime)s %(message)s"


_create_option(
    "logger.enableRich",
    description="""
        Controls whether uncaught app exceptions are logged via the rich library.

        If True and if rich is installed, exception tracebacks will be logged with syntax highlighting and formatting.
        Rich tracebacks are easier to read and show more code than standard Python tracebacks.

        If set to False, the default Python traceback formatting will be used.
    """,
    default_val=False,
    visibility="hidden",
    type_=bool,
    scriptable=True,
)

# Config Section: Client #

_create_section("client", "Settings for scripts that use Streamlit.")


_create_option(
    "client.showErrorDetails",
    description="""
        Controls whether uncaught app exceptions and deprecation warnings
        are displayed in the browser. By default, this is set to True and
        Streamlit displays app exceptions and associated tracebacks, and
        deprecation warnings, in the browser.

        If set to False, deprecation warnings and full exception messages
        will print to the console only. Exceptions will still display in the
        browser with a generic error message. For now, the exception type and
        traceback show in the browser also, but they will be removed in the
        future.
    """,
    default_val=True,
    type_=bool,
    scriptable=True,
)

_create_option(
    "client.toolbarMode",
    description="""
        Change the visibility of items in the toolbar, options menu,
        and settings dialog (top right of the app).

        Allowed values:
        * "auto"      : Show the developer options if the app is accessed through
                        localhost or through Streamlit Community Cloud as a developer.
                        Hide them otherwise.
        * "developer" : Show the developer options.
        * "viewer"    : Hide the developer options.
        * "minimal"   : Show only options set externally (e.g. through
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
        Run the Python Garbage Collector after each script execution. This
        can help avoid excess memory use in Streamlit apps, but could
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
        Handle script rerun requests immediately, rather than waiting for script
        execution to reach a yield point. This makes Streamlit much more
        responsive to user interaction, but it can lead to race conditions in
        apps that mutate session_state data outside of explicit session_state
        assignment statements.
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
        multiselect coerce Enum members when the Enum class gets re-defined
        during a script re-run. For more information, check out the docs:
        https://docs.streamlit.io/develop/concepts/design/custom-classes#enums

        Allowed values:
        * "off": Disables Enum coercion.
        * "nameOnly": Enum classes can be coerced if their member names match.
        * "nameAndValue": Enum classes can be coerced if their member names AND
          member values match.
    """,
    default_val="nameOnly",
    type_=str,
)

# Config Section: Server #

_create_section("server", "Settings for the Streamlit server")

_create_option(
    "server.folderWatchBlacklist",
    description="""
        List of folders that should not be watched for changes.

        Relative paths will be taken as relative to the current working directory.

        Example: ['/home/user1/env', 'relative/path/to/folder']
    """,
    default_val=[],
)

_create_option(
    "server.fileWatcherType",
    description="""
        Change the type of file watcher used by Streamlit, or turn it off
        completely.

        Allowed values:
        * "auto"     : Streamlit will attempt to use the watchdog module, and
                       falls back to polling if watchdog is not available.
        * "watchdog" : Force Streamlit to use the watchdog module.
        * "poll"     : Force Streamlit to always use polling.
        * "none"     : Streamlit will not watch files.
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
    if env_util.IS_LINUX_OR_BSD and not os.getenv("DISPLAY"):
        # We're running in Linux and DISPLAY is unset
        return True

    if os.getenv("IS_RUNNING_IN_STREAMLIT_EDITOR_PLUGIN") is not None:
        # We're running within the Streamlit Atom plugin
        return True

    return False


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
    connections. Use this if you want to bind the server to a specific address.
    If set, the server will only be accessible from this address, and not from
    any aliases (like localhost).

    Default: (unset)
    """
    return None


_create_option(
    "server.port",
    description="""
        The port where the server will listen for browser connections.

        Don't use port 3000 which is reserved for internal development.
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

# TODO: Rename to server.enableCorsProtection.
_create_option(
    "server.enableCORS",
    description="""
        Enables support for Cross-Origin Resource Sharing (CORS) protection, for
        added security.

        Due to conflicts between CORS and XSRF, if `server.enableXsrfProtection` is
        on and `server.enableCORS` is off at the same time, we will prioritize
        `server.enableXsrfProtection`.
    """,
    default_val=True,
    type_=bool,
)


_create_option(
    "server.enableXsrfProtection",
    description="""
        Enables support for Cross-Site Request Forgery (XSRF) protection, for
        added security.

        Due to conflicts between CORS and XSRF, if `server.enableXsrfProtection` is
        on and `server.enableCORS` is off at the same time, we will prioritize
        `server.enableXsrfProtection`.
    """,
    default_val=True,
    type_=bool,
)

_create_option(
    "server.maxUploadSize",
    description="""
        Max size, in megabytes, for files uploaded with the file_uploader.
    """,
    default_val=200,  # If this default is changed, please also update the docstring for `DeltaGenerator.file_uploader`.
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
        Enable automatically truncating all data structures that get serialized into Arrow (e.g. DataFrames)
        to ensure that the size is under `server.maxMessageSize`.
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
        TTL in seconds for sessions whose websockets have been disconnected. The server
        may choose to clean up session state, uploaded files, etc for a given session
        with no active websocket connection at any point after this time has passed.
    """,
    default_val=120,
    type_=int,
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
    `server.Port` instead. Don't use port 3000 which is reserved for internal
    development.

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
        Configure Streamlit to use a custom Mapbox
        token for elements like st.pydeck_chart and st.map.
        To get a token for yourself, create an account at
        https://mapbox.com. It's free (for moderate usage levels)!
    """,
    default_val="",
    sensitive=True,
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

_create_option(
    "theme.base",
    description="""
        The preset Streamlit theme that your custom theme inherits from.
        One of "light" or "dark".
    """,
)

_create_option(
    "theme.primaryColor",
    description="Primary accent color for interactive elements.",
)

_create_option(
    "theme.backgroundColor",
    description="Background color for the main content area.",
)

_create_option(
    "theme.secondaryBackgroundColor",
    description="Background color used for the sidebar and most interactive widgets.",
)

_create_option(
    "theme.textColor",
    description="Color used for almost all text.",
)

_create_option(
    "theme.font",
    description="""
        Font family for all text in the app, except code blocks. One of "sans serif",
        "serif", or "monospace".
    """,
)

# Config Section: Secrets #

_create_section("secrets", "Secrets configuration.")

_create_option(
    "secrets.files",
    description="""
        List of locations where secrets are searched. An entry can be a path to a
        TOML file or directory path where Kubernetes style secrets are saved.
        Order is important, import is first to last, so secrets in later files
        will take precedence over earlier ones.
    """,
    default_val=[
        # NOTE: The order here is important! Project-level secrets should overwrite global
        # secrets.
        file_util.get_streamlit_file_path("secrets.toml"),
        file_util.get_project_streamlit_file_path("secrets.toml"),
    ],
)


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
            raise RuntimeError('Config key "%s" not defined.' % key)
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
        assert (
            _config_options is not None
        ), "_config_options should always be populated here."
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
    assert (
        _config_options is not None
    ), "_config_options should always be populated here."
    if key not in _config_options:
        # Import logger locally to prevent circular references
        from streamlit.logger import get_logger

        LOGGER = get_logger(__name__)

        LOGGER.warning(
            f'"{key}" is not a valid config option. If you previously had this config option set, it may have been removed.'
        )

    else:
        _config_options[key].set_value(value, where_defined)


def _update_config_with_sensitive_env_var(config_options: dict[str, ConfigOption]):
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
    import toml

    parsed_config_file = toml.loads(raw_toml)

    for section, options in parsed_config_file.items():
        for name, value in options.items():
            value = _maybe_read_env_variable(value)
            _set_option(f"{section}.{name}", value, where_defined)


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

            LOGGER = get_logger(__name__)

            LOGGER.error("No environment variable called %s" % var_name)
        else:
            return _maybe_convert_to_number(env_var)

    return value


def _maybe_convert_to_number(v: Any) -> Any:
    """Convert v to int or float, or leave it as is."""
    try:
        return int(v)
    except Exception:
        pass

    try:
        return float(v)
    except Exception:
        pass

    return v


# Allow outside modules to wait for the config file to be parsed before doing
# something.
_on_config_parsed = Signal(doc="Emitted when the config file is parsed.")

CONFIG_FILENAMES = [
    file_util.get_streamlit_file_path("config.toml"),
    file_util.get_project_streamlit_file_path("config.toml"),
]


def get_config_options(
    force_reparse=False, options_from_flags: dict[str, Any] | None = None
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
    global _config_options

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
            return _config_options

        old_options = _config_options
        _config_options = copy.deepcopy(_config_options_template)

        # Values set in files later in the CONFIG_FILENAMES list overwrite those
        # set earlier.
        for filename in CONFIG_FILENAMES:
            if not os.path.exists(filename):
                continue

            with open(filename, encoding="utf-8") as input:
                file_contents = input.read()

            _update_config_with_toml(file_contents, filename)

        _update_config_with_sensitive_env_var(_config_options)

        for opt_name, opt_val in options_from_flags.items():
            _set_option(opt_name, opt_val, _DEFINED_BY_FLAG)

        if old_options and config_util.server_option_changed(
            old_options, _config_options
        ):
            # Import logger locally to prevent circular references.
            from streamlit.logger import get_logger

            LOGGER = get_logger(__name__)
            LOGGER.warning(
                "An update to the [server] config option section was detected."
                " To have these changes be reflected, please restart streamlit."
            )

        _on_config_parsed.send()
        return _config_options


def _check_conflicts() -> None:
    # Node-related conflicts

    # When using the Node server, we must always connect to 8501 (this is
    # hard-coded in JS). Otherwise, the browser would decide what port to
    # connect to based on window.location.port, which in dev is going to
    # be (3000)

    # Import logger locally to prevent circular references
    from streamlit.logger import get_logger

    LOGGER = get_logger(__name__)

    if get_option("global.developmentMode"):
        assert _is_unset(
            "server.port"
        ), "server.port does not work when global.developmentMode is true."

        assert _is_unset(
            "browser.serverPort"
        ), "browser.serverPort does not work when global.developmentMode is true."

    # XSRF conflicts
    if get_option("server.enableXsrfProtection"):
        if not get_option("server.enableCORS") or get_option("global.developmentMode"):
            LOGGER.warning(
                """
Warning: the config option 'server.enableCORS=false' is not compatible with 'server.enableXsrfProtection=true'.
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


def on_config_parsed(
    func: Callable[[], None], force_connect=False, lock=False
) -> Callable[[], bool]:
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
    Callable[[], bool]
        A function that the caller can use to deregister func.
    """

    # We need to use the same receiver when we connect or disconnect on the
    # Signal. If we don't do this, then the registered receiver won't be released
    # leading to a memory leak because the Signal will keep a reference of the
    # callable argument. When the callable argument is an object method, then
    # the reference to that object won't be released.
    def receiver(_):
        return func_with_lock()

    def disconnect():
        return _on_config_parsed.disconnect(receiver)

    def func_with_lock():
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
