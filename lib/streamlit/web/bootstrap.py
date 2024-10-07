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

import asyncio
import os
import signal
import sys
from typing import Any, Final

from streamlit import cli_util, config, env_util, file_util, net_util, secrets
from streamlit.config import CONFIG_FILENAMES
from streamlit.git_util import MIN_GIT_VERSION, GitRepo
from streamlit.logger import get_logger
from streamlit.watcher import report_watchdog_availability, watch_file
from streamlit.web.server import Server, server_address_is_unix_socket, server_util

_LOGGER: Final = get_logger(__name__)


# The maximum possible total size of a static directory.
# We agreed on these limitations for the initial release of static file sharing,
# based on security concerns from the SiS and Community Cloud teams
MAX_APP_STATIC_FOLDER_SIZE = 1 * 1024 * 1024 * 1024  # 1 GB


def _set_up_signal_handler(server: Server) -> None:
    _LOGGER.debug("Setting up signal handler")

    def signal_handler(signal_number, stack_frame):
        # The server will shut down its threads and exit its loop.
        server.stop()

    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    if sys.platform == "win32":
        signal.signal(signal.SIGBREAK, signal_handler)
    else:
        signal.signal(signal.SIGQUIT, signal_handler)


def _fix_sys_path(main_script_path: str) -> None:
    """Add the script's folder to the sys path.

    Python normally does this automatically, but since we exec the script
    ourselves we need to do it instead.
    """
    sys.path.insert(0, os.path.dirname(main_script_path))


def _fix_tornado_crash() -> None:
    """Set default asyncio policy to be compatible with Tornado 6.

    Tornado 6 (at least) is not compatible with the default
    asyncio implementation on Windows. So here we
    pick the older SelectorEventLoopPolicy when the OS is Windows
    if the known-incompatible default policy is in use.

    This has to happen as early as possible to make it a low priority and
    overridable

    See: https://github.com/tornadoweb/tornado/issues/2608

    FIXME: if/when tornado supports the defaults in asyncio,
    remove and bump tornado requirement for py38
    """
    if env_util.IS_WINDOWS:
        try:
            from asyncio import (  # type: ignore[attr-defined]
                WindowsProactorEventLoopPolicy,
                WindowsSelectorEventLoopPolicy,
            )
        except ImportError:
            pass
            # Not affected
        else:
            if type(asyncio.get_event_loop_policy()) is WindowsProactorEventLoopPolicy:
                # WindowsProactorEventLoopPolicy is not compatible with
                # Tornado 6 fallback to the pre-3.8 default of Selector
                asyncio.set_event_loop_policy(WindowsSelectorEventLoopPolicy())


def _fix_sys_argv(main_script_path: str, args: list[str]) -> None:
    """sys.argv needs to exclude streamlit arguments and parameters
    and be set to what a user's script may expect.
    """
    import sys

    sys.argv = [main_script_path] + list(args)


def _on_server_start(server: Server) -> None:
    _maybe_print_old_git_warning(server.main_script_path)
    _maybe_print_static_folder_warning(server.main_script_path)
    _print_url(server.is_running_hello)
    report_watchdog_availability()

    # Load secrets.toml if it exists. If the file doesn't exist, this
    # function will return without raising an exception. We catch any parse
    # errors and display them here.
    try:
        secrets.load_if_toml_exists()
    except Exception as ex:
        _LOGGER.error("Failed to load secrets.toml file", exc_info=ex)

    def maybe_open_browser():
        if config.get_option("server.headless"):
            # Don't open browser when in headless mode.
            return

        if config.is_manually_set("browser.serverAddress"):
            addr = config.get_option("browser.serverAddress")
        elif config.is_manually_set("server.address"):
            if server_address_is_unix_socket():
                # Don't open browser when server address is an unix socket
                return
            addr = config.get_option("server.address")
        else:
            addr = "localhost"

        cli_util.open_browser(server_util.get_url(addr))

    # Schedule the browser to open on the main thread.
    asyncio.get_running_loop().call_soon(maybe_open_browser)


def _fix_pydeck_mapbox_api_warning() -> None:
    """Sets MAPBOX_API_KEY environment variable needed for PyDeck otherwise it will throw an exception"""

    os.environ["MAPBOX_API_KEY"] = config.get_option("mapbox.token")


def _maybe_print_static_folder_warning(main_script_path: str) -> None:
    """Prints a warning if the static folder is misconfigured."""

    if config.get_option("server.enableStaticServing"):
        static_folder_path = file_util.get_app_static_dir(main_script_path)
        if not os.path.isdir(static_folder_path):
            cli_util.print_to_cli(
                f"WARNING: Static file serving is enabled, but no static folder found "
                f"at {static_folder_path}. To disable static file serving, "
                f"set server.enableStaticServing to false.",
                fg="yellow",
            )
        else:
            # Raise warning when static folder size is larger than 1 GB
            static_folder_size = file_util.get_directory_size(static_folder_path)

            if static_folder_size > MAX_APP_STATIC_FOLDER_SIZE:
                config.set_option("server.enableStaticServing", False)
                cli_util.print_to_cli(
                    "WARNING: Static folder size is larger than 1GB. "
                    "Static file serving has been disabled.",
                    fg="yellow",
                )


def _print_url(is_running_hello: bool) -> None:
    if is_running_hello:
        title_message = "Welcome to Streamlit. Check out our demo in your browser."
    else:
        title_message = "You can now view your Streamlit app in your browser."

    named_urls = []

    if config.is_manually_set("browser.serverAddress"):
        named_urls = [
            ("URL", server_util.get_url(config.get_option("browser.serverAddress")))
        ]

    elif (
        config.is_manually_set("server.address") and not server_address_is_unix_socket()
    ):
        named_urls = [
            ("URL", server_util.get_url(config.get_option("server.address"))),
        ]

    elif server_address_is_unix_socket():
        named_urls = [
            ("Unix Socket", config.get_option("server.address")),
        ]

    else:
        named_urls = [
            ("Local URL", server_util.get_url("localhost")),
        ]

        internal_ip = net_util.get_internal_ip()
        if internal_ip:
            named_urls.append(("Network URL", server_util.get_url(internal_ip)))

        if config.get_option("server.headless"):
            external_ip = net_util.get_external_ip()
            if external_ip:
                named_urls.append(("External URL", server_util.get_url(external_ip)))

    cli_util.print_to_cli("")
    cli_util.print_to_cli("  %s" % title_message, fg="blue", bold=True)
    cli_util.print_to_cli("")

    for url_name, url in named_urls:
        cli_util.print_to_cli(f"  {url_name}: ", nl=False, fg="blue")
        cli_util.print_to_cli(url, bold=True)

    cli_util.print_to_cli("")

    if is_running_hello:
        cli_util.print_to_cli("  Ready to create your own Python apps super quickly?")
        cli_util.print_to_cli("  Head over to ", nl=False)
        cli_util.print_to_cli("https://docs.streamlit.io", bold=True)
        cli_util.print_to_cli("")
        cli_util.print_to_cli("  May you create awesome apps!")
        cli_util.print_to_cli("")
        cli_util.print_to_cli("")


def _maybe_print_old_git_warning(main_script_path: str) -> None:
    """If our script is running in a Git repo, and we're running a very old
    Git version, print a warning that Git integration will be unavailable.
    """
    repo = GitRepo(main_script_path)
    if (
        not repo.is_valid()
        and repo.git_version is not None
        and repo.git_version < MIN_GIT_VERSION
    ):
        git_version_string = ".".join(str(val) for val in repo.git_version)
        min_version_string = ".".join(str(val) for val in MIN_GIT_VERSION)
        cli_util.print_to_cli("")
        cli_util.print_to_cli("  Git integration is disabled.", fg="yellow", bold=True)
        cli_util.print_to_cli("")
        cli_util.print_to_cli(
            f"  Streamlit requires Git {min_version_string} or later, "
            f"but you have {git_version_string}.",
            fg="yellow",
        )
        cli_util.print_to_cli(
            "  Git is used by Streamlit Cloud (https://streamlit.io/cloud).",
            fg="yellow",
        )
        cli_util.print_to_cli(
            "  To enable this feature, please update Git.", fg="yellow"
        )


def load_config_options(flag_options: dict[str, Any]) -> None:
    """Load config options from config.toml files, then overlay the ones set by
    flag_options.

    The "streamlit run" command supports passing Streamlit's config options
    as flags. This function reads through the config options set via flag,
    massages them, and passes them to get_config_options() so that they
    overwrite config option defaults and those loaded from config.toml files.

    Parameters
    ----------
    flag_options : dict[str, Any]
        A dict of config options where the keys are the CLI flag version of the
        config option names.
    """
    # We want to filter out two things: values that are None, and values that
    # are empty tuples. The latter is a special case that indicates that the
    # no values were provided, and the config should reset to the default
    options_from_flags = {
        name.replace("_", "."): val
        for name, val in flag_options.items()
        if val is not None and val != ()
    }

    # Force a reparse of config files (if they exist). The result is cached
    # for future calls.
    config.get_config_options(force_reparse=True, options_from_flags=options_from_flags)


def _install_config_watchers(flag_options: dict[str, Any]) -> None:
    def on_config_changed(_path):
        load_config_options(flag_options)

    for filename in CONFIG_FILENAMES:
        if os.path.exists(filename):
            watch_file(filename, on_config_changed)


def run(
    main_script_path: str,
    is_hello: bool,
    args: list[str],
    flag_options: dict[str, Any],
) -> None:
    """Run a script in a separate thread and start a server for the app.

    This starts a blocking asyncio eventloop.
    """
    _fix_sys_path(main_script_path)
    _fix_tornado_crash()
    _fix_sys_argv(main_script_path, args)
    _fix_pydeck_mapbox_api_warning()
    _install_config_watchers(flag_options)

    # Create the server. It won't start running yet.
    server = Server(main_script_path, is_hello)

    async def run_server() -> None:
        # Start the server
        await server.start()
        _on_server_start(server)

        # Install a signal handler that will shut down the server
        # and close all our threads
        _set_up_signal_handler(server)

        # Wait until `Server.stop` is called, either by our signal handler, or
        # by a debug websocket session.
        await server.stopped

    # Run the server. This function will not return until the server is shut down.
    asyncio.run(run_server())
