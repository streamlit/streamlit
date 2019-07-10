# Copyright 2019 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

import json
import logging
import threading
import urllib
from enum import Enum

import tornado.concurrent
import tornado.gen
import tornado.web
import tornado.websocket
import tornado.ioloop

from streamlit import config
from streamlit import protobuf
from streamlit import util
from streamlit.ReportContext import ReportContext
from streamlit.logger import get_logger

LOGGER = get_logger(__name__)


# Largest message that can be sent via the WebSocket connection.
# (Limit was picked by trial and error)
# TODO: Break message in several chunks if too large.
MESSAGE_SIZE_LIMIT = 10466493


# Dictionary key used to mark the script execution context that starts
# up before the first browser connects.
PREHEATED_REPORT_CONTEXT = 'PREHEATED_REPORT_CONTEXT'


class State(Enum):
    INITIAL = 'INITIAL'
    WAITING_FOR_FIRST_BROWSER = 'WAITING_FOR_FIRST_BROWSER'
    ONE_OR_MORE_BROWSERS_CONNECTED = 'ONE_OR_MORE_BROWSERS_CONNECTED'
    NO_BROWSERS_CONNECTED = 'NO_BROWSERS_CONNECTED'
    STOPPING = 'STOPPING'
    STOPPED = 'STOPPED'


class Server(object):

    _singleton = None

    @classmethod
    def get_current(cls):
        """Return the singleton instance."""
        if cls._singleton is None:
            Server()

        return Server._singleton

    def __init__(self, script_path, script_argv, on_server_start_callback):
        """Initialize server."""
        LOGGER.debug('Initializing server...')

        if Server._singleton is not None:
            raise RuntimeError(
                'Server already initialized. Use .get_current() instead')

        Server._singleton = self

        _set_tornado_log_levels()

        self._script_path = script_path
        self._script_argv = script_argv
        self._on_server_start_callback = on_server_start_callback

        # Mapping of WebSocket->ReportContext.
        self._report_contexts = {}

        self._must_stop = threading.Event()
        self._state = None
        self._set_state(State.INITIAL)
        self._ioloop = tornado.ioloop.IOLoop.current()

        port = config.get_option('server.port')
        app = tornado.web.Application(self._get_routes())
        app.listen(port)

        LOGGER.debug('Server started on port %s', port)

    def get_debug(self):
        return {
            'report': self._report.get_debug(),
        }

    def _get_routes(self):
        routes = [
            (r'/stream', _BrowserWebSocketHandler, dict(server=self)),
            (r'/healthz', _HealthHandler, dict(server=self)),
            (r'/debugz', _DebugHandler, dict(server=self)),
        ]

        if (not config.get_option('global.developmentMode')
                or not config.get_option('global.useNode')):
            # If we're not using the node development server, then the proxy
            # will serve up the development pages.
            static_path = util.get_static_dir()
            LOGGER.debug('Serving static content from %s', static_path)

            routes.extend([
                (r"/()$", _StaticFileHandler,
                    {'path': '%s/index.html' % static_path}),
                (r"/(.*)", _StaticFileHandler, {'path': '%s/' % static_path}),
            ])
        else:
            LOGGER.debug(
                'developmentMode == True, '
                'not serving static content from python.')

        return routes

    def _set_state(self, new_state):
        LOGGER.debug('Server state: %s -> %s' % (self._state, new_state))
        self._state = new_state

    @property
    def is_ready_for_browser_connection(self):
        return self._state not in (
            State.INITIAL,
            State.STOPPING,
            State.STOPPED,
        )

    @property
    def browser_is_connected(self):
        return self._state == State.ONE_OR_MORE_BROWSERS_CONNECTED

    @tornado.gen.coroutine
    def loop_coroutine(self):
        if self._state == State.INITIAL:
            self._set_state(State.WAITING_FOR_FIRST_BROWSER)
        elif self._state == State.ONE_OR_MORE_BROWSERS_CONNECTED:
            pass
        else:
            raise RuntimeError('Bad server state at start: %s' % self._state)

        self._on_server_start_callback(self)

        while not self._must_stop.is_set():
            if self._state == State.WAITING_FOR_FIRST_BROWSER:
                pass

            elif self._state == State.ONE_OR_MORE_BROWSERS_CONNECTED:

                # Shallow-clone _report_contexts into a list, so we can iterate
                # over it and not worry about whether it's being changed
                # outside this coroutine.
                ws_ctx_pairs = list(self._report_contexts.items())

                for ws, report_ctx in ws_ctx_pairs:
                    if ws is PREHEATED_REPORT_CONTEXT:
                        continue
                    if ws is None:
                        continue
                    msg_list = report_ctx.flush_browser_queue()
                    for msg in msg_list:
                        msg_str = _serialize(msg)
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

        # Shut down all ReportContexts
        for report_ctx in list(self._report_contexts.values()):
            report_ctx.shutdown()

        self._set_state(State.STOPPED)

        # Stop the ioloop. This will end our process.
        self._ioloop.stop()

    def stop(self):
        self._set_state(State.STOPPING)
        self._must_stop.set()

    def add_preheated_report_context(self):
        """Register a fake browser with the server and run the script.

        This is used to start running the user's script even before the first
        browser connects.
        """
        # report_ctx = self._add_browser_connection(PREHEATED_REPORT_CONTEXT)
        # report_ctx.handle_rerun_script_request()
        # TODO: Re-enable this when preheating is fixed
        pass

    def _add_browser_connection(self, ws):
        """Register a connected browser with the server

        Parameters
        ----------
        ws : _BrowserWebSocketHandler or PREHEATED_REPORT_CONTEXT
            The newly-connected websocket handler

        Returns
        -------
        ReportContext
            The ReportContext associated with this browser connection

        """
        if ws not in self._report_contexts:

            if (len(self._report_contexts) == 1 and
                    PREHEATED_REPORT_CONTEXT in self._report_contexts):
                LOGGER.debug('Reusing preheated context for ws %s', ws)
                report_ctx = self._report_contexts[PREHEATED_REPORT_CONTEXT]
                del self._report_contexts[PREHEATED_REPORT_CONTEXT]
            else:
                LOGGER.debug('Creating new context for ws %s', ws)
                report_ctx = ReportContext(
                    ioloop=self._ioloop,
                    script_path=self._script_path,
                    script_argv=self._script_argv,
                    is_preheat=ws is PREHEATED_REPORT_CONTEXT)

            self._report_contexts[ws] = report_ctx

            if ws is not PREHEATED_REPORT_CONTEXT:
                self._set_state(State.ONE_OR_MORE_BROWSERS_CONNECTED)

        return self._report_contexts[ws]

    def _remove_browser_connection(self, ws):
        if ws in self._report_contexts:
            ctx = self._report_contexts[ws]
            del self._report_contexts[ws]
            ctx.shutdown()

        if len(self._report_contexts) == 0:
            self._set_state(State.NO_BROWSERS_CONNECTED)


class _StaticFileHandler(tornado.web.StaticFileHandler):
    # Don't disable cache since Tornado sets the etag properly. This means the
    # browser sends the hash of its cached file and Tornado only returns the
    # actual file if the latest hash is different.
    #
    # def set_extra_headers(self, path):
    #     """Disable cache."""
    #     self.set_header('Cache-Control', 'no-cache')

    def check_origin(self, origin):
        """Set up CORS."""
        return _is_url_from_allowed_origins(origin)


class _HealthHandler(tornado.web.RequestHandler):
    def initialize(self, server):
        self._server = server

    def check_origin(self, origin):
        """Set up CORS."""
        return _is_url_from_allowed_origins(origin)

    def get(self):
        self.add_header('Cache-Control', 'no-cache')
        if self._server.is_ready_for_browser_connection:
            self.write('ok')
        else:
            # 503 = SERVICE_UNAVAILABLE
            self.set_status(503)
            self.write('unavailable')


class _DebugHandler(tornado.web.RequestHandler):
    def initialize(self, server):
        self._server = server

    def check_origin(self, origin):
        """Set up CORS."""
        return _is_url_from_allowed_origins(origin)

    def get(self):
        self.add_header('Cache-Control', 'no-cache')
        self.write(
            '<code><pre>%s</pre><code>' %
            json.dumps(
                self._server.get_debug(),
                indent=2,
            ))


class _BrowserWebSocketHandler(tornado.websocket.WebSocketHandler):
    """Handles a WebSocket connection from the browser"""
    def initialize(self, server):
        self._server = server

    def check_origin(self, origin):
        """Set up CORS."""
        return _is_url_from_allowed_origins(origin)

    def open(self):
        self._ctx = self._server._add_browser_connection(self)

    def on_close(self):
        self._server._remove_browser_connection(self)

    @tornado.gen.coroutine
    def on_message(self, payload):
        msg = protobuf.BackMsg()

        try:
            msg.ParseFromString(payload)
            LOGGER.debug('Received the following back message:\n%s', msg)

            msg_type = msg.WhichOneof('type')

            if msg_type == 'cloud_upload':
                yield self._ctx.handle_save_request(self)
            elif msg_type == 'rerun_script':
                self._ctx.handle_rerun_script_request(
                    command_line=msg.rerun_script)
            elif msg_type == 'clear_cache':
                self._ctx.handle_clear_cache_request()
            elif msg_type == 'set_run_on_save':
                self._ctx.handle_set_run_on_save_request(msg.set_run_on_save)
            elif msg_type == 'stop_report':
                self._ctx.handle_stop_script_request()
            elif msg_type == 'update_widgets':
                self._ctx.handle_rerun_script_request(
                    widget_state=msg.update_widgets)
            else:
                LOGGER.warning('No handler for "%s"', msg_type)

        except BaseException as e:
            LOGGER.error(e)
            self._ctx.enqueue_exception(e)


def _set_tornado_log_levels():
    if not config.get_option('global.developmentMode'):
        # Hide logs unless they're super important.
        # Example of stuff we don't care about: 404 about .js.map files.
        logging.getLogger('tornado.access').setLevel(logging.ERROR)
        logging.getLogger('tornado.application').setLevel(logging.ERROR)
        logging.getLogger('tornado.general').setLevel(logging.ERROR)


def _serialize(msg):
    msg_str = msg.SerializeToString()

    if len(msg_str) > MESSAGE_SIZE_LIMIT:
        _convert_msg_to_exception_msg(msg, RuntimeError('Data too large'))
        msg_str = msg.SerializeToString()

    return msg_str


def _convert_msg_to_exception_msg(msg, e):
    import streamlit.elements.exception_proto as exception_proto

    delta_id = msg.delta.id
    msg.Clear()
    msg.delta.id = delta_id

    exception_proto.marshall(msg.delta.new_element.exception, e)


def _is_url_from_allowed_origins(url):
    """Return True if URL is from allowed origins (for CORS purpose).

    Allowed origins:
    1. localhost
    2. The internal and external IP addresses of the machine where this
       function was called from.
    3. The cloud storage domain configured in `s3.bucket`.

    If `server.enableCORS` is False, this allows all origins.

    Parameters
    ----------
    url : str
        The URL to check

    Returns
    -------
    bool
        True if URL is accepted. False otherwise.

    """
    if not config.get_option('server.enableCORS'):
        # Allow everything when CORS is disabled.
        return True

    hostname = urllib.parse.urlparse(url).hostname

    # Allow connections from bucket.
    if hostname == config.get_option('s3.bucket'):
        return True

    # Allow connections from watcher's machine or localhost.
    allowed_domains = [
        'localhost',
        '127.0.0.1',
        util.get_internal_ip(),
        util.get_external_ip(),
    ]

    s3_url = config.get_option('s3.url')

    if s3_url is not None:
        parsed = urllib.parse.urlparse(s3_url)
        allowed_domains.append(parsed.hostname)

    if config.is_manually_set('browser.serverAddress'):
        allowed_domains.append(config.get_option('browser.serverAddress'))

    return any(hostname == d for d in allowed_domains)
