"""Websocket handler class which the web client connects to."""
import os

from tornado import gen
from tornado.websocket import WebSocketHandler, WebSocketClosedError

from streamlit import config
from streamlit import protobuf
from streamlit.S3Connection import S3
from streamlit.logger import get_logger
from streamlit.proxy import Proxy

LOGGER = get_logger()


class ClientWebSocket(WebSocketHandler):
    """Websocket handler class which the web client connects to."""

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

        # How long we wait between sending more data.
        throttle_secs = config.get_option('local.throttleSecs')

        try:
            LOGGER.info('Browser websocket opened for "%s"', self._report_name)
            self._connection, self._queue = yield self._proxy.add_client(self._report_name, self)
            LOGGER.debug('Got a new connection ("%s") : %s',
                         self._connection.name, self._connection)
            LOGGER.debug('Got a new queue : "%s"', self._queue)

            LOGGER.debug('Starting loop for "%s"', self._connection.name)
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
    def _handle_backend_msg(self, payload, connection, ws):
        backend_msg = protobuf.BackMsg()
        try:
            backend_msg.ParseFromString(payload)
            command = backend_msg.command
            if command == protobuf.BackMsg.Command.Value('HELP'):
                os.system('python -m streamlit help &')
            elif command == protobuf.BackMsg.Command.Value('CLOUD_UPLOAD'):
                yield self._save_cloud(connection, ws)
            else:
                LOGGER.warning('no handler for "%s"',
                               protobuf.BackMsg.Command.Name(backend_msg.command))
        except Exception as e:
            LOGGER.error('Cannot parse binary message: %s', e)

    @gen.coroutine
    def _save_cloud(self, connection, ws):
        """Save serialized version of report deltas to the cloud."""
        # Indicate that the save is starting.
        progress_msg = protobuf.ForwardMsg()
        try:
            progress_msg.upload_report_progress = 100
            yield ws.write_message(progress_msg.SerializeToString(), binary=True)

            report = connection.get_report_proto()
            LOGGER.debug('Saving report of size %d and type %s',
                         len(report.SerializeToString()),
                         type(report.SerializeToString()))
            url = yield self._cloud.upload_report(connection.id, report)

            # Indicate that the save is done.
            progress_msg.Clear()
            progress_msg.report_uploaded = url
            yield ws.write_message(progress_msg.SerializeToString(), binary=True)
        except Exception as e:
            # Horrible hack to show something if something breaks.
            progress_msg.Clear()
            progress_msg.report_uploaded = 'ERROR: ' + str(e)
            yield ws.write_message(progress_msg.SerializeToString(), binary=True)
            raise
