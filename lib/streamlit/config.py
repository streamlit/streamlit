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

"""Loads the configuration data."""

import os
import toml
import collections
import secrets
import urllib
from typing import Dict

import click
from blinker import Signal

from streamlit import development
from streamlit import env_util
from streamlit import file_util
from streamlit import util
from streamlit.config_option import ConfigOption

# Config System Global State #

# Descriptions of each of the possible config sections.
# (We use OrderedDict to make the order in which sections are declared in this
# file be the same order as the sections appear with `streamlit config show`)
_section_descriptions = collections.OrderedDict(
    _test="Special test section just used for unit tests."
)

# Stores the config options as key value pairs in an ordered dict to be able
# to show the config params help in the same order they were included.
# TODO(nate): Change type annotation to OrderedDict once Python 3.7 is required.
_config_options = collections.OrderedDict()  # type: Dict[str, ConfigOption]

# Makes sure we only parse the config file once.
_config_file_has_been_parsed = False

# Allow outside modules to wait for the config file to be parsed before doing
# something.
_on_config_parsed = Signal(doc="Emitted when the config file is parsed.")


def set_option(key, value):
    """Set config option.

    Run `streamlit config show` in the terminal to see all available options.

    Parameters
    ----------
    key : str
        The config option key of the form "section.optionName". To see all
        available options, run `streamlit config show` on a terminal.

    value
        The new value to assign to this config option.

    """
    _set_option(key, value, _USER_DEFINED)


def get_option(key):
    """Return the current value of a given Streamlit config option.

    Run `streamlit config show` in the terminal to see all available options.

    Parameters
    ----------
    key : str
        The config option key of the form "section.optionName". To see all
        available options, run `streamlit config show` on a terminal.

    """
    # Don't worry, this call cached and only runs once:
    parse_config_file()

    if key not in _config_options:
        raise RuntimeError('Config key "%s" not defined.' % key)
    return _config_options[key].value


def _create_section(section, description):
    """Create a config section and store it globally in this module."""
    assert section not in _section_descriptions, (
        'Cannot define section "%s" twice.' % section
    )
    _section_descriptions[section] = description


def _create_option(
    key,
    description=None,
    default_val=None,
    scriptable=False,
    visibility="visible",
    deprecated=False,
    deprecation_text=None,
    expiration_date=None,
    replaced_by=None,
    type_=str,
):
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
    )
    assert (
        option.section in _section_descriptions
    ), 'Section "%s" must be one of %s.' % (
        option.section,
        ", ".join(_section_descriptions.keys()),
    )
    assert key not in _config_options, 'Cannot define option "%s" twice.' % key
    _config_options[key] = option
    return option


def _delete_option(key):
    """Remove option ConfigOption by key from global store.

    For use in testing.
    """
    try:
        del _config_options[key]
    except Exception:
        pass


# Config Section: Global #

_create_section("global", "Global options that apply across all of Streamlit.")

_create_option(
    "global.disableWatchdogWarning",
    description="""
        By default, Streamlit checks if the Python watchdog module is available
        and, if not, prints a warning asking for you to install it. The watchdog
        module is not required, but highly recommended. It improves Streamlit's
        ability to detect changes to files in your filesystem.

        If you'd like to turn off this warning, set this to True.
        """,
    default_val=False,
    type_=bool,
)

_create_option(
    "global.sharingMode",
    visibility="hidden",
    description="""
        Configure the ability to share apps to the cloud.

        Should be set to one of these values:
        - "off" : turn off sharing.
        - "s3" : share to S3, based on the settings under the [s3] section of
          this config file.
        - "file" : share to a directory on the local machine. This is
          meaningful only for debugging Streamlit itself, and shouldn't be
          used for production.
        """,
    default_val="off",
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
def _global_development_mode():
    """Are we in development mode.

    This option defaults to True if and only if Streamlit wasn't installed
    normally.
    """
    return (
        not env_util.is_pex()
        and "site-packages" not in __file__
        and "dist-packages" not in __file__
    )


_create_option(
    "global.logLevel",
    description="""Level of logging: 'error', 'warning', 'info', or 'debug'.

    Default: 'info'
    """,
    deprecated=True,
    deprecation_text="global.logLevel has been replaced with logger.level",
    expiration_date="2020-11-30",
    replaced_by="logger.level",
)


@_create_option("global.unitTest", visibility="hidden", type_=bool)
def _global_unit_test():
    """Are we in a unit test?

    This option defaults to False.
    """
    return False


_create_option(
    "global.metrics",
    description="Whether to serve prometheus metrics from /metrics.",
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
    description="""Only cache ForwardMsgs that are greater than or equal to
        this minimum.""",
    visibility="hidden",
    default_val=10 * 1e3,
    type_=float,
)  # 10k

_create_option(
    "global.maxCachedMessageAge",
    description="""Expire cached ForwardMsgs whose age is greater than this
        value. A message's age is defined by how many times its script has
        finished running since the message has been accessed.""",
    visibility="hidden",
    default_val=2,
    type_=int,
)


# Config Section: Logger #
_create_section("logger", "Settings to customize Streamlit log messages.")


@_create_option("logger.level", type_=str)
def _logger_log_level():
    """Level of logging: 'error', 'warning', 'info', or 'debug'.

    Default: 'info'
    """

    if get_option("global.logLevel"):
        return get_option("global.logLevel")
    elif get_option("global.developmentMode"):
        return "debug"
    else:
        return "info"


@_create_option("logger.messageFormat", type_=str)
def _logger_message_format():
    """String format for logging messages. If logger.datetimeFormat is set,
    logger messages will default to `%(asctime)s.%(msecs)03d %(message)s`. See
    [Python's documentation](https://docs.python.org/2.6/library/logging.html#formatter-objects)
    for available attributes.

    Default: None
    """
    if get_option("global.developmentMode"):
        from streamlit.logger import DEFAULT_LOG_MESSAGE

        return DEFAULT_LOG_MESSAGE
    else:
        return "%(asctime)s %(message)s"


# Config Section: Client #

_create_section("client", "Settings for scripts that use Streamlit.")

_create_option(
    "client.caching",
    description="Whether to enable st.cache.",
    default_val=True,
    type_=bool,
    scriptable=True,
)

_create_option(
    "client.displayEnabled",
    description="""If false, makes your Streamlit script not draw to a
        Streamlit app.""",
    default_val=True,
    type_=bool,
    scriptable=True,
)

_create_option(
    "client.showTracebacks",
    description="""Controls whether uncaught app exceptions are displayed in
        the browser. (By default, Streamlit displays app exceptions and their
        tracebacks.)""",
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
    "runner.installTracer",
    description="""
        Install a Python tracer to allow you to stop or pause your script at
        any point and introspect it. As a side-effect, this slows down your
        script's execution.
        """,
    default_val=False,
    type_=bool,
)

_create_option(
    "runner.fixMatplotlib",
    description="""
        Sets the MPLBACKEND environment variable to Agg inside Streamlit to
        prevent Python crashing.
        """,
    default_val=True,
    type_=bool,
)

# Config Section: Server #

_create_section("server", "Settings for the Streamlit server")

_create_option(
    "server.folderWatchBlacklist",
    description="""List of folders that should not be watched for changes. This
    impacts both "Run on Save" and @st.cache.

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


@_create_option("server.cookieSecret", type_=str)
@util.memoize
def _server_cookie_secret():
    """Symmetric key used to produce signed cookies. If deploying on multiple replicas, this should
    be set to the same value across all replicas to ensure they all share the same secret.

    Default: randomly generated secret key.
    """
    return secrets.token_hex()


@_create_option("server.headless", type_=bool)
@util.memoize
def _server_headless():
    """If false, will attempt to open a browser window on start.

    Default: false unless (1) we are on a Linux box where DISPLAY is unset, or
    (2) server.liveSave is set.
    """
    is_live_save_on = get_option("server.liveSave")
    is_linux = env_util.IS_LINUX_OR_BSD
    has_display_env = not os.getenv("DISPLAY")
    is_running_in_editor_plugin = (
        os.getenv("IS_RUNNING_IN_STREAMLIT_EDITOR_PLUGIN") is not None
    )
    return (
        is_live_save_on or (is_linux and has_display_env) or is_running_in_editor_plugin
    )


@_create_option("server.liveSave", type_=bool, visibility="hidden")
def _server_live_save():
    """Immediately share the app in such a way that enables live
    monitoring, and post-run analysis.

    Default: false
    """
    return False


@_create_option("server.runOnSave", type_=bool)
def _server_run_on_save():
    """Automatically rerun script when the file is modified on disk.

    Default: false
    """
    return False


@_create_option("server.allowRunOnSave", type_=bool, visibility="hidden")
def _server_allow_run_on_save():
    """Allows users to automatically rerun when app is updated.

    Default: true
    """
    return True


@_create_option("server.address")
def _server_address():
    """The address where the server will listen for client and browser
    connections. Use this if you want to bind the server to a specific address.
    If set, the server will only be accessible from this address, and not from
    any aliases (like localhost).

    Default: (unset)
    """
    return None


@_create_option("server.port", type_=int)
def _server_port():
    """The port where the server will listen for browser
    connections.

    Default: 8501
    """
    return 8501


_create_option(
    "server.baseUrlPath",
    description="""
        The base path for the URL where Streamlit should be served from.
        """,
    default_val="",
    type_=str,
)


# TODO: Rename to server.enableCorsProtection.
@_create_option("server.enableCORS", type_=bool)
def _server_enable_cors():
    """Enables support for Cross-Origin Request Sharing (CORS) protection, for added security.

    Due to conflicts between CORS and XSRF, if `server.enableXsrfProtection` is on and
    `server.enableCORS` is off at the same time, we will prioritize `server.enableXsrfProtection`.

    Default: true
    """
    return True


@_create_option("server.enableXsrfProtection", type_=bool)
def _server_enable_xsrf_protection():
    """Enables support for Cross-Site Request Forgery (XSRF) protection, for added security.

    Due to conflicts between CORS and XSRF, if `server.enableXsrfProtection` is on and
    `server.enableCORS` is off at the same time, we will prioritize `server.enableXsrfProtection`.

    Default: true
    """
    return True


@_create_option("server.maxUploadSize", type_=int)
def _server_max_upload_size():
    """Max size, in megabytes, for files uploaded with the file_uploader.

    Default: 200
    """
    # If this default is changed, please also update the docstring
    # for `DeltaGenerator.file_uploader`.
    return 200


@_create_option("server.enableWebsocketCompression", type_=bool)
def _server_enable_websocket_compression():
    """Enables support for websocket compression.

    Default: true
    """
    return True


# Config Section: Browser #

_create_section("browser", "Configuration of browser front-end.")


@_create_option("browser.serverAddress")
def _browser_server_address():
    """Internet address where users should point their browsers in order to
    connect to the app. Can be IP address or DNS name and path.

    This is used to:
    - Set the correct URL for CORS and XSRF protection purposes.
    - Show the URL on the terminal
    - Open the browser
    - Tell the browser where to connect to the server when in liveSave mode.

    Default: 'localhost'
    """
    return "localhost"


@_create_option("browser.gatherUsageStats", type_=bool)
def _gather_usage_stats():
    """Whether to send usage statistics to Streamlit.

    Default: true
    """
    return True


@_create_option("browser.serverPort", type_=int)
def _browser_server_port():
    """Port where users should point their browsers in order to connect to the
    app.

    This is used to:
    - Set the correct URL for CORS and XSRF protection purposes.
    - Show the URL on the terminal
    - Open the browser
    - Tell the browser where to connect to the server when in liveSave mode.

    Default: whatever value is set in server.port.
    """
    return get_option("server.port")


# Config Section: Mapbox #

_create_section("mapbox", "Mapbox configuration that is being used by DeckGL.")

_create_option(
    "mapbox.token",
    description="""Configure Streamlit to use a custom Mapbox
                token for elements like st.pydeck_chart and st.map.
                To get a token for yourself, create an account at
                https://mapbox.com. It's free (for moderate usage levels)!""",
    default_val="",
)


# Config Section: deprecations

_create_section("deprecation", "Configuration to show or hide deprecation warnings.")

_create_option(
    "deprecation.showfileUploaderEncoding",
    description="Set to false to disable the deprecation warning for the file uploader encoding.",
    default_val="True",
    scriptable="True",
    type_=bool,
    expiration_date="2021-01-06",
)

_create_option(
    "deprecation.showImageFormat",
    description="Set to false to disable the deprecation warning for the image format parameter.",
    default_val="True",
    scriptable="True",
    type_=bool,
)

_create_option(
    "deprecation.showPyplotGlobalUse",
    description="Set to false to disable the deprecation warning for using the global pyplot instance.",
    default_val="True",
    scriptable="True",
    type_=bool,
)

# Config Section: S3 #

_create_section("s3", 'Configuration for when global.sharingMode is set to "s3".')


@_create_option("s3.bucket")
def _s3_bucket():
    """Name of the AWS S3 bucket to save apps.

    Default: (unset)
    """
    return None


@_create_option("s3.url")
def _s3_url():
    """URL root for external view of Streamlit apps.

    Default: (unset)
    """
    return None


@_create_option("s3.accessKeyId")
def _s3_access_key_id():
    """Access key to write to the S3 bucket.

    Leave unset if you want to use an AWS profile.

    Default: (unset)
    """
    return None


@_create_option("s3.secretAccessKey")
def _s3_secret_access_key():
    """Secret access key to write to the S3 bucket.

    Leave unset if you want to use an AWS profile.

    Default: (unset)
    """
    return None


_create_option(
    "s3.keyPrefix",
    description="""The "subdirectory" within the S3 bucket where to save
        apps.

        S3 calls paths "keys" which is why the keyPrefix is like a
        subdirectory. Use "" to mean the root directory.
        """,
    default_val="",
)

_create_option(
    "s3.region",
    description="""AWS region where the bucket is located, e.g. "us-west-2".

        Default: (unset)
        """,
    default_val=None,
)

_create_option(
    "s3.profile",
    description="""AWS credentials profile to use.

        Leave unset to use your default profile.

        Default: (unset)
        """,
    default_val=None,
)  # If changing the default, change S3Storage.py too.


def get_where_defined(key):
    """Indicate where (e.g. in which file) this option was defined.

    Parameters
    ----------
    key : str
        The config option key of the form "section.optionName"

    """
    if key not in _config_options:
        raise RuntimeError('Config key "%s" not defined.' % key)
    return _config_options[key].where_defined


def _is_unset(option_name):
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


def is_manually_set(option_name):
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


def show_config():
    """Show all the config options."""
    SKIP_SECTIONS = ("_test",)

    out = []
    out.append(
        _clean(
            """
        # Below are all the sections and options you can have in
        ~/.streamlit/config.toml.
    """
        )
    )

    def append_desc(text):
        out.append(click.style(text, bold=True))

    def append_comment(text):
        out.append(click.style(text))

    def append_section(text):
        out.append(click.style(text, bold=True, fg="green"))

    def append_setting(text):
        out.append(click.style(text, fg="green"))

    def append_newline():
        out.append("")

    for section, section_description in _section_descriptions.items():
        if section in SKIP_SECTIONS:
            continue

        append_newline()
        append_section("[%s]" % section)
        append_newline()

        for key, option in _config_options.items():
            if option.section != section:
                continue

            if option.visibility == "hidden":
                continue

            if option.is_expired():
                continue

            key = option.key.split(".")[1]
            description_paragraphs = _clean_paragraphs(option.description)

            for i, txt in enumerate(description_paragraphs):
                if i == 0:
                    append_desc("# %s" % txt)
                else:
                    append_comment("# %s" % txt)

            toml_default = toml.dumps({"default": option.default_val})
            toml_default = toml_default[10:].strip()

            if len(toml_default) > 0:
                append_comment("# Default: %s" % toml_default)
            else:
                # Don't say "Default: (unset)" here because this branch applies
                # to complex config settings too.
                pass

            if option.deprecated:
                append_comment("#")
                append_comment("# " + click.style("DEPRECATED.", fg="yellow"))
                append_comment(
                    "# %s" % "\n".join(_clean_paragraphs(option.deprecation_text))
                )
                append_comment(
                    "# This option will be removed on or after %s."
                    % option.expiration_date
                )
                append_comment("#")

            option_is_manually_set = (
                option.where_defined != ConfigOption.DEFAULT_DEFINITION
            )

            if option_is_manually_set:
                append_comment("# The value below was set in %s" % option.where_defined)

            toml_setting = toml.dumps({key: option.value})

            if len(toml_setting) == 0:
                toml_setting = "#%s =\n" % key

            append_setting(toml_setting)

    click.echo("\n".join(out))


# Load Config Files #


# Indicates that this was defined by the user.
_USER_DEFINED = "<user defined>"


def _set_option(key, value, where_defined):
    """Set a config option by key / value pair.

    Parameters
    ----------
    key : str
        The key of the option, like "logger.level".
    value
        The value of the option.
    where_defined : str
        Tells the config system where this was set.

    """
    assert key in _config_options, 'Key "%s" is not defined.' % key
    _config_options[key].set_value(value, where_defined)


def _update_config_with_toml(raw_toml, where_defined):
    """Update the config system by parsing this string.

    Parameters
    ----------
    raw_toml : str
        The TOML file to parse to update the config values.
    where_defined : str
        Tells the config system where this was set.

    """
    parsed_config_file = toml.loads(raw_toml)

    for section, options in parsed_config_file.items():
        for name, value in options.items():
            value = _maybe_read_env_variable(value)
            _set_option(
                "%(section)s.%(name)s" % {"section": section, "name": name},
                value,
                where_defined,
            )


def _maybe_read_env_variable(value):
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


def _maybe_convert_to_number(v):
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


def parse_config_file(force=False):
    """Parse the config file and update config parameters."""
    global _config_file_has_been_parsed

    if _config_file_has_been_parsed and force == False:
        return

    # Read ~/.streamlit/config.toml, and then overlay
    # $CWD/.streamlit/config.toml if it exists.
    config_filenames = [
        file_util.get_streamlit_file_path("config.toml"),
        file_util.get_project_streamlit_file_path("config.toml"),
    ]

    for filename in config_filenames:
        # Parse the config file.
        if not os.path.exists(filename):
            continue

        with open(filename, "r") as input:
            file_contents = input.read()

        _update_config_with_toml(file_contents, filename)

    _config_file_has_been_parsed = True
    _on_config_parsed.send()


def _clean_paragraphs(txt):
    paragraphs = txt.split("\n\n")
    cleaned_paragraphs = [_clean(x) for x in paragraphs]
    return cleaned_paragraphs


def _clean(txt):
    """Replace all whitespace with a single space."""
    return " ".join(txt.split()).strip()


def _check_conflicts():
    # Node-related conflicts

    # When using the Node server, we must always connect to 8501 (this is
    # hard-coded in JS). Otherwise, the browser would decide what port to
    # connect to based on either:
    #   1. window.location.port, which in dev is going to be (3000)
    #   2. the serverPort value in manifest.json, which would work, but only
    #   exists with server.liveSave.

    # Import logger locally to prevent circular references
    from streamlit.logger import get_logger

    LOGGER = get_logger(__name__)

    if get_option("global.developmentMode"):
        assert _is_unset(
            "server.port"
        ), "server.port does not work when global.developmentMode is true."

        assert _is_unset("browser.serverPort"), (
            "browser.serverPort does not work when global.developmentMode is " "true."
        )

    # Sharing-related conflicts

    if get_option("global.sharingMode") == "s3":
        assert is_manually_set("s3.bucket"), (
            'When global.sharingMode is set to "s3", ' "s3.bucket must also be set"
        )
        both_are_set = is_manually_set("s3.accessKeyId") and is_manually_set(
            "s3.secretAccessKey"
        )
        both_are_unset = _is_unset("s3.accessKeyId") and _is_unset("s3.secretAccessKey")
        assert both_are_set or both_are_unset, (
            "In config.toml, s3.accessKeyId and s3.secretAccessKey must "
            "either both be set or both be unset."
        )

        if is_manually_set("s3.url"):
            # If s3.url is set, ensure that it's an absolute URL.
            # An absolute URL starts with either `scheme://` or `//` --
            # if the configured URL does not start with either prefix,
            # prepend it with `//` to make it absolute. (If we don't do this,
            # and the user enters something like `url=myhost.com/reports`, the
            # browser will assume this is a relative URL, and will prepend
            # the hostname of the Streamlit instance to the configured URL.)
            s3_url = get_option("s3.url")
            parsed = urllib.parse.urlparse(s3_url)
            if parsed.netloc == "":
                _set_option("s3.url", "//" + s3_url, get_where_defined("s3.url"))

    elif get_option("global.sharingMode") == "file" and not get_option(
        "global.developmentMode"
    ):
        # Warn users that "sharingMode=file" probably isn't what they meant
        # to do.
        LOGGER.warning(
            "'sharingMode' is set to 'file', but Streamlit is not configured "
            "for development. This sharingMode is used for debugging "
            "Streamlit itself, and is not supported for other use-cases. "
            "\n\nTo remove this warning, set the 'sharingMode' option to "
            "another value, or remove it from your Streamlit config."
        )

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


def _set_development_mode():
    development.is_development_mode = get_option("global.developmentMode")


def on_config_parsed(func, force_connect=False):
    """Wait for the config file to be parsed then call func.

    If the config file has already been parsed, just calls fun immediately.

    """
    if force_connect or not _config_file_has_been_parsed:
        # weak=False, because we're using an anonymous lambda that
        # goes out of scope immediately.
        _on_config_parsed.connect(lambda _: func(), weak=False)
    else:
        func()


# Run _check_conflicts only once the config file is parsed in order to avoid
# loops.
on_config_parsed(_check_conflicts)
on_config_parsed(_set_development_mode)
