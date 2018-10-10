"""Websocket handler class which the web client connects to."""

from tornado import gen
from tornado.ioloop import IOLoop
from tornado.concurrent import run_on_executor, futures
from tornado.websocket import WebSocketHandler, WebSocketClosedError
import os

from streamlit import config
from streamlit import protobuf
from streamlit.S3Connection import S3
from streamlit.logger import get_logger
from streamlit.proxy import Proxy

LOGGER = get_logger()


class ClientWebSocket(WebSocketHandler):
    """Websocket handler class which the web client connects to."""

    executor = futures.ThreadPoolExecutor(5)

    def initialize(self, proxy):
        """Initialize self._connections."""
        self._proxy = proxy
        self._connection = None
        self._queue = None
        self._is_open = False
        self._cloud = S3()

    def check_origin(self, origin):
        """Ignore CORS."""
        # WARNING.  EXTREMELY UNSECURE.
        # See http://www.tornadoweb.org/en/stable/websocket.html#configuration
        return True

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
            # Send the opening message
            LOGGER.info('Browser websocket opened for "%s"', self._report_name)
            self._send_new_connection_msg()

            # Get a ProxyConnection object to coordinate sending deltas over this report name.
            self._connection, self._queue = yield self._proxy.add_client(self._report_name, self)
            LOGGER.debug('Got a new connection ("%s") : %s',
                         self._connection.name, self._connection)
            LOGGER.debug('Got a new command line ("%s") : %s',
                         self._connection.name, self._connection.command_line)
            LOGGER.debug('Got a new queue : "%s"', self._queue)

            LOGGER.debug('Starting loop for "%s"', self._connection.name)
            loop = IOLoop.current()
            loop.spawn_callback(self.do_loop)

        except KeyError as e:
            LOGGER.info('Attempting to access non-existant report "%s"', e)
        except WebSocketClosedError:
            pass

    @Proxy.stop_proxy_on_exception(is_coroutine=True)
    @gen.coroutine
    def do_loop(self):
        # How long we wait between sending more data.
        throttle_secs = config.get_option('local.throttleSecs')

        indicated_closed = False

        try:
            while self._is_open:
                if not self._proxy.proxy_connection_is_registered(self._connection):
                    LOGGER.debug('The proxy connection for "%s" is not registered.',
                                 self._report_name)
                    self._proxy.remove_client(self._connection, self._queue)
                    self._connection, self._queue = yield self._proxy.add_client(
                        self._report_name, self)
                    LOGGER.debug('Got a new connection ("%s") : %s',
                                 self._connection.name, self._connection)
                    LOGGER.debug('Got a new queue : "%s"', self._queue)

                if not self._queue.is_closed():
                    yield self._queue.flush_queue(self)
                elif not indicated_closed:
                    LOGGER.debug('The queue for "%s" is closed.' % self._connection.name)
                    indicated_closed = True

                yield gen.sleep(throttle_secs)
            LOGGER.debug('Closing loop for "%s"', self._connection.name)
        except KeyError as e:
            LOGGER.info('Attempting to access non-existant report "%s"', e)
        except WebSocketClosedError:
            pass

        if self._connection is not None:
            self._proxy.remove_client(self._connection, self._queue)
            LOGGER.debug('Removed the client for "%s"', self._connection.name)

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
        yield self._handle_backend_msg(msg, self._connection, self)

    @gen.coroutine
    def _send_new_connection_msg(self):
        """Sends a message to the browser indicating local configuration
        settings."""
        msg = protobuf.ForwardMsg()

        msg.new_connection.saving_configured = config.saving_is_configured()
        LOGGER.debug('New Client Connection: saving_is_configured=%s' % \
            msg.new_connection.saving_configured)

        msg.new_connection.remotely_track_usage = config.remotely_track_usage()
        LOGGER.debug('New Client Connection: remotely_track_usage=%s' % \
            msg.new_connection.remotely_track_usage)

        yield self.write_message(msg.SerializeToString(), binary=True)

    @gen.coroutine
    def _handle_backend_msg(self, payload, connection, ws):
        backend_msg = protobuf.BackMsg()
        try:
            backend_msg.ParseFromString(payload)
            LOGGER.debug('Received the following backend message:')
            LOGGER.debug(backend_msg)
            msg_type = backend_msg.WhichOneof('type')
            if msg_type == 'help':
                LOGGER.debug('Received command to display help.')
                os.system('streamlit help &')
            elif msg_type == 'cloud_upload':
                yield self._save_cloud(connection, ws)
            elif msg_type == 'rerun_script':
                full_command = 'cd "%s" ; %s' % \
                    (self._connection.cwd, backend_msg.rerun_script)
                yield self._run(full_command)
            else:
                LOGGER.warning('No handler for "%s"', msg_type)
        except Exception as e:
            LOGGER.error('Cannot parse binary message: %s', e)

    @run_on_executor
    def _run(self, cmd):
        LOGGER.info('Running command: %s' % cmd)
        os.system(cmd)

    @gen.coroutine
    def _save_cloud(self, connection, ws):
        """Save serialized version of report deltas to the cloud."""
        @gen.coroutine
        def progress(percent):
            """Takes a 0 <= percent <= 100 and updates the frontend with this
            progress."""
            progress_msg = protobuf.ForwardMsg()
            progress_msg.upload_report_progress = percent
            yield ws.write_message(progress_msg.SerializeToString(), binary=True)

        # Indicate that the save is starting.
        try:
            yield progress(0)

            files = connection.serialize_report_to_files()
            url = yield self._cloud.upload_report(connection.id, files, progress)

            # Indicate that the save is done.
            progress_msg = protobuf.ForwardMsg()
            progress_msg.report_uploaded = url
            yield ws.write_message(progress_msg.SerializeToString(), binary=True)
        except Exception as e:
            # Horrible hack to show something if something breaks.
            progress_msg = protobuf.ForwardMsg()
            progress_msg.report_uploaded = 'ERROR: ' + str(e)
            yield ws.write_message(progress_msg.SerializeToString(), binary=True)
            raise e
