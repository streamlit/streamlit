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

import logging
import os
import threading
import socket
import sys
import errno
import traceback
import click
from enum import Enum
from typing import Any, Dict, Optional, TYPE_CHECKING

import tornado.concurrent
import tornado.gen
import tornado.ioloop
import tornado.netutil
import tornado.web
import tornado.websocket

from streamlit import config
from streamlit import file_util
from streamlit.config_option import ConfigOption
from streamlit.forward_msg_cache import ForwardMsgCache
from streamlit.forward_msg_cache import create_reference_msg
from streamlit.forward_msg_cache import populate_hash_if_needed
from streamlit.report_session import ReportSession
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
from streamlit.server.routes import AddSlashHandler
from streamlit.server.routes import AssetsFileHandler
from streamlit.server.routes import DebugHandler
from streamlit.server.routes import HealthHandler
from streamlit.server.routes import MediaFileHandler
from streamlit.server.routes import MessageCacheHandler
from streamlit.server.routes import MetricsHandler
from streamlit.server.routes import StaticFileHandler
from streamlit.server.server_util import MESSAGE_SIZE_LIMIT
from streamlit.server.server_util import is_cacheable_msg
from streamlit.server.server_util import is_url_from_allowed_origins
from streamlit.server.server_util import make_url_path_regex
from streamlit.server.server_util import serialize_forward_msg

if TYPE_CHECKING:
    from streamlit.report import Report

LOGGER = get_logger(__name__)


TORNADO_SETTINGS = {
    "compress_response": True,  # Gzip HTTP responses.
    "websocket_ping_interval": 20,  # Ping every 20s to keep WS alive.
    "websocket_ping_timeout": 30,  # Pings should be responded to within 30s.
    "websocket_max_message_size": MESSAGE_SIZE_LIMIT,  # Up the WS size limit.
}


# When server.port is not available it will look for the next available port
# up to MAX_PORT_SEARCH_RETRIES.
MAX_PORT_SEARCH_RETRIES = 100

# When server.address starts with this prefix, the server will bind
# to an unix socket.
UNIX_SOCKET_PREFIX = "unix://"


class SessionInfo(object):
    """Type stored in our _session_info_by_id dict.

    For each ReportSession, the server tracks that session's
    report_run_count. This is used to track the age of messages in
    the ForwardMsgCache.
    """

    def __init__(self, ws, session):
        """Initialize a SessionInfo instance.

        Parameters
        ----------
        session : ReportSession
            The ReportSession object.
        ws : _BrowserWebSocketHandler
            The websocket that owns this report.
        """
        self.session = session
        self.ws = ws
        self.report_run_count = 0


class State(Enum):
    INITIAL = "INITIAL"
    WAITING_FOR_FIRST_BROWSER = "WAITING_FOR_FIRST_BROWSER"
    ONE_OR_MORE_BROWSERS_CONNECTED = "ONE_OR_MORE_BROWSERS_CONNECTED"
    NO_BROWSERS_CONNECTED = "NO_BROWSERS_CONNECTED"
    STOPPING = "STOPPING"
    STOPPED = "STOPPED"


class RetriesExceeded(Exception):
    pass


def server_port_is_manually_set():
    return config.is_manually_set("server.port")


def server_address_is_unix_socket():
    address = config.get_option("server.address")
    return address and address.startswith(UNIX_SOCKET_PREFIX)


def start_listening(app):
    """Makes the server start listening at the configured port.

    In case the port is already taken it tries listening to the next available
    port.  It will error after MAX_PORT_SEARCH_RETRIES attempts.

    """

    http_server = tornado.httpserver.HTTPServer(
        app, max_buffer_size=config.get_option("server.maxUploadSize") * 1024 * 1024
    )

    if server_address_is_unix_socket():
        start_listening_unix_socket(http_server)
    else:
        start_listening_tcp_socket(http_server)


def start_listening_unix_socket(http_server):
    address = config.get_option("server.address")
    file_name = os.path.expanduser(address[len(UNIX_SOCKET_PREFIX) :])

    unix_socket = tornado.netutil.bind_unix_socket(file_name)
    http_server.add_socket(unix_socket)


def start_listening_tcp_socket(http_server):
    call_count = 0

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

                    config._set_option(
                        "server.port", port, ConfigOption.STREAMLIT_DEFINITION
                    )
                    call_count += 1
            else:
                raise

    if call_count >= MAX_PORT_SEARCH_RETRIES:
        raise RetriesExceeded(
            "Cannot start Streamlit server. Port %s is already in use, and "
            "Streamlit was unable to find a free port after %s attempts.",
            port,
            MAX_PORT_SEARCH_RETRIES,
        )


class Server(object):

    _singleton = None  # type: Optional[Server]

    @classmethod
    def get_current(cls):
        """
        Returns
        -------
        Server
            The singleton Server object.
        """
        if cls._singleton is None:
            raise RuntimeError("Server has not been initialized yet")

        return Server._singleton

    def __init__(
        self, ioloop: tornado.ioloop.IOLoop, script_path: str, command_line: str
    ):
        """Create the server. It won't be started yet."""
        if Server._singleton is not None:
            raise RuntimeError("Server already initialized. Use .get_current() instead")

        Server._singleton = self

        _set_tornado_log_levels()

        self._ioloop = ioloop
        self._script_path = script_path
        self._command_line = command_line

        # Mapping of ReportSession.id -> SessionInfo.
        self._session_info_by_id = {}  # type: Dict[str, SessionInfo]

        self._must_stop = threading.Event()
        self._state = None
        self._set_state(State.INITIAL)
        self._message_cache = ForwardMsgCache()
        self._uploaded_file_mgr = UploadedFileManager()
        self._uploaded_file_mgr.on_files_updated.connect(self.on_files_updated)
        self._report = None  # type: Optional[Report]
        self._preheated_session_id = None  # type: Optional[str]

    @property
    def script_path(self) -> str:
        return self._script_path

    def on_files_updated(self, session_id):
        """Event handler for UploadedFileManager.on_file_added.

        When a file is uploaded by a user, schedule a re-run of the
        corresponding ReportSession.

        Parameters
        ----------
        file : File
            The file that was just uploaded.

        """
        session_info = self._get_session_info(session_id)
        if session_info is not None:
            session_info.session.request_rerun()
        else:
            # If an uploaded file doesn't belong to an existing session,
            # remove it so it doesn't stick around forever.
            self._uploaded_file_mgr.remove_session_files(session_id)

    def _get_session_info(self, session_id):
        """Return the SessionInfo with the given id, or None if no such
        session exists.

        Parameters
        ----------
        session_id : str

        Returns
        -------
        SessionInfo or None

        """
        return self._session_info_by_id.get(session_id, None)

    def start(self, on_started):
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

    def get_debug(self) -> Dict[str, Dict[str, Any]]:
        if self._report:
            return {"report": self._report.get_debug()}
        return {}

    def _create_app(self):
        """Create our tornado web app.

        Returns
        -------
        tornado.web.Application

        """
        base = config.get_option("server.baseUrlPath")
        routes = [
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
            (make_url_path_regex(base, "metrics"), MetricsHandler),
            (
                make_url_path_regex(base, "message"),
                MessageCacheHandler,
                dict(cache=self._message_cache),
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
            routes,  # type: ignore[arg-type]
            cookie_secret=config.get_option("server.cookieSecret"),
            xsrf_cookies=config.get_option("server.enableXsrfProtection"),
            **TORNADO_SETTINGS,  # type: ignore[arg-type]
        )

    def _set_state(self, new_state):
        LOGGER.debug("Server state: %s -> %s" % (self._state, new_state))
        self._state = new_state

    @property
    def is_ready_for_browser_connection(self):
        return self._state not in (State.INITIAL, State.STOPPING, State.STOPPED)

    @property
    def browser_is_connected(self):
        return self._state == State.ONE_OR_MORE_BROWSERS_CONNECTED

    @property
    def is_running_hello(self):
        from streamlit.hello import hello

        return self._script_path == hello.__file__

    @tornado.gen.coroutine
    def _loop_coroutine(self, on_started=None):
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
                    pass

                elif self._state == State.ONE_OR_MORE_BROWSERS_CONNECTED:

                    # Shallow-clone our sessions into a list, so we can iterate
                    # over it and not worry about whether it's being changed
                    # outside this coroutine.
                    session_infos = list(self._session_info_by_id.values())

                    for session_info in session_infos:
                        if session_info.ws is None:
                            # Preheated.
                            continue
                        msg_list = session_info.session.flush_browser_queue()
                        for msg in msg_list:
                            try:
                                self._send_message(session_info, msg)
                            except tornado.websocket.WebSocketClosedError:
                                self._close_report_session(session_info.session.id)
                            yield
                        yield

                elif self._state == State.NO_BROWSERS_CONNECTED:
                    pass

                else:
                    # Break out of the thread loop if we encounter any other state.
                    break

                yield tornado.gen.sleep(0.01)

            # Shut down all ReportSessions
            for session_info in list(self._session_info_by_id.values()):
                session_info.session.shutdown()

            self._set_state(State.STOPPED)

        except Exception as e:
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

    def _send_message(self, session_info, msg):
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
                msg, session_info.session, session_info.report_run_count
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
                msg, session_info.session, session_info.report_run_count
            )

        # If this was a `report_finished` message, we increment the
        # report_run_count for this session, and update the cache
        if (
            msg.WhichOneof("type") == "report_finished"
            and msg.report_finished == ForwardMsg.FINISHED_SUCCESSFULLY
        ):
            LOGGER.debug(
                "Report finished successfully; "
                "removing expired entries from MessageCache "
                "(max_age=%s)",
                config.get_option("global.maxCachedMessageAge"),
            )
            session_info.report_run_count += 1
            self._message_cache.remove_expired_session_entries(
                session_info.session, session_info.report_run_count
            )

        # Ship it off!
        session_info.ws.write_message(serialize_forward_msg(msg_to_send), binary=True)

    def stop(self):
        click.secho("  Stopping...", fg="blue")
        self._set_state(State.STOPPING)
        self._must_stop.set()

    def _on_stopped(self):
        """Called when our runloop is exiting, to shut down the ioloop.
        This will end our process.

        (Tests can patch this method out, to prevent the test's ioloop
        from being shutdown.)
        """
        self._ioloop.stop()

    def add_preheated_report_session(self):
        """Register a fake browser with the server and run the script.

        This is used to start running the user's script even before the first
        browser connects.
        """
        session = self._create_or_reuse_report_session(ws=None)
        session.handle_rerun_script_request(is_preheat=True)

    def _create_or_reuse_report_session(self, ws):
        """Register a connected browser with the server.

        Parameters
        ----------
        ws : _BrowserWebSocketHandler or None
            The newly-connected websocket handler or None if preheated
            connection.

        Returns
        -------
        ReportSession
            The newly-created ReportSession for this browser connection.

        """
        if self._preheated_session_id is not None:
            assert len(self._session_info_by_id) == 1
            assert ws is not None

            session_id = self._preheated_session_id
            self._preheated_session_id = None

            session_info = self._session_info_by_id[session_id]
            session_info.ws = ws
            session = session_info.session

            LOGGER.debug(
                "Reused preheated session for ws %s. Session ID: %s", id(ws), session_id
            )

        else:
            session = ReportSession(
                ioloop=self._ioloop,
                script_path=self._script_path,
                command_line=self._command_line,
                uploaded_file_manager=self._uploaded_file_mgr,
            )

            LOGGER.debug(
                "Created new session for ws %s. Session ID: %s", id(ws), session.id
            )

            assert session.id not in self._session_info_by_id, (
                "session.id '%s' registered multiple times!" % session.id
            )

        self._session_info_by_id[session.id] = SessionInfo(ws, session)

        if ws is None:
            self._preheated_session_id = session.id
        else:
            self._set_state(State.ONE_OR_MORE_BROWSERS_CONNECTED)

        return session

    def _close_report_session(self, session_id):
        """Shutdown and remove a ReportSession.

        This function may be called multiple times for the same session,
        which is not an error. (Subsequent calls just no-op.)

        Parameters
        ----------
        session_id : str
            The ReportSession's id string.
        """
        if session_id in self._session_info_by_id:
            session_info = self._session_info_by_id[session_id]
            del self._session_info_by_id[session_id]
            session_info.session.shutdown()

        if len(self._session_info_by_id) == 0:
            self._set_state(State.NO_BROWSERS_CONNECTED)


class _BrowserWebSocketHandler(tornado.websocket.WebSocketHandler):
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
            self.xsrf_token

    def check_origin(self, origin):
        """Set up CORS."""
        return super().check_origin(origin) or is_url_from_allowed_origins(origin)

    def open(self):
        self._session = self._server._create_or_reuse_report_session(self)

    def on_close(self):
        if not self._session:
            return
        self._server._close_report_session(self._session.id)
        self._session = None

    def get_compression_options(self):
        """Enable WebSocket compression.

        Returning an empty dict enables websocket compression. Returning
        None disables it.

        (See the docstring in the parent class.)
        """
        if config.get_option("server.enableWebsocketCompression"):
            return {}
        return None

    @tornado.gen.coroutine
    def on_message(self, payload):
        if not self._session:
            return

        msg = BackMsg()

        try:
            msg.ParseFromString(payload)
            msg_type = msg.WhichOneof("type")

            LOGGER.debug("Received the following back message:\n%s", msg)

            if msg_type == "cloud_upload":
                yield self._session.handle_save_request(self)
            elif msg_type == "rerun_script":
                self._session.handle_rerun_script_request(msg.rerun_script)
            elif msg_type == "clear_cache":
                self._session.handle_clear_cache_request()
            elif msg_type == "set_run_on_save":
                self._session.handle_set_run_on_save_request(msg.set_run_on_save)
            elif msg_type == "stop_report":
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
            self._session.enqueue_exception(e)


def _set_tornado_log_levels():
    if not config.get_option("global.developmentMode"):
        # Hide logs unless they're super important.
        # Example of stuff we don't care about: 404 about .js.map files.
        logging.getLogger("tornado.access").setLevel(logging.ERROR)
        logging.getLogger("tornado.application").setLevel(logging.ERROR)
        logging.getLogger("tornado.general").setLevel(logging.ERROR)
