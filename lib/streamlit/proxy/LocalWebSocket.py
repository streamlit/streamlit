# -*- coding: future_fstrings -*-

"""Websocket handler class which the local python library connects to."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

from tornado import gen
from tornado.websocket import WebSocketHandler
import urllib
import webbrowser

from streamlit import config
from streamlit import protobuf
from streamlit.logger import get_logger
from streamlit.streamlit_msg_proto import new_report_msg
from streamlit.proxy import ProxyConnection

LOGGER = get_logger()

class LocalWebSocket(WebSocketHandler):
    """Websocket handler class which the local python library connects to."""

    def initialize(self, connections):
        self._connections = connections

    def check_origin(self, origin):
        """Ignore CORS."""
        # WARNING.  EXTREMELY UNSECURE.
        # See http://www.tornadoweb.org/en/stable/websocket.html#configuration
        return True

    def open(self, *args):
        """Handles a connection to a "local" instance of Streamlit, i.e. one producing deltas to display on the client."""
        # Parse out the control information.
        self._local_id = args[0]
        self._report_name = args[1]
        self._report_name = urllib.parse.unquote_plus(self._report_name)
        self._connection = None

        LOGGER.info('Local websocket opened for "{}/{}"'.format(self._local_id, self._report_name))

    def on_message(self, message):
        # LOGGER.debug(repr(message))

        msg = protobuf.ForwardMsg()
        msg.ParseFromString(message)

        msg_type = msg.WhichOneof('type')
        if msg_type == 'new_report':
            assert not self._connection, 'Cannot send `new_report` twice.'
            report_id = msg.new_report
            print('the report_id is', report_id)
            self._connection = ProxyConnection(report_id, self._report_name)
            self._connections[self._connection.name] = self._connection
            new_name = self._connection.name not in self._connections
            self._launch_web_client(self._connection.name)
        elif msg_type == 'delta_list':
            assert self._connection, 'No `delta_list` before `new_report`.'
            for delta in msg.delta_list.deltas:
                self._connection.enqueue(delta)
    '''
        else:
            raise RuntimeError(f'Cannot parse message type: {msg_type}')
        except concurrent.futures.CancelledError:
            pass

        # Deregister this connection and see if we can close the proxy.
        if connection:
            connection.finished_local_connection()
            self._try_to_deregister(connection)
        self._potentially_stop_proxy()
        return ws
    '''

    def _launch_web_client(self, name):
        """Launches a web browser to connect to the proxy to get the named
        report.

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
