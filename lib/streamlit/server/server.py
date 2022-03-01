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
import logging
import os
import socket
import sys
import errno
import time
import traceback
import click
from enum import Enum
from typing import (
    Any,
    Dict,
    Optional,
    Tuple,
    Callable,
    Awaitable,
    Generator,
    List,
)

import tornado.concurrent
import tornado.gen
import tornado.ioloop
import tornado.locks
import tornado.netutil
import tornado.web
import tornado.websocket
from tornado.websocket import WebSocketHandler
from tornado.httpserver import HTTPServer
from tornado.ioloop import IOLoop

from streamlit import config
from streamlit import file_util
from streamlit import util
from streamlit.caching import get_memo_stats_provider, get_singleton_stats_provider
from streamlit.config_option import ConfigOption
from streamlit.forward_msg_cache import ForwardMsgCache
from streamlit.forward_msg_cache import create_reference_msg
from streamlit.forward_msg_cache import populate_hash_if_needed
from streamlit.in_memory_file_manager import in_memory_file_manager
from streamlit.legacy_caching.caching import _mem_caches
from streamlit.app_session import AppSession
from streamlit.stats import StatsHandler, StatsManager
from streamlit.uploaded_file_manager import UploadedFileManager
from streamlit.logger import get_logger
from streamlit.components.v1.components import ComponentRegistry
from streamlit.components.v1.components import ComponentRequestHandler
from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.server.upload_file_request_handler import (
    UploadFileRequestHandler,
    UPLOAD_FILE_ROUTE,
)

from streamlit.session_data import SessionData
from streamlit.state import (
    SCRIPT_RUN_WITHOUT_ERRORS_KEY,
    SessionStateStatProvider,
)
from streamlit.server.routes import AddSlashHandler
from streamlit.server.routes import AssetsFileHandler
from streamlit.server.routes import DebugHandler
from streamlit.server.routes import HealthHandler
from streamlit.server.routes import MediaFileHandler
from streamlit.server.routes import MessageCacheHandler
from streamlit.server.routes import StaticFileHandler
from streamlit.server.server_util import is_cacheable_msg
from streamlit.server.server_util import is_url_from_allowed_origins
from streamlit.server.server_util import make_url_path_regex
from streamlit.server.server_util import serialize_forward_msg
from streamlit.server.server_util import get_max_message_size_bytes
from streamlit.watcher.local_sources_watcher import LocalSourcesWatcher


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


class SessionInfo:
    """Type stored in our _session_info_by_id dict.

    For each AppSession, the server tracks that session's
    script_run_count. This is used to track the age of messages in
    the ForwardMsgCache.
    """

    def __init__(self, ws: WebSocketHandler, session: AppSession):
        """Initialize a SessionInfo instance.

        Parameters
        ----------
        session : AppSession
            The AppSession object.
        ws : _BrowserWebSocketHandler
            The websocket corresponding to this session.
        """
        self.session = session
        self.ws = ws
        self.script_run_count = 0

    def __repr__(self) -> str:
        return util.repr_(self)


class State(Enum):
    INITIAL = "INITIAL"
    WAITING_FOR_FIRST_BROWSER = "WAITING_FOR_FIRST_BROWSER"
    ONE_OR_MORE_BROWSERS_CONNECTED = "ONE_OR_MORE_BROWSERS_CONNECTED"
    NO_BROWSERS_CONNECTED = "NO_BROWSERS_CONNECTED"
    STOPPING = "STOPPING"
    STOPPED = "STOPPED"


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
    _singleton: Optional["Server"] = None

    @classmethod
    def get_current(cls) -> "Server":
        """
        Returns
        -------
        Server
            The singleton Server object.
        """
        if Server._singleton is None:
            raise RuntimeError("Server has not been initialized yet")

        return Server._singleton

    def __init__(
        self, ioloop: IOLoop, main_script_path: str, command_line: Optional[str]
    ):
        """Create the server. It won't be started yet."""
        if Server._singleton is not None:
            raise RuntimeError("Server already initialized. Use .get_current() instead")

        Server._singleton = self

        _set_tornado_log_levels()

        self._ioloop = ioloop
        self._main_script_path = main_script_path
        self._command_line = command_line if command_line is not None else ""

        # Mapping of AppSession.id -> SessionInfo.
        self._session_info_by_id: Dict[str, SessionInfo] = {}

        self._must_stop = tornado.locks.Event()
        self._state = State.INITIAL
        self._message_cache = ForwardMsgCache()
        self._uploaded_file_mgr = UploadedFileManager()
        self._uploaded_file_mgr.on_files_updated.connect(self.on_files_updated)
        self._session_data: Optional[SessionData] = None
        self._has_connection = tornado.locks.Condition()
        self._need_send_data = tornado.locks.Event()

        # StatsManager
        self._stats_mgr = StatsManager()
        self._stats_mgr.register_provider(get_memo_stats_provider())
        self._stats_mgr.register_provider(get_singleton_stats_provider())
        self._stats_mgr.register_provider(_mem_caches)
        self._stats_mgr.register_provider(self._message_cache)
        self._stats_mgr.register_provider(in_memory_file_manager)
        self._stats_mgr.register_provider(self._uploaded_file_mgr)
        self._stats_mgr.register_provider(
            SessionStateStatProvider(self._session_info_by_id)
        )

    def __repr__(self) -> str:
        return util.repr_(self)

    @property
    def main_script_path(self) -> str:
        return self._main_script_path

    def get_session_by_id(self, session_id: str) -> Optional[AppSession]:
        """Return the AppSession corresponding to the given id, or None if
        no such session exists."""
        session_info = self._get_session_info(session_id)
        if session_info is None:
            return None

        return session_info.session

    def on_files_updated(self, session_id: str) -> None:
        """Event handler for UploadedFileManager.on_file_added.
        Ensures that uploaded files from stale sessions get deleted.
        """
        session_info = self._get_session_info(session_id)
        if session_info is None:
            # If an uploaded file doesn't belong to an existing session,
            # remove it so it doesn't stick around forever.
            self._uploaded_file_mgr.remove_session_files(session_id)

    def _get_session_info(self, session_id: str) -> Optional[SessionInfo]:
        """Return the SessionInfo with the given id, or None if no such
        session exists.

        """
        return self._session_info_by_id.get(session_id, None)

    def start(self, on_started: Callable[["Server"], Any]) -> None:
        """Start the server.

        Parameters
        ----------
        on_started : callable
            A callback that will be called when the server's run-loop
            has started, and the server is ready to begin receiving clients.

        """
        if self._state != State.INITIAL:
            raise RuntimeError("Server has already been started")

        LOGGER.debug("Starting server...")

        app = self._create_app()
        start_listening(app)

        port = config.get_option("server.port")

        LOGGER.debug("Server started on port %s", port)

        self._ioloop.spawn_callback(self._loop_coroutine, on_started)

    def _create_app(self) -> tornado.web.Application:
        """Create our tornado web app."""
        base = config.get_option("server.baseUrlPath")

        routes: List[Any] = [
            (
                make_url_path_regex(base, "stream"),
                _BrowserWebSocketHandler,
                dict(server=self),
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
                dict(cache=self._message_cache),
            ),
            (
                make_url_path_regex(base, "st-metrics"),
                StatsHandler,
                dict(stats_manager=self._stats_mgr),
            ),
            (
                make_url_path_regex(
                    base,
                    UPLOAD_FILE_ROUTE,
                ),
                UploadFileRequestHandler,
                dict(
                    file_mgr=self._uploaded_file_mgr,
                    get_session_info=self._get_session_info,
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
                        {"path": "%s/" % static_path, "default_filename": "index.html"},
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

    def _set_state(self, new_state: State) -> None:
        LOGGER.debug("Server state: %s -> %s" % (self._state, new_state))
        self._state = new_state

    @property
    async def is_ready_for_browser_connection(self) -> Tuple[bool, str]:
        if self._state not in (State.INITIAL, State.STOPPING, State.STOPPED):
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
            ioloop=self._ioloop,
            session_data=session_data,
            uploaded_file_manager=self._uploaded_file_mgr,
            message_enqueued_callback=self._enqueued_some_message,
            local_sources_watcher=local_sources_watcher,
        )

        try:
            session.request_rerun(None)

            now = time.perf_counter()
            while (
                SCRIPT_RUN_WITHOUT_ERRORS_KEY not in session.session_state
                and (time.perf_counter() - now) < SCRIPT_RUN_CHECK_TIMEOUT
            ):
                await tornado.gen.sleep(0.1)

            if SCRIPT_RUN_WITHOUT_ERRORS_KEY not in session.session_state:
                return False, "timeout"

            ok = session.session_state[SCRIPT_RUN_WITHOUT_ERRORS_KEY]
            msg = "ok" if ok else "error"

            return ok, msg
        finally:
            session.shutdown()

    @property
    def browser_is_connected(self) -> bool:
        return self._state == State.ONE_OR_MORE_BROWSERS_CONNECTED

    @property
    def is_running_hello(self) -> bool:
        from streamlit.hello import hello

        return self._main_script_path == hello.__file__

    @tornado.gen.coroutine
    def _loop_coroutine(
        self, on_started: Optional[Callable[["Server"], Any]] = None
    ) -> Generator[Any, None, None]:
        try:
            if self._state == State.INITIAL:
                self._set_state(State.WAITING_FOR_FIRST_BROWSER)
            elif self._state == State.ONE_OR_MORE_BROWSERS_CONNECTED:
                pass
            else:
                raise RuntimeError("Bad server state at start: %s" % self._state)

            if on_started is not None:
                on_started(self)

            while not self._must_stop.is_set():

                if self._state == State.WAITING_FOR_FIRST_BROWSER:
                    yield tornado.gen.convert_yielded(
                        asyncio.wait(
                            [self._must_stop.wait(), self._has_connection.wait()],
                            return_when=asyncio.FIRST_COMPLETED,
                        )
                    )

                elif self._state == State.ONE_OR_MORE_BROWSERS_CONNECTED:
                    self._need_send_data.clear()

                    # Shallow-clone our sessions into a list, so we can iterate
                    # over it and not worry about whether it's being changed
                    # outside this coroutine.
                    session_infos = list(self._session_info_by_id.values())

                    for session_info in session_infos:
                        msg_list = session_info.session.flush_browser_queue()
                        for msg in msg_list:
                            try:
                                self._send_message(session_info, msg)
                            except tornado.websocket.WebSocketClosedError:
                                self._close_app_session(session_info.session.id)
                            yield
                        yield
                    yield tornado.gen.sleep(0.01)

                elif self._state == State.NO_BROWSERS_CONNECTED:
                    yield tornado.gen.convert_yielded(
                        asyncio.wait(
                            [self._must_stop.wait(), self._has_connection.wait()],
                            return_when=asyncio.FIRST_COMPLETED,
                        )
                    )

                else:
                    # Break out of the thread loop if we encounter any other state.
                    break

                yield tornado.gen.convert_yielded(
                    asyncio.wait(
                        [self._must_stop.wait(), self._need_send_data.wait()],
                        return_when=asyncio.FIRST_COMPLETED,
                    )
                )

            # Shut down all AppSessions
            for session_info in list(self._session_info_by_id.values()):
                session_info.session.shutdown()

            self._set_state(State.STOPPED)

        except Exception:
            # Can't just re-raise here because co-routines use Tornado
            # exceptions for control flow, which appears to swallow the reraised
            # exception.
            traceback.print_exc()
            LOGGER.info(
                """
Please report this bug at https://github.com/streamlit/streamlit/issues.
"""
            )

        finally:
            self._on_stopped()

    def _send_message(self, session_info: SessionInfo, msg: ForwardMsg) -> None:
        """Send a message to a client.

        If the client is likely to have already cached the message, we may
        instead send a "reference" message that contains only the hash of the
        message.

        Parameters
        ----------
        session_info : SessionInfo
            The SessionInfo associated with websocket
        msg : ForwardMsg
            The message to send to the client

        """
        msg.metadata.cacheable = is_cacheable_msg(msg)
        msg_to_send = msg
        if msg.metadata.cacheable:
            populate_hash_if_needed(msg)

            if self._message_cache.has_message_reference(
                msg, session_info.session, session_info.script_run_count
            ):
                # This session has probably cached this message. Send
                # a reference instead.
                LOGGER.debug("Sending cached message ref (hash=%s)" % msg.hash)
                msg_to_send = create_reference_msg(msg)

            # Cache the message so it can be referenced in the future.
            # If the message is already cached, this will reset its
            # age.
            LOGGER.debug("Caching message (hash=%s)" % msg.hash)
            self._message_cache.add_message(
                msg, session_info.session, session_info.script_run_count
            )

        # If this was a `script_finished` message, we increment the
        # script_run_count for this session, and update the cache
        if (
            msg.WhichOneof("type") == "script_finished"
            and msg.script_finished == ForwardMsg.FINISHED_SUCCESSFULLY
        ):
            LOGGER.debug(
                "Script run finished successfully; "
                "removing expired entries from MessageCache "
                "(max_age=%s)",
                config.get_option("global.maxCachedMessageAge"),
            )
            session_info.script_run_count += 1
            self._message_cache.remove_expired_session_entries(
                session_info.session, session_info.script_run_count
            )

        # Ship it off!
        session_info.ws.write_message(serialize_forward_msg(msg_to_send), binary=True)

    def _enqueued_some_message(self) -> None:
        self._ioloop.add_callback(self._need_send_data.set)

    def stop(self, from_signal=False) -> None:
        click.secho("  Stopping...", fg="blue")
        self._set_state(State.STOPPING)
        if from_signal:
            self._ioloop.add_callback_from_signal(self._must_stop.set)
        else:
            self._ioloop.add_callback(self._must_stop.set)

    def _on_stopped(self) -> None:
        """Called when our runloop is exiting, to shut down the ioloop.
        This will end our process.

        (Tests can patch this method out, to prevent the test's ioloop
        from being shutdown.)
        """
        self._ioloop.stop()

    def _create_app_session(self, ws: WebSocketHandler) -> AppSession:
        """Register a connected browser with the server.

        Parameters
        ----------
        ws : _BrowserWebSocketHandler
            The newly-connected websocket handler.

        Returns
        -------
        AppSession
            The newly-created AppSession for this browser connection.

        """
        session_data = SessionData(self._main_script_path, self._command_line)
        local_sources_watcher = LocalSourcesWatcher(session_data)
        session = AppSession(
            ioloop=self._ioloop,
            session_data=session_data,
            uploaded_file_manager=self._uploaded_file_mgr,
            message_enqueued_callback=self._enqueued_some_message,
            local_sources_watcher=local_sources_watcher,
        )

        LOGGER.debug(
            "Created new session for ws %s. Session ID: %s", id(ws), session.id
        )

        assert (
            session.id not in self._session_info_by_id
        ), f"session.id '{session.id}' registered multiple times!"

        self._session_info_by_id[session.id] = SessionInfo(ws, session)
        self._set_state(State.ONE_OR_MORE_BROWSERS_CONNECTED)
        self._has_connection.notify_all()

        return session

    def _close_app_session(self, session_id: str) -> None:
        """Shutdown and remove a AppSession.

        This function may be called multiple times for the same session,
        which is not an error. (Subsequent calls just no-op.)

        Parameters
        ----------
        session_id : str
            The AppSession's id string.
        """
        if session_id in self._session_info_by_id:
            session_info = self._session_info_by_id[session_id]
            del self._session_info_by_id[session_id]
            session_info.session.shutdown()

        if len(self._session_info_by_id) == 0:
            self._set_state(State.NO_BROWSERS_CONNECTED)


class _BrowserWebSocketHandler(WebSocketHandler):
    """Handles a WebSocket connection from the browser"""

    def initialize(self, server):
        self._server = server
        self._session = None
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

    def open(self, *args, **kwargs) -> Optional[Awaitable[None]]:
        self._session = self._server._create_app_session(self)
        return None

    def on_close(self) -> None:
        if not self._session:
            return
        self._server._close_app_session(self._session.id)
        self._session = None

    def get_compression_options(self) -> Optional[Dict[Any, Any]]:
        """Enable WebSocket compression.

        Returning an empty dict enables websocket compression. Returning
        None disables it.

        (See the docstring in the parent class.)
        """
        if config.get_option("server.enableWebsocketCompression"):
            return {}
        return None

    @tornado.gen.coroutine
    def on_message(self, payload: bytes) -> None:
        if not self._session:
            return

        msg = BackMsg()

        try:
            msg.ParseFromString(payload)
            msg_type = msg.WhichOneof("type")

            LOGGER.debug("Received the following back message:\n%s", msg)

            if msg_type == "rerun_script":
                self._session.handle_rerun_script_request(msg.rerun_script)
            elif msg_type == "load_git_info":
                self._session.handle_git_information_request()
            elif msg_type == "clear_cache":
                self._session.handle_clear_cache_request()
            elif msg_type == "set_run_on_save":
                self._session.handle_set_run_on_save_request(msg.set_run_on_save)
            elif msg_type == "stop_script":
                self._session.handle_stop_script_request()
            elif msg_type == "close_connection":
                if config.get_option("global.developmentMode"):
                    Server.get_current().stop()
                else:
                    LOGGER.warning(
                        "Client tried to close connection when "
                        "not in development mode"
                    )
            else:
                LOGGER.warning('No handler for "%s"', msg_type)

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
