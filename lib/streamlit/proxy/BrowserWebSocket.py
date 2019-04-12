# Copyright 2018 Streamlit Inc. All rights reserved.

"""Websocket handler class for connections to the browser."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

from tornado import gen
from tornado.concurrent import futures
from tornado.concurrent import run_on_executor
from tornado.ioloop import IOLoop
from tornado.websocket import WebSocketClosedError
from tornado.websocket import WebSocketHandler

from streamlit import caching
from streamlit import forward_msg_proto
from streamlit import config
from streamlit import protobuf
from streamlit import process_runner
from streamlit.proxy import Proxy
from streamlit.proxy import proxy_util

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


class BrowserWebSocket(WebSocketHandler):
    """Websocket handler class which the web client connects to."""

    executor = futures.ThreadPoolExecutor(5)

    @property
    def report_name(self):
        """The report name the browser is interested in"""
        return self._report_name

    @property
    def key(self):
        """A key that uniquely identifies this WebSocket connection."""
        return str(self)

    def initialize(self, proxy):
        """Initialize self._connections."""
        self._proxy = proxy
        self._connection = None
        self._queue = None
        self._is_open = False

    def check_origin(self, origin):
        """Set up CORS."""
        return proxy_util.url_is_from_allowed_origins(origin)

    def write_proto(self, msg):
        """Writes a protobuf to the WebSocket

        Parameters
        ----------
        msg : Protobuf message

        Returns
        -------
        Future
            See tornado.websocket.websocket_connect. This returns a Future
            whose result is a WebSocketClientConnection.
        """
        return self.write_message(msg.SerializeToString(), binary=True)

    def on_session_state_changed(self, _, **kwargs):
        """Signal handler for ReportSession.state_changed.
        Sends a SessionStateChanged message to the browser.
        """
        session_state = kwargs.get('state')
        self.write_proto(
            forward_msg_proto.session_state_changed_msg(session_state))

    def on_report_changed(self, _):
        """Signal handler for ReportSession.report_changed_on_disk.
        Sends a SessionEvent message to the browser.
        """
        self.write_proto(
            forward_msg_proto.report_changed_on_disk_msg())

    def on_report_was_manually_stopped(self, _):
        """Signal handler for ReportSession.on_report_was_manually_stopped.
        Sends a SessionEvent message to the browser.
        """
        self.write_proto(
            forward_msg_proto.report_was_manually_stopped_msg())

    @Proxy.stop_proxy_on_exception(is_coroutine=True)
    @gen.coroutine
    def open(self, report_name):
        """Get and return websocket."""
        # Indicate that the websocket is open.
        self._is_open = True

        # Get the report name from the url
        self._report_name = report_name
        LOGGER.debug('The Report name is "%s"', self._report_name)

        try:
            LOGGER.debug(
                'Browser websocket opened for "%s"', self._report_name)

            # Get a ClientConnection object to coordinate sending deltas over
            # this report name.
            self._connection, self._queue = (
                yield self._proxy.on_browser_connection_opened(self))
            LOGGER.debug('Got a new connection ("%s") : %s',
                         self._connection.name, self._connection)
            LOGGER.debug('Got a new command line ("%s") : %s',
                         self._connection.name, self._connection.command_line)
            LOGGER.debug('Got a new queue : "%s"', self._queue)

            LOGGER.debug('Starting loop for "%s"', self._connection.name)
            loop = IOLoop.current()
            loop.spawn_callback(self.do_loop)

        except KeyError as e:
            LOGGER.debug(
                'Browser attempting to access non-existent report "%s"', e)
        except WebSocketClosedError:
            pass

    @Proxy.stop_proxy_on_exception(is_coroutine=True)
    @gen.coroutine
    def do_loop(self):
        """Start the proxy's main loop."""
        # How long we wait between sending more data.
        throttle_secs = config.get_option('client.throttleSecs')

        indicated_closed = False

        try:
            while self._is_open:
                self._connection, self._queue = (
                    yield self._proxy.get_latest_connection_and_queue(
                            self._report_name, self,
                            self._connection, self._queue))
                if not self._queue.is_closed():
                    yield self._queue.flush_queue(self)
                elif not indicated_closed:
                    LOGGER.debug(
                        'The queue for "%s" is closed.',
                        self._connection.name)
                    indicated_closed = True

                yield gen.sleep(throttle_secs)
            LOGGER.debug('Closing loop for "%s"', self._connection.name)
        except KeyError as e:
            LOGGER.debug(
                'Browser attempting to access non-existent report "%s"', e)
        except WebSocketClosedError:
            pass

        if self._connection is not None:
            self._proxy.on_browser_connection_closed(
                self, self._connection, self._queue)

    @Proxy.stop_proxy_on_exception()
    def on_close(self):
        """Close handler."""
        LOGGER.debug('Received close message.')
        self._is_open = False

    @Proxy.stop_proxy_on_exception(is_coroutine=True)
    @gen.coroutine
    def on_message(self, msg):
        """Run callback for websocket messages."""
        LOGGER.debug(repr(msg))
        yield self._handle_backend_msg(msg, self._connection)

    @gen.coroutine
    def _handle_backend_msg(self, payload, connection):
        backend_msg = protobuf.BackMsg()
        try:
            backend_msg.ParseFromString(payload)
            LOGGER.debug('Received the following backend message:')
            LOGGER.debug(backend_msg)
            msg_type = backend_msg.WhichOneof('type')
            if msg_type == 'cloud_upload':
                yield self._save_cloud(connection)
            elif msg_type == 'rerun_script':
                # 2019-04-10 - TSC - yielding here (and in cloud_upload above)
                # means this coroutine will not complete until the script
                # finishes re-running, which means the socket will not
                # process any further messages until the re-run is complete.
                # We'll need to fix this in order to have 'stop_report'
                # messages work.
                yield self._run(backend_msg.rerun_script)
            elif msg_type == 'clear_cache':
                # Setting verbose=True causes clear_cache to print to stdout.
                # Since this command was initiated from the browser, the user
                # doesn't need to see the results of the command in their
                # terminal.
                caching.clear_cache(verbose=False)
            elif msg_type == 'set_run_on_save':
                self._proxy.set_run_on_save(
                    self._report_name, backend_msg.set_run_on_save)
            elif msg_type == 'stop_report':
                self._proxy.stop_report(self._report_name)
            else:
                LOGGER.warning('No handler for "%s"', msg_type)
        except Exception as e:
            LOGGER.error('Cannot parse binary message: %s', e)

    @run_on_executor
    def _run(self, cmd):
        process_runner.run_handling_errors_in_subprocess(
            cmd, self._connection.cwd)

    @gen.coroutine
    def _save_cloud(self, connection):
        """Save serialized version of report deltas to the cloud."""
        @gen.coroutine
        def progress(percent):
            progress_msg = protobuf.ForwardMsg()
            progress_msg.upload_report_progress = percent
            yield self.write_proto(progress_msg)

        # Indicate that the save is starting.
        try:
            yield progress(0)

            files = connection.serialize_final_report_to_files()
            storage = self._proxy.get_storage()
            url = yield storage.save_report_files(
                connection.id, files, progress)

            # Indicate that the save is done.
            progress_msg = protobuf.ForwardMsg()
            progress_msg.report_uploaded = url
            yield self.write_proto(progress_msg)
        except Exception as e:
            # Horrible hack to show something if something breaks.
            err_msg = '%s: %s' % (
                type(e).__name__, str(e) or "No further details.")
            progress_msg = protobuf.ForwardMsg()
            progress_msg.report_uploaded = err_msg
            yield self.write_proto(progress_msg)
            raise e
