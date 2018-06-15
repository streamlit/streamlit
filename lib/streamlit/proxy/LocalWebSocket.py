# -*- coding: future_fstrings -*-

"""Websocket handler class which the local python library connects to."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

from tornado import gen
from tornado.websocket import WebSocketHandler
import urllib

from streamlit import config
from streamlit import protobuf
from streamlit.proxy import Proxy, ProxyConnection
from streamlit.logger import get_logger
from streamlit.streamlit_msg_proto import new_report_msg

LOGGER = get_logger()

class LocalWebSocket(WebSocketHandler):
    """Websocket handler class which the local python library connects to."""

    def initialize(self, proxy):
        self._proxy = proxy

    def check_origin(self, origin):
        """Ignore CORS."""
        # WARNING.  EXTREMELY UNSECURE.
        # See http://www.tornadoweb.org/en/stable/websocket.html#configuration
        return True

    @Proxy.stop_proxy_on_exception
    def open(self, *args):
        """Handles a connection to a "local" instance of Streamlit, i.e. one producing deltas to display on the client."""
        # Parse out the control information.
        self._local_id = args[0]
        self._report_name = args[1]
        self._report_name = urllib.parse.unquote_plus(self._report_name)
        self._connection = None
        LOGGER.info(f'Local websocket opened for "{self._report_name}"')

    @Proxy.stop_proxy_on_exception
    def on_message(self, message):
        # LOGGER.debug(repr(message))

        msg = protobuf.ForwardMsg()
        msg.ParseFromString(message)

        msg_type = msg.WhichOneof('type')
        if msg_type == 'new_report':
            assert not self._connection, 'Cannot send `new_report` twice.'
            report_id = msg.new_report
            self._connection = ProxyConnection(report_id, self._report_name)
            self._proxy.register_proxy_connection(self._connection)
        elif msg_type == 'delta_list':
            assert self._connection, 'No `delta_list` before `new_report`.'
            for delta in msg.delta_list.deltas:
                self._connection.enqueue(delta)
        else:
            raise RuntimeError(f'Cannot parse message type: {msg_type}')

    @Proxy.stop_proxy_on_exception
    def on_close(self):
        LOGGER.info(f'Local websocket closed for "{self._report_name}"')
        raise RuntimeError('This is a thing.')
    '''
        except concurrent.futures.CancelledError:
            pass

        # Deregister this connection and see if we can close the proxy.
        if connection:
            connection.finished_local_connection()
            self._try_to_deregister(connection)
        self._potentially_stop_proxy()
        return ws
    '''
