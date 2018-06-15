"""Websocket handler class which the local python library connects to."""
from tornado.websocket import WebSocketHandler
import urllib

from streamlit import config
from streamlit import protobuf
from streamlit.proxy import Proxy, ProxyConnection
from streamlit.logger import get_logger

import webbrowser

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
    def open(self, *args):
        """Handle connection to "local" instance of Streamlit.

        i.e. one producing deltas to display on the client.
        """
        # Parse out the control information.
        self._local_id = args[0]
        self._report_name = args[1]
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
            report_id = msg.new_report
            self._connection = ProxyConnection(report_id, self._report_name)
            self._proxy.register_proxy_connection(self._connection)
            # new_name = self._connection.name not in self._connections
            #self._launch_web_client(self._connection.name)
        elif msg_type == 'delta_list':
            assert self._connection, 'No `delta_list` before `new_report`.'
            for delta in msg.delta_list.deltas:
                self._connection.enqueue(delta)
        else:
            raise RuntimeError('Cannot parse message type: %s' % msg_type)

    @Proxy.stop_proxy_on_exception()
    def on_close(self):
        """Close callback."""
        LOGGER.info('Local websocket closed for "%s"' % self._report_name)

        # Deregistering this connection and see if we can close the proxy.
        if self._connection:
            self._connection.finished_local_connection()
            self._proxy.try_to_deregister_proxy_connection(self._connection)
        self._proxy.potentially_stop()

    def _launch_web_client(self, name):
        """Launch web browser to connect to the proxy to get the named report.

        Args
        ----
        name : string
            The name of the report to which the web browser should connect.
        """
        if config.get_option('proxy.useNode'):
            host, port = 'localhost', '3000'
        else:
            host = config.get_option('proxy.server')
            port = config.get_option('proxy.port')
        quoted_name = urllib.parse.quote_plus(name)
        url = 'http://{}:{}/?name={}'.format(
            host, port, quoted_name)
        webbrowser.open(url)
