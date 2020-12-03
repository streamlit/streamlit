# Copyright 2018-2020 Streamlit Inc.
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
import signal
import sys

import click
import tornado.ioloop
from streamlit.git_util import GitRepo, MIN_GIT_VERSION

from streamlit import config
from streamlit import net_util
from streamlit import url_util
from streamlit import env_util
from streamlit import util
from streamlit.report import Report
from streamlit.logger import get_logger
from streamlit.server.server import Server, server_address_is_unix_socket

LOGGER = get_logger(__name__)

# Wait for 1 second before opening a browser. This gives old tabs a chance to
# reconnect.
# This must be >= 2 * WebSocketConnection.ts#RECONNECT_WAIT_TIME_MS.
BROWSER_WAIT_TIMEOUT_SEC = 1


def _set_up_signal_handler():
    LOGGER.debug("Setting up signal handler")

    def signal_handler(signal_number, stack_frame):
        # The server will shut down its threads and stop the ioloop
        Server.get_current().stop()

    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    if sys.platform == "win32":
        signal.signal(signal.SIGBREAK, signal_handler)
    else:
        signal.signal(signal.SIGQUIT, signal_handler)


def _fix_sys_path(script_path):
    """Add the script's folder to the sys path.

    Python normally does this automatically, but since we exec the script
    ourselves we need to do it instead.
    """
    sys.path.insert(0, os.path.dirname(script_path))


def _fix_matplotlib_crash():
    """Set Matplotlib backend to avoid a crash.

    The default Matplotlib backend crashes Python on OSX when run on a thread
    that's not the main thread, so here we set a safer backend as a fix.
    Users can always disable this behavior by setting the config
    runner.fixMatplotlib = false.

    This fix is OS-independent. We didn't see a good reason to make this
    Mac-only. Consistency within Streamlit seemed more important.
    """
    if config.get_option("runner.fixMatplotlib"):
        try:
            # TODO: a better option may be to set
            #  os.environ["MPLBACKEND"] = "Agg". We'd need to do this towards
            #  the top of __init__.py, before importing anything that imports
            #  pandas (which imports matplotlib). Alternately, we could set
            #  this environment variable in a new entrypoint defined in
            #  setup.py. Both of these introduce additional trickiness: they
            #  need to run without consulting streamlit.config.get_option,
            #  because this would import streamlit, and therefore matplotlib.
            import matplotlib

            matplotlib.use("Agg")
        except ImportError:
            pass


def _fix_tornado_crash():
    """Set default asyncio policy to be compatible with Tornado 6.

    Tornado 6 (at least) is not compatible with the default
    asyncio implementation on Windows. So here we
    pick the older SelectorEventLoopPolicy when the OS is Windows
    if the known-incompatible default policy is in use.

    This has to happen as early as possible to make it a low priority and
    overrideable

    See: https://github.com/tornadoweb/tornado/issues/2608

    FIXME: if/when tornado supports the defaults in asyncio,
    remove and bump tornado requirement for py38
    """
    if env_util.IS_WINDOWS and sys.version_info >= (3, 8):
        import asyncio

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


def _fix_sys_argv(script_path, args):
    """sys.argv needs to exclude streamlit arguments and parameters
    and be set to what a user's script may expect.
    """
    import sys

    sys.argv = [script_path] + list(args)


def _on_server_start(server):
    _maybe_print_old_git_warning(server.script_path)
    _print_url(server.is_running_hello)

    def maybe_open_browser():
        if config.get_option("server.headless"):
            # Don't open browser when in headless mode.
            return

        if server.browser_is_connected:
            # Don't auto-open browser if there's already a browser connected.
            # This can happen if there's an old tab repeatedly trying to
            # connect, and it happens to success before we launch the browser.
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

        util.open_browser(Report.get_url(addr))

    # Schedule the browser to open using the IO Loop on the main thread, but
    # only if no other browser connects within 1s.
    ioloop = tornado.ioloop.IOLoop.current()
    ioloop.call_later(BROWSER_WAIT_TIMEOUT_SEC, maybe_open_browser)


def _fix_pydeck_mapbox_api_warning():
    """Sets MAPBOX_API_KEY environment variable needed for PyDeck otherwise it will throw an exception"""

    os.environ["MAPBOX_API_KEY"] = config.get_option("mapbox.token")


def _print_url(is_running_hello):
    if is_running_hello:
        title_message = "Welcome to Streamlit. Check out our demo in your browser."
    else:
        title_message = "You can now view your Streamlit app in your browser."

    named_urls = []

    if config.is_manually_set("browser.serverAddress"):
        named_urls = [
            ("URL", Report.get_url(config.get_option("browser.serverAddress")))
        ]

    elif (
        config.is_manually_set("server.address") and not server_address_is_unix_socket()
    ):
        named_urls = [
            ("URL", Report.get_url(config.get_option("server.address"))),
        ]

    elif config.get_option("server.headless"):
        internal_ip = net_util.get_internal_ip()
        if internal_ip:
            named_urls.append(("Network URL", Report.get_url(internal_ip)))

        external_ip = net_util.get_external_ip()
        if external_ip:
            named_urls.append(("External URL", Report.get_url(external_ip)))

    else:
        named_urls = [
            ("Local URL", Report.get_url("localhost")),
        ]

        internal_ip = net_util.get_internal_ip()
        if internal_ip:
            named_urls.append(("Network URL", Report.get_url(internal_ip)))

    click.secho("")
    click.secho("  %s" % title_message, fg="blue", bold=True)
    click.secho("")

    for url_name, url in named_urls:
        url_util.print_url(url_name, url)

    click.secho("")

    if is_running_hello:
        click.secho("  Ready to create your own Python apps super quickly?")
        click.secho("  Head over to ", nl=False)
        click.secho("https://docs.streamlit.io", bold=True)
        click.secho("")
        click.secho("  May you create awesome apps!")
        click.secho("")


def _maybe_print_old_git_warning(script_path: str) -> None:
    """If our script is running in a Git repo, and we're running a very old
    Git version, print a warning that Git integration will be unavailable.
    """
    repo = GitRepo(script_path)
    if (
        not repo.is_valid()
        and repo.git_version is not None
        and repo.git_version < MIN_GIT_VERSION
    ):
        git_version_string = ".".join(str(val) for val in repo.git_version)
        min_version_string = ".".join(str(val) for val in MIN_GIT_VERSION)
        click.secho("")
        click.secho("  Git integration is disabled.", fg="yellow", bold=True)
        click.secho("")
        click.secho(
            f"  Streamlit requires Git {min_version_string} or later, "
            f"but you have {git_version_string}.",
            fg="yellow",
        )
        click.secho(
            "  Git is used by Streamlit Sharing (https://streamlit.io/sharing).",
            fg="yellow",
        )
        click.secho("  To enable this feature, please update Git.", fg="yellow")


def run(script_path, command_line, args):
    """Run a script in a separate thread and start a server for the app.

    This starts a blocking ioloop.

    Parameters
    ----------
    script_path : str
    command_line : str
    args : [str]

    """
    _fix_sys_path(script_path)
    _fix_matplotlib_crash()
    _fix_tornado_crash()
    _fix_sys_argv(script_path, args)
    _fix_pydeck_mapbox_api_warning()

    # Install a signal handler that will shut down the ioloop
    # and close all our threads
    _set_up_signal_handler()

    ioloop = tornado.ioloop.IOLoop.current()

    # Create and start the server.
    server = Server(ioloop, script_path, command_line)
    server.start(_on_server_start)

    # (Must come after start(), because this starts a new thread and start()
    # may call sys.exit() which doesn't kill other threads.
    server.add_preheated_report_session()

    # Start the ioloop. This function will not return until the
    # server is shut down.
    ioloop.start()
