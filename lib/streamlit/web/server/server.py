# Copyright 2018-2022 Streamlit Inc.
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

import asyncio
import base64
import binascii
import errno
import json
import logging
import os
import socket
import sys
import time
from typing import (
    Any,
    Dict,
    Optional,
    Tuple,
    Callable,
    Awaitable,
    List,
    Union,
)

import click
import tornado.concurrent
import tornado.ioloop
import tornado.locks
import tornado.netutil
import tornado.web
import tornado.websocket
from tornado.httpserver import HTTPServer
from tornado.platform.asyncio import AsyncIOLoop
from tornado.websocket import WebSocketHandler

from streamlit import config
from streamlit import file_util
from streamlit import source_util
from streamlit import util
from streamlit.app_session import AppSession
from streamlit.components.v1.components import ComponentRegistry
from streamlit.config_option import ConfigOption
from streamlit.logger import get_logger
from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime import (
    Runtime,
    RuntimeConfig,
    SessionClient,
    SessionClientDisconnectedError,
    RuntimeState,
)
from streamlit.session_data import SessionData
from streamlit.state import (
    SCRIPT_RUN_WITHOUT_ERRORS_KEY,
)
from streamlit.watcher import LocalSourcesWatcher
from streamlit.web.server.routes import AddSlashHandler
from streamlit.web.server.routes import AssetsFileHandler
from streamlit.web.server.routes import DebugHandler
from streamlit.web.server.routes import HealthHandler
from streamlit.web.server.routes import MediaFileHandler
from streamlit.web.server.routes import MessageCacheHandler
from streamlit.web.server.routes import StaticFileHandler
from streamlit.web.server.server_util import get_max_message_size_bytes
from streamlit.web.server.server_util import is_url_from_allowed_origins
from streamlit.web.server.server_util import make_url_path_regex
from streamlit.web.server.server_util import serialize_forward_msg
from streamlit.web.server.upload_file_request_handler import (
    UploadFileRequestHandler,
    UPLOAD_FILE_ROUTE,
)
from .component_request_handler import ComponentRequestHandler
from .stats_request_handler import StatsRequestHandler

LOGGER = get_logger(__name__)

TORNADO_SETTINGS = {
    # Gzip HTTP responses.
    "compress_response": True,
    # Ping every 1s to keep WS alive.
    # 2021.06.22: this value was previously 20s, and was causing
    # connection instability for a small number of users. This smaller
    # ping_interval fixes that instability.
    # https://github.com/streamlit/streamlit/issues/3196
    "websocket_ping_interval": 1,
    # If we don't get a ping response within 30s, the connection
    # is timed out.
    "websocket_ping_timeout": 30,
}

# When server.port is not available it will look for the next available port
# up to MAX_PORT_SEARCH_RETRIES.
MAX_PORT_SEARCH_RETRIES = 100

# When server.address starts with this prefix, the server will bind
# to an unix socket.
UNIX_SOCKET_PREFIX = "unix://"

# Wait for the script run result for 60s and if no result is available give up
SCRIPT_RUN_CHECK_TIMEOUT = 60


class RetriesExceeded(Exception):
    pass


def server_port_is_manually_set() -> bool:
    return config.is_manually_set("server.port")


def server_address_is_unix_socket() -> bool:
    address = config.get_option("server.address")
    return address is not None and address.startswith(UNIX_SOCKET_PREFIX)


def start_listening(app: tornado.web.Application) -> None:
    """Makes the server start listening at the configured port.

    In case the port is already taken it tries listening to the next available
    port.  It will error after MAX_PORT_SEARCH_RETRIES attempts.

    """

    http_server = HTTPServer(
        app, max_buffer_size=config.get_option("server.maxUploadSize") * 1024 * 1024
    )

    if server_address_is_unix_socket():
        start_listening_unix_socket(http_server)
    else:
        start_listening_tcp_socket(http_server)


def start_listening_unix_socket(http_server: HTTPServer) -> None:
    address = config.get_option("server.address")
    file_name = os.path.expanduser(address[len(UNIX_SOCKET_PREFIX) :])

    unix_socket = tornado.netutil.bind_unix_socket(file_name)
    http_server.add_socket(unix_socket)


def start_listening_tcp_socket(http_server: HTTPServer) -> None:
    call_count = 0

    port = None
    while call_count < MAX_PORT_SEARCH_RETRIES:
        address = config.get_option("server.address")
        port = config.get_option("server.port")

        try:
            http_server.listen(port, address)
            break  # It worked! So let's break out of the loop.

        except (OSError, socket.error) as e:
            if e.errno == errno.EADDRINUSE:
                if server_port_is_manually_set():
                    LOGGER.error("Port %s is already in use", port)
                    sys.exit(1)
                else:
                    LOGGER.debug(
                        "Port %s already in use, trying to use the next one.", port
                    )
                    port += 1
                    # Save port 3000 because it is used for the development
                    # server in the front end.
                    if port == 3000:
                        port += 1

                    config.set_option(
                        "server.port", port, ConfigOption.STREAMLIT_DEFINITION
                    )
                    call_count += 1
            else:
                raise

    if call_count >= MAX_PORT_SEARCH_RETRIES:
        raise RetriesExceeded(
            f"Cannot start Streamlit server. Port {port} is already in use, and "
            f"Streamlit was unable to find a free port after {MAX_PORT_SEARCH_RETRIES} attempts.",
        )


class Server:
    def __init__(
        self, ioloop: AsyncIOLoop, main_script_path: str, command_line: Optional[str]
    ):
        """Create the server. It won't be started yet."""
        _set_tornado_log_levels()

        self._main_script_path = main_script_path

        self._ioloop = ioloop

        self._runtime = Runtime(
            ioloop.asyncio_loop,
            RuntimeConfig(
                script_path=main_script_path,
                command_line=command_line,
            ),
        )

    def __repr__(self) -> str:
        return util.repr_(self)

    @property
    def main_script_path(self) -> str:
        return self._main_script_path

    def start(self, on_started: Callable[["Server"], Any]) -> None:
        """Start the server.

        Parameters
        ----------
        on_started : callable
            A callback that will be called when the server's run-loop
            has started, and the server is ready to begin receiving clients.

        """

        LOGGER.debug("Starting server...")

        app = self._create_app()
        start_listening(app)

        port = config.get_option("server.port")

        LOGGER.debug("Server started on port %s", port)

        self._runtime.start(on_started=lambda: on_started(self))

    def _create_app(self) -> tornado.web.Application:
        """Create our tornado web app."""
        base = config.get_option("server.baseUrlPath")

        routes: List[Any] = [
            (
                make_url_path_regex(base, "stream"),
                _BrowserWebSocketHandler,
                dict(runtime=self._runtime),
            ),
            (
                make_url_path_regex(base, "healthz"),
                HealthHandler,
                dict(callback=lambda: self.is_ready_for_browser_connection),
            ),
            (make_url_path_regex(base, "debugz"), DebugHandler, dict(server=self)),
            (
                make_url_path_regex(base, "message"),
                MessageCacheHandler,
                dict(cache=self._runtime.message_cache),
            ),
            (
                make_url_path_regex(base, "st-metrics"),
                StatsRequestHandler,
                dict(stats_manager=self._runtime.stats_mgr),
            ),
            (
                make_url_path_regex(
                    base,
                    UPLOAD_FILE_ROUTE,
                ),
                UploadFileRequestHandler,
                dict(
                    file_mgr=self._runtime.uploaded_file_mgr,
                    is_active_session=self._runtime.is_active_session,
                ),
            ),
            (
                make_url_path_regex(base, "assets/(.*)"),
                AssetsFileHandler,
                {"path": "%s/" % file_util.get_assets_dir()},
            ),
            (make_url_path_regex(base, "media/(.*)"), MediaFileHandler, {"path": ""}),
            (
                make_url_path_regex(base, "component/(.*)"),
                ComponentRequestHandler,
                dict(registry=ComponentRegistry.instance()),
            ),
        ]

        if config.get_option("server.scriptHealthCheckEnabled"):
            routes.extend(
                [
                    (
                        make_url_path_regex(base, "script-health-check"),
                        HealthHandler,
                        dict(callback=lambda: self.does_script_run_without_error()),
                    )
                ]
            )

        if config.get_option("global.developmentMode"):
            LOGGER.debug("Serving static content from the Node dev server")
        else:
            static_path = file_util.get_static_dir()
            LOGGER.debug("Serving static content from %s", static_path)

            routes.extend(
                [
                    (
                        make_url_path_regex(base, "(.*)"),
                        StaticFileHandler,
                        {
                            "path": "%s/" % static_path,
                            "default_filename": "index.html",
                            "get_pages": lambda: set(
                                [
                                    page_info["page_name"]
                                    for page_info in source_util.get_pages(
                                        self.main_script_path
                                    ).values()
                                ]
                            ),
                        },
                    ),
                    (make_url_path_regex(base, trailing_slash=False), AddSlashHandler),
                ]
            )

        return tornado.web.Application(
            routes,
            cookie_secret=config.get_option("server.cookieSecret"),
            xsrf_cookies=config.get_option("server.enableXsrfProtection"),
            # Set the websocket message size. The default value is too low.
            websocket_max_message_size=get_max_message_size_bytes(),
            **TORNADO_SETTINGS,  # type: ignore[arg-type]
        )

    @property
    async def is_ready_for_browser_connection(self) -> Tuple[bool, str]:
        if self._runtime.state not in (
            RuntimeState.INITIAL,
            RuntimeState.STOPPING,
            RuntimeState.STOPPED,
        ):
            return True, "ok"

        return False, "unavailable"

    async def does_script_run_without_error(self) -> Tuple[bool, str]:
        """Load and execute the app's script to verify it runs without an error.

        Returns
        -------
        (True, "ok") if the script completes without error, or (False, err_msg)
        if the script raises an exception.
        """
        session_data = SessionData(self._main_script_path, self._command_line)
        local_sources_watcher = LocalSourcesWatcher(session_data)
        session = AppSession(
            event_loop=self._ioloop.asyncio_loop,
            session_data=session_data,
            uploaded_file_manager=self._runtime.uploaded_file_mgr,
            message_enqueued_callback=self._enqueued_some_message,
            local_sources_watcher=local_sources_watcher,
            user_info={"email": "test@test.com"},
        )

        try:
            session.request_rerun(None)

            now = time.perf_counter()
            while (
                SCRIPT_RUN_WITHOUT_ERRORS_KEY not in session.session_state
                and (time.perf_counter() - now) < SCRIPT_RUN_CHECK_TIMEOUT
            ):
                await asyncio.sleep(0.1)

            if SCRIPT_RUN_WITHOUT_ERRORS_KEY not in session.session_state:
                return False, "timeout"

            ok = session.session_state[SCRIPT_RUN_WITHOUT_ERRORS_KEY]
            msg = "ok" if ok else "error"

            return ok, msg
        finally:
            session.shutdown()

    @property
    def browser_is_connected(self) -> bool:
        return self._runtime.state == RuntimeState.ONE_OR_MORE_SESSIONS_CONNECTED

    @property
    def is_running_hello(self) -> bool:
        from streamlit.hello import Hello

        return self._main_script_path == Hello.__file__

    def stop(self, from_signal=False) -> None:
        click.secho("  Stopping...", fg="blue")
        self._runtime.stop()

    def _on_stopped(self) -> None:
        """Called when our runloop is exiting, to shut down the ioloop.
        This will end our process.

        (Tests can patch this method out, to prevent the test's ioloop
        from being shutdown.)
        """
        self._ioloop.stop()


class _BrowserWebSocketHandler(WebSocketHandler, SessionClient):
    """Handles a WebSocket connection from the browser"""

    def initialize(self, runtime: Runtime) -> None:
        self._runtime = runtime
        self._session_id: Optional[str] = None
        # The XSRF cookie is normally set when xsrf_form_html is used, but in a pure-Javascript application
        # that does not use any regular forms we just need to read the self.xsrf_token manually to set the
        # cookie as a side effect.
        # See https://www.tornadoweb.org/en/stable/guide/security.html#cross-site-request-forgery-protection
        # for more details.
        if config.get_option("server.enableXsrfProtection"):
            _ = self.xsrf_token

    def check_origin(self, origin: str) -> bool:
        """Set up CORS."""
        return super().check_origin(origin) or is_url_from_allowed_origins(origin)

    def write_forward_msg(self, msg: ForwardMsg) -> None:
        """Send a ForwardMsg to the browser."""
        try:
            self.write_message(serialize_forward_msg(msg), binary=True)
        except tornado.websocket.WebSocketClosedError as e:
            raise SessionClientDisconnectedError from e

    def open(self, *args, **kwargs) -> Optional[Awaitable[None]]:
        # Extract user info from the X-Streamlit-User header
        is_public_cloud_app = False

        try:
            header_content = self.request.headers["X-Streamlit-User"]
            payload = base64.b64decode(header_content)
            user_obj = json.loads(payload)
            email = user_obj["email"]
            is_public_cloud_app = user_obj["isPublicCloudApp"]
        except (KeyError, binascii.Error, json.decoder.JSONDecodeError):
            email = "test@localhost.com"

        user_info: Dict[str, Optional[str]] = dict()
        if is_public_cloud_app:
            user_info["email"] = None
        else:
            user_info["email"] = email

        self._session_id = self._runtime.create_session(self, user_info)
        return None

    def on_close(self) -> None:
        if not self._session_id:
            return
        self._runtime.close_session(self._session_id)
        self._session_id = None

    def get_compression_options(self) -> Optional[Dict[Any, Any]]:
        """Enable WebSocket compression.

        Returning an empty dict enables websocket compression. Returning
        None disables it.

        (See the docstring in the parent class.)
        """
        if config.get_option("server.enableWebsocketCompression"):
            return {}
        return None

    def on_message(self, payload: Union[str, bytes]) -> None:
        if not self._session_id:
            return

        msg = BackMsg()

        try:
            if isinstance(payload, str):
                # Sanity check. (The frontend should only be sending us bytes;
                # Protobuf.ParseFromString does not accept str input.)
                raise RuntimeError(
                    "WebSocket received an unexpected `str` message. "
                    "(We expect `bytes` only.)"
                )

            msg.ParseFromString(payload)
            LOGGER.debug("Received the following back message:\n%s", msg)

            if msg.WhichOneof("type") == "close_connection":
                # "close_connection" is a special developmentMode-only
                # message used in e2e tests to test disabling widgets.
                if config.get_option("global.developmentMode"):
                    self._runtime.stop()
                else:
                    LOGGER.warning(
                        "Client tried to close connection when "
                        "not in development mode"
                    )
            else:
                # AppSession handles all other BackMsg types.
                self._runtime.handle_backmsg(self._session_id, msg)

        except BaseException as e:
            LOGGER.error(e)
            self._session.handle_backmsg_exception(e)


def _set_tornado_log_levels() -> None:
    if not config.get_option("global.developmentMode"):
        # Hide logs unless they're super important.
        # Example of stuff we don't care about: 404 about .js.map files.
        logging.getLogger("tornado.access").setLevel(logging.ERROR)
        logging.getLogger("tornado.application").setLevel(logging.ERROR)
        logging.getLogger("tornado.general").setLevel(logging.ERROR)
