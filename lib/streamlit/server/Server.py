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
import socket
import sys
import errno
import traceback
import click
from enum import Enum

import tornado.concurrent
import tornado.gen
import tornado.ioloop
import tornado.web
import tornado.websocket

from streamlit import config
from streamlit import file_util
from streamlit.ForwardMsgCache import ForwardMsgCache
from streamlit.ForwardMsgCache import create_reference_msg
from streamlit.ForwardMsgCache import populate_hash_if_needed
from streamlit.ReportSession import ReportSession
from streamlit.logger import get_logger
from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.UploadedFileManager import UploadedFileManager
from streamlit.server.routes import AddSlashHandler
from streamlit.server.routes import DebugHandler
from streamlit.server.routes import HealthHandler
from streamlit.server.routes import MessageCacheHandler
from streamlit.server.routes import MetricsHandler
from streamlit.server.routes import StaticFileHandler
from streamlit.server.server_util import MESSAGE_SIZE_LIMIT
from streamlit.server.server_util import is_cacheable_msg
from streamlit.server.server_util import is_url_from_allowed_origins
from streamlit.server.server_util import make_url_path_regex
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

# When server.port is not available it will look for the next available port
# up to MAX_PORT_SEARCH_RETRIES.
MAX_PORT_SEARCH_RETRIES = 100


class SessionInfo(object):
    """Type stored in our _report_sessions dict.

    For each ReportSession, the server tracks that session's
    report_run_count. This is used to track the age of messages in
    the ForwardMsgCache.
    """

    def __init__(self, session):
        """Initialize a SessionInfo instance.

        Parameters
        ----------
        session : ReportSession
        """
        self.session = session
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


def start_listening(app):
    """Takes the server start listening at the configured port.

    In case the port is already taken it tries listening to the next available
    port.  It will error after MAX_PORT_SEARCH_RETRIES attempts.

    """

    call_count = 0

    while call_count < MAX_PORT_SEARCH_RETRIES:
        port = config.get_option("server.port")

        try:
            app.listen(port)
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
                        "server.port", port, config.ConfigOption.STREAMLIT_DEFINITION
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

    _singleton = None

    @classmethod
    def get_current(cls):
        """Return the singleton instance."""
        if cls._singleton is None:
            raise RuntimeError("Server has not been initialized yet")

        return Server._singleton

    def __init__(self, ioloop, script_path, command_line):
        """Create the server. It won't be started yet.

        Parameters
        ----------
        ioloop : tornado.ioloop.IOLoop
        script_path : str
        command_line : str

        """
        if Server._singleton is not None:
            raise RuntimeError("Server already initialized. Use .get_current() instead")

        Server._singleton = self

        _set_tornado_log_levels()

        self._ioloop = ioloop
        self._script_path = script_path
        self._command_line = command_line

        # Mapping of WebSocket->SessionInfo.
        self._session_infos = {}

        self._must_stop = threading.Event()
        self._state = None
        self._set_state(State.INITIAL)
        self._message_cache = ForwardMsgCache()

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

    def get_debug(self):
        return {"report": self._report.get_debug()}

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
        ]

        if config.get_option("global.developmentMode") and config.get_option(
            "global.useNode"
        ):
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
                    session_pairs = list(self._session_infos.items())

                    for ws, session_info in session_pairs:
                        if ws is PREHEATED_REPORT_SESSION:
                            continue
                        if ws is None:
                            continue
                        msg_list = session_info.session.flush_browser_queue()
                        for msg in msg_list:
                            try:
                                self._send_message(ws, session_info, msg)
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
            for session_info in list(self._session_infos.values()):
                session_info.session.shutdown()

            self._set_state(State.STOPPED)

        except Exception as e:
            print("EXCEPTION!", e)
            traceback.print_stack(file=sys.stdout)
            LOGGER.info(
                """
Please report this bug at https://github.com/streamlit/streamlit/issues.
"""
            )

        finally:
            self._on_stopped()

    def _send_message(self, ws, session_info, msg):
        """Send a message to a client.

        If the client is likely to have already cached the message, we may
        instead send a "reference" message that contains only the hash of the
        message.

        Parameters
        ----------
        ws : _BrowserWebSocketHandler
            The socket connected to the client
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
        ws.write_message(serialize_forward_msg(msg_to_send), binary=True)

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
        if ws not in self._session_infos:

            if PREHEATED_REPORT_SESSION in self._session_infos:
                assert len(self._session_infos) == 1
                LOGGER.debug("Reusing preheated context for ws %s", ws)
                session = self._session_infos[PREHEATED_REPORT_SESSION].session
                del self._session_infos[PREHEATED_REPORT_SESSION]
            else:
                LOGGER.debug("Creating new context for ws %s", ws)
                session = ReportSession(
                    ioloop=self._ioloop,
                    script_path=self._script_path,
                    command_line=self._command_line,
                )

            self._session_infos[ws] = SessionInfo(session)

            if ws is not PREHEATED_REPORT_SESSION:
                self._set_state(State.ONE_OR_MORE_BROWSERS_CONNECTED)

        return self._session_infos[ws].session

    def _remove_browser_connection(self, ws):
        if ws in self._session_infos:
            session_info = self._session_infos[ws]
            del self._session_infos[ws]
            session_info.session.shutdown()

        if len(self._session_infos) == 0:
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
            msg_type = msg.WhichOneof("type")

            if msg_type == "upload_file_chunk":
                LOGGER.debug(
                    "Received the following upload_file_chunk back message:\nfile_uploaded {\n   widget_id: %s\n   index: %s\n   data: #####\n}",
                    msg.upload_file_chunk.widget_id,
                    msg.upload_file_chunk.index,
                )
            else:
                LOGGER.debug("Received the following back message:\n%s", msg)

            if msg_type == "cloud_upload":
                yield self._session.handle_save_request(self)
            elif msg_type == "rerun_script":
                self._session.handle_rerun_script_request()
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
            elif msg_type == "upload_file":
                self._session.handle_upload_file(upload_file=msg.upload_file)
            elif msg_type == "upload_file_chunk":
                self._session.handle_upload_file_chunk(
                    upload_file_chunk=msg.upload_file_chunk
                )
            elif msg_type == "delete_uploaded_file":
                self._session.handle_delete_uploaded_file(
                    delete_uploaded_file=msg.delete_uploaded_file
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
