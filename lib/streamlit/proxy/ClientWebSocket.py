# Copyright 2018 Streamlit Inc. All rights reserved.

"""Websocket handler class which the local python library connects to."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import urllib
import sys

from tornado import gen
from tornado.ioloop import IOLoop
from tornado.websocket import WebSocketHandler

from streamlit import config
from streamlit import protobuf
from streamlit.logger import get_logger
from streamlit.proxy import Proxy, ProxyConnection
from streamlit.proxy import proxy_util

LOGGER = get_logger(__name__)


class ClientWebSocket(WebSocketHandler):
    """Websocket handler class which the local python library connects to."""

    def initialize(self, proxy):
        """Initialize self._proxy."""
        self._proxy = proxy

    def check_origin(self, origin):
        """Set up CORS."""
        return proxy_util.url_is_from_allowed_origins(origin)

    @Proxy.stop_proxy_on_exception()
    def open(self, report_name):
        """Handle connection to *local* instance of Streamlit.

        Parameters
        ----------
        report_name : str
            The name of the report.

        """
        # Parse out the control information.
        self._report_name = report_name
        self._report_name = urllib.parse.unquote_plus(self._report_name)
        self._connection = None
        LOGGER.debug('Client websocket opened for %s', self._report_name)

    @Proxy.stop_proxy_on_exception()
    def on_message(self, message):
        """Run callback for websocket messages."""
        # LOGGER.debug(repr(message))

        msg = protobuf.ForwardMsg()
        msg.ParseFromString(message)

        msg_type = msg.WhichOneof('type')
        if msg_type == 'new_report':
            assert not self._connection, 'Cannot send `new_report` twice.'
            self._init_connection(msg.new_report)

        elif msg_type == 'delta':
            assert self._connection, 'No `delta` before `new_report`.'
            self._connection.enqueue(msg.delta)
        else:
            raise RuntimeError('Cannot parse message type: %s' % msg_type)

    @Proxy.stop_proxy_on_exception(is_coroutine=True)
    @gen.coroutine
    def on_close(self):
        """Close callback."""
        LOGGER.debug('Client websocket closed for "%s"' % self._report_name)

        # Deregistering this connection and see if we can close the proxy.
        if self._connection:
            if config.get_option('proxy.liveSave'):
                yield self._save_final_report()

            self._connection.close_client_connection()
            self._proxy.schedule_potential_deregister_and_stop(
                self._connection)
        else:
            self._proxy.schedule_potential_stop()

    def _init_connection(self, new_report_proto):
        self._connection = ProxyConnection(
            new_report_proto, self._report_name)
        self._proxy.register_proxy_connection(self._connection)

        if config.get_option('proxy.liveSave'):
            IOLoop.current().spawn_callback(self._save_running_report)

    @gen.coroutine
    def _save_running_report(self):
        """Save the report stored in this connection."""
        LOGGER.debug(
            'Uploading running report... (id=%s)' % self._connection.id)

        files = self._connection.serialize_running_report_to_files()

        storage = self._proxy.get_storage()
        url = yield storage.save_report_files(self._connection.id, files)

        # Print URL to stderr so it appears in remote logs.
        LOGGER.info('SAVED RUNNING REPORT: %s' % url)

    @gen.coroutine
    def _save_final_report(self):
        """Save the report stored in this connection."""
        LOGGER.debug(
            'Uploading final report... (id=%s)' % self._connection.id)

        files = self._connection.serialize_final_report_to_files()
        storage = self._proxy.get_storage()
        url = yield storage.save_report_files(self._connection.id, files)

        # Print URL to stderr so it appears in remote logs.
        LOGGER.info('SAVED FINAL REPORT: %s' % url)
