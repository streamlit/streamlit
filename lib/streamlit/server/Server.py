# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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
import threading
from enum import Enum

import tornado.concurrent
import tornado.gen
import tornado.ioloop
import tornado.web
import tornado.websocket

from streamlit import config
from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit import util
from streamlit.ReportSession import ReportSession
from streamlit.logger import get_logger
from streamlit.server.routes import DebugHandler
from streamlit.server.routes import HealthHandler
from streamlit.server.routes import MetricsHandler
from streamlit.server.routes import StaticFileHandler
from streamlit.server.server_util import MESSAGE_SIZE_LIMIT
from streamlit.server.server_util import is_url_from_allowed_origins
from streamlit.server.server_util import serialize_forward_msg

LOGGER = get_logger(__name__)


TORNADO_SETTINGS = {
    "compress_response": True,  # Gzip HTTP responses.
    "websocket_ping_interval": 20,  # Ping every 20s to keep WS alive.
    "websocket_ping_timeout": 30,  # Pings should be responded to within 30s.
    "websocket_max_message_size": MESSAGE_SIZE_LIMIT,  # Up the WS size limit.
}


# Dictionary key used to mark the script execution context that starts
# up before the first browser connects.
PREHEATED_REPORT_SESSION = "PREHEATED_REPORT_SESSION"


class State(Enum):
    INITIAL = "INITIAL"
    WAITING_FOR_FIRST_BROWSER = "WAITING_FOR_FIRST_BROWSER"
    ONE_OR_MORE_BROWSERS_CONNECTED = "ONE_OR_MORE_BROWSERS_CONNECTED"
    NO_BROWSERS_CONNECTED = "NO_BROWSERS_CONNECTED"
    STOPPING = "STOPPING"
    STOPPED = "STOPPED"


class Server(object):

    _singleton = None

    @classmethod
    def get_current(cls):
        """Return the singleton instance."""
        if cls._singleton is None:
            raise RuntimeError("Server has not been initialized yet")

        return Server._singleton

    def __init__(self, ioloop, script_path, script_argv):
        """Create the server. It won't be started yet.

        Parameters
        ----------
        ioloop : tornado.ioloop.IOLoop
        script_path : str
        script_argv : List[str]

        """
        if Server._singleton is not None:
            raise RuntimeError("Server already initialized. Use .get_current() instead")

        Server._singleton = self

        _set_tornado_log_levels()

        self._ioloop = ioloop
        self._script_path = script_path
        self._script_argv = script_argv

        # Mapping of WebSocket->ReportSession.
        self._report_sessions = {}

        self._must_stop = threading.Event()
        self._state = None
        self._set_state(State.INITIAL)

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
        port = config.get_option("server.port")
        app.listen(port)
        LOGGER.debug("Server started on port %s", port)

        self._ioloop.spawn_callback(self._loop_coroutine, on_started)

    def get_debug(self):
        return {"report": self._report.get_debug()}

    def _create_app(self):
        """Create our tornado web app.

        Returns
        -------
        tornado.web.Application

        """
        routes = [
            (r"/stream", _BrowserWebSocketHandler, dict(server=self)),
            (
                r"/healthz",
                HealthHandler,
                dict(health_check=lambda: self.is_ready_for_browser_connection),
            ),
            (r"/debugz", DebugHandler, dict(server=self)),
            (r"/metrics", MetricsHandler),
        ]

        if config.get_option("global.developmentMode") and config.get_option(
            "global.useNode"
        ):
            LOGGER.debug("Serving static content from the Node dev server")
        else:
            static_path = util.get_static_dir()
            LOGGER.debug("Serving static content from %s", static_path)

            routes.extend(
                [
                    (
                        r"/()$",
                        StaticFileHandler,
                        {"path": "%s/index.html" % static_path},
                    ),
                    (r"/(.*)", StaticFileHandler, {"path": "%s/" % static_path}),
                ]
            )

        return tornado.web.Application(routes, **TORNADO_SETTINGS)

    def _set_state(self, new_state):
        LOGGER.debug("Server state: %s -> %s" % (self._state, new_state))
        self._state = new_state

    @property
    def is_ready_for_browser_connection(self):
        return self._state not in (State.INITIAL, State.STOPPING, State.STOPPED)

    @property
    def browser_is_connected(self):
        return self._state == State.ONE_OR_MORE_BROWSERS_CONNECTED

    @tornado.gen.coroutine
    def _loop_coroutine(self, on_started=None):
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
                ws_session_pairs = list(self._report_sessions.items())

                for ws, session in ws_session_pairs:
                    if ws is PREHEATED_REPORT_SESSION:
                        continue
                    if ws is None:
                        continue
                    msg_list = session.flush_browser_queue()
                    for msg in msg_list:
                        msg_str = serialize_forward_msg(msg)
                        try:
                            ws.write_message(msg_str, binary=True)
                        except tornado.websocket.WebSocketClosedError:
                            self._remove_browser_connection(ws)
                        yield
                    yield

            elif self._state == State.NO_BROWSERS_CONNECTED:
                pass

            else:
                # Break out of the thread loop if we encounter any other state.
                break

            yield tornado.gen.sleep(0.01)

        # Shut down all ReportSessions
        for session in list(self._report_sessions.values()):
            session.shutdown()

        self._set_state(State.STOPPED)

        self._on_stopped()

    def stop(self):
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
        session = self._add_browser_connection(PREHEATED_REPORT_SESSION)
        session.handle_rerun_script_request(is_preheat=True)

    def _add_browser_connection(self, ws):
        """Register a connected browser with the server

        Parameters
        ----------
        ws : _BrowserWebSocketHandler or PREHEATED_REPORT_CONTEXT
            The newly-connected websocket handler

        Returns
        -------
        ReportSession
            The ReportSession associated with this browser connection

        """
        if ws not in self._report_sessions:

            if PREHEATED_REPORT_SESSION in self._report_sessions:
                assert len(self._report_sessions) == 1
                LOGGER.debug("Reusing preheated context for ws %s", ws)
                session = self._report_sessions[PREHEATED_REPORT_SESSION]
                del self._report_sessions[PREHEATED_REPORT_SESSION]
            else:
                LOGGER.debug("Creating new context for ws %s", ws)
                session = ReportSession(
                    ioloop=self._ioloop,
                    script_path=self._script_path,
                    script_argv=self._script_argv,
                )

            self._report_sessions[ws] = session

            if ws is not PREHEATED_REPORT_SESSION:
                self._set_state(State.ONE_OR_MORE_BROWSERS_CONNECTED)

        return self._report_sessions[ws]

    def _remove_browser_connection(self, ws):
        if ws in self._report_sessions:
            session = self._report_sessions[ws]
            del self._report_sessions[ws]
            session.shutdown()

        if len(self._report_sessions) == 0:
            self._set_state(State.NO_BROWSERS_CONNECTED)


class _BrowserWebSocketHandler(tornado.websocket.WebSocketHandler):
    """Handles a WebSocket connection from the browser"""

    def initialize(self, server):
        self._server = server

    def check_origin(self, origin):
        """Set up CORS."""
        return is_url_from_allowed_origins(origin)

    def open(self):
        self._session = self._server._add_browser_connection(self)

    def on_close(self):
        self._server._remove_browser_connection(self)

    @tornado.gen.coroutine
    def on_message(self, payload):
        msg = BackMsg()

        try:
            msg.ParseFromString(payload)
            LOGGER.debug("Received the following back message:\n%s", msg)

            msg_type = msg.WhichOneof("type")

            if msg_type == "cloud_upload":
                yield self._session.handle_save_request(self)
            elif msg_type == "rerun_script":
                self._session.handle_rerun_script_request(command_line=msg.rerun_script)
            elif msg_type == "clear_cache":
                self._session.handle_clear_cache_request()
            elif msg_type == "set_run_on_save":
                self._session.handle_set_run_on_save_request(msg.set_run_on_save)
            elif msg_type == "stop_report":
                self._session.handle_stop_script_request()
            elif msg_type == "update_widgets":
                self._session.handle_rerun_script_request(
                    widget_state=msg.update_widgets
                )
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
