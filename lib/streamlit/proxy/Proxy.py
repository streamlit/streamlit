# -*- coding: future_fstrings -*-

"""A proxy server between the Streamlit libs and web client.

Internally, the Proxy basically does bookkeeping for a set of ProxyConnection
objects. A ProxyConnection always has:

    - One "local" connection to the python libs.
    - Zero or more "client" connections to the web client.

Essentially, the ProxyConnection stays open so long as any of those connections
do. When the final ProxyConnection closes, then the whole proxy does too.

To ensure the proxy closes, a short timeout is launched for each connection
which closes the proxy if no connections were established.
"""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

from streamlit import config
from streamlit import protobuf
from streamlit.logger import get_logger
from streamlit.util import get_static_dir

from streamlit.streamlit_msg_proto import new_report_msg
# from streamlit.streamlit_msg_proto import streamlit_msg_iter
# from streamlit.proxy import ProxyConnection

from tornado import gen, web
from tornado import httpclient
from tornado.httpserver import HTTPServer
from tornado.ioloop import IOLoop
import functools
import os
import platform
import socket
import traceback
import urllib
import webbrowser

LOGGER = get_logger()
AWS_CHECK_IP = 'http://checkip.amazonaws.com'
HELP_DOC = 'http://streamlit.io/docs/help/'

# def set_remote(val):
#     config.set_option('proxy.isRemote', val)

def _print_remote_url(port, quoted_name):
    external_ip = config.get_option('proxy.externalIP')

    if external_ip:
        LOGGER.debug(f'proxy.externalIP set to {external_ip}')
    else:
        print('proxy.externalIP not set, attempting autodetect of external IP')

        http_client = None
        try:
            http_client = httpclient.HTTPClient()
            response = http_client.fetch(AWS_CHECK_IP, request_timeout=1)
            external_ip = response.body.strip()
        except (httpclient.HTTPError, RuntimeError) as e:
            LOGGER.error(f'Error connecting to {AWS_CHECK_IP}: {e}')
        finally:
            if http_client is not None:
                http_client.close()

    if external_ip is None:
        print('Did not auto detect external ip. Please go to '
              f'{HELP_DOC} for debugging hints.')
        return

    timeout_secs = config.get_option('proxy.waitForConnectionSecs')
    url = 'http://{}:{}/?name={}'.format(external_ip, port, quoted_name)
    print('Please connect to %s within %s seconds.' % (url, timeout_secs))

def _launch_web_client(name):
    """Launches a web browser to connect to the proxy to get the named
    report.

    Args
    ----
    name : string
        The name of the report to which the web browser should connect.
    """
    if config.get_option('proxy.useNode'):
        # If changing this, also change frontend/src/baseconsts.js
        host, port = 'localhost', '3000'
    else:
        host = config.get_option('proxy.server')
        port = config.get_option('proxy.port')
    quoted_name = urllib.parse.quote_plus(name)
    url = 'http://{}:{}/?name={}'.format(
        host, port, quoted_name)

    headless = config.get_option('proxy.isRemote')
    LOGGER.debug(f'headless = {headless}')
    if headless:
        _print_remote_url(port, quoted_name)
    else:
        if platform.system() == 'Linux' and not os.getenv('DISPLAY'):
            LOGGER.warning('Attempting to run Streamlit in a headless system. '\
                'Please consider setting proxy.isRemote to "true" in streamlit/config.yaml.')
        webbrowser.open(url)

def stop_proxy_on_exception(is_coroutine=False):
    """Decorates WebSocketHandler callbacks to stop the proxy on exception."""
    def stop_proxy_decorator(callback):
        if is_coroutine:
            @functools.wraps(callback)
            @gen.coroutine
            def wrapped_coroutine(web_socket_handler, *args, **kwargs):
                try:
                    LOGGER.debug(f'Running wrapped version of COROUTINE {callback}')
                    LOGGER.debug(f'About to yield {callback}')
                    rv = yield callback(web_socket_handler, *args, **kwargs)
                    LOGGER.debug(f'About to return {rv}')
                    raise gen.Return(rv)
                except gen.Return:
                    LOGGER.debug(f'Passing through COROUTINE return value:')
                    raise
                except Exception as e:
                    LOGGER.debug(f'Caught a COROUTINE exception: "{e}" ({type(e)})')
                    traceback.print_exc()
                    web_socket_handler._proxy.stop()
                    LOGGER.debug('Stopped the proxy.')
                    raise
            return wrapped_coroutine
        else:
            @functools.wraps(callback)
            def wrapped_callback(web_socket_handler, *args, **kwargs):
                try:
                    return callback(web_socket_handler, *args, **kwargs)
                    LOGGER.debug(f'Running wrapped version of {callback}')
                except Exception as e:
                    LOGGER.debug(f'Caught an exception: "{e}" ({type(e)})')
                    traceback.print_exc()
                    web_socket_handler._proxy.stop()
                    LOGGER.debug('Stopped the proxy.')
                    raise
            return wrapped_callback
        return functools.wraps(callback)(wrapped_callback)
    return stop_proxy_decorator

class Proxy(object):
    """The main base class for the streamlit server."""

    def __init__(self):
        """Proxy constructor."""
        # This table from names to ProxyConnections stores all the information
        # about our connections. When the number of connections drops to zero,
        # then the proxy shuts down.
        self._connections = dict()  # use instead of {} for 2/3 compatibility
        LOGGER.debug(f'Creating proxy with self._connections: {id(self._connections)}')

        # We have to import these in here to break a circular import reference
        # issue in Python 2.7.
        from streamlit.proxy import LocalWebSocket, ClientWebSocket

        # Set up HTTP routes
        routes = [
            # # Local connection to stream a new report.
            ('/new/(.*)/(.*)', LocalWebSocket, dict(proxy=self)),

            # Outgoing endpoint to get the latest report.
            ('/stream/(.*)', ClientWebSocket, dict(proxy=self)),
        ]
        if not config.get_option('proxy.useNode'):
            # If we're not using the node development server, then the proxy
            # will serve up the development pages.
            static_path = get_static_dir()
            LOGGER.info(f'Serving static content from {static_path}')

            routes.extend([
                (r"/()$", web.StaticFileHandler, {'path': f'{static_path}/index.html'}),
                (r"/(.*)", web.StaticFileHandler, {'path': f'{static_path}/'}),
            ])
        else:
            LOGGER.info('useNode == True, not serving static content from python.')
        self._app = web.Application(routes)

        # Attach an http server
        port = config.get_option('proxy.port')
        http_server = HTTPServer(self._app)
        http_server.listen(port)
        LOGGER.info('Proxy http server started on port {}'.format(port))

        # Remember whether we've seen any client connections so that we can
        # display a helpful warming message if the proxy closed without having
        # received any connections.
        self._received_client_connection = False

        # Avoids an exception by guarding against twice stopping the event loop.
        self._stopped = False

        # # This table from names to ProxyConnections stores all the information
        # # about our connections. When the number of connections drops to zero,
        # # then the proxy shuts down.
        # self._connections = dict()  # use instead of {} for 2/3 compatibility

        # Initialized things that the proxy will need to do cloud things.
        self._cloud = None  # S3Connection()

    def run_app(self):
        """Run web app."""
        '''
        port = config.get_option('proxy.port')
        web.run_app(self._app, port=port)
        '''
        LOGGER.debug('About to start the proxy.')
        IOLoop.current().start()
        LOGGER.debug('IOLoop closed.')

        # Give the user a helpful hint if no connection was received.
        headless = config.get_option('proxy.isRemote')
        if headless and not self._received_client_connection:
            print('Connection timeout to proxy.')
            print('Did you try to connect and nothing happened? '
                f'Please go to {HELP_DOC} for debugging hints.')

    def stop(self):
        """Stop proxy.

        Allowing all current handler to exit normally.
        """
        if not self._stopped:
            IOLoop.current().stop()
        self._stopped = True

    '''
    @_stop_proxy_on_exception
    async def _client_html_handler(self, request):
        static_root = config.get_path('proxy.staticRoot')
        return web.FileResponse(os.path.join(static_root, 'index.html'))
    '''

    def register_proxy_connection(self, connection):
        """Register this connection's name.

        So that client connections can connect to it.
        """
        LOGGER.debug(f'Regisering proxy connection for "{connection.name}"')
        LOGGER.debug(f'About to start registration: {list(self._connections.keys())} ({id(self._connections)})')

        # Register the connection and launch a web client if this is a new name.
        new_name = connection.name not in self._connections
        self._connections[connection.name] = connection
        if new_name:
            _launch_web_client(connection.name)
            # self._cloud.create(connection.name)

        # Clean up the connection we don't get an incoming connection.
        def connection_timeout():
            LOGGER.debug(f'In connection timeout for "{connection.name}".')
            connection.end_grace_period()
            self.try_to_deregister_proxy_connection(connection)
            self.potentially_stop()
        timeout_secs = config.get_option('proxy.waitForConnectionSecs')
        loop = IOLoop.current()
        loop.call_later(timeout_secs, connection_timeout)
        LOGGER.debug(f'Added connection timeout for {timeout_secs} secs.')
        LOGGER.debug(f'Finished resistering connection: {list(self._connections.keys())} ({id(self._connections)})')

    def try_to_deregister_proxy_connection(self, connection):
        """Try to deregister proxy connection.

        Deregister this ProxyConnection so long as there aren't any open
        connection (local or client), and the connection is no longer in its
        grace period.
        """
        if not self.proxy_connection_is_registered(connection):
            return
        if connection.can_be_deregistered():
            del self._connections[connection.name]
            LOGGER.debug('Got rid of connection "%s".' % connection.name)

    def proxy_connection_is_registered(self, connection):
        """Return true if this connection is registered to its name."""
        return self._connections.get(connection.name, None) is connection

    def potentially_stop(self):
        """Stop proxy if no open connections."""
        LOGGER.debug('Stopping if there are no more connections: ' +
            str(list(self._connections.keys())))
        if not self._connections:
            self.stop()

    @gen.coroutine
    def add_client(self, report_name, ws):
        """Adds a queue to the connection for the given report_name."""
        self._received_client_connection = True
        connection = self._connections[report_name]
        queue = connection.add_client_queue()
        yield new_report_msg(connection.id,
            connection.cwd, connection.command_line, ws)
        LOGGER.debug('Added new client. Id: ' + connection.id)
        LOGGER.debug('Added new client. Command line: ' + \
            str(connection.command_line))
        raise gen.Return((connection, queue))

    def remove_client(self, connection, queue):
        """Remove queue from connection and close connection if necessary."""
        connection.remove_client_queue(queue)
        self.try_to_deregister_proxy_connection(connection)
        self.potentially_stop()
