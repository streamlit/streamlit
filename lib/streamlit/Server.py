# Copyright 2019 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

import logging
import threading
import urllib
import json

import tornado.concurrent
import tornado.gen
import tornado.web
import tornado.websocket
import tornado.ioloop

from streamlit import __installation_id__, __version__
from streamlit import caching
from streamlit import config
from streamlit import protobuf
from streamlit import util
from streamlit.credentials import Credentials
from streamlit.ScriptRunner import State as ScriptState
from streamlit.storage.S3Storage import S3Storage as Storage

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


# Largest message that can be sent via the WebSocket connection.
# (Limit was picked by trial and error)
# TODO: Break message in several chunks if too large.
MESSAGE_SIZE_LIMIT = 10466493


class State(object):
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

    def __init__(self, report, scriptrunner, on_server_start_callback):
        """Initialize server."""
        LOGGER.debug('Initializing server...')

        if Server._singleton is not None:
            raise RuntimeError(
                'Server already initialized. Use .get_current() instead')

        Server._singleton = self

        _fix_tornado_logging()

        self._report = report
        self._scriptrunner = scriptrunner
        self._on_server_start_callback = on_server_start_callback

        # Mapping of WebSocket->ReportQueue.
        self._browser_queues = {}

        self._must_stop = threading.Event()
        self._state = None
        self._set_state(State.INITIAL)
        self._sent_initialize_message = False
        self._ioloop = tornado.ioloop.IOLoop.current()

        self._storage = None
        self._credentials = Credentials.get_current()

        port = config.get_option('server.port')
        app = tornado.web.Application(self._get_routes())
        app.listen(port)

        self._scriptrunner.on_state_changed.connect(
            self._enqueue_script_state_changed_message)
        self._scriptrunner.on_file_change_not_handled.connect(
            self._enqueue_file_change_message)
        self._scriptrunner.on_script_compile_error.connect(
            self._on_script_compile_error)

        LOGGER.debug('Server started on port %s', port)

    def get_debug(self):
        return {
            'report': self._report.get_debug(),
        }

    def _get_routes(self):
        routes = [
            (r'/stream', _SocketHandler, dict(server=self)),
            (r'/healthz', _HealthHandler, dict(server=self)),
            (r'/debugz', _DebugHandler, dict(server=self)),
        ]

        if not config.get_option('global.developmentMode') or not config.get_option('global.useNode'):
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
        self._set_state(State.WAITING_FOR_FIRST_BROWSER)

        self._on_server_start_callback(self, self._report)

        while not self._must_stop.is_set():
            if self._state == State.WAITING_FOR_FIRST_BROWSER:
                pass

            elif self._state == State.ONE_OR_MORE_BROWSERS_CONNECTED:

                # Shallow-clone _browser_queues into a list, so we can iterate
                # over it and not worry about whether it's being changed
                # outside this coroutine.
                ws_queue_pairs = list(self._browser_queues.items())

                for ws, browser_queue in ws_queue_pairs:
                    msg_list = browser_queue.flush()
                    for msg in msg_list:
                        msg_str = _serialize(msg)
                        if ws is None:
                            break
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

        self._set_state(State.STOPPED)

    def stop(self):
        self._set_state(State.STOPPING)
        self._must_stop.set()

    # IMPORTANT: This method gest called in the scriptrunner thread.
    def _clear_queue(self):
        self._report.clear()

        for browser_queue in self._browser_queues.values():
            browser_queue.clear()

    # IMPORTANT: This method gest called in the scriptrunner thread.
    def enqueue(self, msg):
        self._report.enqueue(msg)

        for browser_queue in self._browser_queues.values():
            browser_queue.enqueue(msg)

    def _add_browser_connection(self, ws):
        if ws in self._browser_queues:
            return

        self._browser_queues[ws] = self._report.clone_queue()
        self._set_state(State.ONE_OR_MORE_BROWSERS_CONNECTED)

    def _remove_browser_connection(self, ws):
        if ws in self._browser_queues:
            del self._browser_queues[ws]

        if len(self._browser_queues) == 0:
            self._set_state(State.NO_BROWSERS_CONNECTED)

    def _enqueue_exception(self, e):
        import streamlit.elements.exception_proto as exception_proto

        # This does a few things:
        # 1) Clears the current report in the browser.
        # 2) Marks the current report as "stopped" in the browser.
        # 3) HACK: Resets any script params that may have been broken (e.g. the
        # command-line when rerunning with wrong argv[0])
        self._enqueue_script_state_changed_message(ScriptState.STOPPED)
        self._enqueue_script_state_changed_message(ScriptState.RUNNING)
        self._enqueue_script_state_changed_message(ScriptState.STOPPED)

        msg = protobuf.ForwardMsg()
        msg.delta.id = 0
        exception_proto.marshall(msg.delta.new_element.exception, e)

        self.enqueue(msg)

    # IMPORTANT: This method gest called in the scriptrunner thread.
    def _enqueue_script_state_changed_message(self, new_script_state):
        if new_script_state == ScriptState.RUNNING:
            if config.get_option('server.liveSave'):
                # Enqueue into the IOLoop so it runs without blocking AND runs
                # on the main thread.
                self._ioloop.spawn_callback(self._save_running_report)
            self._clear_queue()
            self._maybe_enqueue_initialize_message()
            self._enqueue_new_report_message()

        self._enqueue_session_state_changed_message()

        if new_script_state == ScriptState.STOPPED:
            self._enqueue_report_finished_message()
            if config.get_option('server.liveSave'):
                # Enqueue into the IOLoop so it runs without blocking AND runs
                # on the main thread.
                self._ioloop.spawn_callback(self._save_final_report_and_quit)

    # IMPORTANT: This method gest called in the scriptrunner thread.
    def _enqueue_session_state_changed_message(self):
        msg = protobuf.ForwardMsg()
        msg.session_state_changed.run_on_save = self._scriptrunner.run_on_save
        msg.session_state_changed.report_is_running = (
            # Don't use is_running() because we want to indicate "running" to
            # the user event if we're in the process of stopping.
            not self._scriptrunner.is_fully_stopped())
        self.enqueue(msg)

    def _enqueue_file_change_message(self, _):
        msg = protobuf.ForwardMsg()
        msg.session_event.report_changed_on_disk = True
        self.enqueue(msg)

    def _on_script_compile_error(self, exc):
        """Handles exceptions caught by ScriptRunner during script compilation.

        We deliver these exceptions to the client via SessionEvent messages.
        "Normal" exceptions that are thrown during script execution show up as
        inline elements in the report, but compilation exceptions are handled
        specially, so that the frontend can leave the previous report up.
        """
        from streamlit.elements import exception_proto
        msg = protobuf.ForwardMsg()
        exception_proto.marshall(
            msg.session_event.script_compilation_exception, exc)
        self.enqueue(msg)

    # IMPORTANT: This method gest called in the scriptrunner thread.
    def _maybe_enqueue_initialize_message(self):
        if self._sent_initialize_message:
            return

        self._sent_initialize_message = True

        msg = protobuf.ForwardMsg()
        imsg = msg.initialize

        imsg.sharing_enabled = (
            config.get_option('global.sharingMode') != 'off')
        LOGGER.debug(
            'New browser connection: sharing_enabled=%s',
            msg.initialize.sharing_enabled)

        imsg.gather_usage_stats = (
            config.get_option('browser.gatherUsageStats'))
        LOGGER.debug(
            'New browser connection: gather_usage_stats=%s',
            msg.initialize.gather_usage_stats)

        imsg.streamlit_version = __version__
        imsg.session_state.run_on_save = self._scriptrunner.run_on_save
        imsg.session_state.report_is_running = self._scriptrunner.is_running()

        imsg.user_info.installation_id = __installation_id__
        imsg.user_info.email = self._credentials.activation.email

        self.enqueue(msg)

    # IMPORTANT: This method gest called in the scriptrunner thread.
    def _enqueue_new_report_message(self):
        self._report.generate_new_id()
        msg = protobuf.ForwardMsg()
        msg.new_report.id = self._report.report_id
        msg.new_report.command_line.extend(self._report.argv)
        msg.new_report.name = self._report.name
        self.enqueue(msg)

    # IMPORTANT: This method gest called in the scriptrunner thread.
    def _enqueue_report_finished_message(self):
        msg = protobuf.ForwardMsg()
        msg.report_finished = True
        self.enqueue(msg)

    @tornado.gen.coroutine
    def _handle_save_request(self, ws):
        """Save serialized version of report deltas to the cloud."""
        @tornado.gen.coroutine
        def progress(percent):
            progress_msg = protobuf.ForwardMsg()
            progress_msg.upload_report_progress = percent
            yield ws.write_message(
                progress_msg.SerializeToString(), binary=True)

        # Indicate that the save is starting.
        try:
            yield progress(0)

            url = yield self._save_final_report(progress)

            # Indicate that the save is done.
            progress_msg = protobuf.ForwardMsg()
            progress_msg.report_uploaded = url
            yield ws.write_message(
                progress_msg.SerializeToString(), binary=True)

        except Exception as e:
            # Horrible hack to show something if something breaks.
            err_msg = '%s: %s' % (
                type(e).__name__, str(e) or 'No further details.')
            progress_msg = protobuf.ForwardMsg()
            progress_msg.report_uploaded = err_msg
            yield ws.write_message(
                progress_msg.SerializeToString(), binary=True)
            raise e

    def _handle_rerun_script_request(self, cmd_line_str):
        self._report.set_argv(cmd_line_str)
        self._scriptrunner.request_rerun()

    def _handle_clear_cache_request(self):
        # Setting verbose=True causes clear_cache to print to stdout.
        # Since this command was initiated from the browser, the user
        # doesn't need to see the results of the command in their
        # terminal.
        caching.clear_cache()

    def _handle_set_run_on_save_request(self, new_value):
        self._scriptrunner.run_on_save = new_value
        self._enqueue_session_state_changed_message()

    @tornado.gen.coroutine
    def _save_running_report(self):
        files = self._report.serialize_running_report_to_files()
        url = yield self._get_storage().save_report_files(
            self._report.report_id, files)

        if config.get_option('server.liveSave'):
            util.print_url('Saved running report', url)

        raise tornado.gen.Return(url)

    @tornado.gen.coroutine
    def _save_final_report(self, progress=None):
        files = self._report.serialize_final_report_to_files()
        url = yield self._get_storage().save_report_files(
            self._report.report_id, files, progress)

        if config.get_option('server.liveSave'):
            util.print_url('Saved final report', url)

        raise tornado.gen.Return(url)

    @tornado.gen.coroutine
    def _save_final_report_and_quit(self):
        yield self._save_final_report()
        self._ioloop.stop()

    def _get_storage(self):
        if self._storage is None:
            self._storage = Storage()
        return self._storage


class _StaticFileHandler(tornado.web.StaticFileHandler):
    def set_extra_headers(self, path):
        """Disable cache."""
        self.set_header('Cache-Control', 'no-cache')

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
        self.write('<code><pre>%s</pre><code>' %
            json.dumps(
                self._server.get_debug(),
                indent=2,
            ))


class _SocketHandler(tornado.websocket.WebSocketHandler):
    def initialize(self, server):
        self._server = server

    def check_origin(self, origin):
        """Set up CORS."""
        return _is_url_from_allowed_origins(origin)

    def open(self):
        self._server._add_browser_connection(self)

    def on_close(self):
        self._server._remove_browser_connection(self)

    @tornado.gen.coroutine
    def on_message(self, payload):
        msg = protobuf.BackMsg()

        try:
            msg.ParseFromString(payload)
            LOGGER.debug('Received the following backend message: %s' % msg)

            msg_type = msg.WhichOneof('type')

            if msg_type == 'cloud_upload':
                yield self._server._handle_save_request(self)
            elif msg_type == 'rerun_script':
                self._server._handle_rerun_script_request(msg.rerun_script)
            elif msg_type == 'clear_cache':
                self._server._handle_clear_cache_request()
            elif msg_type == 'set_run_on_save':
                self._server._handle_set_run_on_save_request(msg.set_run_on_save)
            elif msg_type == 'stop_report':
                self._server._scriptrunner.request_stop()
            else:
                LOGGER.warning('No handler for "%s"', msg_type)

        except BaseException as e:
            LOGGER.error(e)
            self._server._enqueue_exception(e)


def _fix_tornado_logging():
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

    exception_proto.marshall(msg.delta.new_element, e)


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
