# Copyright 2018 Streamlit Inc. All rights reserved.

"""Websocket handler class which the local python library connects to."""
from tornado.websocket import WebSocketHandler
from tornado import gen
import urllib

from streamlit import protobuf
from streamlit.proxy import Proxy, ProxyConnection
from streamlit.logger import get_logger
from streamlit import config

LOGGER = get_logger()


class LocalWebSocket(WebSocketHandler):
    """Websocket handler class which the local python library connects to."""

    def initialize(self, proxy):
        """Initialize self._proxy."""
        self._proxy = proxy

    def check_origin(self, origin):
        """Ignore CORS."""
        # WARNING.  EXTREMELY UNSECURE.
        # See http://www.tornadoweb.org/en/stable/websocket.html#configuration
        return True

    @Proxy.stop_proxy_on_exception()
    def open(self, local_id, report_name):
        """Handle connection to *local* instance of Streamlit.

        Parameters
        ----------
        local_id : str
            Vestigial stuff. Deprecated.
        report_name : str
            The name of the report.

        """
        # Parse out the control information.
        self._local_id = local_id
        self._report_name = report_name
        self._report_name = urllib.parse.unquote_plus(self._report_name)
        self._connection = None
        LOGGER.info('Local websocket opened for %s', self._report_name)

    @Proxy.stop_proxy_on_exception()
    def on_message(self, message):
        """Run callback for websocket messages."""
        # LOGGER.debug(repr(message))

        msg = protobuf.ForwardMsg()
        msg.ParseFromString(message)

        # raise RuntimeError('Exceptionin on_message')

        msg_type = msg.WhichOneof('type')
        if msg_type == 'new_report':
            assert not self._connection, 'Cannot send `new_report` twice.'
            self._connection = ProxyConnection(msg.new_report, self._report_name)
            self._proxy.register_proxy_connection(self._connection)
        elif msg_type == 'delta':
            assert self._connection, 'No `delta` before `new_report`.'
            self._connection.enqueue(msg.delta)
        else:
            raise RuntimeError('Cannot parse message type: %s' % msg_type)

    @Proxy.stop_proxy_on_exception(is_coroutine=True)
    @gen.coroutine
    def on_close(self):
        """Close callback."""
        LOGGER.info('Local websocket closed for "%s"' % self._report_name)

        # Deregistering this connection and see if we can close the proxy.
        if self._connection:
            # Save the report if proxy.saveOnExit is true.
            if config.get_option('proxy.saveOnExit'):
                yield self._save_report(self._connection)

            self._connection.close_local_connection()
            self._proxy.schedule_potential_deregister_and_stop(
                self._connection)
        else:
            self._proxy.schedule_potential_stop()

    @gen.coroutine
    def _save_report(self, connection):
        """Save the report stored in this connection."""
        # Don't report upload progress.
        progress = gen.coroutine(lambda percent: None)

        # Saving the report
        LOGGER.debug('Uploading the report... (id=%s)' % connection.id)
        files = connection.serialize_report_to_files()
        cloud = self._proxy.get_cloud_storage()
        url = yield cloud.upload_report(connection.id, files, progress)
        print('SAVED REPORT: %s' % url)
